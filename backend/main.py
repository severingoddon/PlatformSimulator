import csv
import json
import os
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models import BlockSurveySubmission, EngagementEvent, PostData, PostsResponse

try:
    import fcntl  # Linux / macOS (the Docker container is Linux)
except ImportError:  # Windows local development: no single-instance guard
    fcntl = None

PROFILE_NAMES = [
    "alpen_marco", "zueri_lisa", "berg_wanderer", "swiss_adventures",
    "lena_bern", "nordic_hiker", "sunrise_yogi", "urban_felix",
    "mountain_eagle", "stadt_leben", "wanderlust_anna", "see_liebe",
    "winter_sport", "chalet_dreams", "gruen_planet", "foto_kunst",
    "reise_tagebuch", "morgen_licht", "natur_freund", "alpen_glow",
    "lago_vita", "stern_nacht", "blumen_feld", "schnee_fuchs",
    "wald_geist", "fluss_ufer", "himmel_blau", "stein_adler",
    "wind_surfer", "sonnen_kind", "herbst_gold", "fruehling_zeit",
    "nebel_see", "gipfel_sturm", "tal_wanderer", "kristall_klar",
    "polar_licht", "wellen_reiter", "feuer_vogel", "mond_schein",
    "silber_bach", "golden_hour", "wild_blume", "echo_berg",
    "licht_spiel", "traum_faenger", "horizont_jagt", "sand_kueste",
    "nord_stern", "tief_blick",
]

# engagement.csv is an event log: one row per click (like, unlike, follow, ...).
ENGAGEMENT_COLUMNS = [
    "timestamp", "pid", "blockNumber", "postId", "postPosition", "action", "eventId",
]

LOCALIZATION_COLUMNS = [
    "timestamp", "pid", "blockNumber", "theme",
    "post1", "post2", "post3", "post4", "post5", "submissionId",
]

# Where participants are sent after the last block, e.g. a follow-up Qualtrics survey.
# "?pid=<id>" is appended automatically. Empty = show the built-in thank-you page.
RETURN_URL = os.environ.get("RETURN_URL", "").strip()

# Language of all participant-facing texts: loads backend/texts/<LANGUAGE>.json
LANGUAGE = os.environ.get("LANGUAGE", "en").strip() or "en"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ENGAGEMENT_CSV = DATA_DIR / "engagement.csv"
RECOGNITION_CSV = DATA_DIR / "theme_recognition.csv"
LOCALIZATION_CSV = DATA_DIR / "theme_localization.csv"
CONFIG_PATH = BASE_DIR / "block_config.json"
TEXTS_DIR = BASE_DIR / "texts"
REFERENCE_TEXTS = TEXTS_DIR / "en.json"
POST_IMAGES_DIR = BASE_DIR.parent / "postImages"
FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist" / "frontend" / "browser"

# All CSV writes go through this lock, one row at a time. Together with the
# single-instance guard below this guarantees that rows never get mixed up,
# no matter how many participants send data at the same time.
csv_lock = threading.Lock()
# IDs of events / survey submissions already written (to ignore retried duplicates)
seen_ids: set[str] = set()
instance_lock_file = None

block_config: list[list[dict]] = []
post_ids: set[str] = set()
theme_keys: list[str] = []
recognition_columns: list[str] = []
texts: dict = {}


class ConfigError(Exception):
    pass


def missing_keys(reference, actual, prefix="") -> list[str]:
    """Keys present in the English reference file but missing in another language file."""
    if not isinstance(reference, dict):
        return []
    if not isinstance(actual, dict):
        return [prefix.rstrip(".") or "(root)"]
    result = []
    for key, value in reference.items():
        if key not in actual:
            result.append(prefix + key)
        else:
            result += missing_keys(value, actual[key], prefix + key + ".")
    return result


def load_texts():
    global texts
    path = TEXTS_DIR / f"{LANGUAGE}.json"
    if not path.exists():
        available = ", ".join(sorted(f.stem for f in TEXTS_DIR.glob("*.json")))
        raise ConfigError(f"LANGUAGE={LANGUAGE!r}: file {path.name} not found in texts/. Available: {available}")
    try:
        with open(path, encoding="utf-8") as f:
            texts = json.load(f)
    except json.JSONDecodeError as e:
        raise ConfigError(f"{path.name} is not valid JSON (line {e.lineno}, column {e.colno}): {e.msg}")

    with open(REFERENCE_TEXTS, encoding="utf-8") as f:
        missing = missing_keys(json.load(f), texts)
    missing_themes = [k for k in theme_keys if k not in texts.get("themes", {})]
    missing += [f"themes.{k}" for k in missing_themes if f"themes.{k}" not in missing]
    if missing:
        raise ConfigError(f"{path.name} is missing these texts: {', '.join(missing)}")


def load_block_config():
    global block_config, post_ids, theme_keys, recognition_columns
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    block_config = [block["posts"] for block in data["blocks"]]
    post_ids = {Path(post["filename"]).stem for block in block_config for post in block}
    theme_keys = data["themes"]
    recognition_columns = ["timestamp", "pid", "blockNumber", *theme_keys, "submissionId"]
    for number, block in enumerate(block_config, start=1):
        if len(block) != 5:
            raise ConfigError(f"block_config.json: block {number} has {len(block)} posts, every block needs exactly 5")
        for post in block:
            if not (POST_IMAGES_DIR / post["filename"]).is_file():
                raise ConfigError(f"block_config.json: image {post['filename']} not found in postImages/")


def archive_if_columns_changed(path: Path, columns: list[str]):
    """If an existing CSV has different columns (older version, changed themes),
    rename it instead of mixing incompatible rows into one file."""
    if not path.exists() or path.stat().st_size == 0:
        return
    with open(path, newline="", encoding="utf-8") as f:
        header = next(csv.reader(f), [])
    if header != columns:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        archived = path.with_name(f"{path.stem}.archived-{stamp}{path.suffix}")
        path.rename(archived)
        print(f"Columns of {path.name} changed - old file kept as {archived.name}")


def acquire_instance_lock():
    """Only one server process may write the CSV files. A second one (e.g. a second
    container on the same data folder) would mix up rows, so it refuses to start."""
    global instance_lock_file
    if fcntl is None:
        return
    instance_lock_file = open(DATA_DIR / ".writer.lock", "w")
    try:
        fcntl.flock(instance_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit("\nERROR: another instance of the tool is already writing to the data/ folder. "
                 "Run only one instance (docker compose up starts exactly one).\n")


def load_seen_ids():
    """Remember event / submission IDs already on disk, so retried requests are not written twice."""
    for path, column in [(ENGAGEMENT_CSV, "eventId"), (RECOGNITION_CSV, "submissionId")]:
        if path.exists():
            with open(path, newline="", encoding="utf-8") as f:
                seen_ids.update(row[column] for row in csv.DictReader(f) if row.get(column))


def append_rows(path: Path, columns: list[str], rows: list[dict]):
    """Append rows to a CSV file and force them onto the disk.
    Must be called while holding csv_lock. Files are only ever appended to, never
    rewritten, so a crash can at most lose the row being written at that moment."""
    write_header = not path.exists() or path.stat().st_size == 0
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        if write_header:
            writer.writeheader()
        writer.writerows(rows)
        f.flush()
        os.fsync(f.fileno())


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def tf(value: bool) -> str:
    """Write booleans as TRUE / FALSE: read.csv in R, pandas and Excel all recognize this."""
    return "TRUE" if value else "FALSE"


# Everything below runs once before the server starts, so problems show up as a clear message.
try:
    load_block_config()
    load_texts()
except ConfigError as e:
    sys.exit(f"\nCONFIGURATION ERROR: {e}\n")

DATA_DIR.mkdir(parents=True, exist_ok=True)
acquire_instance_lock()
archive_if_columns_changed(ENGAGEMENT_CSV, ENGAGEMENT_COLUMNS)
archive_if_columns_changed(RECOGNITION_CSV, recognition_columns)
archive_if_columns_changed(LOCALIZATION_CSV, LOCALIZATION_COLUMNS)
load_seen_ids()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.middleware("http")
async def cache_headers(request: Request, call_next):
    """Let browsers cache images and app files, so they are downloaded only once."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/images/"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    elif path.endswith((".js", ".css")):
        # Angular puts a content hash into these file names, so they never change
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        response.headers["Cache-Control"] = "no-cache"
    return response


app.mount("/images", StaticFiles(directory=str(POST_IMAGES_DIR)), name="images")


@app.get("/api/config")
async def get_config():
    themes = [{"key": key, "label": texts["themes"][key]} for key in theme_keys]
    return {"themes": themes, "returnUrl": RETURN_URL, "texts": texts}


@app.get("/api/posts", response_model=PostsResponse)
async def get_posts():
    posts = []
    profile_idx = 0
    for block_num, block_posts in enumerate(block_config, start=1):
        for pos, post_cfg in enumerate(block_posts, start=1):
            filename = post_cfg["filename"]
            post_id = Path(filename).stem
            posts.append(PostData(
                postId=post_id,
                profileName=PROFILE_NAMES[profile_idx % len(PROFILE_NAMES)],
                imageUrl=f"/images/{filename}",
                blockNumber=block_num,
                postPosition=pos,
            ))
            profile_idx += 1
    return PostsResponse(posts=posts)


# Note: write endpoints are plain "def" (not "async def"), so FastAPI runs them in a
# worker thread and a disk write never blocks the other participants' requests.

@app.post("/api/engagement")
def submit_engagement(event: EngagementEvent):
    if event.postId not in post_ids:
        raise HTTPException(422, "unknown postId")
    row = {
        "timestamp": now_utc(),
        "pid": event.pid,
        "blockNumber": event.blockNumber,
        "postId": event.postId,
        "postPosition": event.postPosition,
        "action": event.action,
        "eventId": event.eventId,
    }
    with csv_lock:
        if event.eventId not in seen_ids:
            append_rows(ENGAGEMENT_CSV, ENGAGEMENT_COLUMNS, [row])
            seen_ids.add(event.eventId)
    return {"success": True}


@app.post("/api/block-survey")
def submit_block_survey(survey: BlockSurveySubmission):
    unknown = [loc.theme for loc in survey.localizations if loc.theme not in theme_keys]
    if unknown:
        raise HTTPException(422, f"unknown theme: {unknown[0]}")
    now = now_utc()
    recognition_row = {
        "timestamp": now,
        "pid": survey.pid,
        "blockNumber": survey.blockNumber,
        **{key: tf(survey.themes.get(key, False)) for key in theme_keys},
        "submissionId": survey.submissionId,
    }
    localization_rows = [{
        "timestamp": now,
        "pid": survey.pid,
        "blockNumber": survey.blockNumber,
        "theme": loc.theme,
        "post1": tf(loc.post1),
        "post2": tf(loc.post2),
        "post3": tf(loc.post3),
        "post4": tf(loc.post4),
        "post5": tf(loc.post5),
        "submissionId": survey.submissionId,
    } for loc in survey.localizations]

    with csv_lock:
        if survey.submissionId not in seen_ids:
            append_rows(RECOGNITION_CSV, recognition_columns, [recognition_row])
            if localization_rows:
                append_rows(LOCALIZATION_CSV, LOCALIZATION_COLUMNS, localization_rows)
            seen_ids.add(survey.submissionId)
    return {"success": True}


if FRONTEND_DIR.exists():
    FRONTEND_ROOT = FRONTEND_DIR.resolve()

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = (FRONTEND_ROOT / path).resolve()
        # Only serve files inside the frontend folder (blocks "../" tricks)
        if file_path.is_relative_to(FRONTEND_ROOT) and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_ROOT / "index.html")


if __name__ == "__main__":
    # Exactly one process on purpose: all CSV writes are serialized in this process.
    # One process easily handles hundreds of simultaneous participants.
    uvicorn.run(app, host="0.0.0.0", port=3005, workers=1)

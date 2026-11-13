import csv
import json
import os
import sys
import threading
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models import BlockSurveySubmission, PostData, PostFeedback, PostsResponse

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

ENGAGEMENT_COLUMNS = [
    "timestamp", "pid", "blockNumber", "postId", "postPosition",
    "liked", "followed", "saved", "shared",
]

LOCALIZATION_COLUMNS = [
    "timestamp", "pid", "blockNumber", "theme",
    "post1", "post2", "post3", "post4", "post5",
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

csv_lock = threading.Lock()
block_config: list[list[dict]] = []
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
engagement_store: dict[tuple[str, str], dict] = {}


def load_block_config():
    global block_config, theme_keys, recognition_columns
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    block_config = [block["posts"] for block in data["blocks"]]
    theme_keys = data["themes"]
    recognition_columns = ["timestamp", "pid", "blockNumber", *theme_keys]


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


def load_engagement_csv():
    if not ENGAGEMENT_CSV.exists():
        return
    with open(ENGAGEMENT_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["pid"], row["postId"])
            engagement_store[key] = row


def write_engagement_csv():
    with open(ENGAGEMENT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ENGAGEMENT_COLUMNS)
        writer.writeheader()
        for row in engagement_store.values():
            writer.writerow(row)


def append_csv(path: Path, columns: list[str], row: dict):
    with csv_lock:
        write_header = not path.exists() or path.stat().st_size == 0
        with open(path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            if write_header:
                writer.writeheader()
            writer.writerow(row)


# Load configuration before the server starts, so mistakes show up as a clear message.
try:
    load_block_config()
    load_texts()
except ConfigError as e:
    sys.exit(f"\nCONFIGURATION ERROR: {e}\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    archive_if_columns_changed(ENGAGEMENT_CSV, ENGAGEMENT_COLUMNS)
    archive_if_columns_changed(RECOGNITION_CSV, recognition_columns)
    archive_if_columns_changed(LOCALIZATION_CSV, LOCALIZATION_COLUMNS)
    load_engagement_csv()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.post("/api/feedback")
async def submit_feedback(feedback: PostFeedback):
    key = (feedback.pid, feedback.postId)
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": feedback.pid,
        "blockNumber": str(feedback.blockNumber),
        "postId": feedback.postId,
        "postPosition": str(feedback.postPosition),
        "liked": str(feedback.liked).lower(),
        "followed": str(feedback.followed).lower(),
        "saved": str(feedback.saved).lower(),
        "shared": str(feedback.shared).lower(),
    }
    with csv_lock:
        engagement_store[key] = row
        write_engagement_csv()
    return {"success": True}


@app.post("/api/block-survey")
async def submit_block_survey(survey: BlockSurveySubmission):
    now = datetime.now(timezone.utc).isoformat()
    recognition_row = {
        "timestamp": now,
        "pid": survey.pid,
        "blockNumber": str(survey.blockNumber),
        **{key: str(survey.themes.get(key, False)).lower() for key in theme_keys},
    }
    append_csv(RECOGNITION_CSV, recognition_columns, recognition_row)

    for loc in survey.localizations:
        loc_row = {
            "timestamp": now,
            "pid": survey.pid,
            "blockNumber": str(survey.blockNumber),
            "theme": loc.theme,
            "post1": str(loc.post1).lower(),
            "post2": str(loc.post2).lower(),
            "post3": str(loc.post3).lower(),
            "post4": str(loc.post4).lower(),
            "post5": str(loc.post5).lower(),
        }
        append_csv(LOCALIZATION_CSV, LOCALIZATION_COLUMNS, loc_row)

    return {"success": True}


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend-assets")

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = FRONTEND_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3005)

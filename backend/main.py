import csv
import json
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
    "timestamp", "userEmailHash", "blockNumber", "postId", "postPosition",
    "liked", "followed", "saved", "shared",
    "alter", "religionsangehoerigkeit", "bildungsabschluss", "herkunft",
    "politischeEinstellung",
]

LOCALIZATION_COLUMNS = [
    "timestamp", "userEmailHash", "blockNumber", "theme",
    "post1", "post2", "post3", "post4", "post5",
    "alter", "religionsangehoerigkeit", "bildungsabschluss", "herkunft",
    "politischeEinstellung",
]

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ENGAGEMENT_CSV = DATA_DIR / "engagement.csv"
RECOGNITION_CSV = DATA_DIR / "theme_recognition.csv"
LOCALIZATION_CSV = DATA_DIR / "theme_localization.csv"
CONFIG_PATH = BASE_DIR / "block_config.json"
POST_IMAGES_DIR = BASE_DIR.parent / "postImages"
FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist" / "frontend" / "browser"

csv_lock = threading.Lock()
block_config: list[list[dict]] = []
theme_keys: list[str] = []
theme_list: list[dict] = []
recognition_columns: list[str] = []
engagement_store: dict[tuple[str, str], dict] = {}


def load_block_config():
    global block_config, theme_keys, theme_list, recognition_columns
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    block_config = [block["posts"] for block in data["blocks"]]
    theme_list = data["themes"]
    theme_keys = [t["key"] for t in theme_list]
    recognition_columns = [
        "timestamp", "userEmailHash", "blockNumber",
        *theme_keys,
        "alter", "religionsangehoerigkeit", "bildungsabschluss", "herkunft",
        "politischeEinstellung",
    ]


def load_engagement_csv():
    if not ENGAGEMENT_CSV.exists():
        return
    with open(ENGAGEMENT_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["userEmailHash"], row["postId"])
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_block_config()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
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
    return {"themes": theme_list}


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
    key = (feedback.userEmailHash, feedback.postId)
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "userEmailHash": feedback.userEmailHash,
        "blockNumber": str(feedback.blockNumber),
        "postId": feedback.postId,
        "postPosition": str(feedback.postPosition),
        "liked": str(feedback.liked).lower(),
        "followed": str(feedback.followed).lower(),
        "saved": str(feedback.saved).lower(),
        "shared": str(feedback.shared).lower(),
        "alter": str(feedback.alter),
        "religionsangehoerigkeit": feedback.religionsangehoerigkeit,
        "bildungsabschluss": feedback.bildungsabschluss,
        "herkunft": feedback.herkunft,
        "politischeEinstellung": str(feedback.politischeEinstellung),
    }
    with csv_lock:
        engagement_store[key] = row
        write_engagement_csv()
    return {"success": True}


@app.post("/api/block-survey")
async def submit_block_survey(survey: BlockSurveySubmission):
    now = datetime.now(timezone.utc).isoformat()
    demo = {
        "alter": str(survey.alter),
        "religionsangehoerigkeit": survey.religionsangehoerigkeit,
        "bildungsabschluss": survey.bildungsabschluss,
        "herkunft": survey.herkunft,
        "politischeEinstellung": str(survey.politischeEinstellung),
    }

    recognition_row = {
        "timestamp": now,
        "userEmailHash": survey.userEmailHash,
        "blockNumber": str(survey.blockNumber),
        **{key: str(survey.themes.get(key, False)).lower() for key in theme_keys},
        **demo,
    }
    append_csv(RECOGNITION_CSV, recognition_columns, recognition_row)

    for loc in survey.localizations:
        loc_row = {
            "timestamp": now,
            "userEmailHash": survey.userEmailHash,
            "blockNumber": str(survey.blockNumber),
            "theme": loc.theme,
            "post1": str(loc.post1).lower(),
            "post2": str(loc.post2).lower(),
            "post3": str(loc.post3).lower(),
            "post4": str(loc.post4).lower(),
            "post5": str(loc.post5).lower(),
            **demo,
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

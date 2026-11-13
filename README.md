# PlatformSimulator

A simulated Instagram-style feed for research studies. Participants scroll through 50 posts (10 blocks of 5), can like / follow / save / share them, and answer a short question after each block.

The tool is designed to be used **together with a survey tool such as Qualtrics**: participants start in Qualtrics, are sent to this tool via a link, and are sent back to Qualtrics at the end. Demographics and consent are collected in Qualtrics, not here. This tool only records what participants do in the feed, linked to their Qualtrics ID.

## Setup

**Requirement:** a server with [Docker](https://docs.docker.com/get-docker/) (including Docker Compose).

**1. Start the tool**

```bash
git clone <repository-url> PlatformSimulator
cd PlatformSimulator
docker compose up -d --build
```

The tool is now running at `http://<your-server>:3005`.

**2. Set the return link** (where participants go when they are done)

Open `docker-compose.yml` and enter the link of your follow-up Qualtrics survey:

```yaml
RETURN_URL: "https://stanford.qualtrics.com/jfe/form/SV_xxxxxxxxxxxx"
```

Then apply the change:

```bash
docker compose up -d
```

The language of the tool is set in the same file (`LANGUAGE: "en"`, English by default; see [Texts and language](#texts-and-language)).

**3. Get the results**

All results are written as CSV files to the `data/` folder next to `docker-compose.yml`. You can copy them from there at any time, even while the tool is running.

**Stop the tool:**

```bash
docker compose down
```

Stopping, restarting or updating the tool does **not** delete anything in `data/`.

**After editing texts** (`backend/texts/*.json`):

```bash
docker compose restart
```

**After editing `docker-compose.yml`:**

```bash
docker compose up -d
```

**After changes to the code, images or `block_config.json`:**

```bash
git pull
docker compose up -d --build
```

### Before going live

- The tool serves plain HTTP on port 3005. Participants should reach it via **HTTPS** (e.g. `https://feed.your-lab.stanford.edu`). Ask your IT to put it behind their HTTPS reverse proxy / web server and forward to port 3005.
- The tool restarts automatically after a crash or server reboot.
- Back up the `data/` folder regularly. It contains all results.
- Do one complete test run yourself (Qualtrics → tool → back to Qualtrics) and check that your ID shows up in all CSV files and in Qualtrics.

## Connecting Qualtrics

Participants are identified by a **participant ID (`pid`)** that Qualtrics puts into the link. This ID is stored in every row of the CSV files, so afterwards you can match the feed data to the Qualtrics answers.

```
Qualtrics survey 1            This tool                    Qualtrics survey 2
(consent, demographics)  →    (feed + block questions)  →  (follow-up, debriefing)
      sends pid ─────────────→ stores pid ────────────────→ receives pid
```

### Step 1: Link from Qualtrics to the tool

At the end of your first Qualtrics survey, send participants to the tool with this link (replace the host with your own):

```
https://<your-server>/?pid=${e://Field/ResponseID}
```

`${e://Field/ResponseID}` is a Qualtrics placeholder. Qualtrics replaces it automatically with each participant's unique Response ID (e.g. `R_3kT9xZp2LmQ8vWd`).

Easiest way: **Survey flow → End of Survey element → Customize → "Redirect to a URL"** and paste the link above. Alternatively, put it as a link into the last question text.

> Recruiting via Prolific? You can use `?pid={{%PROLIFIC_PID%}}` in the Prolific study link instead. Any ID made of letters, digits, `_` and `-` works.

If someone opens the tool **without** a `pid`, they see an "invalid link" message and no data is recorded.

### Step 2: Link from the tool back to Qualtrics

When participants finish the last block, the tool automatically sends them to `RETURN_URL` (see Setup step 2) and adds their ID:

```
https://stanford.qualtrics.com/jfe/form/SV_xxxxxxxxxxxx?pid=R_3kT9xZp2LmQ8vWd
```

To store this ID in your second Qualtrics survey: **Survey flow → Add a New Element Here → Embedded Data**, create a field named exactly `pid`, and move this element to the **top** of the survey flow. Qualtrics then saves the ID from the link with each response.

If `RETURN_URL` is left empty, participants see a simple thank-you page instead.

### Step 3: Combine the data

After data collection you have:

- the Qualtrics export (column `ResponseID` from survey 1, column `pid` from survey 2)
- the CSV files from this tool (column `pid`)

Match them on this ID. Example in R:

```r
qualtrics  <- read.csv("qualtrics_export.csv")
engagement <- read.csv("data/engagement.csv")
combined   <- merge(qualtrics, engagement, by.x = "ResponseID", by.y = "pid")
```

## Output data

Three CSV files in `data/`. Every row contains the participant ID (`pid`) and a UTC timestamp.

| File | One row per … | Columns |
|------|---------------|---------|
| `engagement.csv` | participant × post they interacted with | `blockNumber`, `postId`, `postPosition` (1–5 within the block), `liked`, `followed`, `saved`, `shared` (true/false, final state) |
| `theme_recognition.csv` | participant × block | one true/false column per theme: did the participant notice this theme in the block? |
| `theme_localization.csv` | participant × block × theme | `theme`, `post1` … `post5`: in which of the 5 posts did the participant see this theme? |

Posts a participant did not interact with at all do not appear in `engagement.csv` (= nothing liked/followed/saved/shared).

If you change the themes in `block_config.json` after data has already been recorded, the old CSV file is kept as `<name>.archived-<date>.csv` and a new file is started, so columns never get mixed.

## Study flow (inside the tool)

1. The participant arrives via the link from Qualtrics.
2. The feed shows 5 posts per block with Instagram-style buttons (like, follow, save, share).
3. After each block: which themes did you notice? → in which posts?
4. After block 10: automatic redirect back to Qualtrics.

Note: if a participant reloads the page in the middle, the feed starts again at block 1 (with the same `pid`). Their block answers may then appear twice in the CSV files; use the latest timestamp per `pid` and block.

## Texts and language

Every text participants see (buttons, questions, theme names, messages) is in **one file per language** in `backend/texts/`:

| File | Language |
|------|----------|
| `en.json` | English (default) |
| `de.json` | German |

**Change a wording:** open the file of the language you use (e.g. `backend/texts/en.json`), change the text between the quotes, save, and run `docker compose restart`. Example:

```json
"recognitionTitle": "Which topics did you notice in the last {count} posts?",
```

Rules:

- Only change the text on the **right** side of the colon. The names on the left (e.g. `"recognitionTitle"`) must stay as they are.
- Words in curly braces like `{count}`, `{block}`, `{total}`, `{number}`, `{name}` are filled in automatically by the tool. Keep them in the text (you can move them around).
- The theme names shown in the questions are under `"themes"`.

**Switch the language:** set `LANGUAGE` in `docker-compose.yml` to the file name without `.json` (e.g. `"de"`), then run `docker compose up -d`.

**Add a language:** copy `en.json` to e.g. `es.json`, translate all texts on the right side, set `LANGUAGE: "es"`, and run `docker compose up -d`.

If a text file has a mistake (missing text, missing comma or quote), the tool does not start and shows a message telling you what is wrong. See it with:

```bash
docker compose logs
```

## Configuration

The study content is controlled by `backend/block_config.json`:

- **themes** – the theme keys offered in the questions after each block. The questions and the CSV columns adapt automatically. Each theme also needs a display name under `"themes"` in every text file (see above).
- **blocks** – 10 blocks with 5 posts each. Per post: file name, type (`explicit_religion`, `spiritual_implicit`, `filler`, `thematic_control`) and ground-truth themes.

Post images are stored in `postImages/`.

After changing `block_config.json` or images, rebuild with `docker compose up -d --build`.

## Local development (without Docker)

Backend (Python 3.12+), runs on `http://localhost:3005`:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Frontend (Node 22+), runs on `http://localhost:4200` and forwards API calls to the backend:

```bash
cd frontend
npm install
npx ng serve --proxy-config proxy.conf.json
```

Open `http://localhost:4200/?pid=test123`. CSV files are written to `backend/data/`. To test the return link locally, start the backend with `RETURN_URL="https://example.com" python main.py`.

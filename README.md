# PlatformSimulator

A simulated Instagram-style feed for research studies. Participants scroll through 15 posts (3 blocks of 5), can like / follow / save / share them, and answer a short question after each block.

The tool is designed to be used **together with a survey tool such as Qualtrics**: somewhere in the Qualtrics survey, participants open this tool via a link, do the feed, and then continue the survey. Demographics and consent are collected in Qualtrics, not here. This tool only records what participants do in the feed, linked to their Qualtrics ID.

## Setup

**Requirement:** a server with [Docker](https://docs.docker.com/get-docker/) (including Docker Compose).

**1. Start the tool**

```bash
git clone https://github.com/severingoddon/PlatformSimulator.git
cd PlatformSimulator
docker compose up -d --build
```

The tool is now running at `http://<your-server>:3005`.

**2. Connect your Qualtrics survey**

See [Connecting Qualtrics](#connecting-qualtrics) below (about 10 minutes in Qualtrics, nothing to change in this tool).

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
- Run exactly **one** instance of the tool (`docker compose up` does that). One instance easily handles 100+ participants at the same time (tested); a second instance on the same `data/` folder refuses to start, because two writers would mix up the CSV files.
- Change the completion code if you like (see [Connecting Qualtrics](#connecting-qualtrics), step 2).
- Do one complete test run yourself (Qualtrics → tool → back to Qualtrics) and check that your Response ID shows up in all CSV files.

## Connecting Qualtrics

Participants are identified by a **participant ID (`pid`)** that Qualtrics puts into the link to this tool. The tool stores this ID in every row of its CSV files, so afterwards you can match the feed data to the Qualtrics answers.

How it works for participants:

```
Qualtrics survey (tab 1)                 This tool (tab 2)
─────────────────────────                ─────────────────
consent, demographics, …
page with link + code field  ── link ──→  feed + questions (3 blocks)
                                          end page shows a code
enter code, continue  ←── go back to tab 1 ──┘
rest of the survey
```

### Step 1: Add the link to the tool

In your Qualtrics survey, at the point where participants should do the feed, add a **Text / Graphic** question with an instruction and the link. To make the link open in a **new tab**, edit the question text in the **HTML View** and paste:

```html
<p>Please click the link below. It opens in a new tab. When you are done, come back to this tab and enter the code you were shown.</p>
<p><a href="https://<your-server>/?pid=${e://Field/ResponseID}" target="_blank">Open the feed</a></p>
```

Replace `<your-server>` with the address of the tool. Leave `${e://Field/ResponseID}` exactly as it is: Qualtrics replaces it automatically with each participant's unique Response ID (e.g. `R_3kT9xZp2LmQ8vWd`).

If someone opens the tool **without** a `pid` (e.g. by typing the address by hand), they see an "invalid link" message and no data is recorded.

### Step 2: Add the code question

On the **same page**, below the link, add a **Text Entry** question, e.g. "Please enter the code from the end of the feed:".

Then: **Validation → Custom validation**, condition **"[this question] Is Equal to 73914"**, and an error message such as "This code is not correct. Please complete the feed first." Participants can only continue once they enter the correct code.

The code is shown on the tool's end page. The default is `73914`. To change it, edit the `"thankYou"` → `"message"` text in `backend/texts/en.json` (see [Texts and language](#texts-and-language)), run `docker compose restart`, and use the same code in the Qualtrics validation. Numbers work best (no confusion about upper/lower case).

The code is the same for everybody, so it only serves as a reminder and a simple gate. The reliable check is step 3.

### Step 3: Combine the data and check completion

After data collection you have:

- the Qualtrics export (column `ResponseID`)
- the CSV files from this tool (column `pid`, which contains the same Response ID)

**Check who really completed the feed:** a participant completed it if `theme_recognition.csv` contains the last block (currently block 3) for their ID. Exclude everyone else (e.g. someone who got the code from another participant). Example in R:

```r
qualtrics   <- read.csv("qualtrics_export.csv")
recognition <- read.csv("data/theme_recognition.csv")

# Response IDs that finished all blocks of the feed
n_blocks  <- 3
completed <- unique(recognition$pid[recognition$blockNumber == n_blocks])
qualtrics$feed_completed <- qualtrics$ResponseID %in% completed

# Combine Qualtrics answers with the answers after each block
combined <- merge(qualtrics, recognition, by.x = "ResponseID", by.y = "pid")
```

To get the final like / follow / save / share state per post from `engagement.csv`, see [Output data](#output-data).

### Alternative setup: automatic return

Instead of a second tab and a code, the tool can send participants back automatically: set `RETURN_URL` in `docker-compose.yml` to your survey link and run `docker compose up -d`. At the end of the feed, participants are redirected there, with `?pid=<their ID>` added.

For this to continue the **same** response, enable **Survey options → "Allow respondents to finish later"** in Qualtrics. Qualtrics then uses a browser cookie to resume where the participant left. This fails if participants use private browsing, block cookies or switch devices. They then start the survey from the beginning. The recommended setup above does not have this problem.

## Output data

Three CSV files in `data/`. Every row contains the participant ID (`pid`) and a UTC timestamp.

| File | One row per … | Columns |
|------|---------------|---------|
| `engagement.csv` | click on a post (event log) | `blockNumber`, `postId`, `postPosition` (1–5 within the block), `action`: `like`, `unlike`, `follow`, `unfollow`, `save`, `unsave`, `share`, `unshare` |
| `theme_recognition.csv` | participant × block | one true/false column per theme: did the participant notice this theme in the block? |
| `theme_localization.csv` | participant × block × theme | `theme`, `post1` … `post5`: in which of the 5 posts did the participant see this theme? |

The columns `eventId` / `submissionId` are technical IDs (used to make sure nothing is stored twice if a participant's connection drops). You can ignore them.

**`engagement.csv` is a log of every click**, in the order they happened. If someone likes a post and then unlikes it, there are two rows. This keeps the full sequence and timing. To get the **final state** per participant and post (liked yes/no, followed yes/no, …), use this in R:

```r
engagement <- read.csv("data/engagement.csv")
engagement <- engagement[order(engagement$timestamp), ]
engagement$type  <- sub("^un", "", engagement$action)       # "unlike" -> "like"
engagement$value <- !startsWith(engagement$action, "un")    # like = TRUE, unlike = FALSE

# keep the last click per participant, post and type
last  <- engagement[!duplicated(engagement[c("pid", "postId", "type")], fromLast = TRUE), ]
final <- reshape(last[c("pid", "postId", "type", "value")],
                 idvar = c("pid", "postId"), timevar = "type", direction = "wide")
final[is.na(final)] <- FALSE   # e.g. liked but never saved -> saved = FALSE
# columns: pid, postId, value.like, value.follow, value.save, value.share
# (a column only appears if at least one participant used that button)
```

Posts a participant never clicked on do not appear in `engagement.csv` (= nothing liked / followed / saved / shared).

If you change the themes in `block_config.json` after data has already been recorded, the old CSV file is kept as `<name>.archived-<date>.csv` and a new file is started, so columns never get mixed.

## Study flow (inside the tool)

1. The participant arrives via the link from Qualtrics.
2. The feed shows 5 posts per block with Instagram-style buttons (like, follow, save, share).
3. After each block: which themes did you notice? → in which posts?
4. After the last block: end page with the completion code (or automatic redirect, if `RETURN_URL` is set).

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
- **blocks** – currently 3 blocks. Each block needs **exactly 5 posts**. Add or remove whole blocks to change the length of the feed. Per post: file name, type (`explicit_religion`, `spiritual_implicit`, `filler`, `thematic_control`) and ground-truth themes.

Post images are stored in `postImages/` (50 images are available, the config uses 15 of them). Use JPEG files of about 1100 px width: they load fast on phones and look sharp. If an image listed in `block_config.json` is missing, the tool does not start and tells you which one.

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

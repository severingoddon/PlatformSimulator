# PlatformSimulator

A simulated Instagram-style feed for research studies. Participants scroll through 50 posts (10 blocks of 5), can like / follow / save / share them, and answer a short survey after each block.

## Setup

**Requirement:** [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

**Start:**

```bash
git clone <repository-url> PlatformSimulator
cd PlatformSimulator
docker compose up -d --build
```

The tool is now running at `http://<server>:3005`.

**Get the results:** all data is written as CSV files to the `data/` folder next to `docker-compose.yml`. Download or copy them from there at any time, even while the tool is running.

**Stop:**

```bash
docker compose down
```

Stopping, restarting or rebuilding the container does **not** delete any data in `data/`.

**Update after code or config changes:**

```bash
git pull
docker compose up -d --build
```

### Notes for production

- The container serves plain HTTP on port 3005. For a real study, put it behind your HTTPS reverse proxy (nginx, Caddy, institutional load balancer, …) and forward requests to port 3005.
- The container restarts automatically after a crash or a server reboot.
- Back up the `data/` folder regularly. It contains all study results and nothing else.

## Output data

Three CSV files in `data/`:

| File | Content |
|------|---------|
| `engagement.csv` | One row per participant and post: like / follow / save / share status + demographics |
| `theme_recognition.csv` | One row per participant and block: which themes were noticed (true/false) + demographics |
| `theme_localization.csv` | One row per participant, block and theme: which of posts 1–5 contained the theme + demographics |

Participants are identified by `userEmailHash` (SHA-256 hash of the email address entered in the demographics form; the plain email is never stored).

## Study flow

1. Participant fills in the demographics form (age, religious affiliation, education, origin, political orientation, email).
2. The feed shows 5 posts per block with Instagram-style buttons (like, follow, save, share).
3. After each block: theme recognition (which themes did you notice?) → theme localization (in which posts?).
4. After block 10: thank-you page.

## Configuration

Everything is controlled by `backend/block_config.json`:

- **themes** – themes offered in the survey (key + label). The survey UI and the CSV columns adapt automatically.
- **blocks** – 10 blocks with 5 posts each. Per post: file name, type (`explicit_religion`, `spiritual_implicit`, `filler`, `thematic_control`) and ground-truth themes.

Post images are stored in `postImages/`.

After changing the configuration or images, rebuild the container with `docker compose up -d --build`.

## Local development (without Docker)

Backend (Python 3.12+), runs on `http://localhost:3005`:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Frontend (Node 22+), runs on `http://localhost:4200` and proxies API calls to the backend:

```bash
cd frontend
npm install
npx ng serve --proxy-config proxy.conf.json
```

In local development, CSV files are written to `backend/data/`.

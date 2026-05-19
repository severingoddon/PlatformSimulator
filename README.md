# PlatformSimulator

Simulierte Instagram-Feed-Umgebung für Forschungszwecke. Probanden scrollen durch einen Feed mit 50 Posts (10 Blöcke à 5), interagieren mit Like/Follow/Save/Share und beantworten nach jedem Block eine Themen-Survey.

## Setup

### Backend (Python)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Läuft auf `http://localhost:8000`

### Frontend (Angular)

```bash
cd frontend
npm install
npx ng serve --proxy-config proxy.conf.json
```

Läuft auf `http://localhost:4200`

## Konfiguration

Alles wird über `backend/block_config.json` gesteuert:

- **themes** -- Themen für die Survey (Key + Label). Änderungen hier passen automatisch Survey-UI und CSV-Spalten an.
- **blocks** -- 10 Blöcke mit je 5 Posts. Pro Post: Dateiname, Typ (`explicit_religion`, `spiritual_implicit`, `filler`, `thematic_control`) und Ground-Truth-Themen.

Post-Bilder liegen in `postImages/`.

## Ablauf

1. Proband füllt Demografie-Formular aus (Alter, Religion, Bildung, Herkunft, politische Einstellung, E-Mail als SHA-256 Hash)
2. Feed zeigt 5 Posts pro Block mit Instagram-Buttons (Like, Follow, Save, Share)
3. Nach jedem Block: Theme Recognition (welche Themen bemerkt?) → Theme Localization (in welchen Posts?)
4. Nach Block 10: Danke-Seite

## Datenausgabe

Drei CSVs in `backend/data/`:

| Datei | Inhalt |
|-------|--------|
| `engagement.csv` | Pro Post: Like/Follow/Save/Share Status + Demografie |
| `theme_recognition.csv` | Pro Block: erkannte Themen (true/false) + Demografie |
| `theme_localization.csv` | Pro Block pro Thema: Zuordnung zu Posts 1-5 + Demografie |

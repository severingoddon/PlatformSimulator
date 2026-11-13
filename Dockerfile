# --- Stage 1: build the Angular frontend ---
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build

# --- Stage 2: Python backend serving API + frontend ---
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY postImages/ postImages/
COPY --from=frontend /build/dist/frontend/browser frontend/dist/frontend/browser

EXPOSE 3005
WORKDIR /app/backend
CMD ["python", "main.py"]

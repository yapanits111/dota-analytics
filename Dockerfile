# Production image for Railway — packages the API together with the ETL and
# schema so the /sync endpoint works and the DB self-initialises on boot.
FROM python:3.11-slim

WORKDIR /app

# Install backend deps (requirements.txt also covers the ETL's `requests`).
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the app. Keeping the same /app/backend, /app/etl, /app/sql layout as the
# repo means sync.py's relative path to etl/ resolves correctly in the image.
COPY backend/ ./backend/
COPY etl/     ./etl/
COPY sql/     ./sql/

WORKDIR /app/backend

# Railway injects $PORT; default to 8000 for local `docker run`.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

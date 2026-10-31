FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DB_PATH=/data/arb.db \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY arb.py arbweb.py ./

RUN mkdir -p /data

EXPOSE 8000

CMD ["sh", "-c", "uvicorn arbweb:app --host 0.0.0.0 --port ${PORT:-8000}"]

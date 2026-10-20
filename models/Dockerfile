FROM python:3.10-slim

WORKDIR /app

# Install system libraries needed by OpenCV & Ultralytics
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5003
EXPOSE 5003

CMD ["python", "run_server.py"]

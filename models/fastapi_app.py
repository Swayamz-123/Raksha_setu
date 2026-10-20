import os
import sys
import json
import time
import asyncio
from typing import Optional
from collections import defaultdict

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment configuration
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from services.yolo_service import detect_person
from services.gemini_service import analyze as gemini_analyze
from services.llava_service import analyze as llava_analyze
from services.email_service import send_emergency_email, EMAIL_TO

app = FastAPI(
    title="RakshaSetu AI Vision Triage Microservice",
    version="2.0.0",
    description="High-concurrency stateless AI vision triage microservice running YOLO11n and Gemini/LLaVA VLM models."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Email routing mapping based on emergency crisis category
CRISIS_EMAIL_MAP = {
    "medical":          os.getenv("EMAIL_MEDICAL") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "medical-emergency@example.com",
    "accident":         os.getenv("EMAIL_MEDICAL") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "medical-emergency@example.com",
    "fire":             os.getenv("EMAIL_FIRE") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "fire-emergency@example.com",
    "crime":            os.getenv("EMAIL_CRIME") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "police-emergency@example.com",
    "natural_disaster": os.getenv("EMAIL_DISASTER") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "disaster-emergency@example.com",
    "other":            os.getenv("EMAIL_DEFAULT") or EMAIL_TO or "emergency-dispatch@example.com",
}

BACKEND_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")

# Per-client sliding window rate limiter (max 12 calls/minute per client instead of global lock)
RATE_LIMIT_WINDOW = 60  # seconds
MAX_REQUESTS_PER_WINDOW = 12
client_request_history = defaultdict(list)


def is_rate_limited(client_id: str) -> Optional[int]:
    now = time.time()
    history = client_request_history[client_id]
    # Prune timestamps older than window
    client_request_history[client_id] = [t for t in history if now - t < RATE_LIMIT_WINDOW]
    if len(client_request_history[client_id]) >= MAX_REQUESTS_PER_WINDOW:
        oldest = client_request_history[client_id][0]
        return int(RATE_LIMIT_WINDOW - (now - oldest))
    client_request_history[client_id].append(now)
    return None


def get_email_for_crisis(crisis_type: str) -> str:
    return CRISIS_EMAIL_MAP.get((crisis_type or "other").lower(), os.getenv("EMAIL_DEFAULT") or "emergency-dispatch@example.com")


def decode_image_bytes(raw_bytes: bytes) -> Optional[np.ndarray]:
    nparr = np.frombuffer(raw_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def call_auto_sos(crisis_type: str, latitude, longitude, access_token: str):
    """Call backend SOS API to auto-trigger SOS alert"""
    if not access_token:
        return None
    try:
        res = requests.post(
            f"{BACKEND_URL}/api/sos",
            json={
                "crisisType": crisis_type or "other",
                "longitude": float(longitude) if longitude else 0,
                "latitude": float(latitude) if latitude else 0,
                "address": "AI Safety Monitor Vision Alert",
                "broadcastRadius": 1000,
                "isAnonymous": False
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=8
        )
        if res.status_code in [200, 201, 202]:
            data = res.json().get("data", {})
            return data.get("sos", {}).get("_id") or data.get("trackingId")
    except Exception as e:
        print(f"[AUTO-SOS] Backend dispatch failed: {e}")
    return None


@app.get("/")
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "rakshasetu-ai-triage",
        "version": "2.0.0",
        "models": {
            "yolo": "yolo11n",
            "vlm": ["gemini-2.5-flash", "llava:7b"]
        }
    }


@app.post("/api/analyze")
async def analyze_emergency(
    request: Request,
    image0: Optional[UploadFile] = File(None),
    image1: Optional[UploadFile] = File(None),
    image2: Optional[UploadFile] = File(None),
    model_provider: str = Form("gemini"),
    access_token: Optional[str] = Form(None),
    email_config: str = Form("{}"),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_remaining = is_rate_limited(client_ip)
    if rate_limit_remaining is not None:
        return JSONResponse({
            "message": f"Monitoring active... next analysis available in {rate_limit_remaining}s",
            "emergency": False
        })

    # Parse email config
    try:
        config_data = json.loads(email_config)
    except Exception:
        config_data = {}

    lat = config_data.get("latitude") or latitude
    lng = config_data.get("longitude") or longitude

    # Ingest uploaded frames statelessly (request-scoped, zero global buffer)
    uploaded_files = [f for f in [image0, image1, image2] if f is not None]
    if not uploaded_files:
        return JSONResponse({"message": "No frames received", "emergency": False})

    frames = []
    for f in uploaded_files:
        content = await f.read()
        img = await asyncio.to_thread(decode_image_bytes, content)
        if img is not None:
            frames.append(img)

    if not frames:
        return JSONResponse({"message": "Failed to decode received image frames", "emergency": False})

    # Step 1: Threaded YOLO Person & Hazard Detection (CPU-bound)
    person_detected = await asyncio.to_thread(
        lambda: any(detect_person(img) for img in frames)
    )

    if not person_detected:
        return JSONResponse({
            "message": "No person detected in frame",
            "emergency": False,
            "yolo_verified": False
        })

    # Step 2: Vision-Language Model Analysis
    provider = model_provider.lower().strip()
    try:
        if provider == "llava":
            raw_ai = await asyncio.to_thread(llava_analyze, frames)
        else:
            raw_ai = await asyncio.to_thread(gemini_analyze, frames)

        try:
            result = json.loads(raw_ai)
        except Exception:
            result = {
                "emergency": False,
                "crisis_type": "none",
                "intensity": 0,
                "flag": "safe",
                "summary": str(raw_ai)[:150]
            }

        is_emergency = bool(result.get("emergency", False))
        crisis_type = result.get("crisis_type", "other")
        intensity = int(result.get("intensity", 0))
        flag = result.get("flag", "safe")
        summary = result.get("summary", "")

        message = f"Intensity: {intensity}: {flag}: {summary}"

        auto_sos_id = None
        if is_emergency:
            # Trigger emergency email fanout asynchronously
            recipient = get_email_for_crisis(crisis_type)
            maps_link = f"https://maps.google.com/?q={lat},{lng}" if lat and lng else "#"
            asyncio.create_task(
                asyncio.to_thread(
                    send_emergency_email,
                    recipient,
                    {
                        "name": config_data.get("name", "AI Vision Safety Monitor"),
                        "emergencyMessage": message,
                        "crisisType": crisis_type,
                        "intensity": intensity,
                        "flag": flag,
                        "phone": config_data.get("phone", "N/A"),
                        "emergencyPhone": config_data.get("emergency_phone", "112"),
                        "address": config_data.get("address", "AI Monitored Zone"),
                        "latitude": lat or "N/A",
                        "longitude": lng or "N/A",
                        "mapsLink": maps_link,
                        "modelUsed": provider
                    }
                )
            )

            # Auto-trigger SOS on Node.js backend
            if access_token and lat and lng:
                auto_sos_id = await asyncio.to_thread(
                    call_auto_sos, crisis_type, lat, lng, access_token
                )

        return JSONResponse({
            "message": message,
            "emergency": is_emergency,
            "crisis_type": crisis_type,
            "intensity": intensity,
            "flag": flag,
            "auto_sos_id": auto_sos_id,
            "model_used": provider
        })

    except Exception as exc:
        print(f"[Analyze API] Processing error: {exc}")
        return JSONResponse(
            status_code=500,
            content={"message": "Analysis pipeline encountered an error", "emergency": False}
        )

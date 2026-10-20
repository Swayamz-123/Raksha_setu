import json
import time
import os
import requests
import numpy as np
import cv2
from flask import request, jsonify
from services.yolo_service import detect_person
from services.gemini_service import analyze as gemini_analyze
from services.llava_service import analyze as llava_analyze
from services.email_service import send_emergency_email, EMAIL_TO

# In-memory state
frame_buffer = []
last_ai_call = 0
COOLDOWN = 60  # seconds

# Crisis-type → email recipient mapping (env-driven)
CRISIS_EMAIL_MAP = {
    "medical":          os.getenv("EMAIL_MEDICAL") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
    "accident":         os.getenv("EMAIL_MEDICAL") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
    "fire":             os.getenv("EMAIL_FIRE") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
    "crime":            os.getenv("EMAIL_CRIME") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
    "natural_disaster": os.getenv("EMAIL_DISASTER") or os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
    "other":            os.getenv("EMAIL_DEFAULT") or EMAIL_TO,
}

# Backend API URL for auto-triggering SOS
BACKEND_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")


def get_email_for_crisis(crisis_type: str) -> str:
    return CRISIS_EMAIL_MAP.get((crisis_type or "other").lower(), EMAIL_TO or "awaishehsan86@gmail.com")


def auto_trigger_sos(crisis_type: str, latitude, longitude, access_token: str = None):
    """Call the backend SOS API to auto-create an SOS when AI detects emergency."""
    if not access_token:
        print("[AUTO-SOS] No access token — skipping auto SOS trigger")
        return None
    try:
        res = requests.post(
            f"{BACKEND_URL}/api/sos",
            json={
                "crisisType": crisis_type or "other",
                "longitude": float(longitude) if longitude else 0,
                "latitude": float(latitude) if latitude else 0,
                "address": "AI Safety Monitor detected emergency",
                "broadcastRadius": 1000,
                "isAnonymous": False
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        if res.status_code == 201:
            sos_id = res.json().get("data", {}).get("sos", {}).get("_id")
            print(f"[AUTO-SOS] SOS created: {sos_id} (type: {crisis_type})")
            return sos_id
        else:
            print(f"[AUTO-SOS] Failed: {res.status_code} — {res.text[:100]}")
    except Exception as e:
        print(f"[AUTO-SOS] Error: {e}")
    return None


def analyze_frames():
    global frame_buffer, last_ai_call

    frame_buffer = []
    print(f"\n[ANALYZE] POST /api/analyze hit")

    email_config = request.form.get("email_config", "{}")
    try:
        email_config = json.loads(email_config)
    except json.JSONDecodeError:
        email_config = {}

    model_provider = request.form.get("model_provider", "gemini")
    access_token = request.form.get("access_token", None)
    latitude = email_config.get("latitude") or request.form.get("latitude")
    longitude = email_config.get("longitude") or request.form.get("longitude")

    print(f"[ANALYZE] Model: {model_provider} | Location: {latitude},{longitude}")

    # Collect frames
    frames_received = 0
    for i in range(3):
        file = request.files.get(f"image{i}")
        if file:
            image = np.frombuffer(file.read(), np.uint8)
            image = cv2.imdecode(image, cv2.IMREAD_COLOR)
            if image is not None:
                frame_buffer.append(image)
                frames_received += 1

    print(f"[ANALYZE] Frames received: {frames_received}/3")

    if frames_received == 0:
        return jsonify({"message": "No frames received", "emergency": False})

    # YOLO person detection
    person_found = any(detect_person(img) for img in frame_buffer)
    if not person_found:
        frame_buffer.clear()
        print("[ANALYZE] No person detected — skipping AI")
        return jsonify({"message": "No person detected", "emergency": False})

    print(f"[ANALYZE] Person confirmed")

    # Cooldown check
    now = time.time()
    if now - last_ai_call < COOLDOWN:
        remaining = int(COOLDOWN - (now - last_ai_call))
        print(f"[ANALYZE] Cooldown — {remaining}s remaining")
        frame_buffer.clear()
        return jsonify({"message": f"Monitoring... next analysis in {remaining}s", "emergency": False})

    # Dispatch to AI
    print(f"[ANALYZE] Dispatching to {model_provider.upper()}...")
    try:
        images = frame_buffer[:]
        frame_buffer.clear()
        last_ai_call = time.time()

        raw = llava_analyze(images) if model_provider == "llava" else gemini_analyze(images)

        # Parse structured JSON response
        try:
            result = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            result = {"emergency": False, "crisis_type": "none", "intensity": 0, "flag": "safe", "summary": str(raw)[:200]}

        is_emergency = bool(result.get("emergency", False))
        crisis_type = result.get("crisis_type", "other")
        intensity = result.get("intensity", 0)
        flag = result.get("flag", "safe")
        summary = result.get("summary", "")

        # Build human-readable message
        message = f"Intensity: {intensity}: {flag}: {summary}"

        print(f"[ANALYZE] Emergency: {is_emergency} | Type: {crisis_type} | Intensity: {intensity} | Flag: {flag}")

        if is_emergency:
            # 1. Send routed email based on crisis type
            recipient = get_email_for_crisis(crisis_type)
            print(f"[ANALYZE] Sending alert email to {recipient} (crisis: {crisis_type})")
            send_emergency_email(
                recipient_email=recipient,
                emergency_data={
                    "name": email_config.get("name", "AI Monitor"),
                    "emergencyMessage": message,
                    "crisisType": crisis_type,
                    "intensity": intensity,
                    "flag": flag,
                    "phone": email_config.get("phone", "N/A"),
                    "emergencyPhone": email_config.get("emergency_phone", "N/A"),
                    "address": email_config.get("address", "AI Safety Monitor"),
                    "latitude": latitude or "N/A",
                    "longitude": longitude or "N/A",
                    "mapsLink": f"https://maps.google.com/?q={latitude},{longitude}" if latitude and longitude else "#",
                    "modelUsed": model_provider
                }
            )

            # 2. Auto-trigger SOS on backend
            if access_token and latitude and longitude:
                sos_id = auto_trigger_sos(crisis_type, latitude, longitude, access_token)
                return jsonify({
                    "message": message,
                    "emergency": True,
                    "crisis_type": crisis_type,
                    "intensity": intensity,
                    "flag": flag,
                    "auto_sos_id": sos_id
                })

        return jsonify({
            "message": message,
            "emergency": is_emergency,
            "crisis_type": crisis_type,
            "intensity": intensity,
            "flag": flag
        })

    except Exception as e:
        print(f"[ANALYZE] Error: {e}")
        frame_buffer.clear()
        return jsonify({"message": "Analysis failed", "emergency": False})

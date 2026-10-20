import os
from flask import jsonify
from dotenv import load_dotenv

load_dotenv()

def health_check():
    print("[HEALTH] GET /health hit")
    return jsonify({
        "status": "ok",
        "service": "Critical Care AI Safety Monitor",
        "version": "2.0",
        "yolo_loaded": True,
        "gemini_configured": os.getenv("GEMINI_API_KEY") is not None,
        "ollama_url": "http://localhost:11434"
    }), 200

def root():
    print("[ROOT] GET / hit")
    return jsonify({"message": "Flask API is running", "version": "2.0"}), 200

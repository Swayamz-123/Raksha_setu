import base64
import json
import cv2
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llava:7b"

PROMPT = """You are an emergency detection AI. Analyze this image and respond ONLY with valid JSON — no extra text, no markdown.

JSON format:
{
  "emergency": true or false,
  "crisis_type": one of ["medical", "fire", "crime", "natural_disaster", "accident", "other", "none"],
  "intensity": number 0-100,
  "flag": one of ["fallen", "unresponsive", "severe risk", "potential danger", "motionless", "disoriented", "restricted movement", "labored breathing", "seizure-like activity", "visible bleeding", "hazard nearby", "fire detected", "smoke detected", "environmental risk", "sudden collapse", "no assistance", "safe"],
  "summary": "Brief 1-2 sentence description of what you see and why it's an emergency (if applicable)"
}

Rules:
- emergency = true only if immediate help is needed
- crisis_type = "none" and flag = "safe" if person looks fine
- For fire emergencies, set crisis_type = "fire"
- For medical emergencies (fallen, injured, unresponsive), set crisis_type = "medical"
- For accidents (vehicle crash, collision), set crisis_type = "accident"
- Be concise and clear in summary (max 2 sentences)"""


def analyze(images):
    print(f"[LLAVA] Sending image to Ollama at {OLLAMA_URL} using model {OLLAMA_MODEL}...")
    img = images[-1]
    _, buffer = cv2.imencode(".jpg", img)
    img_b64 = base64.b64encode(buffer).decode("utf-8")

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": PROMPT,
                "images": [img_b64],
                "stream": False,
                "format": "json"
            },
            timeout=120
        )

        data = response.json()

        if "error" in data:
            print(f"[LLAVA] Ollama error: {data['error']}")
            return json.dumps({"emergency": False, "crisis_type": "none", "intensity": 0, "flag": "safe", "summary": f"Error: {data['error']}"})

        raw = data.get("response", "")
        print(f"[LLAVA] Raw response: {raw[:120]}...")

        # Try to parse as JSON
        try:
            parsed = json.loads(raw)
            # Validate required keys
            parsed.setdefault("emergency", False)
            parsed.setdefault("crisis_type", "none")
            parsed.setdefault("intensity", 0)
            parsed.setdefault("flag", "safe")
            parsed.setdefault("summary", raw[:100])
            return json.dumps(parsed)
        except json.JSONDecodeError:
            # Fallback: return raw as summary
            print(f"[LLAVA] JSON parse failed, using raw text")
            return json.dumps({
                "emergency": False,
                "crisis_type": "none",
                "intensity": 0,
                "flag": "safe",
                "summary": raw[:200]
            })

    except Exception as e:
        print(f"[LLAVA] Error: {e}")
        return json.dumps({"emergency": False, "crisis_type": "none", "intensity": 0, "flag": "safe", "summary": f"Analysis error: {str(e)}"})

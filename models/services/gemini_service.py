import os
import json
import cv2
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTIONS = """You are an emergency detection AI. Analyze images and respond ONLY with valid JSON.

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
- Be concise and clear in summary (max 2 sentences)
- No extra text outside the JSON"""


def _encode_image(image):
    _, buffer = cv2.imencode(".jpg", image)
    return buffer.tobytes()


def analyze(images):
    print(f"[GEMINI] Sending {len(images)} image(s) for analysis...")
    prompt = "Analyze these images and return ONLY a JSON object as specified."
    contents = [prompt]
    for img in images:
        contents.append(types.Part.from_bytes(data=_encode_image(img), mime_type="image/jpeg"))

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTIONS,
                temperature=0.2,
                max_output_tokens=512,
            )
        )
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        print(f"[GEMINI] Raw response: {raw[:120]}...")

        try:
            parsed = json.loads(raw)
            parsed.setdefault("emergency", False)
            parsed.setdefault("crisis_type", "none")
            parsed.setdefault("intensity", 0)
            parsed.setdefault("flag", "safe")
            parsed.setdefault("summary", raw[:100])
            return json.dumps(parsed)
        except json.JSONDecodeError:
            return json.dumps({
                "emergency": False,
                "crisis_type": "none",
                "intensity": 0,
                "flag": "safe",
                "summary": raw[:200]
            })

    except Exception as e:
        print(f"[GEMINI] Error: {e}")
        return json.dumps({"emergency": False, "crisis_type": "none", "intensity": 0, "flag": "safe", "summary": f"Analysis error: {str(e)}"})

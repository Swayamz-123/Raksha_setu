from ultralytics import YOLO
import os

_model = None

def get_model():
    global _model
    if _model is None:
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "yolo11n.pt")
        print(f"[YOLO] Loading model from {model_path} on CPU...")
        _model = YOLO(model_path)
        _model.to("cpu")
        print("[YOLO] Model loaded on CPU.")
    return _model

def detect_person(image):
    model = get_model()
    results = model(image, device="cpu")
    class_ids = results[0].boxes.cls.cpu().tolist()
    detected = "person" in [results[0].names[int(cls)] for cls in class_ids]
    print(f"[YOLO] Person detected: {detected}")
    return detected

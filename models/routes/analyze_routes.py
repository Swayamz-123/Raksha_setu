from flask import Blueprint
from controllers.analyze_controller import analyze_frames

analyze_bp = Blueprint("analyze", __name__)

# POST /api/analyze
analyze_bp.route("/analyze", methods=["POST"])(analyze_frames)

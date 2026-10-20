from flask import Blueprint
from controllers.health_controller import health_check, root

health_bp = Blueprint("health", __name__)

# GET /health
health_bp.route("/health", methods=["GET"])(health_check)

# GET /
health_bp.route("/", methods=["GET"])(root)

import os
import sys
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Load env from models/ directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Add models/ to path so imports resolve correctly
sys.path.insert(0, os.path.dirname(__file__))

from routes.health_routes import health_bp
from routes.analyze_routes import analyze_bp

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
    }
})

# Register blueprints
app.register_blueprint(health_bp)           # GET /  and  GET /health
app.register_blueprint(analyze_bp, url_prefix="/api")  # POST /api/analyze

# Log all registered routes on startup
def print_routes():
    print("\n" + "="*55)
    print("  Registered Routes")
    print("="*55)
    for rule in app.url_map.iter_rules():
        methods = ", ".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
        print(f"  {methods:<8} {rule.rule}")
    print("="*55 + "\n")

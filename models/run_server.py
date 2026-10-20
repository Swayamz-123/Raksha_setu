#!/usr/bin/env python
"""
Entry point for Critical Care AI Safety Monitor
Run from the models/ directory: python run_server.py
"""
import os
import sys

# Ensure we're running from models/ directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, print_routes

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  RakshaSetu AI Vision Triage Microservice — v2.0")
    print("="*55)
    print("  Endpoint: http://0.0.0.0:5003/api/analyze")
    print("  Swagger Docs: http://localhost:5003/docs")
    print("="*55 + "\n")

    try:
        import uvicorn
        print("  Starting with high-concurrency Uvicorn ASGI server...")
        uvicorn.run("fastapi_app:app", host="0.0.0.0", port=5003, log_level="info", reload=False)
    except ImportError:
        print("  Uvicorn not found, falling back to WSGI Flask server...")
        from app import app, print_routes
        print_routes()
        app.run(host="0.0.0.0", port=5003, debug=False)


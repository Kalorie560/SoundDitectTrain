#!/usr/bin/env python3
"""
SoundDitect Streamlit Runner
Simple launcher for the Streamlit-based SoundDitect application

This script runs both the FastAPI backend and Streamlit frontend
"""

import subprocess
import threading
import time
import sys
import signal
import os
from pathlib import Path

def run_backend():
    """Run the FastAPI backend server"""
    print("🚀 Starting FastAPI backend...")
    try:
        # Run the existing backend
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "backend.main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000",
            "--reload"
        ], cwd=Path(__file__).parent)
    except KeyboardInterrupt:
        print("🛑 Backend shutdown")

def run_streamlit():
    """Run the Streamlit frontend"""
    print("🎨 Starting Streamlit frontend...")
    try:
        # Wait a moment for backend to start
        time.sleep(3)
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", 
            "app_streamlit.py",
            "--server.port", "8501",
            "--server.address", "0.0.0.0",
            "--theme.primaryColor", "#4299e1",
            "--theme.backgroundColor", "#ffffff",
            "--theme.secondaryBackgroundColor", "#f7fafc"
        ], cwd=Path(__file__).parent)
    except KeyboardInterrupt:
        print("🛑 Frontend shutdown")

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    print("\n🛑 Shutting down SoundDitect...")
    sys.exit(0)

def main():
    """Main launcher"""
    print("🎵 SoundDitect - Streamlit Edition")
    print("=" * 50)
    
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, signal_handler)
    
    # Check if required files exist
    if not Path("app_streamlit.py").exists():
        print("❌ app_streamlit.py not found!")
        sys.exit(1)
    
    if not Path("backend/main.py").exists():
        print("❌ backend/main.py not found!")
        sys.exit(1)
    
    print("📋 Starting services...")
    print("   • FastAPI Backend: http://localhost:8000")
    print("   • Streamlit Frontend: http://localhost:8501")
    print()
    
    # Create threads for backend and frontend
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    frontend_thread = threading.Thread(target=run_streamlit, daemon=True)
    
    # Start both services
    backend_thread.start()
    frontend_thread.start()
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        sys.exit(0)

if __name__ == "__main__":
    main()
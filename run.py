#!/usr/bin/env python3
"""
SoundDitect - Easy Run Script
Automatically installs dependencies and starts the application
"""

import subprocess
import sys
import os
import argparse
import time
from pathlib import Path

def run_command(cmd, description="", capture_output=True):
    """Run a command and return success status"""
    try:
        if capture_output:
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd, cwd=Path(__file__).parent)
            return result.returncode == 0, "", ""
    except Exception as e:
        return False, "", str(e)

def check_dependencies():
    """Check if dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    # Check base dependencies
    try:
        import torch
        import fastapi
        import uvicorn
        print("✅ Base dependencies found")
        base_deps = True
    except ImportError:
        print("❌ Base dependencies missing")
        base_deps = False
    
    # Check Streamlit
    try:
        import streamlit
        print("✅ Streamlit found")
        streamlit_deps = True
    except ImportError:
        print("⚠️ Streamlit not found")
        streamlit_deps = False
    
    return base_deps, streamlit_deps

def install_dependencies(install_streamlit=True):
    """Install missing dependencies"""
    print("\n📦 Installing dependencies...")
    
    # Install base requirements
    print("Installing base requirements...")
    success, stdout, stderr = run_command([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    if not success:
        print(f"❌ Failed to install base requirements: {stderr}")
        return False
    
    # Install Streamlit requirements if requested
    if install_streamlit and Path("requirements_streamlit.txt").exists():
        print("Installing Streamlit requirements...")
        success, stdout, stderr = run_command([sys.executable, "-m", "pip", "install", "-r", "requirements_streamlit.txt"])
        if not success:
            print(f"⚠️ Failed to install Streamlit requirements: {stderr}")
            print("💡 You can still use the traditional version")
    
    return True

def start_traditional():
    """Start the traditional HTML/JavaScript version"""
    print("\n🚀 Starting SoundDitect Traditional Version...")
    print("📱 Open: http://localhost:8000")
    print("⏹️ Press Ctrl+C to stop")
    
    success, stdout, stderr = run_command([sys.executable, "run_server.py"], capture_output=False)
    return success

def start_streamlit():
    """Start the Streamlit version"""
    print("\n🚀 Starting SoundDitect Streamlit Version...")
    print("📱 Open: http://localhost:8501")
    print("⏹️ Press Ctrl+C to stop")
    
    success, stdout, stderr = run_command([sys.executable, "run_streamlit.py"], capture_output=False)
    return success

def main():
    parser = argparse.ArgumentParser(description="SoundDitect Easy Runner")
    parser.add_argument("--version", choices=["traditional", "streamlit", "auto"], 
                       default="auto", help="Version to run (default: auto)")
    parser.add_argument("--no-install", action="store_true", 
                       help="Skip dependency installation")
    parser.add_argument("--install-only", action="store_true",
                       help="Only install dependencies, don't start app")
    
    args = parser.parse_args()
    
    print("🎵 SoundDitect Easy Runner")
    print("=" * 40)
    
    # Check current dependencies
    base_deps, streamlit_deps = check_dependencies()
    
    # Install dependencies if needed
    if not args.no_install and (not base_deps or not streamlit_deps):
        print("\n📥 Installing missing dependencies...")
        if not install_dependencies(install_streamlit=True):
            print("❌ Installation failed")
            sys.exit(1)
        
        # Re-check after installation
        base_deps, streamlit_deps = check_dependencies()
    
    # Exit if only installing
    if args.install_only:
        print("\n✅ Dependencies installed successfully!")
        print("🚀 Run 'python run.py' to start the application")
        return
    
    # Determine which version to run
    if args.version == "auto":
        if streamlit_deps:
            version = "streamlit"
            print("\n🎨 Auto-selected: Streamlit version (better UI)")
        elif base_deps:
            version = "traditional"
            print("\n🌐 Auto-selected: Traditional version (Streamlit not available)")
        else:
            print("❌ No dependencies available. Please install first:")
            print("   python run.py --install-only")
            sys.exit(1)
    else:
        version = args.version
    
    # Check if selected version is available
    if version == "streamlit" and not streamlit_deps:
        print("❌ Streamlit version requested but not available")
        print("💡 Install Streamlit: pip install -r requirements_streamlit.txt")
        print("💡 Or try: python run.py --version traditional")
        sys.exit(1)
    
    if version == "traditional" and not base_deps:
        print("❌ Traditional version requested but base dependencies not available")
        print("💡 Install dependencies: pip install -r requirements.txt")
        sys.exit(1)
    
    # Start the selected version
    try:
        if version == "streamlit":
            success = start_streamlit()
        else:
            success = start_traditional()
            
        if not success:
            print(f"\n❌ Failed to start {version} version")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 SoundDitect stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
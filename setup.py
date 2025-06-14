#!/usr/bin/env python3
"""
SoundDitect Installation and Setup Script
Provides easy installation for both traditional and Streamlit versions
"""

import subprocess
import sys
import os
import time
from pathlib import Path

def run_command(cmd, description, check_result=True):
    """Run a command with nice output formatting"""
    print(f"\n🔄 {description}...")
    print(f"Running: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ {description} failed")
            if result.stderr.strip():
                print(f"Error: {result.stderr.strip()}")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
            
            if check_result:
                print(f"\n💡 If this error persists, try running the command manually:")
                print(f"   {' '.join(cmd)}")
                return False
            return True
            
    except Exception as e:
        print(f"❌ Error running {description}: {e}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    print("🐍 Checking Python version...")
    
    if sys.version_info < (3, 8):
        print(f"❌ Python {sys.version_info.major}.{sys.version_info.minor} detected")
        print("⚠️ SoundDitect requires Python 3.8 or higher")
        print("💡 Please upgrade Python and try again")
        return False
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro} detected")
    return True

def check_virtual_environment():
    """Check if we're in a virtual environment"""
    print("\n🏠 Checking virtual environment...")
    
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("✅ Virtual environment detected")
        return True
    else:
        print("⚠️ No virtual environment detected")
        print("💡 It's recommended to use a virtual environment:")
        print("   python -m venv venv")
        print("   source venv/bin/activate  # On Windows: venv\\Scripts\\activate")
        print("   python setup.py")
        
        response = input("\nContinue without virtual environment? (y/N): ").lower()
        return response in ['y', 'yes']

def install_base_requirements():
    """Install base requirements for traditional version"""
    print("\n📦 Installing base requirements...")
    
    if not Path("requirements.txt").exists():
        print("❌ requirements.txt not found")
        return False
    
    return run_command([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      "Installing base requirements")

def install_streamlit_requirements():
    """Install additional requirements for Streamlit version"""
    print("\n🎨 Installing Streamlit requirements...")
    
    if not Path("requirements_streamlit.txt").exists():
        print("❌ requirements_streamlit.txt not found")
        return False
    
    return run_command([sys.executable, "-m", "pip", "install", "-r", "requirements_streamlit.txt"], 
                      "Installing Streamlit requirements")

def test_installations():
    """Test if installations work"""
    print("\n🧪 Testing installations...")
    
    # Test base imports
    try:
        import torch
        import fastapi
        import uvicorn
        print("✅ Base packages (PyTorch, FastAPI) imported successfully")
    except ImportError as e:
        print(f"❌ Base package import failed: {e}")
        return False
    
    # Test Streamlit import
    try:
        import streamlit
        print("✅ Streamlit imported successfully")
        return True
    except ImportError:
        print("⚠️ Streamlit not available - only traditional version will work")
        return True

def show_startup_instructions():
    """Show instructions for starting the application"""
    print("\n" + "="*60)
    print("🎉 INSTALLATION COMPLETE!")
    print("="*60)
    
    print("\n📋 How to start SoundDitect:")
    print("\n1️⃣ Traditional Version (HTML + JavaScript):")
    print("   python run_server.py")
    print("   Then open: http://localhost:8000")
    
    print("\n2️⃣ Streamlit Version (if Streamlit is installed):")
    print("   python run_streamlit.py")
    print("   Then open: http://localhost:8501")
    
    print("\n💡 Tips:")
    print("   • Use Traditional version if you have connection issues")
    print("   • Use Streamlit version for better user experience")
    print("   • Check README.md for detailed documentation")
    
    print("\n🚨 If you encounter issues:")
    print("   • Check the terminal output for error messages")
    print("   • Make sure your microphone permissions are enabled")
    print("   • Try refreshing the browser page")
    
    print("\n🔧 For debugging:")
    print("   • Open browser console (F12) for detailed logs")
    print("   • Traditional version has debug panel (🔧 button)")

def main():
    """Main setup process"""
    print("🎵 SoundDitect Setup and Installation")
    print("="*50)
    
    # Check prerequisites
    if not check_python_version():
        sys.exit(1)
    
    if not check_virtual_environment():
        print("❌ Setup cancelled by user")
        sys.exit(1)
    
    # Install packages
    success = True
    
    # Install base requirements first
    if not install_base_requirements():
        print("❌ Failed to install base requirements")
        success = False
    
    # Install Streamlit requirements
    if not install_streamlit_requirements():
        print("⚠️ Failed to install Streamlit requirements")
        print("💡 You can still use the traditional version")
    
    # Test installations
    if not test_installations():
        print("⚠️ Some imports failed, but you may still be able to run the application")
    
    # Show final instructions
    if success:
        show_startup_instructions()
    else:
        print("\n❌ Setup completed with errors")
        print("💡 Try running the commands manually or check the error messages above")
        sys.exit(1)

if __name__ == "__main__":
    main()
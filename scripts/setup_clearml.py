#!/usr/bin/env python3
"""
ClearML Setup Script for SoundDitect

This script helps initialize ClearML configuration for the SoundDitect project.
"""

import os
import sys
import subprocess
from pathlib import Path

def setup_clearml():
    """Setup ClearML configuration"""
    print("🚀 Setting up ClearML for SoundDitect...")
    print()
    
    # Check if ClearML is installed
    try:
        import clearml
        print("✅ ClearML is installed")
    except ImportError:
        print("❌ ClearML is not installed. Please run:")
        print("   pip install -r requirements.txt")
        return False
    
    # Check for existing ClearML configuration
    clearml_config_path = Path.home() / ".clearml.conf"
    project_config_path = Path(__file__).parent.parent / "clearml.conf"
    
    if clearml_config_path.exists():
        print("✅ ClearML configuration already exists at ~/.clearml.conf")
        choice = input("Do you want to reconfigure? (y/N): ").lower().strip()
        if choice != 'y':
            print("Skipping ClearML setup.")
            return True
    
    print()
    print("🔧 ClearML Configuration Options:")
    print("1. Use clearml-init (recommended for new users)")
    print("2. Copy template and configure manually")
    print("3. Use environment variables")
    print()
    
    choice = input("Choose an option (1-3): ").strip()
    
    if choice == "1":
        return setup_with_clearml_init()
    elif choice == "2":
        return setup_with_template()
    elif choice == "3":
        return setup_with_env_vars()
    else:
        print("❌ Invalid choice. Exiting.")
        return False

def setup_with_clearml_init():
    """Setup using clearml-init command"""
    print()
    print("🔧 Running clearml-init...")
    print("This will open your browser to get ClearML credentials.")
    print("If you don't have a ClearML account, create one at https://app.clear.ml")
    print()
    
    try:
        # Run clearml-init
        subprocess.run(['clearml-init'], check=True)
        print("✅ ClearML initialization completed!")
        return True
    except subprocess.CalledProcessError:
        print("❌ clearml-init failed. You can try manual setup instead.")
        return False
    except FileNotFoundError:
        print("❌ clearml-init command not found. Installing ClearML...")
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', 'clearml'], check=True)
            subprocess.run(['clearml-init'], check=True)
            print("✅ ClearML initialization completed!")
            return True
        except Exception as e:
            print(f"❌ Failed to install or run clearml-init: {e}")
            return False

def setup_with_template():
    """Setup using template file"""
    print()
    print("📋 Manual Setup Instructions:")
    print("1. Create an account at https://app.clear.ml")
    print("2. Go to https://app.clear.ml/profile to get your credentials")
    print("3. Copy the template file and fill in your credentials:")
    print()
    
    clearml_config_path = Path.home() / ".clearml.conf"
    project_config_path = Path(__file__).parent.parent / "clearml.conf"
    
    print(f"   cp {project_config_path} {clearml_config_path}")
    print(f"   # Edit {clearml_config_path} with your credentials")
    print()
    
    copy_now = input("Copy template now? (Y/n): ").lower().strip()
    if copy_now != 'n':
        try:
            import shutil
            shutil.copy2(project_config_path, clearml_config_path)
            print(f"✅ Template copied to {clearml_config_path}")
            print("⚠️  Please edit this file with your actual ClearML credentials!")
            return True
        except Exception as e:
            print(f"❌ Failed to copy template: {e}")
            return False
    
    return True

def setup_with_env_vars():
    """Setup using environment variables"""
    print()
    print("🌍 Environment Variables Setup:")
    print("Set the following environment variables in your shell:")
    print()
    print("export CLEARML_WEB_HOST=https://app.clear.ml")
    print("export CLEARML_API_HOST=https://api.clear.ml") 
    print("export CLEARML_FILES_HOST=https://files.clear.ml")
    print("export CLEARML_API_ACCESS_KEY=your_access_key_here")
    print("export CLEARML_API_SECRET_KEY=your_secret_key_here")
    print()
    print("Get your credentials from: https://app.clear.ml/profile")
    print()
    
    return True

def verify_setup():
    """Verify ClearML setup"""
    print()
    print("🧪 Verifying ClearML setup...")
    
    try:
        from clearml import Task
        
        # Try to create a test task
        task = Task.init(
            project_name="SoundDitect",
            task_name="setup_verification",
            output_uri=False
        )
        task.close()
        
        print("✅ ClearML setup verified successfully!")
        return True
        
    except Exception as e:
        print(f"❌ ClearML verification failed: {e}")
        print("Please check your credentials and network connection.")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("  SoundDitect ClearML Setup")
    print("=" * 60)
    
    if setup_clearml():
        if verify_setup():
            print()
            print("🎉 ClearML setup completed successfully!")
            print("You can now run training scripts with experiment tracking.")
        else:
            print()
            print("⚠️  Setup completed but verification failed.")
            print("Please check your configuration manually.")
    else:
        print()
        print("❌ ClearML setup failed.")
        print("Please refer to the documentation for manual setup.")
    
    print()
    print("Next steps:")
    print("1. Run: python scripts/train_model.py")
    print("2. Monitor experiments at: https://app.clear.ml")

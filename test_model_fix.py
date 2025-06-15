#!/usr/bin/env python3
"""
Test script for model dimension mismatch fix
"""
import sys
import os
sys.path.append('.')

import torch
import yaml
from pathlib import Path
from backend.model_manager import ModelManager

def test_model_loading():
    """Test if the model loading fix works correctly."""
    print("🧪 Testing Model Loading Fix")
    print("=" * 50)
    
    # Load config
    try:
        config_path = Path('./config.yaml')
        if not config_path.exists():
            print("❌ config.yaml not found")
            return False
            
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        print("✅ Config loaded successfully")
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        return False
    
    # Check if model file exists
    model_path = Path('./models/best_model.pth')
    if not model_path.exists():
        print("ℹ️  best_model.pth not found - test will use baseline model")
    else:
        print("✅ best_model.pth found")
    
    # Test ModelManager initialization and model loading
    try:
        print("\n🔧 Initializing ModelManager...")
        manager = ModelManager(config)
        
        print("🔧 Testing model loading...")
        
        # This should use our new architecture detection
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        success = loop.run_until_complete(manager.load_model())
        
        if success:
            print("✅ Model loaded successfully!")
            print(f"   Model device: {manager.device}")
            print(f"   Model loaded: {manager.is_model_loaded()}")
            
            # Test a prediction to ensure everything works
            print("\n🧪 Testing prediction...")
            import numpy as np
            test_audio = np.random.randn(44100).astype(np.float32)  # 1 second of test audio
            
            pred, conf = loop.run_until_complete(manager.predict(test_audio))
            print(f"✅ Prediction test successful: prediction={pred}, confidence={conf:.3f}")
            
            return True
        else:
            print("❌ Model loading failed")
            return False
            
    except Exception as e:
        print(f"❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_model_loading()
    if success:
        print("\n🎉 All tests passed! Model loading fix is working correctly.")
        sys.exit(0)
    else:
        print("\n💥 Tests failed! Please check the implementation.")
        sys.exit(1)
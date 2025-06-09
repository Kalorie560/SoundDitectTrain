#!/usr/bin/env python3
"""
Training Script for SoundDitect Model

This script handles model training with ClearML integration and memory-efficient
data loading for the sound anomaly detection system.

Usage: python scripts/train_model.py
All configuration is managed through config.yaml file.
"""

# Suppress urllib3 warnings for macOS LibreSSL compatibility
import warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", "urllib3*")

import os
import sys
import yaml
import asyncio
import logging
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from model_manager import ModelManager
from audio_processor import AudioProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_config():
    """Load configuration from config.yaml"""
    config_path = Path(__file__).parent.parent / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def validate_config(config):
    """Validate configuration parameters"""
    required_sections = ['data', 'training', 'model', 'clearml']
    for section in required_sections:
        if section not in config:
            raise ValueError(f"Missing required configuration section: {section}")
    
    # Check for required data paths
    required_data_keys = ['data_dir', 'output_dir', 'model_save_path']
    for key in required_data_keys:
        if key not in config['data']:
            raise ValueError(f"Missing required data configuration: {key}")
    
    logger.info("✅ Configuration validation passed")

def check_training_data(data_dir):
    """Check if training data exists and provide helpful instructions if not"""
    data_path = Path(data_dir)
    json_files = list(data_path.glob("*.json"))
    
    if not json_files:
        logger.error("❌ No training data found!")
        logger.error(f"📂 Looking for *.json files in: {data_path.absolute()}")
        logger.error("")
        logger.error("📝 Please place your JSON data files in the data directory.")
        logger.error("   Expected format: {'waveforms': [[...]], 'labels': ['OK', 'NG'], 'fs': 44100}")
        logger.error("")
        logger.error("🔍 Example file structure:")
        logger.error('   {')
        logger.error('     "waveforms": [[0.0, 0.01, -0.01, ...], [0.0, 0.0, 0.02, ...]],')
        logger.error('     "labels": ["OK", "NG"],')
        logger.error('     "fs": 44100,')
        logger.error('     "metric": "RMS"')
        logger.error('   }')
        logger.error("")
        raise FileNotFoundError("No training data available. Please add your JSON data files to the data directory.")
    
    logger.info(f"✅ Found {len(json_files)} training data files")
    return True

async def main():
    """Main training function"""
    logger.info("🚀 Starting SoundDitect model training...")
    
    # Load and validate configuration
    try:
        config = load_config()
        validate_config(config)
    except Exception as e:
        logger.error(f"❌ Configuration error: {e}")
        logger.error("Please ensure config.yaml exists and contains all required settings.")
        sys.exit(1)
    
    # Display configuration info
    logger.info(f"📂 Data directory: {config['data']['data_dir']}")
    logger.info(f"📤 Output directory: {config['data']['output_dir']}")
    logger.info(f"💾 Model save path: {config['data']['model_save_path']}")
    logger.info(f"🔄 Training epochs: {config['training']['epochs']}")
    logger.info(f"📦 Batch size: {config['training']['batch_size']}")
    
    # Check for training data before proceeding
    try:
        check_training_data(config['data']['data_dir'])
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)
    
    # Create required directories
    directories_to_create = [
        config['data']['output_dir'],
        config['data']['model_save_path'],
        Path(config['logging']['file']).parent  # Create logs directory
    ]
    
    for directory in directories_to_create:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Created directory: {directory}")
    
    # Initialize components
    logger.info("🔧 Initializing model manager...")
    model_manager = ModelManager(config)
    
    # Start training
    try:
        logger.info("🎯 Starting model training...")
        success = await model_manager.train_model()
        
        if success:
            logger.info("✅ Training completed successfully!")
            logger.info(f"💾 Model saved to: {config['data']['model_save_path']}")
            logger.info("🎉 Training process finished!")
        else:
            logger.error("❌ Training failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Training error: {e}")
        logger.error("Please check your configuration and data files.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
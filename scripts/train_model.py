#!/usr/bin/env python3
"""
Training Script for SoundDitect Model

This script handles model training with ClearML integration and memory-efficient
data loading for the sound anomaly detection system.
"""

import os
import sys
import yaml
import asyncio
import logging
import argparse
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
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

async def main():
    """Main training function"""
    parser = argparse.ArgumentParser(description='Train SoundDitect anomaly detection model')
    parser.add_argument('--config', type=str, help='Path to config file')
    parser.add_argument('--data-dir', type=str, help='Path to training data directory')
    parser.add_argument('--output-dir', type=str, help='Path to output directory')
    parser.add_argument('--epochs', type=int, help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, help='Training batch size')
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config()
    
    # Override config with command line arguments
    if args.data_dir:
        config['data']['data_dir'] = args.data_dir
    if args.output_dir:
        config['data']['output_dir'] = args.output_dir
    if args.epochs:
        config['training']['epochs'] = args.epochs
    if args.batch_size:
        config['training']['batch_size'] = args.batch_size
    
    logger.info("Starting SoundDitect model training...")
    logger.info(f"Data directory: {config['data']['data_dir']}")
    logger.info(f"Output directory: {config['data']['output_dir']}")
    
    # Create directories
    Path(config['data']['output_dir']).mkdir(parents=True, exist_ok=True)
    Path(config['data']['model_save_path']).mkdir(parents=True, exist_ok=True)
    
    # Initialize components
    model_manager = ModelManager(config)
    
    # Start training
    try:
        success = await model_manager.train_model()
        
        if success:
            logger.info("Training completed successfully!")
            logger.info(f"Model saved to: {config['data']['model_save_path']}")
        else:
            logger.error("Training failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Training error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
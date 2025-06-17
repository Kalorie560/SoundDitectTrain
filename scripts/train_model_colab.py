#!/usr/bin/env python3
"""
Training Script for SoundDitect Model - Google Colab Optimized
==============================================================

This script is specifically optimized for Google Colab T4 GPU training with:
- Memory optimizations for T4 constraints (12-13GB RAM)
- Kernel size 63 support with reduced memory footprint
- Mixed precision training for memory efficiency
- Aggressive memory management
- Session time optimizations for 12-hour Colab limits

Usage in Google Colab:
!python scripts/train_model_colab.py

All configuration is managed through config_colab.yaml file.
"""

# Comprehensive warning suppression for Colab compatibility
import warnings
import urllib3
import ssl
import os

# Suppress all urllib3 and SSL warnings
urllib3.disable_warnings()
warnings.filterwarnings("ignore", "urllib3*")
warnings.filterwarnings("ignore", "Unverified HTTPS request*")
warnings.filterwarnings("ignore", message=".*urllib3.*")

# Additional SSL configuration for Colab
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

import sys
import yaml
import json
import asyncio
import logging
import psutil
import torch
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from model_manager import ModelManager
from audio_processor import AudioProcessor

# Configure logging for Colab
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_colab_environment():
    """Setup Google Colab environment optimizations."""
    logger.info("🚀 Setting up Google Colab environment...")
    
    # Check if running in Colab
    try:
        import google.colab
        in_colab = True
        logger.info("✅ Running in Google Colab environment")
    except ImportError:
        in_colab = False
        logger.info("ℹ️ Not running in Colab (local environment)")
    
    # Memory information
    memory = psutil.virtual_memory()
    logger.info(f"💾 System Memory: {memory.total / (1024**3):.1f} GB total, {memory.available / (1024**3):.1f} GB available")
    
    # GPU information
    if torch.cuda.is_available():
        gpu_count = torch.cuda.device_count()
        for i in range(gpu_count):
            gpu_props = torch.cuda.get_device_properties(i)
            gpu_memory = gpu_props.total_memory / (1024**3)
            logger.info(f"🎮 GPU {i}: {gpu_props.name} ({gpu_memory:.1f} GB)")
    else:
        logger.warning("⚠️ No GPU available - training will be slow on CPU")
    
    # Set environment variables for optimal Colab performance
    os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:256'
    os.environ['CUDA_LAUNCH_BLOCKING'] = '0'  # Non-blocking for performance
    
    return in_colab

def load_colab_config():
    """Load Colab-optimized configuration from config_colab.yaml"""
    config_path = Path(__file__).parent.parent / "config_colab.yaml"
    if not config_path.exists():
        logger.warning("⚠️ config_colab.yaml not found, falling back to config.yaml")
        config_path = Path(__file__).parent.parent / "config.yaml"
        
    if not config_path.exists():
        raise FileNotFoundError(f"No configuration file found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    logger.info(f"📋 Loaded configuration from: {config_path.name}")
    return config

def validate_colab_config(config):
    """Validate configuration parameters for Colab environment"""
    required_sections = ['data', 'training', 'model', 'clearml']
    for section in required_sections:
        if section not in config:
            raise ValueError(f"Missing required configuration section: {section}")
    
    # Validate Colab-specific optimizations
    colab_config = config.get('colab', {})
    if colab_config:
        logger.info("✅ Colab optimizations detected in configuration")
        logger.info(f"   Memory limit: {config['data']['max_memory_usage']}")
        logger.info(f"   Batch size: {config['training']['batch_size']}")
        logger.info(f"   Input length: {config['model']['input_length']}")
        logger.info(f"   Mixed precision: {colab_config.get('mixed_precision', False)}")
        logger.info(f"   Gradient checkpointing: {colab_config.get('enable_gradient_checkpointing', False)}")
    
    # Check memory configuration is reasonable for Colab
    max_memory_str = config['data']['max_memory_usage']
    if max_memory_str.endswith('GB'):
        max_memory_gb = float(max_memory_str[:-2])
        if max_memory_gb > 10:
            logger.warning(f"⚠️ Memory limit ({max_memory_gb} GB) may be too high for Colab T4")
            logger.warning("   Consider using config_colab.yaml for optimized settings")
    
    logger.info("✅ Configuration validation passed")

def check_training_data_colab(data_dir):
    """Check if training data exists with Colab-specific guidance"""
    data_path = Path(data_dir)
    json_files = list(data_path.glob("*.json"))
    
    if not json_files:
        logger.error("❌ No training data found!")
        logger.error(f"📂 Looking for *.json files in: {data_path.absolute()}")
        logger.error("")
        logger.error("📱 Google Colab Data Upload Instructions:")
        logger.error("   1. Upload your JSON files to the Colab file browser")
        logger.error("   2. Create a 'data' folder in the file browser")
        logger.error("   3. Move your JSON files into the data folder")
        logger.error("   4. Or use: files.upload() to upload files programmatically")
        logger.error("")
        logger.error("📝 Expected JSON format:")
        logger.error('   {"waveforms": [[...]], "labels": ["OK", "NG"], "fs": 44100}')
        logger.error("")
        raise FileNotFoundError("No training data available. Please upload your JSON data files.")
    
    logger.info(f"✅ Found {len(json_files)} training data files")
    logger.info("📋 JSON files that will be used for training:")
    
    total_estimated_samples = 0
    for i, json_file in enumerate(json_files, 1):
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            # Estimate sample count
            sample_count = 0
            if isinstance(data, list):
                sample_count = len(data)
                logger.info(f"   {i}. {json_file.name} - Old format with ~{sample_count} entries")
            elif isinstance(data, dict) and 'waveforms' in data:
                waveforms = data.get('waveforms', [])
                labels = data.get('labels', [])
                sample_count = min(len(waveforms), len(labels))
                logger.info(f"   {i}. {json_file.name} - New format with ~{sample_count} samples")
            else:
                logger.warning(f"   {i}. {json_file.name} - Unknown format, will attempt to process")
                
            total_estimated_samples += sample_count
            
        except Exception as e:
            logger.warning(f"   {i}. {json_file.name} - Error reading file: {e}")
    
    logger.info(f"🎯 Estimated total samples: ~{total_estimated_samples}")
    
    # Provide training time estimates for Colab
    epochs = 50  # Default from config_colab.yaml
    estimated_time_per_epoch = max(1, total_estimated_samples // 100)  # Rough estimate
    total_estimated_time = epochs * estimated_time_per_epoch
    
    logger.info(f"⏱️ Estimated training time: ~{total_estimated_time} minutes for {epochs} epochs")
    if total_estimated_time > 600:  # 10 hours
        logger.warning("⚠️ Training may take longer than 10 hours - consider reducing epochs")
        logger.warning("   Colab sessions have a 12-hour limit")
    
    return True

def log_memory_usage():
    """Log current memory usage for Colab monitoring"""
    try:
        # System memory
        memory = psutil.virtual_memory()
        logger.info(f"💾 Memory: {memory.used / (1024**3):.1f} GB used / {memory.total / (1024**3):.1f} GB total ({memory.percent:.1f}%)")
        
        # GPU memory if available
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / (1024**3)
            reserved = torch.cuda.memory_reserved() / (1024**3)
            total = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            logger.info(f"🎮 GPU Memory: {allocated:.1f} GB allocated, {reserved:.1f} GB reserved / {total:.1f} GB total")
    except Exception as e:
        logger.warning(f"Could not get memory info: {e}")

async def main():
    """Main training function optimized for Google Colab"""
    logger.info("🚀 Starting SoundDitect model training (Colab Optimized)...")
    
    # Setup Colab environment
    in_colab = setup_colab_environment()
    
    # Log initial memory usage
    log_memory_usage()
    
    # Load and validate configuration
    try:
        config = load_colab_config()
        validate_colab_config(config)
    except Exception as e:
        logger.error(f"❌ Configuration error: {e}")
        if in_colab:
            logger.error("💡 Make sure config_colab.yaml is uploaded to your Colab environment")
        sys.exit(1)
    
    # Display configuration info
    logger.info(f"📂 Data directory: {config['data']['data_dir']}")
    logger.info(f"📤 Output directory: {config['data']['output_dir']}")
    logger.info(f"💾 Model save path: {config['data']['model_save_path']}")
    logger.info(f"🔄 Training epochs: {config['training']['epochs']}")
    logger.info(f"📦 Batch size: {config['training']['batch_size']}")
    logger.info(f"🔧 Memory limit: {config['data']['max_memory_usage']}")
    
    # Check for training data
    try:
        check_training_data_colab(config['data']['data_dir'])
    except FileNotFoundError as e:
        logger.error(str(e))
        if in_colab:
            logger.error("📱 Please upload your training data using the Colab file browser")
        sys.exit(1)
    
    # Create required directories
    directories_to_create = [
        config['data']['output_dir'],
        config['data']['model_save_path'],
        Path(config['logging']['file']).parent
    ]
    
    for directory in directories_to_create:
        Path(directory).mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Created directory: {directory}")
    
    # Initialize components
    logger.info("🔧 Initializing model manager...")
    model_manager = ModelManager(config)
    
    # Log memory after initialization
    log_memory_usage()
    
    # Start training with time tracking
    import time
    start_time = time.time()
    
    try:
        logger.info("🎯 Starting model training...")
        success = await model_manager.train_model()
        
        end_time = time.time()
        training_time = (end_time - start_time) / 60  # minutes
        
        if success:
            logger.info("✅ Training completed successfully!")
            logger.info(f"⏱️ Training time: {training_time:.1f} minutes")
            logger.info(f"💾 Model saved to: {config['data']['model_save_path']}")
            
            # Final memory usage
            log_memory_usage()
            
            if in_colab:
                logger.info("📱 Don't forget to download your trained model from the file browser!")
                logger.info("   The model is saved in the 'models' folder")
            
            logger.info("🎉 Training process finished!")
        else:
            logger.error("❌ Training failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Training error: {e}")
        if "memory" in str(e).lower():
            logger.error("💡 Try reducing batch_size or input_length in config_colab.yaml")
        logger.error("Please check your configuration and data files.")
        sys.exit(1)

if __name__ == "__main__":
    # Set up asyncio for Colab compatibility
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If running in notebook, create a new task
            import nest_asyncio
            nest_asyncio.apply()
    except:
        pass
    
    asyncio.run(main())
#!/usr/bin/env python3
"""
SoundDitect Server Startup Script

This script starts the FastAPI server for the SoundDitect application
with proper configuration and error handling.
"""

import os
import sys
import yaml
import uvicorn
import logging
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).parent / "backend"))

def setup_logging():
    """Set up logging configuration"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('logs/soundditect.log', mode='a')
        ]
    )

def load_config():
    """Load configuration from config.yaml"""
    config_path = Path(__file__).parent / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def create_directories(config):
    """Create necessary directories"""
    directories = [
        config['data']['data_dir'],
        config['data']['output_dir'],
        config['data']['model_save_path'],
        'logs'
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)

def main():
    """Main function to start the server"""
    try:
        # Load configuration
        config = load_config()
        
        # Create necessary directories
        create_directories(config)
        
        # Set up logging
        setup_logging()
        logger = logging.getLogger(__name__)
        
        logger.info("Starting SoundDitect server...")
        logger.info(f"Host: {config['server']['host']}")
        logger.info(f"Port: {config['server']['port']}")
        logger.info(f"Debug mode: {config['server']['debug']}")
        
        # Start the server
        uvicorn.run(
            "backend.main:app",
            host=config['server']['host'],
            port=config['server']['port'],
            reload=config['server']['debug'],
            log_level="info",
            access_log=True
        )
        
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyError as e:
        print(f"Configuration error - missing key: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
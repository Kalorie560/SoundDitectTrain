"""
SoundDitect Backend API
Real-time Sound Anomaly Detection System

This module provides the main FastAPI application with WebSocket support
for real-time audio processing and anomaly detection.
"""

import asyncio
import json
import logging
import numpy as np
import torch
import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import base64
import wave
import io
from pathlib import Path

from .audio_processor import AudioProcessor
from .model_manager import ModelManager
from .websocket_manager import WebSocketManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
config_path = Path(__file__).parent.parent / "config.yaml"
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# Initialize FastAPI app
app = FastAPI(
    title="SoundDitect API",
    description="Real-time Sound Anomaly Detection System",
    version=config['project']['version']
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config['server']['cors_origins'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize managers
audio_processor = AudioProcessor(config)
model_manager = ModelManager(config)
websocket_manager = WebSocketManager()

# Note: Static files will be mounted after all API routes and WebSocket endpoints are defined

@app.on_event("startup")
async def startup_event():
    """Initialize the application on startup."""
    logger.info("Starting SoundDitect backend...")
    
    # Load the trained model
    try:
        await model_manager.load_model()
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.warning(f"Could not load model: {e}")
        logger.info("Model will be trained on first use")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown."""
    logger.info("Shutting down SoundDitect backend...")
    await websocket_manager.disconnect_all()

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "SoundDitect API",
        "version": config['project']['version'],
        "model_loaded": model_manager.is_model_loaded()
    }

@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    return {
        "audio": config['audio'],
        "model": {
            "architecture": config['model']['architecture'],
            "num_classes": config['model']['num_classes']
        },
        "inference": config['inference']
    }

@app.post("/api/train")
async def start_training():
    """Start model training process."""
    try:
        # This would typically be a background task
        training_task = asyncio.create_task(model_manager.train_model())
        return {
            "status": "training_started",
            "message": "Model training has been initiated"
        }
    except Exception as e:
        logger.error(f"Training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/audio")
async def websocket_audio_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio processing.
    
    Expected message format:
    {
        "type": "audio_data",
        "data": "base64_encoded_audio_data",
        "sample_rate": 44100
    }
    """
    await websocket.accept()
    client_id = await websocket_manager.connect(websocket)
    
    try:
        await websocket.send_json({
            "type": "connection_established",
            "client_id": client_id,
            "message": "接続が確立されました (Connection established)"
        })
        
        while True:
            # Receive audio data from client
            message = await websocket.receive_text()
            data = json.loads(message)
            
            if data.get("type") == "audio_data":
                try:
                    # Process audio data
                    audio_result = await process_audio_message(data)
                    
                    # Send result back to client
                    await websocket.send_json({
                        "type": "detection_result",
                        "timestamp": audio_result["timestamp"],
                        "prediction": audio_result["prediction"],
                        "confidence": audio_result["confidence"],
                        "status": "OK" if audio_result["prediction"] == 0 else "NG",
                        "message": "正常" if audio_result["prediction"] == 0 else "異常検知!"
                    })
                    
                except Exception as e:
                    logger.error(f"Audio processing error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"音声処理エラー: {str(e)}"
                    })
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket_manager.disconnect(client_id)

async def process_audio_message(data: Dict) -> Dict:
    """
    Process incoming audio data and return prediction result.
    
    Args:
        data: Dictionary containing audio data and metadata
        
    Returns:
        Dictionary with prediction results
    """
    try:
        # Decode base64 audio data
        audio_data = base64.b64decode(data["data"])
        sample_rate = data.get("sample_rate", config['audio']['sample_rate'])
        
        # Convert to numpy array
        audio_array = np.frombuffer(audio_data, dtype=np.float32)
        
        # Process audio through the pipeline
        processed_audio = audio_processor.preprocess(audio_array, sample_rate)
        
        # Get prediction from model
        prediction, confidence = await model_manager.predict(processed_audio)
        
        return {
            "timestamp": asyncio.get_event_loop().time(),
            "prediction": int(prediction),
            "confidence": float(confidence),
            "sample_rate": sample_rate,
            "audio_length": len(audio_array)
        }
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        raise

@app.get("/api/stats")
async def get_stats():
    """Get system statistics."""
    return {
        "connected_clients": websocket_manager.get_connection_count(),
        "model_loaded": model_manager.is_model_loaded(),
        "total_predictions": getattr(model_manager, 'prediction_count', 0),
        "uptime": getattr(app.state, 'start_time', 0)
    }

# Mount static files (frontend) - This must be done AFTER all API routes and WebSocket endpoints
# to prevent static file handler from intercepting API requests
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config['server']['host'],
        port=config['server']['port'],
        reload=config['server']['debug'],
        log_level="info"
    )
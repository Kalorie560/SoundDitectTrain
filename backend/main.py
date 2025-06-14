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
    
    Expected message formats:
    - Start recording: {"type": "start_recording", "session_id": "..."}
    - Audio data: {"type": "audio_data", "data": "...", "session_id": "..."}
    - Stop recording: {"type": "stop_recording", "session_id": "..."}
    - Ping: {"type": "ping"}
    """
    await websocket.accept()
    client_id = await websocket_manager.connect(websocket)
    
    # Track recording session state
    recording_session = None
    is_processing = False
    
    try:
        await websocket.send_json({
            "type": "connection_established",
            "client_id": client_id,
            "message": "接続が確立されました (Connection established)"
        })
        
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "start_recording":
                # Start recording session
                recording_session = data.get("session_id")
                is_processing = True
                logger.info(f"Client {client_id} started recording session: {recording_session}")
                
                await websocket.send_json({
                    "type": "recording_started",
                    "session_id": recording_session,
                    "message": "録音セッションが開始されました"
                })
                
            elif message_type == "stop_recording":
                # Stop recording session
                session_id = data.get("session_id")
                if session_id == recording_session:
                    is_processing = False
                    logger.info(f"Client {client_id} stopped recording session: {recording_session}")
                    
                    await websocket.send_json({
                        "type": "recording_stopped",
                        "session_id": recording_session,
                        "message": "録音セッションが停止されました"
                    })
                    
                    recording_session = None
                else:
                    logger.warning(f"Session ID mismatch: {session_id} vs {recording_session}")
                
            elif message_type == "audio_data":
                # Only process audio if we have an active recording session
                session_id = data.get("session_id")
                if is_processing and session_id == recording_session:
                    try:
                        # Process audio data
                        logger.debug(f"Processing audio data for session: {recording_session}")
                        audio_result = await process_audio_message(data)
                        
                        # Log the prediction result for debugging
                        logger.info(f"Prediction result - Session: {recording_session}, "
                                  f"Prediction: {audio_result['prediction']}, "
                                  f"Confidence: {audio_result['confidence']:.3f}")
                        
                        # Prepare response
                        result_message = {
                            "type": "detection_result",
                            "session_id": recording_session,
                            "timestamp": audio_result["timestamp"],
                            "prediction": audio_result["prediction"],
                            "confidence": audio_result["confidence"],
                            "status": "OK" if audio_result["prediction"] == 0 else "NG",
                            "message": "正常" if audio_result["prediction"] == 0 else "異常検知!"
                        }
                        
                        # Send result back to client
                        await websocket.send_json(result_message)
                        logger.debug(f"Detection result sent to client: {result_message}")
                        
                    except Exception as e:
                        logger.error(f"Audio processing error: {e}")
                        error_message = {
                            "type": "error",
                            "session_id": recording_session,
                            "message": f"音声処理エラー: {str(e)}"
                        }
                        await websocket.send_json(error_message)
                        logger.debug(f"Error message sent to client: {error_message}")
                else:
                    # Audio data received without active session - ignore
                    logger.debug(f"Ignoring audio data - no active session or session mismatch")
            
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if recording_session:
            logger.info(f"Cleaning up recording session {recording_session} for client {client_id}")
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
        logger.debug(f"Received audio data: {len(audio_array)} samples at {sample_rate}Hz")
        
        # Validate audio data
        if len(audio_array) == 0:
            logger.warning("Received empty audio data")
            return {
                "timestamp": asyncio.get_event_loop().time(),
                "prediction": 0,
                "confidence": 0.5,
                "sample_rate": sample_rate,
                "audio_length": 0,
                "error": "Empty audio data"
            }
        
        # Process audio through the pipeline
        processed_audio = audio_processor.preprocess(audio_array, sample_rate)
        logger.debug(f"Processed audio: {len(processed_audio)} samples")
        
        # Ensure model is loaded before prediction
        if not model_manager.is_model_loaded():
            logger.warning("Model not loaded, attempting to load...")
            await model_manager.load_model()
        
        # Get prediction from model
        prediction, confidence = await model_manager.predict(processed_audio)
        logger.debug(f"Model prediction: {prediction}, confidence: {confidence}")
        
        return {
            "timestamp": asyncio.get_event_loop().time(),
            "prediction": int(prediction),
            "confidence": float(confidence),
            "sample_rate": sample_rate,
            "audio_length": len(audio_array)
        }
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}", exc_info=True)
        # Return a default result instead of raising to prevent WebSocket disconnect
        return {
            "timestamp": asyncio.get_event_loop().time(),
            "prediction": 0,
            "confidence": 0.0,
            "sample_rate": data.get("sample_rate", config['audio']['sample_rate']),
            "audio_length": 0,
            "error": str(e)
        }

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
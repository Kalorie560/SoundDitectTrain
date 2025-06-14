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
    """Initialize the application on startup with comprehensive model loading."""
    logger.info("🚀 Starting SoundDitect backend...")
    
    # Create necessary directories
    import os
    os.makedirs("models", exist_ok=True)
    os.makedirs("data", exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Load the trained model (with fallback to baseline)
    try:
        model_loaded = await model_manager.load_model()
        if model_loaded:
            logger.info("✅ Model initialization completed successfully")
        else:
            logger.warning("⚠️ Model loading failed, but continuing with fallback")
    except Exception as e:
        logger.error(f"❌ Model initialization error: {e}")
        logger.info("🔄 System will attempt model creation on first prediction")
    
    logger.info("🎯 SoundDitect backend startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Enhanced cleanup on application shutdown to prevent resource leaks."""
    logger.info("🔄 Shutting down SoundDitect backend...")
    
    try:
        # Disconnect all WebSocket connections
        await websocket_manager.disconnect_all()
        logger.info("✅ WebSocket connections closed")
        
        # Clean up model resources
        if model_manager.model is not None:
            del model_manager.model
            logger.info("✅ Model resources cleaned up")
        
        # Force garbage collection to help with resource cleanup
        import gc
        gc.collect()
        
        # Clean up ClearML task if it exists
        if hasattr(model_manager, 'task') and model_manager.task is not None:
            try:
                model_manager.task.close()
                logger.info("✅ ClearML task closed")
            except Exception as clearml_error:
                logger.debug(f"ClearML cleanup note: {clearml_error}")
        
        logger.info("✅ SoundDitect backend shutdown complete")
        
    except Exception as e:
        logger.error(f"⚠️ Error during shutdown: {e}")
        
    # Additional cleanup for macOS semaphore issues
    import platform
    if platform.system() == 'Darwin':
        try:
            import multiprocessing
            multiprocessing.current_process().terminate()
        except:
            pass

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
                        # Process audio data with enhanced logging
                        start_time = asyncio.get_event_loop().time()
                        logger.info(f"🎧 Processing audio data for session: {recording_session}")
                        
                        audio_result = await process_audio_message(data)
                        
                        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
                        
                        # Enhanced logging for debugging
                        logger.info(f"🎯 Prediction result - Session: {recording_session}, "
                                  f"Prediction: {audio_result['prediction']}, "
                                  f"Confidence: {audio_result['confidence']:.3f}, "
                                  f"Processing time: {processing_time:.1f}ms")
                        
                        # Check for processing errors
                        if 'error' in audio_result:
                            logger.warning(f"⚠️ Audio processing warning: {audio_result['error']}")
                        
                        # Prepare enhanced response
                        result_message = {
                            "type": "detection_result",
                            "session_id": recording_session,
                            "timestamp": audio_result["timestamp"],
                            "prediction": audio_result["prediction"],
                            "confidence": audio_result["confidence"],
                            "status": "OK" if audio_result["prediction"] == 0 else "NG",
                            "message": "正常" if audio_result["prediction"] == 0 else "異常検知!",
                            "processing_time_ms": processing_time,
                            "audio_length": audio_result.get("audio_length", 0)
                        }
                        
                        # Add error information if present
                        if 'error' in audio_result:
                            result_message["warning"] = audio_result['error']
                        
                        # Send result back to client
                        await websocket.send_json(result_message)
                        logger.info(f"✅ Detection result sent successfully to client")
                        
                    except Exception as e:
                        logger.error(f"❌ Audio processing error: {e}", exc_info=True)
                        error_message = {
                            "type": "error",
                            "session_id": recording_session,
                            "message": f"音声処理エラー: {str(e)}",
                            "timestamp": asyncio.get_event_loop().time()
                        }
                        try:
                            await websocket.send_json(error_message)
                            logger.info("ℹ️ Error message sent to client")
                        except Exception as send_error:
                            logger.error(f"❌ Failed to send error message: {send_error}")
                else:
                    # Audio data received without active session - log for debugging
                    logger.debug(f"⏸️ Ignoring audio data - Session active: {is_processing}, "
                               f"Session ID match: {session_id == recording_session}")
            
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
    Process incoming audio data and return prediction result with enhanced error handling.
    
    Args:
        data: Dictionary containing audio data and metadata
        
    Returns:
        Dictionary with prediction results
    """
    try:
        # Validate input data structure
        if not isinstance(data, dict) or "data" not in data:
            raise ValueError("Invalid audio data format: missing 'data' field")
        
        # Decode base64 audio data with validation
        try:
            audio_data = base64.b64decode(data["data"])
        except Exception as decode_error:
            raise ValueError(f"Failed to decode base64 audio data: {decode_error}")
        
        sample_rate = data.get("sample_rate", config['audio']['sample_rate'])
        
        # Convert to numpy array with proper validation
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
        except ValueError as convert_error:
            raise ValueError(f"Failed to convert audio data to numpy array: {convert_error}")
        
        logger.info(f"📊 Audio data received: {len(audio_array)} samples at {sample_rate}Hz")
        
        # Validate audio data size and content
        if len(audio_array) == 0:
            logger.warning("⚠️ Received empty audio data")
            return {
                "timestamp": asyncio.get_event_loop().time(),
                "prediction": 0,
                "confidence": 0.5,
                "sample_rate": sample_rate,
                "audio_length": 0,
                "error": "Empty audio data"
            }
        
        # Check for silence or very low amplitude
        max_amplitude = np.max(np.abs(audio_array))
        if max_amplitude < 1e-6:
            logger.info(f"🔇 Very quiet audio detected (max amplitude: {max_amplitude:.2e})")
        
        # Process audio through the pipeline
        try:
            processed_audio = audio_processor.preprocess(audio_array, sample_rate)
            logger.info(f"⚙️ Audio preprocessing complete: {len(processed_audio)} samples")
        except Exception as preprocess_error:
            logger.error(f"❌ Audio preprocessing failed: {preprocess_error}")
            raise ValueError(f"Audio preprocessing failed: {preprocess_error}")
        
        # Ensure model is loaded before prediction
        if not model_manager.is_model_loaded():
            logger.warning("⚠️ Model not loaded, attempting to load...")
            load_success = await model_manager.load_model()
            if not load_success:
                raise RuntimeError("Failed to load model for prediction")
            logger.info("✅ Model loaded successfully")
        
        # Get prediction from model with timing
        try:
            prediction_start = asyncio.get_event_loop().time()
            prediction, confidence = await model_manager.predict(processed_audio)
            prediction_time = (asyncio.get_event_loop().time() - prediction_start) * 1000
            
            logger.info(f"🧠 Model prediction complete: {prediction} (confidence: {confidence:.3f}, time: {prediction_time:.1f}ms)")
        except Exception as prediction_error:
            logger.error(f"❌ Model prediction failed: {prediction_error}")
            raise RuntimeError(f"Model prediction failed: {prediction_error}")
        
        # Validate prediction results
        if not isinstance(prediction, (int, float)) or not isinstance(confidence, (int, float)):
            logger.warning(f"⚠️ Invalid prediction format: {type(prediction)}, {type(confidence)}")
            prediction, confidence = int(prediction), float(confidence)
        
        # Create comprehensive result
        result = {
            "timestamp": asyncio.get_event_loop().time(),
            "prediction": int(prediction),
            "confidence": float(confidence),
            "sample_rate": sample_rate,
            "audio_length": len(audio_array),
            "max_amplitude": float(max_amplitude),
            "processing_info": {
                "preprocessed_length": len(processed_audio),
                "prediction_time_ms": prediction_time if 'prediction_time' in locals() else 0
            }
        }
        
        logger.info(f"✅ Audio processing completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"❌ Critical error processing audio: {e}", exc_info=True)
        # Return a safe default result to prevent WebSocket disconnect
        return {
            "timestamp": asyncio.get_event_loop().time(),
            "prediction": 0,
            "confidence": 0.0,
            "sample_rate": data.get("sample_rate", config['audio']['sample_rate']),
            "audio_length": 0,
            "max_amplitude": 0.0,
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
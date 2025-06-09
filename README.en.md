# SoundDitect

Real-time Sound Anomaly Detection AI Application

## Overview

SoundDitect is a high-responsiveness, high-precision web application that analyzes real-time audio streams from PC microphones to detect "anomalous sounds" such as impact sounds and notify users immediately.

## Key Features

- 🎤 **Real-time Audio Monitoring**: Analyzes audio from PC microphone at 1-second intervals
- 🧠 **AI Anomaly Detection**: High-precision anomalous sound detection using 1D-CNN + Attention mechanism
- 💻 **Web-based Interface**: Intuitive Japanese UI running in browsers
- 📊 **Real-time Visualization**: Real-time display of audio waveforms and frequency spectrums
- 📈 **Experiment Management**: Recording and management of learning processes with ClearML
- ⚡ **Memory Efficiency**: Streaming processing for large-scale data handling

## Technical Design Decisions

### AI Architecture Selection

**1D-CNN with Multi-Head Attention** was chosen for the following reasons:
- **Temporal Pattern Recognition**: 1D-CNNs excel at detecting local patterns in time-series audio data
- **Attention Mechanism**: Enables the model to focus on the most relevant time frames for anomaly detection
- **Computational Efficiency**: Suitable for real-time inference requirements
- **Proven Effectiveness**: Well-established architecture for audio classification tasks

**PyTorch Framework** was selected because:
- **Flexibility**: Allows for rapid prototyping and experimentation with custom architectures
- **Dynamic Computation**: Better suited for variable-length audio processing
- **Research Community**: Strong support for audio processing and anomaly detection research

**ClearML Integration** provides:
- **Experiment Reproducibility**: Ensures all training runs can be replicated
- **Model Versioning**: Tracks different model iterations and performance metrics
- **Collaborative Development**: Enables team collaboration on model improvements

### Backend/Frontend Technology Stack

**FastAPI Backend** was chosen for:
- **Asynchronous Processing**: Native support for async/await patterns essential for real-time audio
- **WebSocket Support**: Built-in WebSocket capabilities for low-latency communication
- **High Performance**: One of the fastest Python web frameworks
- **Automatic Documentation**: Self-generating API documentation

**Web Audio API Frontend** provides:
- **Direct Hardware Access**: Low-level access to microphone without additional plugins
- **Real-time Processing**: Minimal latency for audio capture and processing
- **Browser Compatibility**: Works across modern browsers without installation
- **Fine-grained Control**: Precise control over audio parameters and processing

**WebSocket Communication** enables:
- **Bidirectional Communication**: Real-time data exchange between client and server
- **Low Latency**: Minimal overhead compared to HTTP polling
- **Event-driven**: Immediate notification of detection results

## Architecture Overview

### System Components

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Frontend      │◄──────────────►│   Backend       │
│                 │                 │                 │
│ • Web Audio API │                 │ • FastAPI       │
│ • Real-time UI  │                 │ • Audio Proc.   │
│ • Visualization │                 │ • AI Model      │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │ Microphone                        │ ClearML
         ▼                                   ▼
┌─────────────────┐                 ┌─────────────────┐
│ Audio Hardware  │                 │ Experiment      │
│                 │                 │ Tracking        │
└─────────────────┘                 └─────────────────┘
```

### AI Model Architecture

```
Audio Input (44.1kHz, 1 second)
         │
         ▼
┌─────────────────┐
│  Preprocessing  │ ← Bandpass Filter, Normalization
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   1D-CNN Stack  │ ← Feature Extraction (64→128→256 filters)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Multi-Head      │ ← Attention over temporal features
│ Attention       │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Global Average  │ ← Pooling across time dimension
│ Pooling         │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Fully Connected │ ← Classification layers with dropout
│ + Dropout       │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Binary Output   │ ← Normal (0) vs Anomaly (1)
└─────────────────┘
```

### Real-time Processing Pipeline

1. **Audio Capture**: Web Audio API captures 44.1kHz audio in 1024-sample chunks
2. **Buffer Management**: Maintains a rolling 1-second buffer (44,100 samples)
3. **Preprocessing**: Applies bandpass filtering (20Hz-8kHz) and normalization
4. **Data Transmission**: Base64-encoded audio sent via WebSocket
5. **Model Inference**: Server-side PyTorch model processes audio data
6. **Result Broadcasting**: Detection results sent back to all connected clients
7. **UI Update**: Interface updates within 200ms of detection

## Installation and Setup

### Prerequisites

- Python 3.8+ with pip
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access permissions

### Quick Start

1. **Clone Repository**
```bash
git clone https://github.com/Kalorie560/SoundDitect.git
cd SoundDitect
```

2. **Setup Environment**
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **ClearML Setup** (Required)
```bash
# Configure ClearML (choose one method)

# Method 1: Automatic setup (recommended)
python scripts/setup_clearml.py

# Method 2: Manual setup
clearml-init

# Method 3: Environment variables
export CLEARML_WEB_HOST=https://app.clear.ml
export CLEARML_API_HOST=https://api.clear.ml
export CLEARML_FILES_HOST=https://files.clear.ml
export CLEARML_API_ACCESS_KEY=your_access_key_here
export CLEARML_API_SECRET_KEY=your_secret_key_here
```

> 🌟 **ClearML Account**: Create account at [https://app.clear.ml](https://app.clear.ml) and get credentials from profile page.

4. **Generate Sample Data** (Optional)
```bash
# All settings read from config.yaml
python scripts/generate_sample_data.py
```

5. **Train Model** (Optional)
```bash
# All settings read from config.yaml  
python scripts/train_model.py
```

6. **Start Application**
```bash
python run_server.py
```

7. **Access Interface**
   - Open browser to `http://localhost:8000`
   - Allow microphone access when prompted
   - Click "録音開始" (Start Recording) to begin detection

## Data Format Specification

Training data must be provided as JSON files with the following structure:

```json
[
  {
    "Waveform": [0.1234, -0.2345, 0.3456, ...],
    "Labels": 0
  },
  {
    "Waveform": [0.9876, -0.8765, 0.7654, ...],
    "Labels": 1
  }
]
```

**Fields:**
- `Waveform`: Array of 44,100 float values representing 1 second of audio at 44.1kHz
- `Labels`: Integer (0 = Normal, 1 = Anomaly)

**Memory Efficiency:**
- Data is loaded using generators to avoid loading entire dataset into memory
- Supports datasets larger than available RAM
- Configurable batch processing and prefetching

## Configuration

All system parameters are configurable via `config.yaml`:

### Model Configuration
```yaml
model:
  architecture: "1d_cnn_attention"
  input_length: 44100
  cnn_layers:
    - filters: 64
      kernel_size: 3
  attention:
    hidden_dim: 256
    num_heads: 8
```

### Training Configuration
```yaml
training:
  batch_size: 32
  epochs: 100
  learning_rate: 0.001
  early_stopping:
    patience: 10
```

### Audio Processing
```yaml
audio:
  sample_rate: 44100
  chunk_size: 1024
  detection_interval: 1.0
```

## Performance Optimization

### Model Optimization
- **Mixed Precision Training**: Reduces memory usage and speeds up training
- **Gradient Accumulation**: Enables larger effective batch sizes
- **Learning Rate Scheduling**: Adaptive learning rate for better convergence

### Real-time Optimization
- **Audio Buffer Management**: Circular buffers for efficient memory usage
- **WebSocket Connection Pooling**: Handles multiple concurrent clients
- **Async Processing**: Non-blocking audio processing pipeline

### Memory Management
- **Data Generators**: Stream data from disk without full loading
- **Model Checkpointing**: Saves memory by checkpointing during training
- **Cache Management**: LRU caches for frequently accessed data

## ClearML Integration

### Setup
```bash
clearml-init  # Configure credentials
```

### Experiment Tracking
- **Hyperparameters**: Automatically logged from config.yaml
- **Metrics**: Loss, accuracy, validation metrics tracked in real-time
- **Models**: Automatic model versioning and storage
- **Artifacts**: Training logs, plots, and model files

### Visualization
```bash
clearml-serving --open  # Launch web interface
```

## API Documentation

### REST Endpoints

- `GET /api/health` - System health check
- `GET /api/config` - Current configuration
- `POST /api/train` - Start model training

### WebSocket Protocol

**Client → Server:**
```json
{
  "type": "audio_data",
  "data": "base64_encoded_audio",
  "sample_rate": 44100
}
```

**Server → Client:**
```json
{
  "type": "detection_result",
  "prediction": 0,
  "confidence": 0.85,
  "status": "OK",
  "message": "正常"
}
```

## Development Guidelines

### Code Style
- **Python**: Follow PEP 8 with Black formatting
- **JavaScript**: ESLint with Airbnb configuration
- **Documentation**: Comprehensive docstrings and comments

### Testing
```bash
pytest tests/                    # Run Python tests
npm test                        # Run JavaScript tests
pytest --cov=backend tests/     # Coverage report
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## Troubleshooting

### Common Issues

**Microphone Access Denied**
- Check browser permissions
- Ensure HTTPS in production
- Clear browser cache

**Model Training Fails**
- Verify data format matches specification
- Check available memory
- Reduce batch size if needed

**WebSocket Connection Fails**
- Check firewall settings
- Verify server is running
- Check browser developer console

**Poor Detection Performance**
- Increase training data quantity
- Adjust model hyperparameters
- Check audio preprocessing settings

### Performance Monitoring

Monitor system performance using:
- **CPU Usage**: Should remain below 80% during inference
- **Memory Usage**: Monitor for memory leaks in long-running sessions
- **Network Latency**: WebSocket round-trip should be < 100ms
- **Model Accuracy**: Use validation metrics to assess performance

## Future Enhancements

### Planned Features
- **Multi-class Classification**: Detect specific types of anomalies
- **Adaptive Thresholds**: Dynamic sensitivity adjustment
- **Edge Deployment**: TensorFlow Lite/ONNX model conversion
- **Mobile Support**: Progressive Web App features

### Research Directions
- **Self-supervised Learning**: Reduce labeled data requirements
- **Continual Learning**: Online model adaptation
- **Federated Learning**: Distributed training across devices
- **Explainable AI**: Visualization of decision patterns

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Acknowledgments

- **PyTorch Team**: For the excellent deep learning framework
- **FastAPI Team**: For the high-performance web framework
- **ClearML Team**: For experiment management capabilities
- **Web Audio API**: For enabling browser-based audio processing
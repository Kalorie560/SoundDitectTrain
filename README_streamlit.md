# SoundDitect - Streamlit Edition

🎵 **Simple, Reliable Audio Anomaly Detection**

This is a simplified, robust version of SoundDitect built with Streamlit that provides the same functionality as the original JavaScript frontend but with much better reliability and user experience.

## ✨ Features

### 🎯 **Mode Selection**
- **Real-time Mode**: Live audio processing with immediate anomaly detection
- **Offline Mode**: Record audio, then analyze with detailed waveform visualization

### 📊 **Analysis Capabilities**
- Real-time audio anomaly detection using AI models
- Detailed waveform analysis with judgment overlays
- Statistical summaries and downloadable results
- Interactive visualizations with Plotly

### 🛠️ **Technical Improvements**
- **Zero JavaScript Complexity**: Pure Python with Streamlit
- **Automatic State Management**: No manual DOM manipulation
- **Robust Error Handling**: Built-in Streamlit error recovery
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Automatic UI refreshing

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements_streamlit.txt
```

### 2. Run the Application
```bash
python run_streamlit.py
```

This will start:
- **FastAPI Backend**: http://localhost:8000
- **Streamlit Frontend**: http://localhost:8501

### 3. Use the Application
1. Open http://localhost:8501 in your browser
2. Select your desired mode (Real-time or Offline)
3. Start recording and analyzing audio!

## 📋 System Requirements

- **Python**: 3.8+ 
- **Memory**: 4GB+ RAM
- **Audio**: Microphone access required
- **Browser**: Modern browser with audio support

## 🎨 User Interface

### Mode Selection
- Large, clear mode selection cards
- Immediate visual feedback
- Simple navigation

### Real-time Mode
- Live connection status
- Real-time waveform visualization
- Instant anomaly alerts
- Adjustable sensitivity

### Offline Mode
- Configurable recording duration (5-60 seconds)
- Progress indicators during recording and analysis
- Detailed waveform with anomaly overlays
- Interactive results table
- Downloadable analysis reports

## 🔧 Architecture

```
┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐
│                 │◄────────────────────►│                 │
│   Streamlit     │                      │   FastAPI       │
│   Frontend      │                      │   Backend       │
│                 │                      │                 │
└─────────────────┘                      └─────────────────┘
         │                                        │
         │                                        │
         ▼                                        ▼
┌─────────────────┐                      ┌─────────────────┐
│   Plotly        │                      │   AI Model      │
│   Visualizations│                      │   Audio Proc.   │
└─────────────────┘                      └─────────────────┘
```

## 📊 Benefits Over Original

| Feature | Original (JavaScript) | Streamlit Edition |
|---------|----------------------|-------------------|
| **Complexity** | 2700+ lines JS | 400 lines Python |
| **Reliability** | Fragile DOM deps | Auto state mgmt |
| **Error Handling** | Manual recovery | Built-in recovery |
| **Mobile Support** | Limited | Fully responsive |
| **Maintenance** | High | Low |
| **Development** | Complex debugging | Simple Python |

## 🔍 Troubleshooting

### Common Issues

**Backend Not Running**
```bash
# Check if backend is accessible
curl http://localhost:8000/

# If not, ensure run_streamlit.py is running
python run_streamlit.py
```

**Audio Not Working**
- Ensure microphone permissions are granted
- Check browser audio settings
- Verify microphone is not used by other applications

**Slow Performance**
- Check CPU usage during real-time mode
- Consider using offline mode for better performance
- Reduce recording duration if needed

## 📝 Configuration

The application uses the same `config.yaml` file as the original version:

```yaml
# Audio settings
audio:
  sample_rate: 44100
  channels: 1
  
# Server settings
server:
  host: "0.0.0.0"
  port: 8000
```

## 🧪 Development

### Running in Development Mode
```bash
# Backend only
uvicorn backend.main:app --reload --port 8000

# Frontend only  
streamlit run app_streamlit.py --server.port 8501
```

### Adding Features
The Streamlit architecture makes it easy to add new features:

1. **New Visualizations**: Add Plotly charts in the results section
2. **Additional Modes**: Add new mode options in the sidebar
3. **Export Formats**: Add new download formats (CSV, Excel, etc.)
4. **Settings**: Add configuration options in the sidebar

## 📚 Further Reading

- [Streamlit Documentation](https://docs.streamlit.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Plotly Documentation](https://plotly.com/python/)

## 💡 Why This Approach Works

1. **Simplicity**: Streamlit handles all UI complexity automatically
2. **Reliability**: No fragile JavaScript event handling or DOM manipulation  
3. **Maintainability**: Single Python codebase is easier to debug and extend
4. **User Experience**: Consistent, responsive interface that works reliably
5. **Development Speed**: Rapid prototyping and feature addition

---

**SoundDitect Streamlit Edition** - Reliable audio anomaly detection made simple! 🎉
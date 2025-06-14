# SoundDitect - Installation Guide

## Quick Start (Recommended)

### 1. Clone and Setup
```bash
git clone https://github.com/Kalorie560/SoundDitect.git
cd SoundDitect

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Run automatic setup
python setup.py
```

### 2. Start the Application

**Option A: Traditional Version (HTML + JavaScript)**
```bash
python run_server.py
```
Then open: http://localhost:8000

**Option B: Streamlit Version (Modern UI)**
```bash
python run_streamlit.py
```
Then open: http://localhost:8501

---

## Manual Installation

If the automatic setup doesn't work, try manual installation:

### Step 1: Install Base Requirements
```bash
pip install -r requirements.txt
```

### Step 2: Install Streamlit Requirements (Optional)
```bash
pip install -r requirements_streamlit.txt
```

### Step 3: Start Application
```bash
# Traditional version
python run_server.py

# OR Streamlit version (if installed)
python run_streamlit.py
```

---

## Troubleshooting

### Common Issues

**1. "No module named streamlit"**
```bash
# Install Streamlit dependencies
pip install -r requirements_streamlit.txt
```

**2. "Mode selection not working"**
- Refresh the browser page
- Check browser console (F12) for errors
- Try the Streamlit version instead

**3. "Microphone not detected"**
- Enable microphone permissions in browser
- Check system microphone settings
- Try different browser (Chrome recommended)

**4. "Connection timeout"**
- Make sure backend is running first
- Check firewall settings
- Try restarting the application

### Browser Compatibility

**Recommended Browsers:**
- Chrome (best support)
- Firefox
- Safari
- Edge

**Not supported:**
- Internet Explorer

### System Requirements

**Minimum:**
- Python 3.8+
- 4GB RAM
- Modern web browser
- Microphone access

**Recommended:**
- Python 3.9+
- 8GB RAM
- Fast CPU for real-time processing
- Chrome browser

---

## Application Versions

### Traditional Version (HTML + JavaScript)
- **Best for**: Stable operation, debugging
- **Features**: Real-time detection, basic UI
- **Pros**: More stable, easier to debug
- **Cons**: Basic UI, potential mode selection issues

### Streamlit Version (Modern UI)
- **Best for**: Better user experience, modern interface
- **Features**: Interactive charts, better visualization
- **Pros**: Beautiful UI, easier to use
- **Cons**: Requires additional dependencies

---

## Getting Help

1. **Check Console Logs**: Open browser console (F12) for detailed error information
2. **Debug Tools**: Traditional version has a debug panel (🔧 button)
3. **Error Reports**: Use `debugHelpers.exportErrors()` in browser console
4. **Issues**: Report problems at the GitHub repository

---

## Development Setup

For developers who want to modify SoundDitect:

```bash
# Install development dependencies
pip install -r requirements.txt
pip install -r requirements_streamlit.txt

# Install additional dev tools
pip install pytest black flake8

# Run tests (if available)
pytest

# Code formatting
black .
```

---

## Next Steps

1. **Start Application**: Choose traditional or Streamlit version
2. **Enable Microphone**: Allow microphone access when prompted
3. **Select Mode**: Choose real-time or offline processing
4. **Test Recording**: Try a short recording to verify setup
5. **Adjust Settings**: Tune sensitivity and recording duration as needed

**Enjoy using SoundDitect! 🎵**
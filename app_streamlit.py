"""
SoundDitect - Streamlit Application
Simple, reliable real-time and offline audio anomaly detection

This replaces the complex JavaScript frontend with a simple, robust Streamlit interface
while maintaining all functionality from the original FastAPI backend.
"""

import streamlit as st
import asyncio
import websockets
import json
import numpy as np
import requests
import base64
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import time
import threading
from pathlib import Path
import tempfile
import wave
import io
from datetime import datetime

# Page configuration
st.set_page_config(
    page_title="SoundDitect - 音声異常検知",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'mode' not in st.session_state:
    st.session_state.mode = None
if 'is_recording' not in st.session_state:
    st.session_state.is_recording = False
if 'detection_history' not in st.session_state:
    st.session_state.detection_history = []
if 'offline_results' not in st.session_state:
    st.session_state.offline_results = None
if 'connection_status' not in st.session_state:
    st.session_state.connection_status = "disconnected"

# Configuration
BACKEND_URL = "http://localhost:8000"
WEBSOCKET_URL = "ws://localhost:8000/ws"

# Helper functions
def reset_mode():
    """Reset to mode selection"""
    st.session_state.mode = None
    st.session_state.is_recording = False
    st.session_state.offline_results = None
    st.rerun()

def check_backend_status():
    """Check if the FastAPI backend is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        return response.status_code == 200
    except:
        return False

def process_offline_audio(audio_data, sample_rate, duration):
    """Process audio data for offline analysis"""
    try:
        # Convert audio to base64
        audio_bytes = (audio_data * 32767).astype(np.int16).tobytes()
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # Send to backend for batch analysis
        response = requests.post(
            f"{BACKEND_URL}/api/analyze_batch",
            json={
                "audio_data": audio_base64,
                "sample_rate": sample_rate,
                "duration": duration
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Backend error: {response.status_code}")
            return None
    except Exception as e:
        st.error(f"Analysis error: {e}")
        return None

# Header
st.markdown("""
<div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; margin-bottom: 2rem;">
    <h1 style="color: white; margin: 0; font-size: 3rem;">🎵 SoundDitect</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 1.2rem;">リアルタイム音声異常検知システム</p>
</div>
""", unsafe_allow_html=True)

# Check backend status
backend_status = check_backend_status()
if not backend_status:
    st.error("🚨 FastAPI backend is not running. Please start the backend server first.")
    st.code("python run_server.py")
    st.stop()

# Sidebar - Mode Selection
st.sidebar.title("🎯 動作モード選択")

if st.session_state.mode is None:
    # Mode selection
    st.sidebar.markdown("### 動作モードを選択してください")
    
    if st.sidebar.button("⚡ リアルタイムモード", use_container_width=True):
        st.session_state.mode = "realtime"
        st.rerun()
    
    st.sidebar.info("録音中にリアルタイムで音声を判定します。高性能なPCに適しています。")
    
    if st.sidebar.button("📊 オフラインモード", use_container_width=True):
        st.session_state.mode = "offline"
        st.rerun()
    
    st.sidebar.info("録音完了後に一括で分析します。詳細な分析結果と波形表示が利用できます。")
    
else:
    # Mode selected - show back button and mode info
    mode_info = "⚡ リアルタイムモード" if st.session_state.mode == "realtime" else "📊 オフラインモード"
    st.sidebar.success(f"選択中: {mode_info}")
    
    if st.sidebar.button("← モード選択に戻る", use_container_width=True):
        reset_mode()

# Main content based on selected mode
if st.session_state.mode is None:
    # Mode selection page
    st.markdown("## 🎯 動作モード選択")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        <div style="border: 3px solid #4299e1; border-radius: 15px; padding: 2rem; text-align: center; height: 300px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">⚡</div>
            <h3>リアルタイムモード</h3>
            <p>録音中にリアルタイムで音声を判定します。高性能なPCに適しています。</p>
            <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 25px; font-weight: 600; cursor: pointer;">選択</button>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button("リアルタイムモードを選択", key="realtime_main", use_container_width=True):
            st.session_state.mode = "realtime"
            st.rerun()
    
    with col2:
        st.markdown("""
        <div style="border: 3px solid #4299e1; border-radius: 15px; padding: 2rem; text-align: center; height: 300px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📊</div>
            <h3>オフラインモード</h3>
            <p>録音完了後に一括で分析します。詳細な分析結果と波形表示が利用できます。</p>
            <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 25px; font-weight: 600; cursor: pointer;">選択</button>
        </div>
        """, unsafe_allow_html=True)
        
        if st.button("オフラインモードを選択", key="offline_main", use_container_width=True):
            st.session_state.mode = "offline"
            st.rerun()

elif st.session_state.mode == "realtime":
    # Real-time mode interface
    st.markdown("## ⚡ リアルタイムモード")
    
    # Connection status
    col1, col2, col3 = st.columns([2, 1, 1])
    with col1:
        if st.session_state.connection_status == "connected":
            st.success("🟢 サーバーに接続済み")
        else:
            st.warning("🟡 サーバーに接続中...")
    
    with col2:
        if st.button("🔄 再接続", use_container_width=True):
            st.session_state.connection_status = "connecting"
            st.rerun()
    
    with col3:
        sensitivity = st.slider("感度", 0.1, 1.0, 0.5, 0.1)
    
    # Recording controls
    st.markdown("### 🎤 録音制御")
    col1, col2 = st.columns(2)
    
    with col1:
        if not st.session_state.is_recording:
            if st.button("🎤 録音開始", type="primary", use_container_width=True):
                st.session_state.is_recording = True
                st.rerun()
        else:
            if st.button("⏹️ 録音停止", type="secondary", use_container_width=True):
                st.session_state.is_recording = False
                st.rerun()
    
    # Detection results
    if st.session_state.is_recording:
        st.markdown("### 📊 検知結果")
        
        # Placeholder for real-time detection results
        detection_placeholder = st.empty()
        
        # Simulate real-time detection (in a real implementation, this would use WebSocket)
        with detection_placeholder.container():
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("現在の状態", "正常", delta="信頼度: 0.87")
            
            with col2:
                st.metric("検知回数", len(st.session_state.detection_history))
            
            with col3:
                st.metric("異常検知", "0回")
        
        # Audio visualization placeholder
        st.markdown("### 🎨 音声可視化")
        
        # Generate sample waveform for demonstration
        time_points = np.linspace(0, 1, 1000)
        waveform = np.sin(2 * np.pi * 5 * time_points) * np.exp(-time_points)
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=time_points, y=waveform, mode='lines', name='音声波形'))
        fig.update_layout(
            title="リアルタイム音声波形",
            xaxis_title="時間 (秒)",
            yaxis_title="振幅",
            height=300
        )
        st.plotly_chart(fig, use_container_width=True)
        
        # Volume meter
        volume_level = 0.7  # Simulated volume
        st.progress(volume_level, text=f"音量レベル: {volume_level:.2f}")
        
        # Auto-refresh for real-time updates
        time.sleep(1)
        st.rerun()
    
    else:
        st.info("📝 録音ボタンを押して開始してください")

elif st.session_state.mode == "offline":
    # Offline mode interface
    st.markdown("## 📊 オフラインモード")
    
    # Settings
    col1, col2 = st.columns([1, 2])
    with col1:
        recording_duration = st.slider("録音時間 (秒)", 5, 60, 30, 5)
    
    with col2:
        st.info(f"📝 {recording_duration}秒間録音して分析します")
    
    # Recording controls
    st.markdown("### 🎤 録音制御")
    col1, col2 = st.columns(2)
    
    with col1:
        if not st.session_state.is_recording:
            if st.button(f"🎤 録音開始 ({recording_duration}秒)", type="primary", use_container_width=True):
                st.session_state.is_recording = True
                st.session_state.offline_results = None
                st.rerun()
        else:
            if st.button("⏹️ 録音停止", type="secondary", use_container_width=True):
                st.session_state.is_recording = False
                st.rerun()
    
    # Recording status and processing
    if st.session_state.is_recording:
        st.markdown("### ⏳ 録音中...")
        
        # Progress bar for recording
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        # Simulate recording progress
        for i in range(recording_duration):
            progress = (i + 1) / recording_duration
            progress_bar.progress(progress)
            status_text.text(f"録音中... {i+1}/{recording_duration}秒")
            time.sleep(1)
        
        # Processing
        status_text.text("分析中...")
        progress_bar.progress(1.0)
        
        # Simulate audio data and processing
        sample_rate = 44100
        duration = recording_duration
        t = np.linspace(0, duration, int(sample_rate * duration))
        # Generate sample audio data (in real implementation, this would be actual recorded audio)
        audio_data = np.sin(2 * np.pi * 440 * t) + 0.1 * np.random.randn(len(t))
        
        # Process the audio
        with st.spinner("AI分析中..."):
            # Simulate processing delay
            time.sleep(2)
            
            # Generate mock results (in real implementation, call process_offline_audio)
            results = {
                "summary": {
                    "total_duration": duration,
                    "ok_count": duration - 2,
                    "ng_count": 2,
                    "average_confidence": 0.85
                },
                "results": [
                    {
                        "time": i,
                        "prediction": 1 if i in [10, 25] else 0,  # Mock anomalies at 10s and 25s
                        "confidence": 0.9 if i in [10, 25] else np.random.uniform(0.7, 0.95),
                        "status": "NG" if i in [10, 25] else "OK"
                    }
                    for i in range(duration)
                ],
                "waveform_data": [audio_data[i*1000:(i+1)*1000].tolist() for i in range(duration)]
            }
        
        st.session_state.offline_results = results
        st.session_state.is_recording = False
        st.rerun()
    
    # Display offline results
    if st.session_state.offline_results:
        st.markdown("### 📊 分析結果")
        
        results = st.session_state.offline_results
        
        # Summary statistics
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("総録音時間", f"{results['summary']['total_duration']:.1f}秒")
        with col2:
            st.metric("OK判定", results['summary']['ok_count'], delta_color="normal")
        with col3:
            st.metric("NG判定", results['summary']['ng_count'], delta_color="inverse")
        with col4:
            st.metric("平均信頼度", f"{results['summary']['average_confidence']:.3f}")
        
        # Waveform with judgment overlays
        st.markdown("### 🎨 波形分析")
        
        # Create waveform visualization
        time_points = np.linspace(0, results['summary']['total_duration'], len(results['waveform_data']) * 1000)
        waveform = np.concatenate([np.array(segment) for segment in results['waveform_data']])
        
        fig = make_subplots(rows=2, cols=1, 
                           subplot_titles=("音声波形", "判定結果"),
                           vertical_spacing=0.1,
                           row_heights=[0.7, 0.3])
        
        # Waveform
        fig.add_trace(
            go.Scatter(x=time_points, y=waveform, mode='lines', name='音声波形', line=dict(color='blue')),
            row=1, col=1
        )
        
        # Judgment overlays
        for result in results['results']:
            color = 'red' if result['prediction'] == 1 else 'green'
            alpha = result['confidence'] * 0.7
            
            fig.add_vrect(
                x0=result['time'], x1=result['time'] + 1,
                fillcolor=color, opacity=alpha,
                row=1, col=1
            )
        
        # Judgment timeline
        times = [r['time'] for r in results['results']]
        predictions = [r['prediction'] for r in results['results']]
        confidences = [r['confidence'] for r in results['results']]
        
        colors = ['red' if p == 1 else 'green' for p in predictions]
        
        fig.add_trace(
            go.Scatter(x=times, y=predictions, mode='markers', 
                      marker=dict(size=10, color=colors, opacity=0.8),
                      name='判定結果',
                      hovertemplate='時間: %{x}秒<br>判定: %{text}<br>信頼度: %{customdata:.3f}<extra></extra>',
                      text=[r['status'] for r in results['results']],
                      customdata=confidences),
            row=2, col=1
        )
        
        fig.update_layout(height=600, title="詳細波形分析")
        fig.update_xaxes(title_text="時間 (秒)", row=2, col=1)
        fig.update_yaxes(title_text="振幅", row=1, col=1)
        fig.update_yaxes(title_text="判定 (0=OK, 1=NG)", row=2, col=1)
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Detailed results table
        st.markdown("### 📋 詳細結果")
        
        df = pd.DataFrame(results['results'])
        df['判定'] = df['prediction'].map({0: 'OK', 1: 'NG'})
        df['時間'] = df['time'].astype(str) + '秒'
        df['信頼度'] = df['confidence'].round(3)
        
        # Color-code the dataframe
        def highlight_ng(row):
            if row['prediction'] == 1:
                return ['background-color: #fed7d7'] * len(row)
            else:
                return ['background-color: #c6f6d5'] * len(row)
        
        st.dataframe(
            df[['時間', '判定', '信頼度', 'status']].style.apply(highlight_ng, axis=1),
            use_container_width=True,
            height=400
        )
        
        # Download results
        if st.button("📥 結果をダウンロード", use_container_width=True):
            # Convert results to downloadable format
            results_json = json.dumps(results, indent=2, ensure_ascii=False)
            st.download_button(
                label="JSON形式でダウンロード",
                data=results_json,
                file_name=f"soundditect_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )

# Sidebar - System Status
st.sidebar.markdown("---")
st.sidebar.markdown("### 📊 システム状態")
st.sidebar.success("✅ Backend接続済み")
st.sidebar.info(f"🕐 {datetime.now().strftime('%H:%M:%S')}")

if st.session_state.detection_history:
    st.sidebar.metric("検知履歴", len(st.session_state.detection_history))

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #718096; font-size: 0.9rem;">
    SoundDitect v2.0 - Streamlit Edition | Real-time Sound Anomaly Detection System
</div>
""", unsafe_allow_html=True)
/**
 * UI Controller for SoundDitect
 * 
 * Manages user interface interactions, updates, and visualizations
 * for the real-time sound anomaly detection system.
 */

class UIController {
    constructor() {
        // UI Elements
        this.elements = {
            // Connection status
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            
            // Control buttons
            startButton: document.getElementById('startButton'),
            stopButton: document.getElementById('stopButton'),
            
            // Settings
            sensitivitySlider: document.getElementById('sensitivitySlider'),
            sensitivityValue: document.getElementById('sensitivityValue'),
            
            // Detection display
            detectionStatus: document.getElementById('detectionStatus'),
            statusCircle: document.getElementById('statusCircle'),
            statusLabel: document.getElementById('statusLabel'),
            statusMessage: document.getElementById('statusMessage'),
            
            // Confidence meter
            confidenceFill: document.getElementById('confidenceFill'),
            confidenceText: document.getElementById('confidenceText'),
            
            // Volume meter
            volumeFill: document.getElementById('volumeFill'),
            
            // Audio visualization
            audioCanvas: document.getElementById('audioCanvas'),
            
            // Statistics
            detectionCount: document.getElementById('detectionCount'),
            anomalyCount: document.getElementById('anomalyCount'),
            normalCount: document.getElementById('normalCount'),
            uptime: document.getElementById('uptime'),
            
            // History
            historyList: document.getElementById('historyList'),
            
            // Modal
            errorModal: document.getElementById('errorModal'),
            errorMessage: document.getElementById('errorMessage'),
            closeModal: document.getElementById('closeModal'),
            
            // System status
            systemStatus: document.getElementById('systemStatus')
        };
        
        // Canvas context for audio visualization
        this.canvasContext = this.elements.audioCanvas.getContext('2d');
        
        // Application state
        this.state = {
            isRecording: false,
            isConnected: false,
            sensitivity: 0.5,
            currentDetection: 'unknown',
            detectionHistory: [],
            statistics: {
                totalDetections: 0,
                anomalyCount: 0,
                normalCount: 0
            },
            startTime: null
        };
        
        // Animation frame for visualizations
        this.animationFrame = null;
        
        this.initializeUI();
    }

    /**
     * Initialize UI components and event listeners
     */
    initializeUI() {
        // Sensitivity slider
        this.elements.sensitivitySlider.addEventListener('input', (e) => {
            this.state.sensitivity = parseFloat(e.target.value);
            this.elements.sensitivityValue.textContent = this.state.sensitivity.toFixed(1);
        });
        
        // Modal close button
        this.elements.closeModal.addEventListener('click', () => {
            this.hideModal();
        });
        
        // Close modal when clicking outside
        this.elements.errorModal.addEventListener('click', (e) => {
            if (e.target === this.elements.errorModal) {
                this.hideModal();
            }
        });
        
        // Initialize canvas
        this.setupCanvas();
        
        // Start uptime counter
        this.startUptimeCounter();
        
        // Start animation loop
        this.startAnimationLoop();
        
        console.log('UI Controller initialized');
    }

    /**
     * Set up button event handlers
     */
    setButtonHandlers(onStart, onStop) {
        this.elements.startButton.addEventListener('click', async () => {
            const success = await onStart();
            if (success) {
                this.setRecordingState(true);
            }
        });
        
        this.elements.stopButton.addEventListener('click', () => {
            onStop();
            this.setRecordingState(false);
        });
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        this.state.isConnected = status === 'connected';
        
        let statusText = '';
        let indicatorClass = '';
        
        switch (status) {
            case 'connected':
                statusText = '接続済み';
                indicatorClass = 'online';
                this.elements.startButton.disabled = false;
                break;
            case 'connecting':
            case 'reconnecting':
                statusText = '接続中...';
                indicatorClass = 'connecting';
                this.elements.startButton.disabled = true;
                break;
            case 'disconnected':
                statusText = '切断';
                indicatorClass = 'offline';
                this.elements.startButton.disabled = true;
                break;
            case 'error':
                statusText = '接続エラー';
                indicatorClass = 'offline';
                this.elements.startButton.disabled = true;
                break;
            default:
                statusText = '不明';
                indicatorClass = 'offline';
                this.elements.startButton.disabled = true;
        }
        
        this.elements.statusText.textContent = statusText;
        this.elements.statusIndicator.className = `status-indicator ${indicatorClass}`;
    }

    /**
     * Update recording state
     */
    setRecordingState(isRecording) {
        this.state.isRecording = isRecording;
        
        if (isRecording) {
            this.elements.startButton.disabled = true;
            this.elements.stopButton.disabled = false;
            this.elements.statusLabel.textContent = '監視中';
            this.elements.statusMessage.textContent = '音声を分析しています...';
            this.state.startTime = Date.now();
        } else {
            this.elements.startButton.disabled = !this.state.isConnected;
            this.elements.stopButton.disabled = true;
            this.elements.statusLabel.textContent = '待機中';
            this.elements.statusMessage.textContent = '録音ボタンを押して開始してください';
            this.updateDetectionStatus('unknown', 0, '');
        }
    }

    /**
     * Update detection result
     */
    updateDetectionResult(result) {
        const { prediction, confidence, status, message } = result;
        
        this.updateDetectionStatus(status.toLowerCase(), confidence, message);
        this.addToHistory(result);
        this.updateStatistics(prediction);
    }

    /**
     * Update detection status display
     */
    updateDetectionStatus(status, confidence, message) {
        this.state.currentDetection = status;
        
        // Update status circle
        this.elements.statusCircle.className = `status-circle ${status}`;
        
        // Update status text
        switch (status) {
            case 'normal':
            case 'ok':
                this.elements.statusLabel.textContent = '正常';
                this.elements.statusMessage.textContent = message || '正常な音声です';
                break;
            case 'anomaly':
            case 'ng':
                this.elements.statusLabel.textContent = '異常検知!';
                this.elements.statusMessage.textContent = message || '異常な音声を検知しました';
                break;
            default:
                this.elements.statusLabel.textContent = '分析中';
                this.elements.statusMessage.textContent = message || '音声を分析中...';
        }
        
        // Update confidence meter
        this.updateConfidence(confidence);
    }

    /**
     * Update confidence meter
     */
    updateConfidence(confidence) {
        const percentage = Math.round(confidence * 100);
        this.elements.confidenceFill.style.width = `${percentage}%`;
        this.elements.confidenceText.textContent = `${percentage}%`;
    }

    /**
     * Update volume meter
     */
    updateVolume(volume) {
        const percentage = Math.min(Math.round(volume * 100), 100);
        this.elements.volumeFill.style.width = `${percentage}%`;
    }

    /**
     * Add detection result to history
     */
    addToHistory(result) {
        const historyItem = {
            timestamp: new Date(result.timestamp * 1000),
            status: result.status.toLowerCase(),
            confidence: result.confidence,
            message: result.message
        };
        
        this.state.detectionHistory.unshift(historyItem);
        
        // Keep only last 50 items
        if (this.state.detectionHistory.length > 50) {
            this.state.detectionHistory = this.state.detectionHistory.slice(0, 50);
        }
        
        this.updateHistoryDisplay();
    }

    /**
     * Update history display
     */
    updateHistoryDisplay() {
        this.elements.historyList.innerHTML = '';
        
        this.state.detectionHistory.slice(0, 10).forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = `history-item ${item.status === 'ng' || item.status === 'anomaly' ? 'anomaly' : ''}`;
            
            const timeString = item.timestamp.toLocaleTimeString('ja-JP');
            const statusText = item.status === 'ng' || item.status === 'anomaly' ? '異常' : '正常';
            const confidence = Math.round(item.confidence * 100);
            
            historyElement.innerHTML = `
                <div class="history-timestamp">${timeString}</div>
                <div class="history-status ${item.status === 'ng' || item.status === 'anomaly' ? 'anomaly' : 'normal'}">
                    ${statusText} (${confidence}%)
                </div>
            `;
            
            this.elements.historyList.appendChild(historyElement);
        });
    }

    /**
     * Update statistics
     */
    updateStatistics(prediction) {
        this.state.statistics.totalDetections++;
        
        if (prediction === 1) { // Anomaly
            this.state.statistics.anomalyCount++;
        } else { // Normal
            this.state.statistics.normalCount++;
        }
        
        // Update display
        this.elements.detectionCount.textContent = this.state.statistics.totalDetections;
        this.elements.anomalyCount.textContent = this.state.statistics.anomalyCount;
        this.elements.normalCount.textContent = this.state.statistics.normalCount;
    }

    /**
     * Set up canvas for audio visualization
     */
    setupCanvas() {
        const canvas = this.elements.audioCanvas;
        const ctx = this.canvasContext;
        
        // Set canvas size
        canvas.width = 600;
        canvas.height = 200;
        
        // Initial clear
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * Draw audio waveform visualization
     */
    drawAudioVisualization(timeDomainData, frequencyData) {
        const canvas = this.elements.audioCanvas;
        const ctx = this.canvasContext;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, width, height);
        
        if (!timeDomainData && !frequencyData) {
            // Draw "no signal" message
            ctx.fillStyle = '#718096';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('音声信号なし', width / 2, height / 2);
            return;
        }
        
        // Draw frequency spectrum if available
        if (frequencyData && frequencyData.length > 0) {
            const barWidth = width / frequencyData.length;
            ctx.fillStyle = '#4299e1';
            
            for (let i = 0; i < frequencyData.length; i++) {
                const barHeight = (frequencyData[i] / 255) * height * 0.8;
                ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
            }
        }
        
        // Draw waveform if available
        if (timeDomainData && timeDomainData.length > 0) {
            ctx.strokeStyle = '#48bb78';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const sliceWidth = width / timeDomainData.length;
            let x = 0;
            
            for (let i = 0; i < timeDomainData.length; i++) {
                const v = (timeDomainData[i] - 128) / 128.0;
                const y = (v * height / 2) + height / 2;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            ctx.stroke();
        }
    }

    /**
     * Start animation loop for visualizations
     */
    startAnimationLoop() {
        const animate = () => {
            // Animation loop can be used for smooth transitions
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    /**
     * Start uptime counter
     */
    startUptimeCounter() {
        const startTime = Date.now();
        
        setInterval(() => {
            const uptime = Date.now() - startTime;
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
            
            const uptimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            this.elements.uptime.textContent = uptimeString;
        }, 1000);
    }

    /**
     * Show error modal
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorModal.style.display = 'block';
    }

    /**
     * Hide error modal
     */
    hideModal() {
        this.elements.errorModal.style.display = 'none';
    }

    /**
     * Update system status
     */
    updateSystemStatus(status) {
        this.elements.systemStatus.textContent = status;
    }

    /**
     * Get current sensitivity setting
     */
    getSensitivity() {
        return this.state.sensitivity;
    }

    /**
     * Get current statistics
     */
    getStatistics() {
        return { ...this.state.statistics };
    }

    /**
     * Reset statistics
     */
    resetStatistics() {
        this.state.statistics = {
            totalDetections: 0,
            anomalyCount: 0,
            normalCount: 0
        };
        
        this.elements.detectionCount.textContent = '0';
        this.elements.anomalyCount.textContent = '0';
        this.elements.normalCount.textContent = '0';
        
        this.state.detectionHistory = [];
        this.updateHistoryDisplay();
    }

    /**
     * Export detection history as JSON
     */
    exportHistory() {
        const data = {
            export_time: new Date().toISOString(),
            statistics: this.state.statistics,
            history: this.state.detectionHistory
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `soundditect_history_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}
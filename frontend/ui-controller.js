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
            reconnectButton: document.getElementById('reconnectButton'),
            
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
        
        // Canvas context for audio visualization with enhanced error handling
        this.canvasContext = null;
        this.initializeCanvas();
        
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
    /**
     * Initialize canvas with comprehensive error handling
     */
    initializeCanvas() {
        try {
            if (this.elements.audioCanvas) {
                // Check if canvas is accessible
                if (typeof this.elements.audioCanvas.getContext !== 'function') {
                    throw new Error('Canvas getContext method not available');
                }
                
                this.canvasContext = this.elements.audioCanvas.getContext('2d');
                
                if (!this.canvasContext) {
                    throw new Error('Failed to obtain 2D canvas context');
                }
                
                console.log('✅ Canvas context initialized successfully');
                
                // Test canvas functionality
                this.canvasContext.fillStyle = '#1a202c';
                this.canvasContext.fillRect(0, 0, 10, 10);
                
            } else {
                console.warn('⚠️ Audio canvas element not found in DOM');
                if (window.errorLogger) {
                    window.errorLogger.log(
                        new Error('Audio canvas element not found'),
                        'UI Controller Canvas',
                        { 
                            canvasElementExists: false,
                            domReady: document.readyState,
                            elementsFound: Object.keys(this.elements).filter(key => this.elements[key] !== null)
                        }
                    );
                }
            }
        } catch (error) {
            console.error('❌ Canvas initialization failed:', error);
            if (window.errorLogger) {
                window.errorLogger.log(error, 'UI Controller Canvas', {
                    canvasElement: !!this.elements.audioCanvas,
                    canvasType: this.elements.audioCanvas?.toString(),
                    contextSupport: !!(this.elements.audioCanvas?.getContext),
                    webglSupport: !!(this.elements.audioCanvas?.getContext && this.elements.audioCanvas.getContext('webgl'))
                });
            }
            this.canvasContext = null;
        }
    }

    initializeUI() {
        try {
            console.log('🎨 Initializing UI Controller components...');
            
            // Count available elements for diagnostics
            const availableElements = Object.keys(this.elements).filter(key => this.elements[key] !== null).length;
            const totalElements = Object.keys(this.elements).length;
            console.log(`📊 Found ${availableElements}/${totalElements} DOM elements`);
            
            // Log missing elements for debugging
            const missingElements = Object.keys(this.elements).filter(key => this.elements[key] === null);
            if (missingElements.length > 0) {
                console.warn('⚠️ Missing DOM elements:', missingElements);
                if (window.errorLogger) {
                    window.errorLogger.log(
                        new Error('Missing DOM elements during UI initialization'),
                        'UI Controller Init',
                        { missingElements, totalElements, availableElements }
                    );
                }
            }
            
            // Sensitivity slider
            if (this.elements.sensitivitySlider && this.elements.sensitivityValue) {
                this.elements.sensitivitySlider.addEventListener('input', (e) => {
                    this.state.sensitivity = parseFloat(e.target.value);
                    this.elements.sensitivityValue.textContent = this.state.sensitivity.toFixed(1);
                });
            } else {
                console.warn('Sensitivity slider elements not found');
            }
            
            // Modal close button
            if (this.elements.closeModal) {
                this.elements.closeModal.addEventListener('click', () => {
                    this.hideModal();
                });
            } else {
                console.warn('Close modal button not found');
            }
            
            // Close modal when clicking outside
            if (this.elements.errorModal) {
                this.elements.errorModal.addEventListener('click', (e) => {
                    if (e.target === this.elements.errorModal) {
                        this.hideModal();
                    }
                });
            } else {
                console.warn('Error modal not found');
            }
            
            // Initialize canvas
            this.setupCanvas();
            
            // Start uptime counter
            this.startUptimeCounter();
            
            // Start animation loop
            this.startAnimationLoop();
            
            console.log('UI Controller initialized successfully');
        } catch (error) {
            console.error('Error during UI initialization:', error);
            // Don't throw the error, just log it
        }
    }

    /**
     * Set up button event handlers
     */
    setButtonHandlers(onStart, onStop, onReconnect = null) {
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
        
        if (this.elements.reconnectButton && onReconnect) {
            this.elements.reconnectButton.addEventListener('click', () => {
                onReconnect();
                this.updateConnectionStatus('connecting');
            });
        }
    }

    /**
     * Update connection status with enhanced feedback
     */
    updateConnectionStatus(status, quality = null, healthScore = null) {
        this.state.isConnected = status === 'connected';
        this.state.connectionQuality = quality || 'unknown';
        this.state.connectionHealthScore = healthScore || 0;
        
        let statusText = '';
        let indicatorClass = '';
        let qualityText = '';
        
        switch (status) {
            case 'connected':
                statusText = '接続済み';
                indicatorClass = 'online';
                this.elements.startButton.disabled = false;
                qualityText = this.getQualityText(quality, healthScore);
                break;
            case 'waiting':
                statusText = 'サーバー待機中...';
                indicatorClass = 'waiting';
                this.elements.startButton.disabled = true;
                qualityText = 'バックエンドの準備を待っています';
                break;
            case 'connecting':
                statusText = '接続中...';
                indicatorClass = 'connecting';
                this.elements.startButton.disabled = true;
                qualityText = '';
                break;
            case 'reconnecting':
                statusText = '再接続中...';
                indicatorClass = 'reconnecting';
                this.elements.startButton.disabled = true;
                qualityText = '接続を復旧しています';
                break;
            case 'disconnected':
                statusText = '切断';
                indicatorClass = 'offline';
                this.elements.startButton.disabled = true;
                qualityText = '';
                break;
            case 'failed':
                statusText = '接続失敗';
                indicatorClass = 'failed';
                this.elements.startButton.disabled = true;
                qualityText = 'オフラインモードをお試しください';
                break;
            case 'error':
                statusText = '接続エラー';
                indicatorClass = 'error';
                this.elements.startButton.disabled = true;
                qualityText = '接続に問題があります';
                break;
            default:
                statusText = '不明';
                indicatorClass = 'offline';
                this.elements.startButton.disabled = true;
                qualityText = '';
        }
        
        this.elements.statusText.textContent = statusText + (qualityText ? ` (${qualityText})` : '');
        this.elements.statusIndicator.className = `status-indicator ${indicatorClass}`;
        
        // Add quality indicator class if connected
        if (status === 'connected' && quality) {
            this.elements.statusIndicator.classList.add(`quality-${quality}`);
        }
        
        // Update connection quality indicator if element exists
        const qualityIndicator = document.getElementById('connectionQuality');
        if (qualityIndicator) {
            qualityIndicator.textContent = qualityText;
            qualityIndicator.className = `connection-quality ${quality || 'unknown'}`;
        }
        
        // Show/hide reconnect button based on connection status
        if (this.elements.reconnectButton) {
            const shouldShowReconnect = status === 'failed' || status === 'error' || 
                                       (status === 'disconnected' && !this.state.isRecording);
            this.elements.reconnectButton.style.display = shouldShowReconnect ? 'flex' : 'none';
        }
    }
    
    /**
     * Get human-readable quality text
     */
    getQualityText(quality, healthScore) {
        if (!quality || !healthScore) return '';
        
        const qualityTexts = {
            'excellent': '優秀',
            'good': '良好',
            'fair': '普通',
            'poor': '不安定'
        };
        
        const qualityText = qualityTexts[quality] || quality;
        return `${qualityText} (${healthScore}%)`;
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
     * Update offline recording state
     */
    setOfflineRecordingState(isRecording) {
        this.state.isRecording = isRecording;
        
        const offlineStartBtn = document.getElementById('offlineStartButton');
        const offlineStopBtn = document.getElementById('offlineStopButton');
        
        if (offlineStartBtn && offlineStopBtn) {
            if (isRecording) {
                offlineStartBtn.disabled = true;
                offlineStopBtn.disabled = false;
            } else {
                offlineStartBtn.disabled = false;
                offlineStopBtn.disabled = true;
            }
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
        
        if (!canvas || !ctx) {
            console.warn('Canvas or context not available for audio visualization');
            return;
        }
        
        try {
            // Set canvas size
            canvas.width = 600;
            canvas.height = 200;
            
            // Initial clear
            ctx.fillStyle = '#1a202c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.error('Error setting up canvas:', error);
        }
    }

    /**
     * Draw audio waveform visualization
     */
    drawAudioVisualization(timeDomainData, frequencyData) {
        const canvas = this.elements.audioCanvas;
        const ctx = this.canvasContext;
        
        if (!canvas || !ctx) {
            console.warn('Canvas or context not available for visualization');
            return;
        }
        
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
            if (!this.elements.uptime) {
                return; // Skip if element doesn't exist
            }
            
            const uptime = Date.now() - startTime;
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
            
            const uptimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            this.elements.uptime.textContent = uptimeString;
        }, 1000);
    }

    /**
     * Show error modal with enhanced error handling
     */
    showError(message, details = null, suggestions = null) {
        this.elements.errorMessage.innerHTML = this.formatErrorMessage(message, details, suggestions);
        this.elements.errorModal.style.display = 'block';
        
        // Auto-hide certain types of errors
        if (message.includes('接続を復旧') || message.includes('再接続中')) {
            setTimeout(() => {
                this.hideModal();
            }, 5000);
        }
    }
    
    /**
     * Format error message with details and suggestions
     */
    formatErrorMessage(message, details, suggestions) {
        let html = `<div class="error-message">${message}</div>`;
        
        if (details) {
            html += `<div class="error-details">${details}</div>`;
        }
        
        if (suggestions) {
            html += '<div class="error-suggestions">';
            html += '<h4>解決方法：</h4>';
            html += '<ul>';
            suggestions.forEach(suggestion => {
                html += `<li>${suggestion}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        return html;
    }
    
    /**
     * Show connection-specific error with recovery suggestions
     */
    showConnectionError(error, diagnostics = null) {
        let suggestions = [
            'インターネット接続を確認してください',
            'ファイアウォールやプロキシ設定を確認してください',
            'ブラウザのページを再読み込みしてください'
        ];
        
        let details = null;
        if (diagnostics) {
            details = `再接続回数: ${diagnostics.totalReconnections}, 接続品質: ${diagnostics.connectionQuality}`;
            
            // Add specific suggestions based on diagnostics
            if (diagnostics.averageLatency > 1000) {
                suggestions.unshift('ネットワーク接続が遅い可能性があります');
            }
            
            if (diagnostics.consecutiveFailures > 5) {
                suggestions.unshift('サーバーが応答していない可能性があります');
            }
        }
        
        this.showError(error, details, suggestions);
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
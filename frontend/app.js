/**
 * Main Application for SoundDitect
 * 
 * Integrates all components and manages the overall application flow
 * for real-time sound anomaly detection.
 */

class SoundDitectApp {
    constructor() {
        // Core components
        this.audioProcessor = null;
        this.websocketClient = null;
        this.uiController = null;
        
        // Application state
        this.isInitialized = false;
        this.isRecording = false;
        
        // Performance tracking
        this.lastProcessTime = 0;
        this.processingTimes = [];
        this.maxProcessingHistory = 100;
        
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing SoundDitect application...');
            
            // Initialize UI Controller
            this.uiController = new UIController();
            this.uiController.updateSystemStatus('初期化中...');
            
            // Check browser compatibility
            if (!this.checkBrowserCompatibility()) {
                this.uiController.showError('お使いのブラウザは対応していません。Chrome、Firefox、Safari、Edgeをご利用ください。');
                return;
            }
            
            // Check microphone access
            const micAccess = await AudioProcessor.checkMicrophoneAccess();
            if (!micAccess) {
                this.uiController.showError('マイクへのアクセスが必要です。ブラウザの設定でマイクアクセスを許可してください。');
                return;
            }
            
            // Initialize audio processor
            this.audioProcessor = new AudioProcessor();
            this.setupAudioProcessorCallbacks();
            
            // Initialize WebSocket client
            this.websocketClient = new WebSocketClient();
            this.setupWebSocketCallbacks();
            
            // Set up UI button handlers
            this.uiController.setButtonHandlers(
                () => this.startRecording(),
                () => this.stopRecording()
            );
            
            this.isInitialized = true;
            this.uiController.updateSystemStatus('システム正常');
            
            console.log('SoundDitect application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.uiController.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    /**
     * Check browser compatibility
     */
    checkBrowserCompatibility() {
        // Check for required APIs
        const requiredAPIs = [
            'AudioContext',
            'navigator.mediaDevices',
            'WebSocket',
            'requestAnimationFrame'
        ];
        
        for (const api of requiredAPIs) {
            const apiPath = api.split('.');
            let obj = window;
            
            for (const prop of apiPath) {
                if (!obj || !obj[prop]) {
                    console.error(`Required API not available: ${api}`);
                    return false;
                }
                obj = obj[prop];
            }
        }
        
        // Check for WebAudio support
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.error('Web Audio API not supported');
            return false;
        }
        
        // Check for getUserMedia support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('getUserMedia not supported');
            return false;
        }
        
        return true;
    }

    /**
     * Set up audio processor callbacks
     */
    setupAudioProcessorCallbacks() {
        // Audio data callback - send to server for processing
        this.audioProcessor.onAudioData = (audioData) => {
            this.processAudioData(audioData);
        };
        
        // Volume level callback - update UI
        this.audioProcessor.onVolumeChange = (volume) => {
            this.uiController.updateVolume(volume);
            this.updateAudioVisualization();
        };
        
        // Error callback
        this.audioProcessor.onError = (error) => {
            console.error('Audio processor error:', error);
            this.uiController.showError(error);
            this.stopRecording();
        };
    }

    /**
     * Set up WebSocket callbacks
     */
    setupWebSocketCallbacks() {
        // Connection state changes
        this.websocketClient.onConnectionStateChange = (state) => {
            this.uiController.updateConnectionStatus(state);
        };
        
        // Detection results from server
        this.websocketClient.onDetectionResult = (result) => {
            this.handleDetectionResult(result);
        };
        
        // Connection established
        this.websocketClient.onConnect = () => {
            console.log('Connected to server');
            this.uiController.updateSystemStatus('サーバー接続完了');
        };
        
        // Connection lost
        this.websocketClient.onDisconnect = () => {
            console.log('Disconnected from server');
            this.uiController.updateSystemStatus('サーバー接続切断');
            
            // Stop recording if connection is lost
            if (this.isRecording) {
                console.log('Stopping recording due to connection loss');
                // Stop audio processing but don't try to send WebSocket stop message
                if (this.audioProcessor) {
                    this.audioProcessor.stopRecording();
                }
                this.isRecording = false;
                
                // Update UI to reflect stopped state
                this.uiController.setRecordingState(false);
                this.uiController.drawAudioVisualization(null, null);
            }
        };
        
        // WebSocket errors
        this.websocketClient.onError = (error) => {
            console.error('WebSocket error:', error);
            this.uiController.showError('サーバー通信エラー: ' + error);
        };
    }

    /**
     * Start audio recording and processing
     */
    async startRecording() {
        try {
            if (this.isRecording) {
                console.warn('Recording already in progress');
                return false;
            }
            
            if (!this.websocketClient.isConnected) {
                this.uiController.showError('サーバーに接続されていません');
                return false;
            }
            
            console.log('Starting audio recording...');
            
            // Resume audio context if needed
            await this.audioProcessor.resumeAudioContext();
            
            // Start WebSocket recording session
            const wsSuccess = this.websocketClient.startRecording();
            if (!wsSuccess) {
                this.uiController.showError('録音セッションの開始に失敗しました');
                return false;
            }
            
            // Start audio recording
            const audioSuccess = await this.audioProcessor.startRecording();
            
            if (audioSuccess) {
                this.isRecording = true;
                this.lastProcessTime = Date.now();
                console.log('Audio recording started successfully');
                return true;
            } else {
                // If audio recording fails, stop WebSocket session
                this.websocketClient.stopRecording();
                console.error('Failed to start audio recording');
                return false;
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.uiController.showError('録音開始エラー: ' + error.message);
            
            // Cleanup on error
            if (this.websocketClient.isRecording) {
                this.websocketClient.stopRecording();
            }
            return false;
        }
    }

    /**
     * Stop audio recording and processing
     */
    stopRecording() {
        try {
            if (!this.isRecording) {
                console.warn('Recording not in progress');
                return;
            }
            
            console.log('Stopping audio recording...');
            
            // Stop audio recording first
            this.audioProcessor.stopRecording();
            
            // Stop WebSocket recording session
            if (this.websocketClient.isRecording) {
                this.websocketClient.stopRecording();
            }
            
            this.isRecording = false;
            
            // Clear visualization
            this.uiController.drawAudioVisualization(null, null);
            
            console.log('Audio recording stopped');
            
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.uiController.showError('録音停止エラー: ' + error.message);
            
            // Force cleanup on error
            try {
                this.isRecording = false;
                if (this.websocketClient.isRecording) {
                    this.websocketClient.stopRecording();
                }
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }
    }

    /**
     * Process audio data and send to server
     */
    async processAudioData(audioData) {
        try {
            const startTime = Date.now();
            
            // Preprocess audio data
            const preprocessedAudio = this.audioProcessor.preprocessAudio(audioData);
            
            // Convert to base64 for transmission
            const audioBase64 = this.audioProcessor.audioToBase64(preprocessedAudio);
            
            if (audioBase64) {
                // Send to server via WebSocket
                const success = this.websocketClient.sendAudioData(
                    audioBase64,
                    this.audioProcessor.sampleRate
                );
                
                if (!success) {
                    console.warn('Failed to send audio data to server');
                }
            }
            
            // Track processing performance
            const processingTime = Date.now() - startTime;
            this.trackProcessingPerformance(processingTime);
            
        } catch (error) {
            console.error('Error processing audio data:', error);
        }
    }

    /**
     * Handle detection result from server
     */
    handleDetectionResult(result) {
        try {
            console.log('Detection result received:', result);
            
            // Update UI with result
            this.uiController.updateDetectionResult(result);
            
            // Apply sensitivity threshold
            const sensitivity = this.uiController.getSensitivity();
            const adjustedConfidence = result.confidence * sensitivity;
            
            // Log significant detections
            if (result.prediction === 1) { // Anomaly detected
                console.warn(`Anomaly detected! Confidence: ${result.confidence.toFixed(2)}`);
                
                // Could add notification sound or vibration here
                this.notifyAnomalyDetection(result);
            }
            
        } catch (error) {
            console.error('Error handling detection result:', error);
        }
    }

    /**
     * Update audio visualization
     */
    updateAudioVisualization() {
        if (!this.isRecording || !this.audioProcessor) {
            return;
        }
        
        try {
            const timeDomainData = this.audioProcessor.getTimeDomainData();
            const frequencyData = this.audioProcessor.getFrequencySpectrum();
            
            this.uiController.drawAudioVisualization(timeDomainData, frequencyData);
            
        } catch (error) {
            console.error('Error updating audio visualization:', error);
        }
    }

    /**
     * Notify user of anomaly detection
     */
    notifyAnomalyDetection(result) {
        // Browser notification (if permission granted)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('SoundDitect - 異常検知', {
                body: `異常な音声を検知しました (信頼度: ${Math.round(result.confidence * 100)}%)`,
                icon: '/favicon.ico'
            });
        }
        
        // Console notification for development
        console.log('🚨 ANOMALY DETECTED 🚨', result);
    }

    /**
     * Track processing performance
     */
    trackProcessingPerformance(processingTime) {
        this.processingTimes.push(processingTime);
        
        // Keep only recent processing times
        if (this.processingTimes.length > this.maxProcessingHistory) {
            this.processingTimes.shift();
        }
        
        // Log performance every 100 samples
        if (this.processingTimes.length % 100 === 0) {
            const avgTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
            console.log(`Average processing time: ${avgTime.toFixed(2)}ms`);
        }
    }

    /**
     * Get application statistics
     */
    getStatistics() {
        const uiStats = this.uiController.getStatistics();
        const wsStats = this.websocketClient.getStatistics();
        const audioState = this.audioProcessor ? this.audioProcessor.getAudioContextState() : 'unavailable';
        
        const avgProcessingTime = this.processingTimes.length > 0 ?
            this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length : 0;
        
        return {
            ui: uiStats,
            websocket: wsStats,
            audio: {
                contextState: audioState,
                isRecording: this.isRecording,
                averageProcessingTime: avgProcessingTime
            },
            system: {
                isInitialized: this.isInitialized,
                browserCompatible: this.checkBrowserCompatibility()
            }
        };
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
            return permission === 'granted';
        }
        return false;
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        console.log('Shutting down SoundDitect application...');
        
        // Stop recording
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Disconnect WebSocket
        if (this.websocketClient) {
            this.websocketClient.disconnect();
        }
        
        // Cleanup UI
        if (this.uiController) {
            this.uiController.destroy();
        }
        
        console.log('Application shutdown complete');
    }
}

// Application initialization
let app = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SoundDitect...');
    app = new SoundDitectApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.shutdown();
    }
});

// Handle visibility changes (pause/resume when tab is hidden/visible)
document.addEventListener('visibilitychange', () => {
    if (app && app.isRecording) {
        if (document.hidden) {
            console.log('Tab hidden, pausing detection...');
            // Could pause processing here to save resources
        } else {
            console.log('Tab visible, resuming detection...');
            // Resume processing
        }
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (app && app.uiController) {
        app.uiController.showError('予期しないエラーが発生しました');
    }
});

// Export for debugging
window.SoundDitectApp = app;
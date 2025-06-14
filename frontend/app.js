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
        this.currentMode = 'realtime'; // 'realtime' or 'offline'
        
        // Offline mode state
        this.offlineAudioData = [];
        this.recordingStartTime = 0;
        this.recordingDuration = 30; // seconds
        this.recordingTimer = null;
        
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
            
            // Set up mode selection handlers
            this.setupModeSelection();
            
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
     * Set up mode selection handlers
     */
    setupModeSelection() {
        const realtimeRadio = document.getElementById('realtimeMode');
        const offlineRadio = document.getElementById('offlineMode');
        const offlineSettings = document.getElementById('offlineSettings');
        const offlineResultsSection = document.getElementById('offlineResultsSection');
        const resultsSection = document.querySelector('.results-section');
        const durationSlider = document.getElementById('recordingDuration');
        const durationValue = document.getElementById('durationValue');
        const startButtonText = document.getElementById('startButtonText');
        
        // Handle mode changes
        const handleModeChange = () => {
            this.currentMode = realtimeRadio.checked ? 'realtime' : 'offline';
            console.log(`Mode changed to: ${this.currentMode}`);
            
            // Show/hide appropriate settings and sections
            if (this.currentMode === 'offline') {
                offlineSettings.style.display = 'block';
                offlineResultsSection.style.display = 'block';
                resultsSection.style.display = 'none';
                startButtonText.textContent = `録音開始 (${this.recordingDuration}秒)`;
            } else {
                offlineSettings.style.display = 'none';
                offlineResultsSection.style.display = 'none';
                resultsSection.style.display = 'block';
                startButtonText.textContent = '録音開始';
            }
            
            // Stop recording if mode changes during recording
            if (this.isRecording) {
                this.stopRecording();
            }
        };
        
        // Handle duration slider changes
        const handleDurationChange = () => {
            this.recordingDuration = parseInt(durationSlider.value);
            durationValue.textContent = this.recordingDuration;
            if (this.currentMode === 'offline') {
                startButtonText.textContent = `録音開始 (${this.recordingDuration}秒)`;
            }
        };
        
        // Add event listeners
        realtimeRadio.addEventListener('change', handleModeChange);
        offlineRadio.addEventListener('change', handleModeChange);
        durationSlider.addEventListener('input', handleDurationChange);
        
        // Initialize
        handleModeChange();
        handleDurationChange();
    }

    /**
     * Set up audio processor callbacks
     */
    setupAudioProcessorCallbacks() {
        // Audio data callback - process based on current mode
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
        
        // Connection lost with enhanced recovery
        this.websocketClient.onDisconnect = () => {
            console.log('🔄 Disconnected from server');
            this.uiController.updateSystemStatus('サーバー接続切断');
            
            // Stop recording if connection is lost
            if (this.isRecording) {
                console.log('⏹️ Stopping recording due to connection loss');
                
                try {
                    // Stop audio processing but don't try to send WebSocket stop message
                    if (this.audioProcessor) {
                        this.audioProcessor.stopRecording();
                        console.log('✅ Audio processor stopped cleanly');
                    }
                } catch (audioError) {
                    console.error('❌ Error stopping audio processor:', audioError);
                }
                
                this.isRecording = false;
                
                // Update UI to reflect stopped state
                this.uiController.setRecordingState(false);
                this.uiController.drawAudioVisualization(null, null);
                
                // Show user-friendly message
                this.uiController.showError('接続が切断されたため、録音を停止しました。再接続をお待ちください。');
            }
        };
        
        // WebSocket errors with detailed handling
        this.websocketClient.onError = (error) => {
            console.error('❌ WebSocket error:', error);
            
            let userMessage = 'サーバー通信エラー';
            
            // Provide more specific error messages
            if (error.includes('タイムアウト')) {
                userMessage = '接続タイムアウトが発生しました。再接続を試みています...';
            } else if (error.includes('接続')) {
                userMessage = 'サーバーへの接続に問題があります。ネットワークを確認してください。';
            }
            
            this.uiController.showError(userMessage);
            
            // If recording, show additional guidance
            if (this.isRecording) {
                console.log('📝 Recording in progress during error - will attempt to continue');
            }
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
            
            console.log(`Starting ${this.currentMode} recording...`);
            
            // Resume audio context if needed
            await this.audioProcessor.resumeAudioContext();
            
            if (this.currentMode === 'realtime') {
                return await this.startRealtimeRecording();
            } else {
                return await this.startOfflineRecording();
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.uiController.showError('録音開始エラー: ' + error.message);
            return false;
        }
    }

    /**
     * Start real-time recording mode
     */
    async startRealtimeRecording() {
        if (!this.websocketClient.isConnected) {
            this.uiController.showError('サーバーに接続されていません');
            return false;
        }
        
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
            console.log('Real-time recording started successfully');
            return true;
        } else {
            // If audio recording fails, stop WebSocket session
            this.websocketClient.stopRecording();
            console.error('Failed to start real-time recording');
            return false;
        }
    }

    /**
     * Start offline recording mode
     */
    async startOfflineRecording() {
        // Initialize offline recording state
        this.offlineAudioData = [];
        this.recordingStartTime = Date.now();
        
        // Update UI
        this.updateOfflineProcessingStatus('録音中...', true);
        this.updateOfflineProgress(0);
        
        // Set up audio processor for offline mode
        this.audioProcessor.onAudioData = (audioData) => {
            this.collectOfflineAudioData(audioData);
        };
        
        // Start audio recording
        const audioSuccess = await this.audioProcessor.startRecording();
        
        if (audioSuccess) {
            this.isRecording = true;
            console.log(`Offline recording started for ${this.recordingDuration} seconds`);
            
            // Set up timer for recording duration
            this.recordingTimer = setInterval(() => {
                const elapsed = (Date.now() - this.recordingStartTime) / 1000;
                const progress = Math.min(elapsed / this.recordingDuration, 1) * 100;
                this.updateOfflineProgress(progress);
                
                if (elapsed >= this.recordingDuration) {
                    this.stopRecording();
                }
            }, 100);
            
            return true;
        } else {
            this.updateOfflineProcessingStatus('録音開始に失敗しました', false);
            console.error('Failed to start offline recording');
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
            
            console.log(`Stopping ${this.currentMode} recording...`);
            
            // Clear timer if in offline mode
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            // Stop audio recording first
            this.audioProcessor.stopRecording();
            
            if (this.currentMode === 'realtime') {
                // Stop WebSocket recording session
                if (this.websocketClient.isRecording) {
                    this.websocketClient.stopRecording();
                }
                
                // Clear visualization
                this.uiController.drawAudioVisualization(null, null);
            } else {
                // Offline mode - process collected audio data
                this.processOfflineAudio();
            }
            
            this.isRecording = false;
            console.log(`${this.currentMode} recording stopped`);
            
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.uiController.showError('録音停止エラー: ' + error.message);
            
            // Force cleanup on error
            try {
                this.isRecording = false;
                if (this.recordingTimer) {
                    clearInterval(this.recordingTimer);
                    this.recordingTimer = null;
                }
                if (this.websocketClient.isRecording) {
                    this.websocketClient.stopRecording();
                }
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }
    }

    /**
     * Process audio data based on current mode
     */
    async processAudioData(audioData) {
        if (this.currentMode === 'realtime') {
            await this.processRealtimeAudioData(audioData);
        } else {
            // In offline mode, this is handled by collectOfflineAudioData
            // which is set as the callback in startOfflineRecording
        }
    }

    /**
     * Process audio data for real-time mode with enhanced validation and error handling
     */
    async processRealtimeAudioData(audioData) {
        try {
            const startTime = Date.now();
            
            // Validate audio data
            if (!audioData || audioData.length === 0) {
                console.warn('⚠️ Received empty audio data, skipping processing');
                return;
            }
            
            // Log audio characteristics for debugging
            const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
            const maxAmplitude = Math.max(...audioData.map(Math.abs));
            
            console.log(`🎧 Processing audio: ${audioData.length} samples, RMS: ${rms.toFixed(4)}, Max: ${maxAmplitude.toFixed(4)}`);
            
            // Preprocess audio data
            const preprocessedAudio = this.audioProcessor.preprocessAudio(audioData);
            
            if (!preprocessedAudio || preprocessedAudio.length === 0) {
                console.warn('⚠️ Audio preprocessing failed, skipping');
                return;
            }
            
            // Convert to base64 for transmission
            const audioBase64 = this.audioProcessor.audioToBase64(preprocessedAudio);
            
            if (audioBase64) {
                console.log(`📦 Sending audio data to server: ${audioBase64.length} base64 chars`);
                
                // Send to server via WebSocket
                const success = this.websocketClient.sendAudioData(
                    audioBase64,
                    this.audioProcessor.sampleRate
                );
                
                if (success) {
                    console.log('✅ Audio data sent successfully');
                } else {
                    console.warn('❌ Failed to send audio data to server');
                    this.uiController.showError('サーバーへの音声データ送信に失敗しました');
                }
            } else {
                console.error('❌ Base64 encoding failed');
                this.uiController.showError('音声データのエンコードに失敗しました');
            }
            
            // Track processing performance
            const processingTime = Date.now() - startTime;
            this.trackProcessingPerformance(processingTime);
            
        } catch (error) {
            console.error('❌ Error processing audio data:', error);
            this.uiController.showError(`音声処理エラー: ${error.message}`);
        }
    }

    /**
     * Collect audio data for offline processing
     */
    collectOfflineAudioData(audioData) {
        if (!audioData || audioData.length === 0) {
            return;
        }
        
        // Store the audio data
        this.offlineAudioData.push(...audioData);
        
        // Update volume visualization in real-time even in offline mode
        if (this.uiController) {
            const rms = Math.sqrt(audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length);
            const volume = Math.min(rms * 100, 1.0);
            this.uiController.updateVolume(volume);
        }
    }

    /**
     * Process collected offline audio data
     */
    async processOfflineAudio() {
        try {
            if (this.offlineAudioData.length === 0) {
                this.uiController.showError('録音データがありません');
                return;
            }
            
            console.log(`🎯 Processing offline audio: ${this.offlineAudioData.length} samples`);
            
            // Update UI
            this.updateOfflineProcessingStatus('分析中...', true);
            this.updateOfflineProgress(0);
            
            // Convert to base64 for transmission
            const audioArray = new Float32Array(this.offlineAudioData);
            const audioBase64 = this.audioProcessor.audioToBase64(audioArray);
            
            if (!audioBase64) {
                throw new Error('音声データのエンコードに失敗しました');
            }
            
            // Send to server for batch analysis
            const response = await fetch('/api/analyze_batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio_data: audioBase64,
                    sample_rate: this.audioProcessor.sampleRate,
                    duration: this.recordingDuration
                })
            });
            
            if (!response.ok) {
                throw new Error(`サーバーエラー: ${response.status}`);
            }
            
            const results = await response.json();
            console.log('📊 Batch analysis results:', results);
            
            // Display results
            this.displayOfflineResults(results);
            
        } catch (error) {
            console.error('❌ Error processing offline audio:', error);
            this.updateOfflineProcessingStatus(`エラー: ${error.message}`, false);
            this.uiController.showError(`オフライン分析エラー: ${error.message}`);
        }
    }

    /**
     * Update offline processing status
     */
    updateOfflineProcessingStatus(text, showSpinner = false) {
        const processingText = document.getElementById('processingText');
        const processingSpinner = document.getElementById('processingSpinner');
        
        if (processingText) {
            processingText.textContent = text;
        }
        
        if (processingSpinner) {
            processingSpinner.style.display = showSpinner ? 'block' : 'none';
        }
    }

    /**
     * Update offline processing progress
     */
    updateOfflineProgress(percentage) {
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        
        if (progressBar && progressFill) {
            progressBar.style.display = 'block';
            progressFill.style.width = `${percentage}%`;
        }
    }

    /**
     * Display offline analysis results
     */
    displayOfflineResults(results) {
        try {
            console.log('🎨 Displaying offline results...');
            
            // Update processing status
            this.updateOfflineProcessingStatus('分析完了', false);
            this.updateOfflineProgress(100);
            
            // Update summary statistics
            this.updateOfflineSummary(results.summary);
            
            // Draw waveform with judgments
            this.drawWaveformWithJudgments(results.waveform_data, results.results);
            
            // Update detailed results table
            this.updateResultsTable(results.results);
            
            // Generate timeline
            this.generateTimeline(results.duration);
            
            console.log('✅ Offline results displayed successfully');
            
        } catch (error) {
            console.error('❌ Error displaying offline results:', error);
            this.uiController.showError(`結果表示エラー: ${error.message}`);
        }
    }

    /**
     * Update offline summary statistics
     */
    updateOfflineSummary(summary) {
        const totalDuration = document.getElementById('totalDuration');
        const okCount = document.getElementById('okCount');
        const ngCount = document.getElementById('ngCount');
        const avgConfidence = document.getElementById('avgConfidence');
        
        if (totalDuration) totalDuration.textContent = `${summary.total_duration.toFixed(1)}秒`;
        if (okCount) okCount.textContent = summary.ok_count;
        if (ngCount) ngCount.textContent = summary.ng_count;
        if (avgConfidence) avgConfidence.textContent = summary.average_confidence.toFixed(3);
    }

    /**
     * Draw waveform with judgment overlays
     */
    drawWaveformWithJudgments(waveformData, results) {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(0, 0, width, height);
        
        if (!waveformData || waveformData.length === 0) return;
        
        // Draw waveform
        ctx.strokeStyle = '#4299e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const totalSamples = waveformData.flat().length;
        const samplesPerPixel = Math.ceil(totalSamples / width);
        const midY = height / 2;
        
        let sampleIndex = 0;
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;
            
            // Average samples for this pixel
            for (let i = 0; i < samplesPerPixel && sampleIndex < totalSamples; i++) {
                const segmentIndex = Math.floor(sampleIndex / 1000);
                const sampleInSegment = sampleIndex % 1000;
                
                if (segmentIndex < waveformData.length && 
                    sampleInSegment < waveformData[segmentIndex].length) {
                    sum += Math.abs(waveformData[segmentIndex][sampleInSegment]);
                    count++;
                }
                sampleIndex++;
            }
            
            const amplitude = count > 0 ? (sum / count) : 0;
            const y = midY - (amplitude * midY * 0.8);
            
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw judgment overlays
        if (results && results.length > 0) {
            const segmentWidth = width / results.length;
            
            results.forEach((result, index) => {
                const x = index * segmentWidth;
                const segmentColor = result.prediction === 1 ? 
                    `rgba(245, 101, 101, ${result.confidence * 0.7})` : 
                    `rgba(72, 187, 120, ${result.confidence * 0.3})`;
                
                ctx.fillStyle = segmentColor;
                ctx.fillRect(x, 0, segmentWidth, height);
                
                // Add text label for NG segments with high confidence
                if (result.prediction === 1 && result.confidence > 0.7) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('NG', x + segmentWidth / 2, height / 2);
                }
            });
        }
    }

    /**
     * Update results table
     */
    updateResultsTable(results) {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) return;
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        results.forEach(result => {
            const row = document.createElement('tr');
            
            const timeCell = document.createElement('td');
            timeCell.textContent = `${result.time}`;
            
            const predictionCell = document.createElement('td');
            predictionCell.textContent = result.prediction === 1 ? 'NG' : 'OK';
            predictionCell.className = result.prediction === 1 ? 'status-ng' : 'status-ok';
            
            const confidenceCell = document.createElement('td');
            confidenceCell.textContent = result.confidence.toFixed(3);
            
            const statusCell = document.createElement('td');
            statusCell.textContent = result.status;
            statusCell.className = result.status === 'OK' ? 'status-ok' : 
                                  result.status === 'NG' ? 'status-ng' : '';
            
            row.appendChild(timeCell);
            row.appendChild(predictionCell);
            row.appendChild(confidenceCell);
            row.appendChild(statusCell);
            
            tableBody.appendChild(row);
        });
    }

    /**
     * Generate timeline for waveform
     */
    generateTimeline(duration) {
        const timeline = document.getElementById('timeline');
        if (!timeline) return;
        
        timeline.innerHTML = '';
        
        const intervals = Math.min(10, Math.ceil(duration));
        for (let i = 0; i <= intervals; i++) {
            const time = (duration * i / intervals).toFixed(1);
            const span = document.createElement('span');
            span.textContent = `${time}s`;
            timeline.appendChild(span);
        }
    }

    /**
     * Handle detection result from server with enhanced logging and validation (Real-time mode only)
     */
    handleDetectionResult(result) {
        // Only handle detection results in real-time mode
        if (this.currentMode !== 'realtime') {
            return;
        }
        
        try {
            console.log('📨 Detection result received:', result);
            
            // Validate result structure
            if (!result || typeof result !== 'object') {
                console.error('❌ Invalid detection result format');
                return;
            }
            
            // Extract and validate core result data
            const prediction = result.prediction !== undefined ? result.prediction : -1;
            const confidence = result.confidence !== undefined ? result.confidence : 0;
            const status = result.status || 'UNKNOWN';
            const processingTime = result.processing_time_ms || 0;
            
            // Log detailed information for debugging
            const timestamp = new Date(result.timestamp * 1000).toLocaleTimeString();
            console.log(`🕰️ [${timestamp}] Prediction: ${prediction}, Confidence: ${confidence.toFixed(3)}, Status: ${status}, Processing: ${processingTime.toFixed(1)}ms`);
            
            // Check for warnings or errors in the result
            if (result.error) {
                console.warn('⚠️ Detection result contains error:', result.error);
                this.uiController.showError(`検知エラー: ${result.error}`);
            }
            
            if (result.warning) {
                console.warn('⚠️ Detection result contains warning:', result.warning);
            }
            
            // Update UI with result
            this.uiController.updateDetectionResult(result);
            
            // Apply sensitivity threshold
            const sensitivity = this.uiController.getSensitivity();
            const adjustedConfidence = confidence * sensitivity;
            
            // Enhanced detection result analysis
            if (prediction === 1) {
                if (confidence > 0.7) {
                    console.warn(`🚨 HIGH CONFIDENCE ANOMALY! Confidence: ${confidence.toFixed(3)}, Adjusted: ${adjustedConfidence.toFixed(3)}`);
                    this.notifyAnomalyDetection(result);
                } else if (confidence > 0.5) {
                    console.warn(`🟡 Medium confidence anomaly: ${confidence.toFixed(3)}, Adjusted: ${adjustedConfidence.toFixed(3)}`);
                    this.notifyAnomalyDetection(result);
                } else {
                    console.log(`🟨 Low confidence anomaly: ${confidence.toFixed(3)}, may be false positive`);
                }
            } else if (prediction === 0) {
                console.log(`✅ Normal sound detected. Confidence: ${confidence.toFixed(3)}`);
            } else {
                console.warn(`❓ Unknown prediction value: ${prediction}`);
            }
            
            // Track result processing performance
            this.trackDetectionPerformance(result);
            
            // Log audio processing metrics if available
            if (result.audio_length) {
                console.log(`📊 Audio metrics: ${result.audio_length} samples, Max amplitude: ${result.max_amplitude?.toFixed(4) || 'N/A'}`);
            }
            
        } catch (error) {
            console.error('❌ Error handling detection result:', error);
            this.uiController.showError(`結果処理エラー: ${error.message}`);
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
     * Track detection result performance and statistics with enhanced metrics
     */
    trackDetectionPerformance(result) {
        if (!this.detectionStats) {
            this.detectionStats = {
                totalDetections: 0,
                anomalyCount: 0,
                normalCount: 0,
                averageConfidence: 0,
                lastDetectionTime: 0,
                processingTimes: [],
                highConfidenceAnomalies: 0,
                errorCount: 0,
                startTime: Date.now()
            };
        }
        
        this.detectionStats.totalDetections++;
        
        // Track prediction types
        if (result.prediction === 1) {
            this.detectionStats.anomalyCount++;
            if (result.confidence > 0.7) {
                this.detectionStats.highConfidenceAnomalies++;
            }
        } else if (result.prediction === 0) {
            this.detectionStats.normalCount++;
        }
        
        // Track errors
        if (result.error || result.warning) {
            this.detectionStats.errorCount++;
        }
        
        // Track processing times
        if (result.processing_time_ms) {
            this.detectionStats.processingTimes.push(result.processing_time_ms);
            if (this.detectionStats.processingTimes.length > 100) {
                this.detectionStats.processingTimes.shift(); // Keep only last 100
            }
        }
        
        // Update average confidence (running average)
        this.detectionStats.averageConfidence = 
            (this.detectionStats.averageConfidence * (this.detectionStats.totalDetections - 1) + result.confidence) / 
            this.detectionStats.totalDetections;
        
        this.detectionStats.lastDetectionTime = Date.now();
        
        // Log statistics every 20 detections (more frequent for debugging)
        if (this.detectionStats.totalDetections % 20 === 0) {
            const avgProcessingTime = this.detectionStats.processingTimes.length > 0 ?
                this.detectionStats.processingTimes.reduce((a, b) => a + b, 0) / this.detectionStats.processingTimes.length : 0;
                
            const sessionTime = (Date.now() - this.detectionStats.startTime) / 1000;
            const detectionRate = this.detectionStats.totalDetections / sessionTime;
            
            console.log('📊 Detection Statistics:', {
                total: this.detectionStats.totalDetections,
                anomalies: this.detectionStats.anomalyCount,
                normal: this.detectionStats.normalCount,
                errors: this.detectionStats.errorCount,
                anomalyRate: (this.detectionStats.anomalyCount / this.detectionStats.totalDetections * 100).toFixed(2) + '%',
                highConfidenceAnomalies: this.detectionStats.highConfidenceAnomalies,
                avgConfidence: this.detectionStats.averageConfidence.toFixed(3),
                avgProcessingTime: avgProcessingTime.toFixed(1) + 'ms',
                detectionRate: detectionRate.toFixed(2) + '/sec',
                sessionTime: sessionTime.toFixed(1) + 's'
            });
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
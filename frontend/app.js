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
     * Initialize the application with enhanced error handling and logging
     */
    async initialize() {
        const initStart = Date.now();
        console.log('🚀 Starting SoundDitect application initialization...');
        
        try {
            // Phase 1: UI Controller initialization
            await this.initializeUIController();
            
            // Phase 2: Browser compatibility check
            this.checkBrowserCompatibilityWithLogging();
            
            // Phase 3: Audio system initialization
            await this.initializeAudioSystem();
            
            // Phase 4: WebSocket initialization
            await this.initializeWebSocketSystem();
            
            // Phase 5: UI event handlers
            this.setupUIHandlers();
            
            // Mark as initialized
            this.isInitialized = true;
            const initTime = Date.now() - initStart;
            
            console.log(`✅ SoundDitect initialized successfully in ${initTime}ms`);
            this.uiController.updateSystemStatus('システム正常');
            
            // Log successful initialization
            window.errorLogger.log(
                new Error('Initialization Success'),
                'App Initialize',
                { initTime, phase: 'complete' }
            );
            
        } catch (error) {
            const initTime = Date.now() - initStart;
            console.error(`❌ Critical initialization error after ${initTime}ms:`, error);
            
            // Log the critical error
            window.errorLogger.log(error, 'App Initialize Critical', {
                initTime,
                phase: 'failed',
                isInitialized: this.isInitialized
            });
            
            // Ensure we have some way to show errors
            this.handleCriticalInitializationError(error);
        }
    }
    
    /**
     * Initialize UI Controller with comprehensive error handling
     */
    async initializeUIController() {
        console.log('🎨 Phase 1: Initializing UI Controller...');
        
        try {
            this.uiController = new UIController();
            if (this.uiController) {
                this.uiController.updateSystemStatus('初期化中...');
                console.log('✅ UI Controller initialized successfully');
            } else {
                throw new Error('UI Controller constructor returned null');
            }
        } catch (uiError) {
            window.errorLogger.log(uiError, 'UI Controller Init', {
                elementCount: document.querySelectorAll('*').length,
                canvasExists: !!document.getElementById('audioCanvas'),
                domReady: document.readyState
            });
            
            console.warn('⚠️ UI Controller failed, creating fallback...');
            
            // Create a comprehensive fallback UI controller
            this.uiController = this.createFallbackUIController();
        }
    }
    
    /**
     * Create fallback UI controller when main initialization fails
     */
    createFallbackUIController() {
        return {
            showError: (message) => {
                console.error('🚨 UI Error (Fallback):', message);
                // Try to show modal, fallback to alert
                const modal = document.getElementById('errorModal');
                const errorMessage = document.getElementById('errorMessage');
                if (modal && errorMessage) {
                    errorMessage.textContent = message;
                    modal.style.display = 'block';
                } else {
                    alert(message);
                }
            },
            updateSystemStatus: (status) => {
                console.log('📊 System Status (Fallback):', status);
                const statusEl = document.getElementById('systemStatus');
                if (statusEl) statusEl.textContent = status;
            },
            setButtonHandlers: () => console.log('🔘 Button handlers setup (Fallback)'),
            setRecordingState: (recording) => console.log('🎤 Recording state (Fallback):', recording),
            updateConnectionStatus: (status) => console.log('🔗 Connection status (Fallback):', status),
            updateDetectionResult: (result) => console.log('🎯 Detection result (Fallback):', result),
            updateVolume: (volume) => console.log('🔊 Volume (Fallback):', volume),
            drawAudioVisualization: () => console.log('📊 Audio visualization (Fallback)'),
            getSensitivity: () => 0.5,
            getStatistics: () => ({ fallback: true })
        };
    }
    
    /**
     * Check browser compatibility with detailed logging
     */
    checkBrowserCompatibilityWithLogging() {
        console.log('🔍 Phase 2: Checking browser compatibility...');
        
        if (!this.checkBrowserCompatibility()) {
            const compatibilityError = new Error('Browser not compatible');
            window.errorLogger.log(compatibilityError, 'Browser Compatibility', {
                userAgent: navigator.userAgent,
                webAudio: !!(window.AudioContext || window.webkitAudioContext),
                getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                webSocket: !!window.WebSocket
            });
            
            this.uiController.showError('お使いのブラウザは対応していません。Chrome、Firefox、Safari、Edgeをご利用ください。');
            throw compatibilityError;
        }
        
        console.log('✅ Browser compatibility check passed');
    }
    
    /**
     * Initialize audio system with enhanced error handling
     */
    async initializeAudioSystem() {
        console.log('🎧 Phase 3: Initializing audio system...');
        
        try {
            // Check microphone access first
            const micAccess = await this.checkMicrophoneAccessSafely();
            if (!micAccess) {
                console.warn('⚠️ Microphone access denied or unavailable');
                window.errorLogger.log(
                    new Error('Microphone access unavailable'),
                    'Audio System Init',
                    { micAccess: false, reason: 'Permission denied or not available' }
                );
            }
            
            this.audioProcessor = new AudioProcessor();
            this.setupAudioProcessorCallbacks();
            
            console.log('✅ Audio system initialized successfully');
            
        } catch (audioError) {
            window.errorLogger.log(audioError, 'Audio System Init', {
                audioContextSupport: !!(window.AudioContext || window.webkitAudioContext),
                getUserMediaSupport: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            });
            
            console.warn('⚠️ Audio system initialization failed, continuing with limited functionality');
            this.uiController.showError('オーディオシステムの初期化に失敗しました。録音機能が制限される可能性があります。');
            
            // Don't throw, continue with limited functionality
        }
    }
    
    /**
     * Initialize WebSocket system with enhanced error handling
     */
    async initializeWebSocketSystem() {
        console.log('🌐 Phase 4: Initializing WebSocket system...');
        
        try {
            this.websocketClient = new WebSocketClient();
            this.setupWebSocketCallbacks();
            
            console.log('✅ WebSocket system initialized successfully');
            
        } catch (wsError) {
            window.errorLogger.log(wsError, 'WebSocket System Init', {
                webSocketSupport: !!window.WebSocket,
                currentHost: window.location.host
            });
            
            console.warn('⚠️ WebSocket system initialization failed, continuing with offline-only mode');
            this.uiController.updateSystemStatus('オフラインモードで動作しています (サーバー接続なし)');
            
            // Create a fallback WebSocket client that only supports offline operations
            this.websocketClient = this.createFallbackWebSocketClient();
            
            // Don't throw, continue with offline-only functionality
        }
    }
    
    /**
     * Create a fallback WebSocket client for offline-only operation
     */
    createFallbackWebSocketClient() {
        return {
            isConnected: false,
            startRecording: () => {
                console.warn('⚠️ Real-time recording not available - server not connected');
                return false;
            },
            stopRecording: () => {
                console.warn('⚠️ Real-time recording not available - server not connected');
                return false;
            },
            sendAudioData: () => {
                console.warn('⚠️ Audio data sending not available - server not connected');
                return false;
            },
            reconnect: () => {
                console.log('🔄 Attempting to reconnect...');
                if (this.websocketClient && this.websocketClient.constructor === WebSocketClient) {
                    this.websocketClient.reconnect();
                } else {
                    // Try to create a new WebSocket client
                    try {
                        this.websocketClient = new WebSocketClient();
                        this.setupWebSocketCallbacks();
                    } catch (error) {
                        console.error('❌ Failed to create new WebSocket client:', error);
                    }
                }
            },
            disconnect: () => console.log('🔌 Fallback client disconnect (no-op)'),
            getConnectionStatus: () => 'disconnected',
            getStatistics: () => ({ fallback: true, isConnected: false }),
            getDiagnostics: () => ({ fallback: true, connectionStatus: 'unavailable' }),
            forceReconnect: () => this.createFallbackWebSocketClient().reconnect(),
            onConnect: null,
            onDisconnect: null,
            onDetectionResult: null,
            onError: null,
            onConnectionStateChange: null,
            onConnectionQualityChange: null
        };
    }
    
    /**
     * Set up UI handlers with error protection
     */
    setupUIHandlers() {
        console.log('🔘 Phase 5: Setting up UI handlers...');
        
        try {
            this.uiController.setButtonHandlers(
                () => this.startRecording(),
                () => this.stopRecording(),
                () => this.forceReconnect()
            );
            
            console.log('✅ UI handlers setup successfully');
            
        } catch (handlerError) {
            window.errorLogger.log(handlerError, 'UI Handlers Setup', {
                uiControllerExists: !!this.uiController,
                buttonsExist: {
                    start: !!document.getElementById('startButton'),
                    stop: !!document.getElementById('stopButton'),
                    reconnect: !!document.getElementById('reconnectButton')
                }
            });
            
            console.warn('⚠️ UI handlers setup failed, some controls may not work');
        }
    }
    
    /**
     * Handle critical initialization errors
     */
    handleCriticalInitializationError(error) {
        const errorMessage = `アプリケーションの初期化に失敗しました: ${error.message}`;
        
        if (this.uiController && this.uiController.showError) {
            this.uiController.showError(errorMessage);
        } else {
            // Last resort - direct DOM manipulation
            const modal = document.getElementById('errorModal');
            const errorMessageEl = document.getElementById('errorMessage');
            if (modal && errorMessageEl) {
                errorMessageEl.textContent = errorMessage + '\n\nコンソールで errorLogger.exportErrorReport() を実行してエラーレポートをダウンロードできます。';
                modal.style.display = 'block';
            } else {
                alert(errorMessage);
            }
        }
    }
    }
    
    /**
     * Safely check microphone access without throwing errors
     */
    async checkMicrophoneAccessSafely() {
        try {
            if (AudioProcessor && AudioProcessor.checkMicrophoneAccess) {
                return await AudioProcessor.checkMicrophoneAccess();
            } else {
                console.warn('AudioProcessor.checkMicrophoneAccess not available');
                return false;
            }
        } catch (error) {
            console.error('Error checking microphone access:', error);
            return false;
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
     * DISABLED - Now handled by SimpleModeManager
     */
    setupModeSelection() {
        console.log('⚠️ setupModeSelection disabled - using SimpleModeManager instead');
        return;
        /*
        const selectRealtimeBtn = document.getElementById('selectRealtimeMode');
        const selectOfflineBtn = document.getElementById('selectOfflineMode');
        const backFromRealtimeBtn = document.getElementById('backFromRealtime');
        const backFromOfflineBtn = document.getElementById('backFromOffline');
        const durationSlider = document.getElementById('recordingDuration');
        const durationValue = document.getElementById('durationValue');
        const offlineStartButtonText = document.getElementById('offlineStartButtonText');
        
        // Handle real-time mode selection
        if (selectRealtimeBtn) {
            selectRealtimeBtn.addEventListener('click', () => {
                console.log('Real-time mode selected - button clicked');
                selectRealtimeBtn.style.backgroundColor = '#2d3748';
                selectRealtimeBtn.style.transform = 'scale(0.95)';
                selectRealtimeBtn.disabled = true;
                selectRealtimeBtn.textContent = '選択中...';
                this.setMode('realtime');
            });
        } else {
            console.error('Real-time mode button not found');
        }
        
        // Handle offline mode selection
        if (selectOfflineBtn) {
            selectOfflineBtn.addEventListener('click', () => {
                console.log('Offline mode selected - button clicked');
                selectOfflineBtn.style.backgroundColor = '#2d3748';
                selectOfflineBtn.style.transform = 'scale(0.95)';
                selectOfflineBtn.disabled = true;
                selectOfflineBtn.textContent = '選択中...';
                this.setMode('offline');
            });
        } else {
            console.error('Offline mode button not found');
        }
        
        // Handle back buttons
        if (backFromRealtimeBtn) {
            backFromRealtimeBtn.addEventListener('click', () => {
                console.log('Back to mode selection from real-time');
                this.showModeSelection();
            });
        } else {
            console.error('Back from real-time button not found');
        }
        
        if (backFromOfflineBtn) {
            backFromOfflineBtn.addEventListener('click', () => {
                console.log('Back to mode selection from offline');
                this.showModeSelection();
            });
        } else {
            console.error('Back from offline button not found');
        }
        
        // Handle duration slider changes
        if (durationSlider && durationValue) {
            const handleDurationChange = () => {
                this.recordingDuration = parseInt(durationSlider.value);
                durationValue.textContent = this.recordingDuration;
                if (offlineStartButtonText && this.currentMode === 'offline') {
                    offlineStartButtonText.textContent = `録音開始 (${this.recordingDuration}秒)`;
                }
            };
            
            durationSlider.addEventListener('input', handleDurationChange);
            handleDurationChange(); // Initialize
        }
        
        // Set up offline mode button handlers
        const offlineStartBtn = document.getElementById('offlineStartButton');
        const offlineStopBtn = document.getElementById('offlineStopButton');
        
        if (offlineStartBtn) {
            offlineStartBtn.addEventListener('click', async () => {
                const success = await this.startRecording();
                if (success) {
                    this.uiController.setOfflineRecordingState(true);
                }
            });
        }
        
        if (offlineStopBtn) {
            offlineStopBtn.addEventListener('click', () => {
                this.stopRecording();
                this.uiController.setOfflineRecordingState(false);
            });
        }
        */
    }

    /**
     * Set up audio processor callbacks
     */
    setupAudioProcessorCallbacks() {
        if (!this.audioProcessor) {
            console.warn('Audio processor not available, skipping callback setup');
            return;
        }
        
        try {
            // Audio data callback - process based on current mode
            this.audioProcessor.onAudioData = (audioData) => {
                this.processAudioData(audioData);
            };
            
            // Volume level callback - update UI
            this.audioProcessor.onVolumeChange = (volume) => {
                if (this.uiController && this.uiController.updateVolume) {
                    this.uiController.updateVolume(volume);
                }
                this.updateAudioVisualization();
            };
            
            // Error callback
            this.audioProcessor.onError = (error) => {
                console.error('Audio processor error:', error);
                if (this.uiController && this.uiController.showError) {
                    this.uiController.showError(error);
                }
                this.stopRecording();
            };
        } catch (error) {
            console.error('Error setting up audio processor callbacks:', error);
        }
    }

    /**
     * Set up WebSocket callbacks with enhanced connection monitoring
     */
    setupWebSocketCallbacks() {
        if (!this.websocketClient) {
            console.warn('WebSocket client not available, skipping callback setup');
            return;
        }
        
        try {
        // Connection state changes with quality monitoring
        this.websocketClient.onConnectionStateChange = (state) => {
            this.uiController.updateConnectionStatus(state);
        };
        
        // Connection quality changes
        this.websocketClient.onConnectionQualityChange = (quality, healthScore) => {
            this.uiController.updateConnectionStatus(
                this.websocketClient.isConnected ? 'connected' : 'disconnected', 
                quality, 
                healthScore
            );
            
            // Log quality changes for monitoring
            console.log(`📊 Connection quality: ${quality} (${healthScore}%)`);
        };
        
        // Detection results from server
        this.websocketClient.onDetectionResult = (result) => {
            this.handleDetectionResult(result);
        };
        
        // Connection established with enhanced feedback
        this.websocketClient.onConnect = () => {
            console.log('✅ Connected to server successfully');
            
            // Update UI based on current mode
            if (this.currentMode === 'realtime') {
                this.uiController.updateSystemStatus('リアルタイムモード準備完了');
                // Update connection status visual feedback
                const connectionStatus = document.getElementById('connectionStatus');
                if (connectionStatus) {
                    connectionStatus.className = 'connection-status ready';
                }
            } else {
                this.uiController.updateSystemStatus('サーバー接続完了');
            }
            
            // Hide loading overlay if visible
            this.hideLoadingTransition();
            
            // Log connection diagnostics
            const diagnostics = this.websocketClient.getDiagnostics();
            if (diagnostics.reconnectAttempts > 0) {
                console.log(`🔄 Reconnected after ${diagnostics.reconnectAttempts} attempts`);
            }
        };
        
        // Enhanced disconnect handling with detailed logging
        this.websocketClient.onDisconnect = (code, reason) => {
            console.log(`🔌 Disconnected from server: ${reason} (${code})`);
            this.uiController.updateSystemStatus(`サーバー接続切断: ${reason}`);
            
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
                
                // Show user-friendly message with automatic recovery info
                if (code !== 1000) { // Not a normal close
                    this.uiController.showError('接続が切断されたため、録音を停止しました。自動的に再接続を試みています...');
                }
            }
        };
        
        // Enhanced WebSocket error handling with diagnostics
        this.websocketClient.onError = (error) => {
            console.error('❌ WebSocket error:', error);
            
            // Get connection diagnostics for better error context
            const diagnostics = this.websocketClient.getDiagnostics();
            
            let userMessage = 'サーバー通信エラー';
            let shouldShowDetailed = false;
            
            // Provide more specific error messages based on error type and diagnostics
            if (error.includes('タイムアウト')) {
                userMessage = '接続タイムアウトが発生しました。自動的に再接続を試みています...';
            } else if (error.includes('接続')) {
                userMessage = 'サーバーへの接続に問題があります。';
                shouldShowDetailed = true;
            } else if (error.includes('最大再接続回数')) {
                userMessage = '接続の復旧に失敗しました。';
                shouldShowDetailed = true;
            }
            
            // Show detailed error for persistent connection issues
            if (shouldShowDetailed && diagnostics.consecutiveFailures > 3) {
                this.uiController.showConnectionError(userMessage, diagnostics);
            } else {
                this.uiController.showError(userMessage);
            }
            
            // Update system status with error info
            this.uiController.updateSystemStatus(`接続エラー: ${error}`);
            
            // If recording, show additional guidance
            if (this.isRecording) {
                console.log('📝 Recording in progress during error - monitoring for recovery');
            }
        };
        } catch (error) {
            console.error('Error setting up WebSocket callbacks:', error);
        }
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
            const errorMessage = 'サーバーに接続されていません。オフラインモードをお試しください。';
            this.uiController.showError(errorMessage);
            
            // Offer the option to try reconnecting
            setTimeout(() => {
                if (confirm('サーバーに再接続を試みますか？')) {
                    this.forceReconnect();
                }
            }, 2000);
            
            return false;
        }
        
        // Start WebSocket recording session
        const wsSuccess = this.websocketClient.startRecording();
        if (!wsSuccess) {
            this.uiController.showError('録音セッションの開始に失敗しました。接続を確認してください。');
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
        if (!this.isRecording || !this.audioProcessor || !this.uiController) {
            return;
        }
        
        try {
            const timeDomainData = this.audioProcessor.getTimeDomainData();
            const frequencyData = this.audioProcessor.getFrequencySpectrum();
            
            if (this.uiController.drawAudioVisualization) {
                this.uiController.drawAudioVisualization(timeDomainData, frequencyData);
            }
            
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
     * Force reconnection with UI feedback
     */
    forceReconnect() {
        console.log('🔄 User initiated force reconnection');
        
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Update UI to show reconnecting state
        this.uiController.updateConnectionStatus('connecting');
        this.uiController.updateSystemStatus('手動再接続を実行中...');
        
        // Force reconnect through WebSocket client
        if (this.websocketClient) {
            this.websocketClient.forceReconnect();
        }
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
    
    // Make app globally accessible for debugging and integration
    window.app = app;
    
    // Try to integrate with mode manager after app is created
    setTimeout(() => {
        integrateModeManager();
    }, 200);
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

// Enhanced error logging system
class ErrorLogger {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.isDebugMode = true; // Enable detailed logging
    }
    
    log(error, context = 'Unknown', details = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            error: error.message || error,
            stack: error.stack || 'No stack trace',
            context: context,
            details: details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.errors.push(errorEntry);
        
        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // Console logging with enhanced formatting
        console.group(`🚨 Error in ${context}`);
        console.error('Error:', error.message || error);
        console.error('Stack:', error.stack || 'No stack trace');
        console.error('Context Details:', details);
        console.error('Timestamp:', errorEntry.timestamp);
        console.groupEnd();
        
        // Store in localStorage for persistence
        try {
            localStorage.setItem('soundditect_errors', JSON.stringify(this.errors.slice(-10)));
        } catch (e) {
            console.warn('Could not store errors in localStorage:', e);
        }
        
        return errorEntry;
    }
    
    getErrors() {
        return this.errors;
    }
    
    getErrorSummary() {
        return {
            totalErrors: this.errors.length,
            recentErrors: this.errors.slice(-5),
            errorContexts: [...new Set(this.errors.map(e => e.context))],
            timeRange: {
                first: this.errors[0]?.timestamp,
                last: this.errors[this.errors.length - 1]?.timestamp
            }
        };
    }
    
    exportErrorReport() {
        const report = {
            summary: this.getErrorSummary(),
            allErrors: this.errors,
            systemInfo: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                appInitialized: app?.isInitialized || false
            }
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soundditect-error-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('📋 Error report exported. Total errors:', this.errors.length);
    }
}

// Create global error logger
window.errorLogger = new ErrorLogger();

// Enhanced global error handler with better recovery
window.addEventListener('error', (event) => {
    const errorDetails = {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message,
        type: 'Javascript Error'
    };
    
    // Log error with enhanced context
    window.errorLogger.log(event.error || new Error(event.message), 'Global Handler', errorDetails);
    
    // Only show error to user if app has fully initialized
    if (app && app.isInitialized && app.uiController && app.uiController.showError) {
        // Wait a moment before showing to avoid startup noise
        setTimeout(() => {
            if (app.isInitialized) {
                app.uiController.showError('予期しないエラーが発生しました。コンソールで詳細を確認してください。');
            }
        }, 1000);
    } else {
        console.warn('🚧 Error occurred during app initialization - errors logged but not shown to user');
        console.warn('💡 Check errorLogger.getErrors() for detailed error information');
    }
});

// Enhanced unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    const errorDetails = {
        reason: event.reason,
        promise: event.promise,
        type: 'Promise Rejection'
    };
    
    // Log the rejection with context
    window.errorLogger.log(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'Promise Rejection',
        errorDetails
    );
    
    // Prevent the error from showing in console as "Uncaught"
    event.preventDefault();
    
    // Only show to user if app is running normally
    if (app && app.isInitialized && app.uiController) {
        app.uiController.showError('通信エラーが発生しました。接続を確認してください。');
    } else {
        console.warn('🚧 Promise rejection during initialization - logged but not shown to user');
    }
});

// Export for debugging
window.SoundDitectApp = SoundDitectApp;

// Debug panel functions
window.toggleDebugPanel = function() {
    const panel = document.getElementById('debugPanel');
    const info = document.getElementById('debugInfo');
    
    if (panel.style.display === 'none') {
        // Show panel and update info
        updateDebugInfo();
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
};

function updateDebugInfo() {
    const info = document.getElementById('debugInfo');
    if (!info) return;
    
    const errorSummary = window.errorLogger?.getErrorSummary() || { totalErrors: 0 };
    const appStatus = {
        initialized: app?.isInitialized || false,
        recording: app?.isRecording || false,
        mode: app?.currentMode || 'unknown'
    };
    
    const systemInfo = {
        userAgent: navigator.userAgent.substring(0, 50) + '...',
        url: window.location.pathname,
        timestamp: new Date().toLocaleTimeString()
    };
    
    info.innerHTML = `
        <div><strong>Errors:</strong> ${errorSummary.totalErrors}</div>
        <div><strong>App:</strong> ${appStatus.initialized ? '✅' : '❌'} Init, ${appStatus.recording ? '🎤' : '⏹️'} Rec</div>
        <div><strong>Mode:</strong> ${appStatus.mode}</div>
        <div><strong>Time:</strong> ${systemInfo.timestamp}</div>
        <div style="margin-top: 8px; font-size: 10px; color: #a0aec0;">
            Click Export to download detailed error log
        </div>
    `;
}

// Update debug info every 5 seconds if panel is visible
setInterval(() => {
    const panel = document.getElementById('debugPanel');
    if (panel && panel.style.display !== 'none') {
        updateDebugInfo();
    }
}, 5000);

// Console helper functions for users
window.debugHelpers = {
    getErrors: () => window.errorLogger?.getErrors() || [],
    getErrorSummary: () => window.errorLogger?.getErrorSummary() || {},
    exportErrors: () => window.errorLogger?.exportErrorReport(),
    getAppState: () => ({
        initialized: app?.isInitialized,
        recording: app?.isRecording,
        mode: app?.currentMode,
        components: {
            uiController: !!app?.uiController,
            audioProcessor: !!app?.audioProcessor,
            websocketClient: !!app?.websocketClient
        }
    }),
    clearErrors: () => {
        if (window.errorLogger) {
            window.errorLogger.errors = [];
            console.log('🧹 Error log cleared');
        }
    }
};

console.log('🛠️ Debug helpers available:');
console.log('  debugHelpers.getErrors() - Get all errors');
console.log('  debugHelpers.exportErrors() - Export error report');
console.log('  debugHelpers.getAppState() - Get app status');
console.log('  debugHelpers.clearErrors() - Clear error log');
console.log('  Click the 🔧 button (bottom left) for debug panel');

// Integration with SimpleModeManager
function integrateModeManager() {
    if (window.simpleModeManager && window.app) {
        console.log('🔗 Integrating SimpleModeManager with SoundDitectApp');
        
        // Set up mode change handler
        const originalSelectMode = window.simpleModeManager.selectMode.bind(window.simpleModeManager);
        window.simpleModeManager.selectMode = function(mode, buttonElement) {
            console.log(`🔗 Mode change intercepted: ${mode}`);
            
            // Update app's current mode first
            if (window.app) {
                window.app.currentMode = mode;
                console.log(`✅ App mode updated to: ${mode}`);
            }
            
            // Call original method
            originalSelectMode(mode, buttonElement);
        };
        
        console.log('✅ SimpleModeManager integration complete');
        return true;
    }
    return false;
}

// Try integration after DOM load and after app initialization
document.addEventListener('DOMContentLoaded', () => {
    // Try integration multiple times to ensure it works
    setTimeout(integrateModeManager, 100);
    setTimeout(integrateModeManager, 500);
    setTimeout(integrateModeManager, 1000);
});

// Enhanced UI management methods with visual feedback
// DISABLED - These prototype methods are now handled by SimpleModeManager
/*
SoundDitectApp.prototype.showModeSelection = function() {
    console.log('🎯 Showing mode selection interface');
    
    this.currentInterface = 'selection';
    this.currentMode = null;
    
    // Stop recording if active
    if (this.isRecording) {
        this.stopRecording();
    }
    
    // Hide loading overlay if visible
    this.hideLoadingOverlay();
    
    // Hide all interfaces
    const realtimeInterface = document.getElementById('realtimeInterface');
    const offlineInterface = document.getElementById('offlineInterface');
    const realtimeResults = document.getElementById('realtimeResults');
    const offlineResults = document.getElementById('offlineResults');
    
    if (realtimeInterface) realtimeInterface.style.display = 'none';
    if (offlineInterface) offlineInterface.style.display = 'none';
    if (realtimeResults) realtimeResults.style.display = 'none';
    if (offlineResults) offlineResults.style.display = 'none';
    
    // Show mode selection panel
    const modeSelectionPanel = document.querySelector('.mode-selection-panel');
    if (modeSelectionPanel) {
        modeSelectionPanel.style.display = 'block';
        modeSelectionPanel.style.opacity = '1';
        console.log('✅ Mode selection panel displayed');
    } else {
        console.error('❌ Mode selection panel not found');
    }
    
    // Reset button states
    this.resetModeButtons();
    
    // Update system status
    if (this.uiController) {
        this.uiController.updateSystemStatus('動作モードを選択してください');
    }
    
    console.log('🎯 Mode selection interface setup complete');
};

SoundDitectApp.prototype.setMode = function(mode) {
    this.currentMode = mode;
    this.currentInterface = mode;
    
    console.log(`🔄 Mode set to: ${mode} - Starting transition`);
    
    // Show loading overlay immediately
    this.showLoadingOverlay(mode);
    
    // Short delay to show loading, then transition
    setTimeout(() => {
        // Hide mode selection panel
        const modeSelectionPanel = document.querySelector('.mode-selection-panel');
        if (modeSelectionPanel) {
            console.log('Hiding mode selection panel');
            modeSelectionPanel.style.display = 'none';
        }
        
        // Show appropriate interface
        if (mode === 'realtime') {
            console.log('Showing real-time interface');
            this.showRealtimeInterface();
        } else if (mode === 'offline') {
            console.log('Showing offline interface');
            this.showOfflineInterface();
        }
        
        // Hide loading overlay
        this.hideLoadingOverlay();
        
    }, 1500); // Show loading for 1.5 seconds
};

SoundDitectApp.prototype.showRealtimeInterface = function() {
    console.log('🎯 Starting to show real-time interface');
    
    // Hide all other interfaces first
    const modeSelectionPanel = document.querySelector('.mode-selection-panel');
    const offlineInterface = document.getElementById('offlineInterface');
    const offlineResults = document.getElementById('offlineResults');
    
    if (modeSelectionPanel) modeSelectionPanel.style.display = 'none';
    if (offlineInterface) offlineInterface.style.display = 'none';
    if (offlineResults) offlineResults.style.display = 'none';
    
    // Show real-time interface
    const realtimeInterface = document.getElementById('realtimeInterface');
    const realtimeResults = document.getElementById('realtimeResults');
    
    if (realtimeInterface) {
        realtimeInterface.style.display = 'block';
        realtimeInterface.style.opacity = '1';
        console.log('✅ Real-time interface displayed');
    } else {
        console.error('❌ Real-time interface element not found');
    }
    
    if (realtimeResults) {
        realtimeResults.style.display = 'block';
        realtimeResults.style.opacity = '1';
        console.log('✅ Real-time results displayed');
    } else {
        console.error('❌ Real-time results element not found');
    }
    
    // Update status
    if (this.uiController) {
        this.uiController.updateSystemStatus('リアルタイムモード準備完了');
    }
    
    // Start WebSocket connection if not already connected
    if (this.websocketClient && !this.websocketClient.isConnected) {
        console.log('🔗 Starting WebSocket connection for real-time mode');
        // Note: WebSocket connection will be handled by existing logic
    }
    
    console.log('⚡ Real-time interface setup complete');
};

SoundDitectApp.prototype.showOfflineInterface = function() {
    console.log('🎯 Starting to show offline interface');
    
    // Hide all other interfaces first
    const modeSelectionPanel = document.querySelector('.mode-selection-panel');
    const realtimeInterface = document.getElementById('realtimeInterface');
    const realtimeResults = document.getElementById('realtimeResults');
    
    if (modeSelectionPanel) modeSelectionPanel.style.display = 'none';
    if (realtimeInterface) realtimeInterface.style.display = 'none';
    if (realtimeResults) realtimeResults.style.display = 'none';
    
    // Show offline interface
    const offlineInterface = document.getElementById('offlineInterface');
    const offlineResults = document.getElementById('offlineResults');
    
    if (offlineInterface) {
        offlineInterface.style.display = 'block';
        offlineInterface.style.opacity = '1';
        console.log('✅ Offline interface displayed');
    } else {
        console.error('❌ Offline interface element not found');
    }
    
    if (offlineResults) {
        offlineResults.style.display = 'block';
        offlineResults.style.opacity = '1';
        console.log('✅ Offline results displayed');
    } else {
        console.error('❌ Offline results element not found');
    }
    
    // Update status
    if (this.uiController) {
        this.uiController.updateSystemStatus('オフライン分析モード準備完了');
    }
    
    // Show helpful instruction overlay
    this.showOfflineInstructions();
    
    console.log('📊 Offline interface setup complete');
};

// New loading overlay methods
SoundDitectApp.prototype.showLoadingOverlay = function(mode) {
    const modeText = mode === 'realtime' ? 'リアルタイム' : 'オフライン';
    
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9998;
            backdrop-filter: blur(5px);
        `;
        document.body.appendChild(loadingOverlay);
    }
    
    loadingOverlay.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top: 4px solid #4299e1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <h2 style="color: #4a5568; margin-bottom: 10px; font-size: 1.5rem;">${modeText}モード準備中</h2>
            <p style="color: #718096; font-size: 1.1rem;">インターフェースを準備しています...</p>
        </div>
    `;
    
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
    
    console.log(`📝 Loading overlay shown for ${mode} mode`);
};

SoundDitectApp.prototype.hideLoadingOverlay = function() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
        console.log('📝 Loading overlay hidden');
    }
};

SoundDitectApp.prototype.showOfflineInstructions = function() {
    // Show a temporary instruction message for offline mode
    const instructionDiv = document.createElement('div');
    instructionDiv.id = 'offlineInstructionMessage';
    instructionDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e6fffa;
        border: 2px solid #4299e1;
        border-radius: 10px;
        padding: 15px;
        z-index: 1000;
        max-width: 300px;
        font-size: 0.9rem;
        color: #2d3748;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.5s ease-out;
    `;
    
    instructionDiv.innerHTML = `
        <strong>📊 オフラインモード</strong><br>
        録音時間を設定して「録音開始」ボタンをクリックしてください。<br>
        録音完了後、詳細な分析結果を表示します。
    `;
    
    document.body.appendChild(instructionDiv);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (instructionDiv && instructionDiv.parentNode) {
            instructionDiv.style.opacity = '0';
            setTimeout(() => {
                if (instructionDiv.parentNode) {
                    instructionDiv.parentNode.removeChild(instructionDiv);
                }
            }, 300);
        }
    }, 5000);
    
    console.log('📝 Offline instructions shown');
};

SoundDitectApp.prototype.resetModeButtons = function() {
    // Reset button states to default
    const realtimeBtn = document.getElementById('selectRealtimeMode');
    const offlineBtn = document.getElementById('selectOfflineMode');
    
    if (realtimeBtn) {
        realtimeBtn.style.backgroundColor = '';
        realtimeBtn.style.transform = '';
        realtimeBtn.disabled = false;
        realtimeBtn.textContent = 'リアルタイムモードを選択';
        console.log('✅ Real-time button reset');
    }
    
    if (offlineBtn) {
        offlineBtn.style.backgroundColor = '';
        offlineBtn.style.transform = '';
        offlineBtn.disabled = false;
        offlineBtn.textContent = 'オフラインモードを選択';
        console.log('✅ Offline button reset');
    }
    
    // Remove any temporary instruction messages
    const existingInstruction = document.getElementById('offlineInstructionMessage');
    if (existingInstruction && existingInstruction.parentNode) {
        existingInstruction.parentNode.removeChild(existingInstruction);
    }
};

SoundDitectApp.prototype.highlightSelectedMode = function(mode) {
    const realtimeBtn = document.getElementById('selectRealtimeMode');
    const offlineBtn = document.getElementById('selectOfflineMode');
    const realtimeCard = document.getElementById('realtimeModeCard');
    const offlineCard = document.getElementById('offlineModeCard');
    
    // Reset all buttons and cards
    [realtimeBtn, offlineBtn].forEach(btn => {
        if (btn) {
            btn.style.transform = '';
            btn.style.backgroundColor = '';
            btn.disabled = false;
        }
    });
    
    [realtimeCard, offlineCard].forEach(card => {
        if (card) {
            card.style.transform = '';
            card.style.borderColor = '';
            card.style.boxShadow = '';
        }
    });
    
    // Highlight selected mode
    const selectedBtn = mode === 'realtime' ? realtimeBtn : offlineBtn;
    const selectedCard = mode === 'realtime' ? realtimeCard : offlineCard;
    
    if (selectedBtn) {
        selectedBtn.style.transform = 'scale(0.95)';
        selectedBtn.style.backgroundColor = '#2d3748';
        selectedBtn.disabled = true;
        selectedBtn.textContent = '選択中...';
    }
    
    if (selectedCard) {
        selectedCard.style.transform = 'scale(1.02)';
        selectedCard.style.borderColor = '#4299e1';
        selectedCard.style.boxShadow = '0 10px 30px rgba(66, 153, 225, 0.3)';
    }
};

SoundDitectApp.prototype.showConnectionProgress = function() {
    if (this.currentMode === 'realtime') {
        // Update connection status to show progress
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.style.borderLeft = '4px solid #ed8936';
        }
        
        // Start WebSocket connection if not connected
        if (!this.websocketClient.isConnected) {
            this.uiController.updateSystemStatus('サーバーに接続中...');
            setTimeout(() => {
                if (this.websocketClient.isConnected) {
                    this.uiController.updateSystemStatus('リアルタイムモード準備完了');
                } else {
                    this.uiController.updateSystemStatus('サーバー接続に時間がかかっています...');
                }
            }, 3000);
        } else {
            this.uiController.updateSystemStatus('リアルタイムモード準備完了');
        }
    }
};

SoundDitectApp.prototype.showOfflineModeInstructions = function() {
    // Create helpful status notification for offline mode
    const statusMessage = document.createElement('div');
    statusMessage.style.cssText = `
        background: #e6fffa;
        border: 1px solid #81e6d9;
        border-radius: 8px;
        padding: 15px;
        margin: 15px 0;
        text-align: center;
        color: #234e52;
    `;
    statusMessage.innerHTML = `
        <strong>📊 オフライン分析モード</strong><br>
        録音時間を設定して「録音開始」をクリックしてください。<br>
        録音完了後、詳細な波形分析結果を表示します。
    `;
    
    const offlineInterface = document.getElementById('offlineInterface');
    if (offlineInterface && !document.getElementById('offlineInstructions')) {
        statusMessage.id = 'offlineInstructions';
        offlineInterface.insertBefore(statusMessage, offlineInterface.firstChild.nextSibling);
    }
};

SoundDitectApp.prototype.resetModeVisualFeedback = function() {
    // Reset button states
    const realtimeBtn = document.getElementById('selectRealtimeMode');
    const offlineBtn = document.getElementById('selectOfflineMode');
    
    if (realtimeBtn) {
        realtimeBtn.style.transform = '';
        realtimeBtn.style.backgroundColor = '';
        realtimeBtn.disabled = false;
        realtimeBtn.textContent = 'リアルタイムモードを選択';
    }
    
    if (offlineBtn) {
        offlineBtn.style.transform = '';
        offlineBtn.style.backgroundColor = '';
        offlineBtn.disabled = false;
        offlineBtn.textContent = 'オフラインモードを選択';
    }
    
    // Reset card states
    const realtimeCard = document.getElementById('realtimeModeCard');
    const offlineCard = document.getElementById('offlineModeCard');
    
    [realtimeCard, offlineCard].forEach(card => {
        if (card) {
            card.style.transform = '';
            card.style.borderColor = '';
            card.style.boxShadow = '';
        }
    });
    
    // Remove any temporary instructions
    const instructions = document.getElementById('offlineInstructions');
    if (instructions) {
        instructions.remove();
    }
};
*/
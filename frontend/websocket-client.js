/**
 * WebSocket Client for SoundDitect
 * 
 * Handles real-time communication with the backend server
 * for audio data transmission and detection results.
 */

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.clientId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15; // Increased retry attempts
        this.reconnectDelay = 1500; // Faster initial reconnection
        this.pingInterval = null;
        this.pingTimeout = null;
        
        // Recording state management
        this.isRecording = false;
        this.recordingSessionId = null;
        
        // Message queue for offline scenarios
        this.messageQueue = [];
        this.maxQueueSize = 100;
        
        // Connection quality tracking
        this.connectionQuality = 'unknown';
        this.lastPingTime = 0;
        this.pingLatency = 0;
        this.connectionErrors = [];
        this.connectionStartTime = null;
        this.lastSuccessfulConnection = null;
        
        // Health monitoring
        this.healthCheckInterval = null;
        this.connectionHealthScore = 100;
        this.consecutiveFailures = 0;
        
        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onDetectionResult = null;
        this.onError = null;
        this.onConnectionStateChange = null;
        this.onConnectionQualityChange = null;
        
        // Statistics
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.totalReconnections = 0;
        this.averageLatency = 0;
        
        // Smart reconnection strategy
        this.reconnectStrategy = 'adaptive'; // 'adaptive', 'fixed', 'exponential'
        this.adaptiveDelayMultiplier = 1;
        
        this.connect();
    }

    /**
     * Establish WebSocket connection to the server with enhanced error handling
     */
    connect() {
        try {
            // Clean up any existing connection
            if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                this.ws.close();
            }
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws/audio`;
            
            console.log(`🔌 Attempting connection ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts + 1} to:`, wsUrl);
            
            // Update connection state
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');
            }
            
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
            
            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    console.warn('⏰ Connection timeout - closing WebSocket');
                    this.ws.close();
                    this.handleConnectionError('接続タイムアウト - サーバーが応答しません');
                }
            }, 10000); // 10 second timeout
            
            // Clear timeout on successful connection
            this.ws.addEventListener('open', () => {
                clearTimeout(connectionTimeout);
            }, { once: true });
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.logConnectionError(error);
            this.handleConnectionError('WebSocket接続の作成に失敗しました');
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.ws.onopen = (event) => {
            console.log('✅ WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.consecutiveFailures = 0;
            this.connectionStartTime = Date.now();
            this.lastSuccessfulConnection = Date.now();
            this.connectionQuality = 'excellent';
            this.connectionHealthScore = 100;
            this.adaptiveDelayMultiplier = 1; // Reset adaptive delay
            
            // Update statistics
            if (this.totalReconnections > 0) {
                console.log(`🔄 Reconnection successful after ${this.totalReconnections} attempts`);
            }
            
            // Start monitoring mechanisms
            this.startPing();
            this.startHealthMonitoring();
            
            // Process queued messages
            this.processMessageQueue();
            
            // Notify connection established
            if (this.onConnect) {
                this.onConnect();
            }
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('connected');
            }
            
            if (this.onConnectionQualityChange) {
                this.onConnectionQualityChange(this.connectionQuality, this.connectionHealthScore);
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
                this.messagesReceived++;
                
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            const wasConnected = this.isConnected;
            const reasonText = this.getCloseReasonText(event.code);
            
            console.log(`🔌 WebSocket disconnected: Code ${event.code} - ${reasonText}`);
            if (event.reason) {
                console.log(`📝 Disconnect reason: ${event.reason}`);
            }
            
            this.isConnected = false;
            this.clientId = null;
            this.connectionQuality = 'disconnected';
            
            // Log the disconnection
            this.logConnectionError({
                type: 'disconnect',
                code: event.code,
                reason: event.reason || reasonText,
                wasExpected: event.code === 1000
            });
            
            // Reset recording state on disconnection with detailed logging
            if (this.isRecording || this.recordingSessionId) {
                console.log('🚨 Recording session terminated due to disconnection');
                console.log('   Previous session ID:', this.recordingSessionId);
                this.isRecording = false;
                this.recordingSessionId = null;
                console.log('✅ Recording state reset for restart capability');
            }
            
            // Stop monitoring mechanisms
            this.stopPing();
            this.stopHealthMonitoring();
            
            // Update connection health score
            if (wasConnected) {
                this.connectionHealthScore = Math.max(0, this.connectionHealthScore - 20);
                this.consecutiveFailures++;
            }
            
            // Notify disconnection
            if (this.onDisconnect) {
                this.onDisconnect(event.code, reasonText);
            }
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('disconnected');
            }
            
            if (this.onConnectionQualityChange) {
                this.onConnectionQualityChange(this.connectionQuality, this.connectionHealthScore);
            }
            
            // Attempt reconnection if not a normal closure
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('🚫 Maximum reconnection attempts reached');
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange('failed');
                }
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleConnectionError('WebSocket接続エラーが発生しました');
        };
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(message) {
        switch (message.type) {
            case 'connection_established':
                this.clientId = message.client_id;
                console.log('Connection established with client ID:', this.clientId);
                break;
                
            case 'recording_started':
                console.log('Recording session confirmed by server:', message.session_id);
                break;
                
            case 'recording_stopped':
                console.log('Recording session stopped by server:', message.session_id);
                break;
                
            case 'detection_result':
                this.handleDetectionResult(message);
                break;
                
            case 'pong':
                this.handlePong();
                break;
                
            case 'error':
                console.error('Server error:', message.message);
                if (this.onError) {
                    this.onError(message.message);
                }
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    /**
     * Handle detection result from server
     */
    handleDetectionResult(message) {
        const result = {
            timestamp: message.timestamp,
            prediction: message.prediction,
            confidence: message.confidence,
            status: message.status,
            message: message.message
        };
        
        console.log('Detection result:', result);
        
        if (this.onDetectionResult) {
            this.onDetectionResult(result);
        }
    }

    /**
     * Start recording session with improved state management
     */
    startRecording() {
        if (!this.isConnected) {
            console.warn('❌ Cannot start recording: WebSocket not connected');
            return false;
        }
        
        // Clean up any previous recording state
        if (this.isRecording) {
            console.log('🔄 Cleaning up previous recording session before starting new one');
            this.stopRecording();
        }
        
        // Generate new session ID and start recording
        this.isRecording = true;
        this.recordingSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const message = {
            type: 'start_recording',
            session_id: this.recordingSessionId,
            timestamp: Date.now()
        };
        
        const success = this.sendMessage(message);
        if (success) {
            console.log('✅ Recording session started:', this.recordingSessionId);
            return true;
        } else {
            console.error('❌ Failed to send start recording message');
            this.isRecording = false;
            this.recordingSessionId = null;
            return false;
        }
    }

    /**
     * Stop recording session with improved cleanup
     */
    stopRecording() {
        if (!this.isRecording && !this.recordingSessionId) {
            console.warn('⚠️ Recording is not active');
            return false;
        }
        
        console.log('🛑 Stopping recording session:', this.recordingSessionId);
        
        // Send stop message if connected
        if (this.isConnected && this.recordingSessionId) {
            const message = {
                type: 'stop_recording',
                session_id: this.recordingSessionId,
                timestamp: Date.now()
            };
            
            const success = this.sendMessage(message);
            if (success) {
                console.log('✅ Stop recording message sent successfully');
            } else {
                console.warn('⚠️ Failed to send stop recording message - proceeding with local cleanup');
            }
        }
        
        // Always clean up local state regardless of message send status
        this.isRecording = false;
        this.recordingSessionId = null;
        
        console.log('✅ Recording session stopped and state cleaned up');
        return true;
    }

    /**
     * Send audio data to server for processing with enhanced validation and retries
     */
    sendAudioData(audioData, sampleRate = 44100) {
        if (!this.isConnected) {
            console.warn('⚠️ Cannot send audio data: WebSocket not connected');
            return false;
        }
        
        if (!this.isRecording) {
            console.warn('⚠️ Cannot send audio data: Recording not active');
            return false;
        }
        
        if (!audioData || audioData.length === 0) {
            console.warn('⚠️ Cannot send audio data: Data is empty');
            return false;
        }
        
        try {
            const message = {
                type: 'audio_data',
                data: audioData, // Should be base64 encoded
                sample_rate: sampleRate,
                session_id: this.recordingSessionId,
                timestamp: Date.now(),
                data_size: audioData.length
            };
            
            const success = this.sendMessage(message);
            if (success) {
                console.log(`📤 Audio data sent: ${audioData.length} chars, session: ${this.recordingSessionId}`);
            } else {
                console.warn('❌ Failed to send audio data message');
            }
            
            return success;
            
        } catch (error) {
            console.error('❌ Error sending audio data:', error);
            return false;
        }
    }

    /**
     * Send a message through WebSocket
     */
    sendMessage(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                this.messagesSent++;
                return true;
                
            } catch (error) {
                console.error('Error sending message:', error);
                this.queueMessage(message);
                return false;
            }
        } else {
            this.queueMessage(message);
            return false;
        }
    }

    /**
     * Queue message for later sending
     */
    queueMessage(message) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            this.messageQueue.shift(); // Remove oldest message
        }
        this.messageQueue.push(message);
    }

    /**
     * Process queued messages when connection is restored
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }

    /**
     * Start ping mechanism to keep connection alive
     */
    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendPing();
            }
        }, 15000); // Ping every 15 seconds for more frequent keepalive
    }

    /**
     * Stop ping mechanism
     */
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
    }

    /**
     * Send ping message to server with latency tracking
     */
    sendPing() {
        this.lastPingTime = Date.now();
        
        const pingMessage = {
            type: 'ping',
            timestamp: this.lastPingTime
        };
        
        const success = this.sendMessage(pingMessage);
        if (!success) {
            console.warn('⚠️ Failed to send ping - connection may be unstable');
            this.updateConnectionHealth(-10);
            return;
        }
        
        // Set timeout for pong response with adaptive timeout
        const pingTimeout = Math.min(30000, 15000 + (this.consecutiveFailures * 2000));
        this.pingTimeout = setTimeout(() => {
            console.warn(`⏰ Ping timeout after ${pingTimeout}ms - connection may be lost`);
            this.updateConnectionHealth(-25);
            this.handleConnectionError('接続タイムアウト - サーバーが応答しません');
        }, pingTimeout);
    }

    /**
     * Handle pong response from server with latency calculation
     */
    handlePong() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        // Calculate latency
        if (this.lastPingTime > 0) {
            this.pingLatency = Date.now() - this.lastPingTime;
            
            // Update average latency
            if (this.averageLatency === 0) {
                this.averageLatency = this.pingLatency;
            } else {
                this.averageLatency = (this.averageLatency * 0.8) + (this.pingLatency * 0.2);
            }
            
            // Update connection quality based on latency
            this.updateConnectionQuality();
            
            console.log(`🏓 Pong received: ${this.pingLatency}ms (avg: ${this.averageLatency.toFixed(1)}ms)`);
        }
    }

    /**
     * Handle connection errors with enhanced recovery mechanisms
     */
    handleConnectionError(errorMessage) {
        console.error('❌ Connection error:', errorMessage);
        
        // Log connection statistics for debugging
        const stats = this.getStatistics();
        console.log('📊 Connection statistics at error:', stats);
        
        // Clear any pending ping timeout
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        // Reset recording state on connection error with enhanced cleanup
        if (this.isRecording || this.recordingSessionId) {
            console.log('🚨 Resetting recording state due to connection error');
            console.log('   Affected session ID:', this.recordingSessionId);
            this.isRecording = false;
            this.recordingSessionId = null;
            console.log('✅ Recording state completely reset - ready for restart');
        }
        
        if (this.onError) {
            this.onError(errorMessage);
        }
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange('error');
        }
        
        // Enhanced auto-reconnect logic
        const shouldReconnect = (
            this.reconnectAttempts < this.maxReconnectAttempts && (
                errorMessage.includes('タイムアウト') ||
                errorMessage.includes('WebSocket') ||
                errorMessage.includes('接続')
            )
        );
        
        if (shouldReconnect) {
            console.log('🔄 Attempting auto-reconnect due to error...');
            this.scheduleReconnect();
        } else {
            console.warn('🚫 Max reconnection attempts reached or unrecoverable error');
        }
    }

    /**
     * Schedule reconnection attempt with improved backoff strategy
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        
        // Smart exponential backoff with maximum delay cap
        const baseDelay = this.reconnectDelay;
        const exponentialDelay = baseDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        const delay = Math.min(exponentialDelay, 30000); // Cap at 30 seconds
        
        console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange('reconnecting');
        }
        
        setTimeout(() => {
            if (!this.isConnected && this.reconnectAttempts <= this.maxReconnectAttempts) {
                console.log(`🔌 Executing reconnection attempt ${this.reconnectAttempts}`);
                this.connect();
            } else if (this.reconnectAttempts > this.maxReconnectAttempts) {
                console.error('🚫 Maximum reconnection attempts exceeded');
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange('failed');
                }
            }
        }, delay);
    }

    /**
     * Manually trigger reconnection
     */
    reconnect() {
        if (this.isConnected) {
            this.disconnect();
        }
        
        this.reconnectAttempts = 0;
        this.connect();
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        // Stop recording session if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        if (this.ws) {
            this.stopPing();
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.clientId = null;
        this.isRecording = false;
        this.recordingSessionId = null;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (!this.ws) {
            return 'disconnected';
        }
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
                return 'disconnecting';
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'unknown';
        }
    }

    /**
     * Get connection statistics
     */
    getStatistics() {
        const now = Date.now();
        const connectionDuration = this.connectionStartTime ? 
            (now - this.connectionStartTime) / 1000 : 0;
        
        return {
            isConnected: this.isConnected,
            clientId: this.clientId,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            connectionDuration: connectionDuration,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length
        };
    }

    /**
     * Reset connection statistics
     */
    resetStatistics() {
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.totalReconnections = 0;
        this.averageLatency = 0;
        this.connectionStartTime = this.isConnected ? Date.now() : null;
        this.connectionErrors = [];
        this.connectionHealthScore = 100;
        this.consecutiveFailures = 0;
    }
    
    /**
     * Update connection health score
     */
    updateConnectionHealth(delta) {
        this.connectionHealthScore = Math.max(0, Math.min(100, this.connectionHealthScore + delta));
        
        if (this.onConnectionQualityChange) {
            this.onConnectionQualityChange(this.connectionQuality, this.connectionHealthScore);
        }
    }
    
    /**
     * Update connection quality based on latency and health
     */
    updateConnectionQuality() {
        let quality = 'unknown';
        
        if (!this.isConnected) {
            quality = 'disconnected';
        } else if (this.averageLatency < 100 && this.connectionHealthScore > 80) {
            quality = 'excellent';
        } else if (this.averageLatency < 200 && this.connectionHealthScore > 60) {
            quality = 'good';
        } else if (this.averageLatency < 500 && this.connectionHealthScore > 40) {
            quality = 'fair';
        } else {
            quality = 'poor';
        }
        
        if (quality !== this.connectionQuality) {
            console.log(`📊 Connection quality changed: ${this.connectionQuality} → ${quality} (latency: ${this.averageLatency.toFixed(1)}ms, health: ${this.connectionHealthScore}%)`);
            this.connectionQuality = quality;
            
            if (this.onConnectionQualityChange) {
                this.onConnectionQualityChange(this.connectionQuality, this.connectionHealthScore);
            }
        }
        
        // Gradually improve health score on successful pings
        if (this.isConnected) {
            this.updateConnectionHealth(2);
        }
    }
    
    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            if (this.isConnected) {
                // Gradually decrease health if no recent activity
                const timeSinceLastPing = Date.now() - this.lastPingTime;
                if (timeSinceLastPing > 60000) { // 1 minute
                    this.updateConnectionHealth(-5);
                }
                
                // Update connection quality
                this.updateConnectionQuality();
            }
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    /**
     * Log connection errors for analysis
     */
    logConnectionError(error) {
        const errorEntry = {
            timestamp: Date.now(),
            error: error,
            reconnectAttempt: this.reconnectAttempts,
            consecutiveFailures: this.consecutiveFailures
        };
        
        this.connectionErrors.push(errorEntry);
        
        // Keep only last 50 errors
        if (this.connectionErrors.length > 50) {
            this.connectionErrors = this.connectionErrors.slice(-50);
        }
        
        console.log('📝 Connection error logged:', errorEntry);
    }
    
    /**
     * Get human-readable close reason
     */
    getCloseReasonText(code) {
        const reasons = {
            1000: '正常切断',
            1001: 'エンドポイント離脱',
            1002: 'プロトコルエラー',
            1003: '未対応データ',
            1006: '異常切断',
            1007: 'データ形式エラー',
            1008: 'ポリシー違反',
            1009: 'メッセージサイズ超過',
            1010: '拡張ネゴシエーション失敗',
            1011: 'サーバー内部エラー',
            1012: 'サーバー再起動',
            1013: 'サーバー過負荷',
            1014: 'Bad Gateway',
            1015: 'TLS失敗'
        };
        
        return reasons[code] || `不明なエラー (${code})`;
    }
    
    /**
     * Get adaptive reconnection delay based on strategy
     */
    getReconnectionDelay() {
        switch (this.reconnectStrategy) {
            case 'fixed':
                return this.reconnectDelay;
                
            case 'exponential':
                return Math.min(30000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
                
            case 'adaptive':
            default:
                // Adaptive strategy based on connection quality and failure rate
                let baseDelay = this.reconnectDelay;
                
                // Increase delay based on consecutive failures
                const failureMultiplier = 1 + (this.consecutiveFailures * 0.5);
                
                // Decrease delay if connection was recently stable
                const stabilityBonus = this.lastSuccessfulConnection ? 
                    Math.max(0.5, 1 - ((Date.now() - this.lastSuccessfulConnection) / 300000)) : 1; // 5 minute window
                
                // Increase delay based on connection health
                const healthPenalty = 1 + ((100 - this.connectionHealthScore) / 100);
                
                const adaptiveDelay = baseDelay * failureMultiplier * stabilityBonus * healthPenalty * this.adaptiveDelayMultiplier;
                
                // Cap the delay
                return Math.min(60000, Math.max(1000, adaptiveDelay));
        }
    }
    
    /**
     * Enhanced reconnection with smart retry logic
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        this.totalReconnections++;
        
        const delay = this.getReconnectionDelay();
        
        // Update adaptive multiplier for next time
        if (this.reconnectStrategy === 'adaptive') {
            this.adaptiveDelayMultiplier *= 1.2; // Gradually increase delay
        }
        
        console.log(`🔄 Scheduling smart reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        console.log(`📊 Reconnection strategy: ${this.reconnectStrategy}, Health: ${this.connectionHealthScore}%, Failures: ${this.consecutiveFailures}`);
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange('reconnecting');
        }
        
        setTimeout(() => {
            if (!this.isConnected && this.reconnectAttempts <= this.maxReconnectAttempts) {
                console.log(`🔌 Executing smart reconnection attempt ${this.reconnectAttempts}`);
                this.connect();
            } else if (this.reconnectAttempts > this.maxReconnectAttempts) {
                console.error('🚫 Maximum reconnection attempts exceeded');
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange('failed');
                }
                if (this.onError) {
                    this.onError('最大再接続回数に達しました。ページを再読み込みしてください。');
                }
            }
        }, delay);
    }
    
    /**
     * Get detailed connection diagnostics
     */
    getDiagnostics() {
        return {
            isConnected: this.isConnected,
            connectionQuality: this.connectionQuality,
            connectionHealthScore: this.connectionHealthScore,
            pingLatency: this.pingLatency,
            averageLatency: this.averageLatency,
            reconnectAttempts: this.reconnectAttempts,
            totalReconnections: this.totalReconnections,
            consecutiveFailures: this.consecutiveFailures,
            connectionErrors: this.connectionErrors.slice(-10), // Last 10 errors
            lastSuccessfulConnection: this.lastSuccessfulConnection,
            connectionDuration: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            queuedMessages: this.messageQueue.length,
            reconnectStrategy: this.reconnectStrategy
        };
    }
    
    /**
     * Force manual reconnection with reset
     */
    forceReconnect() {
        console.log('🔄 Force reconnection initiated');
        
        // Reset some counters for fresh start
        this.consecutiveFailures = Math.max(0, this.consecutiveFailures - 2);
        this.adaptiveDelayMultiplier = Math.max(1, this.adaptiveDelayMultiplier * 0.8);
        
        this.reconnect();
    }
}
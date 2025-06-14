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
        this.maxReconnectAttempts = 5; // Simplified retry attempts
        this.reconnectDelay = 3000; // More reasonable initial delay
        this.pingInterval = null;
        this.pingTimeout = null;
        
        // Recording state management
        this.isRecording = false;
        this.recordingSessionId = null;
        
        // Message queue for offline scenarios
        this.messageQueue = [];
        this.maxQueueSize = 100;
        
        // Simple connection tracking
        this.connectionQuality = 'unknown';
        this.lastPingTime = 0;
        
        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onDetectionResult = null;
        this.onError = null;
        this.onConnectionStateChange = null;
        this.onConnectionQualityChange = null;
        
        // Simple statistics
        this.messagesSent = 0;
        this.messagesReceived = 0;
        
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
                    this.handleConnectionError('接続タイムアウト - サーバーへの接続に時間がかかりすぎています');
                }
            }, 20000); // 20 second timeout - more reasonable for slower networks
            
            // Clear timeout on successful connection
            this.ws.addEventListener('open', () => {
                clearTimeout(connectionTimeout);
            }, { once: true });
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
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
            this.connectionQuality = 'connected';
            
            console.log('✅ WebSocket connection established successfully');
            
            // Start simple ping mechanism
            this.startPing();
            
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
                this.onConnectionQualityChange(this.connectionQuality, 100);
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
            
            // Simple disconnection logging
            console.log('Connection closed:', {
                code: event.code,
                reason: event.reason || reasonText
            });
            
            // Reset recording state on disconnection with detailed logging
            if (this.isRecording || this.recordingSessionId) {
                console.log('🚨 Recording session terminated due to disconnection');
                console.log('   Previous session ID:', this.recordingSessionId);
                this.isRecording = false;
                this.recordingSessionId = null;
                console.log('✅ Recording state reset for restart capability');
            }
            
            // Stop ping mechanism
            this.stopPing();
            
            // Simple connection state tracking
            
            // Notify disconnection
            if (this.onDisconnect) {
                this.onDisconnect(event.code, reasonText);
            }
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('disconnected');
            }
            
            if (this.onConnectionQualityChange) {
                this.onConnectionQualityChange('disconnected', 0);
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
        }, 30000); // Ping every 30 seconds - less aggressive
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
            return;
        }
        
        // Set timeout for pong response - simplified
        this.pingTimeout = setTimeout(() => {
            console.warn('⏰ Ping timeout - connection may be lost');
            this.handleConnectionError('サーバーが応答しません - 接続を確認中...');
        }, 15000); // 15 second timeout for ping response
    }

    /**
     * Handle pong response from server with latency calculation
     */
    handlePong() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        console.log('🏓 Pong received - connection is alive');
    }

    /**
     * Handle connection errors with simple recovery
     */
    handleConnectionError(errorMessage) {
        console.error('❌ Connection error:', errorMessage);
        
        // Clear any pending ping timeout
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        // Reset recording state on connection error
        if (this.isRecording || this.recordingSessionId) {
            console.log('🚨 Resetting recording state due to connection error');
            this.isRecording = false;
            this.recordingSessionId = null;
        }
        
        if (this.onError) {
            this.onError(errorMessage);
        }
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange('error');
        }
        
        // Simple auto-reconnect logic
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('🔄 Attempting auto-reconnect due to error...');
            this.scheduleReconnect();
        } else {
            console.warn('🚫 Max reconnection attempts reached');
        }
    }

    /**
     * Schedule simple reconnection attempt
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        
        // Simple exponential backoff
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
        
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
     * Get simple connection statistics
     */
    getStatistics() {
        return {
            isConnected: this.isConnected,
            clientId: this.clientId,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length
        };
    }

    /**
     * Reset simple statistics
     */
    resetStatistics() {
        this.messagesSent = 0;
        this.messagesReceived = 0;
    }
    
    /**
     * Simple connection health stub
     */
    updateConnectionHealth() {
        // Stub - no complex health monitoring
        return;
    }
    
    /**
     * Simple connection quality stub
     */
    updateConnectionQuality() {
        // Simple quality assessment
        if (!this.isConnected) {
            this.connectionQuality = 'disconnected';
        } else {
            this.connectionQuality = 'connected';
        }
    }
    
    /**
     * Health monitoring stub - removed
     */
    startHealthMonitoring() {
        // Stub - complex health monitoring removed
        return;
    }
    
    /**
     * Health monitoring stub - removed
     */
    stopHealthMonitoring() {
        // Stub - complex health monitoring removed
        return;
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
     * Simple reconnection delay - removed complex adaptive logic
     */
    getReconnectionDelay() {
        // Simple exponential backoff
        return Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts));
    }
    
    /**
     * Simple diagnostics stub
     */
    getDiagnostics() {
        return {
            isConnected: this.isConnected,
            connectionQuality: this.connectionQuality,
            reconnectAttempts: this.reconnectAttempts,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            queuedMessages: this.messageQueue.length
        };
    }
    
    /**
     * Simple force reconnect stub
     */
    forceReconnect() {
        console.log('🔄 Force reconnection initiated');
        this.reconnect();
    }
}
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
        this.maxReconnectAttempts = 10; // Reasonable retry attempts
        this.reconnectDelay = 2000; // 2 seconds for more stable reconnection
        this.pingInterval = null;
        this.pingTimeout = null;
        
        // Recording state management
        this.isRecording = false;
        this.recordingSessionId = null;
        
        // Message queue for offline scenarios
        this.messageQueue = [];
        this.maxQueueSize = 100;
        
        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onDetectionResult = null;
        this.onError = null;
        this.onConnectionStateChange = null;
        
        // Statistics
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.connectionStartTime = null;
        
        this.connect();
    }

    /**
     * Establish WebSocket connection to the server
     */
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws/audio`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
            
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.handleConnectionError('WebSocket接続の作成に失敗しました');
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.ws.onopen = (event) => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.connectionStartTime = Date.now();
            
            // Start ping mechanism
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
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.clientId = null;
            
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
            
            // Notify disconnection
            if (this.onDisconnect) {
                this.onDisconnect();
            }
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange('disconnected');
            }
            
            // Attempt reconnection if not a normal closure
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
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
     * Send ping message to server
     */
    sendPing() {
        const pingMessage = {
            type: 'ping',
            timestamp: Date.now()
        };
        
        this.sendMessage(pingMessage);
        
        // Set timeout for pong response (further extended for maximum stability)
        this.pingTimeout = setTimeout(() => {
            console.warn('Ping timeout - connection may be lost');
            this.handleConnectionError('接続タイムアウト');
        }, 20000); // 20 second timeout - reasonable balance between stability and responsiveness
    }

    /**
     * Handle pong response from server
     */
    handlePong() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
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
        this.connectionStartTime = this.isConnected ? Date.now() : null;
    }
}
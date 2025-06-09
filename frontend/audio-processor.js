/**
 * Audio Processing Module for SoundDitect Frontend
 * 
 * Handles real-time audio capture, processing, and visualization
 * using Web Audio API.
 */

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.processorNode = null;
        
        // Audio configuration
        this.sampleRate = 44100;
        this.bufferSize = 1024;
        this.fftSize = 2048;
        
        // Processing state
        this.isRecording = false;
        this.audioBuffer = [];
        this.maxBufferLength = this.sampleRate; // 1 second of audio
        
        // Visualization
        this.frequencyData = null;
        this.timeDomainData = null;
        
        // Callbacks
        this.onAudioData = null;
        this.onVolumeChange = null;
        this.onError = null;
        
        // Audio features
        this.currentVolume = 0;
        this.currentFrequencySpectrum = null;
        
        this.initializeAudioContext();
    }

    /**
     * Initialize the Web Audio API context
     */
    async initializeAudioContext() {
        try {
            // Create audio context with the desired sample rate
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            // Handle audio context state changes
            this.audioContext.addEventListener('statechange', () => {
                console.log('Audio context state:', this.audioContext.state);
            });

            // Resume context if suspended (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            console.log('Audio context initialized successfully');
            console.log('Sample rate:', this.audioContext.sampleRate);
            
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            if (this.onError) {
                this.onError('オーディオコンテキストの初期化に失敗しました');
            }
        }
    }

    /**
     * Start audio recording and processing
     */
    async startRecording() {
        try {
            if (this.isRecording) {
                console.warn('Recording is already in progress');
                return false;
            }

            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio nodes
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyserNode = this.audioContext.createAnalyser();
            
            // Configure analyser
            this.analyserNode.fftSize = this.fftSize;
            this.analyserNode.smoothingTimeConstant = 0.8;
            
            // Create ScriptProcessorNode for audio processing
            this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
            
            // Connect audio nodes
            this.sourceNode.connect(this.analyserNode);
            this.analyserNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
            
            // Set up audio processing callback
            this.processorNode.onaudioprocess = (event) => {
                this.processAudioBuffer(event);
            };
            
            // Initialize data arrays
            this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
            this.timeDomainData = new Uint8Array(this.analyserNode.fftSize);
            
            this.isRecording = true;
            console.log('Audio recording started successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            
            let errorMessage = 'マイクアクセスに失敗しました';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'マイクが見つかりません。デバイスを確認してください。';
            }
            
            if (this.onError) {
                this.onError(errorMessage);
            }
            
            return false;
        }
    }

    /**
     * Stop audio recording and processing
     */
    stopRecording() {
        try {
            this.isRecording = false;
            
            // Stop media stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
            
            // Disconnect and clean up audio nodes
            if (this.processorNode) {
                this.processorNode.disconnect();
                this.processorNode = null;
            }
            
            if (this.analyserNode) {
                this.analyserNode.disconnect();
                this.analyserNode = null;
            }
            
            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            
            // Clear buffers
            this.audioBuffer = [];
            this.frequencyData = null;
            this.timeDomainData = null;
            
            console.log('Audio recording stopped');
            
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
    }

    /**
     * Process incoming audio buffer
     */
    processAudioBuffer(event) {
        if (!this.isRecording) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Copy audio data to our buffer
        const audioArray = new Float32Array(inputData);
        this.audioBuffer.push(...audioArray);
        
        // Maintain buffer size limit
        if (this.audioBuffer.length > this.maxBufferLength) {
            this.audioBuffer = this.audioBuffer.slice(-this.maxBufferLength);
        }
        
        // Calculate volume (RMS)
        this.currentVolume = this.calculateRMS(audioArray);
        
        // Update visualization data
        this.updateVisualizationData();
        
        // Send volume update
        if (this.onVolumeChange) {
            this.onVolumeChange(this.currentVolume);
        }
        
        // Send audio data if we have enough (1 second worth)
        if (this.audioBuffer.length >= this.maxBufferLength && this.onAudioData) {
            const audioData = new Float32Array(this.audioBuffer.slice(-this.maxBufferLength));
            this.onAudioData(audioData);
        }
    }

    /**
     * Update visualization data from analyser
     */
    updateVisualizationData() {
        if (!this.analyserNode || !this.frequencyData || !this.timeDomainData) return;
        
        // Get frequency domain data
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        
        // Get time domain data
        this.analyserNode.getByteTimeDomainData(this.timeDomainData);
        
        // Store current frequency spectrum
        this.currentFrequencySpectrum = Array.from(this.frequencyData);
    }

    /**
     * Calculate RMS (Root Mean Square) volume level
     */
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }

    /**
     * Get current frequency spectrum for visualization
     */
    getFrequencySpectrum() {
        return this.currentFrequencySpectrum;
    }

    /**
     * Get current time domain data for waveform visualization
     */
    getTimeDomainData() {
        return this.timeDomainData ? Array.from(this.timeDomainData) : null;
    }

    /**
     * Get current volume level (0-1)
     */
    getVolumeLevel() {
        return this.currentVolume;
    }

    /**
     * Convert audio data to base64 for transmission
     */
    audioToBase64(audioData) {
        try {
            const buffer = new ArrayBuffer(audioData.length * 4);
            const view = new Float32Array(buffer);
            view.set(audioData);
            
            // Convert to base64
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            
            return btoa(binary);
            
        } catch (error) {
            console.error('Error converting audio to base64:', error);
            return null;
        }
    }

    /**
     * Apply simple audio preprocessing
     */
    preprocessAudio(audioData) {
        // Remove DC offset
        const mean = audioData.reduce((sum, val) => sum + val, 0) / audioData.length;
        const dcRemoved = audioData.map(val => val - mean);
        
        // Normalize to [-1, 1]
        const maxVal = Math.max(...dcRemoved.map(Math.abs));
        if (maxVal > 0) {
            return dcRemoved.map(val => val / maxVal);
        }
        
        return dcRemoved;
    }

    /**
     * Detect if current audio is mostly silence
     */
    isSilence(threshold = 0.01) {
        return this.currentVolume < threshold;
    }

    /**
     * Get audio context state
     */
    getAudioContextState() {
        return this.audioContext ? this.audioContext.state : 'unavailable';
    }

    /**
     * Resume audio context if suspended
     */
    async resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('Audio context resumed');
                return true;
            } catch (error) {
                console.error('Failed to resume audio context:', error);
                return false;
            }
        }
        return true;
    }

    /**
     * Check if microphone access is available
     */
    static async checkMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Microphone access check failed:', error);
            return false;
        }
    }

    /**
     * Get available audio input devices
     */
    static async getAudioInputDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Failed to enumerate audio devices:', error);
            return [];
        }
    }
}
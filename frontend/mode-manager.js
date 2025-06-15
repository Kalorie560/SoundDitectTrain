/**
 * Simplified Mode Manager for SoundDitect
 * 
 * Handles mode selection with immediate visual feedback and reliable operation
 */

class SimpleModeManager {
    constructor() {
        this.currentMode = null;
        this.isTransitioning = false;
        this.elements = {};
        this.initializationAttempts = 0;
        this.maxInitAttempts = 5;
        
        // Initialize after DOM is ready with retry mechanism
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeWithRetry());
        } else {
            this.initializeWithRetry();
        }
    }

    initializeWithRetry() {
        this.initializationAttempts++;
        console.log(`🎯 SimpleModeManager initialization attempt ${this.initializationAttempts}/${this.maxInitAttempts}`);
        
        if (this.initialize()) {
            console.log('✅ SimpleModeManager initialized successfully');
            return true;
        } else if (this.initializationAttempts < this.maxInitAttempts) {
            console.log(`⏳ Retrying initialization in 500ms (attempt ${this.initializationAttempts + 1}/${this.maxInitAttempts})`);
            setTimeout(() => this.initializeWithRetry(), 500);
            return false;
        } else {
            console.error('❌ SimpleModeManager initialization failed after all attempts');
            this.createFallbackModeManager();
            return false;
        }
    }

    initialize() {
        console.log('🎯 Initializing SimpleModeManager...');
        
        try {
            // Cache all DOM elements with error handling
            const elementsCached = this.cacheElements();
            if (!elementsCached) {
                console.warn('⚠️ Element caching failed, will retry');
                return false;
            }
            
            // Set up event listeners with error handling
            const listenersSetup = this.setupEventListeners();
            if (!listenersSetup) {
                console.warn('⚠️ Event listener setup failed, will retry');
                return false;
            }
            
            // Show mode selection initially
            this.showModeSelection();
            
            console.log('✅ SimpleModeManager initialized successfully');
            
            // Log successful initialization
            if (window.errorLogger) {
                window.errorLogger.log(
                    new Error('SimpleModeManager initialization success'),
                    'Mode Manager Init',
                    { 
                        elementsFound: Object.keys(this.elements).filter(key => this.elements[key]).length,
                        totalElements: Object.keys(this.elements).length,
                        attempts: this.initializationAttempts
                    }
                );
            }
            
            return true;
            
        } catch (error) {
            console.error(`❌ SimpleModeManager initialization failed (attempt ${this.initializationAttempts}):`, error);
            
            if (window.errorLogger) {
                window.errorLogger.log(error, 'Mode Manager Init', {
                    domReady: document.readyState,
                    elementsAttempted: Object.keys(this.elements || {}).length,
                    attempt: this.initializationAttempts
                });
            }
            
            return false;
        }
    }

    cacheElements() {
        console.log('📋 Caching DOM elements...');
        
        // Initialize elements object
        this.elements = {};
        
        // Element selectors with fallback descriptions
        const elementSelectors = {
            // Mode selection elements (most critical)
            modeSelectionPanel: { selector: '.mode-selection-panel', type: 'class', required: true },
            selectRealtimeBtn: { selector: 'selectRealtimeMode', type: 'id', required: true },
            selectOfflineBtn: { selector: 'selectOfflineMode', type: 'id', required: true },
            
            // Interface elements (required for mode switching)
            realtimeInterface: { selector: 'realtimeInterface', type: 'id', required: true },
            offlineInterface: { selector: 'offlineInterface', type: 'id', required: true },
            
            // Mode cards (nice to have)
            realtimeModeCard: { selector: 'realtimeModeCard', type: 'id', required: false },
            offlineModeCard: { selector: 'offlineModeCard', type: 'id', required: false },
            
            // Results areas (optional)
            realtimeResults: { selector: 'realtimeResults', type: 'id', required: false },
            offlineResults: { selector: 'offlineResults', type: 'id', required: false },
            
            // Back buttons (optional)
            backFromRealtime: { selector: 'backFromRealtime', type: 'id', required: false },
            backFromOffline: { selector: 'backFromOffline', type: 'id', required: false },
            
            // Other controls (optional)
            recordingDuration: { selector: 'recordingDuration', type: 'id', required: false },
            durationValue: { selector: 'durationValue', type: 'id', required: false },
            offlineStartButtonText: { selector: 'offlineStartButtonText', type: 'id', required: false }
        };
        
        // Cache elements with error handling
        let foundElements = 0;
        let missingRequired = [];
        
        for (const [name, config] of Object.entries(elementSelectors)) {
            try {
                if (config.type === 'id') {
                    this.elements[name] = document.getElementById(config.selector);
                } else if (config.type === 'class') {
                    this.elements[name] = document.querySelector(config.selector);
                }
                
                if (this.elements[name]) {
                    foundElements++;
                    console.log(`✅ Found ${name}: ${config.selector}`);
                } else {
                    console.warn(`⚠️ Missing ${name}: ${config.selector}${config.required ? ' (REQUIRED)' : ''}`);
                    if (config.required) {
                        missingRequired.push(name);
                    }
                }
            } catch (error) {
                console.error(`❌ Error caching ${name}:`, error);
                if (window.errorLogger) {
                    window.errorLogger.log(error, 'Mode Manager Element Cache', {
                        elementName: name,
                        selector: config.selector,
                        type: config.type
                    });
                }
            }
        }
        
        console.log(`📊 Cached ${foundElements}/${Object.keys(elementSelectors).length} elements`);
        
        // Check for critical missing elements
        if (missingRequired.length > 0) {
            console.warn(`⚠️ Missing required elements: ${missingRequired.join(', ')}`);
            console.warn('📝 Cannot continue without critical elements');
            
            if (window.errorLogger) {
                window.errorLogger.log(new Error(`Missing required elements: ${missingRequired.join(', ')}`), 'Mode Manager Required Elements', {
                    missingRequired,
                    foundElements,
                    totalElements: Object.keys(elementSelectors).length,
                    domReady: document.readyState,
                    canRetry: true
                });
            }
            
            return false; // Return false to indicate failure
        }
        
        // Success if we have all required elements
        return true;
    }
    
    /**
     * Create fallback mode manager when initialization fails
     */
    createFallbackModeManager() {
        console.log('🛡️ Creating fallback mode manager...');
        
        // Reset state
        this.currentMode = null;
        this.isTransitioning = false;
        this.elements = {};
        
        // Try to find elements with simple selectors
        try {
            const realtimeBtn = document.getElementById('selectRealtimeMode');
            const offlineBtn = document.getElementById('selectOfflineMode');
            
            if (realtimeBtn) {
                realtimeBtn.onclick = () => {
                    console.log('🚨 Fallback: Real-time mode clicked');
                    realtimeBtn.textContent = 'モード選択が無効です - ページを再読み込みしてください';
                    realtimeBtn.disabled = true;
                };
            }
            
            if (offlineBtn) {
                offlineBtn.onclick = () => {
                    console.log('🚨 Fallback: Offline mode clicked');
                    offlineBtn.textContent = 'モード選択が無効です - ページを再読み込みしてください';
                    offlineBtn.disabled = true;
                };
            }
            
            // Show error message to user
            setTimeout(() => {
                if (window.app && window.app.uiController) {
                    window.app.uiController.showError(
                        'モード選択機能の初期化に失敗しました。ページを再読み込みしてください。\n\n詳細はコンソール (F12) で errorLogger.getErrors() を確認してください。'
                    );
                }
            }, 1000);
            
        } catch (fallbackError) {
            console.error('❌ Even fallback mode manager failed:', fallbackError);
            if (window.errorLogger) {
                window.errorLogger.log(fallbackError, 'Mode Manager Fallback', {
                    originalError: 'SimpleModeManager initialization failed'
                });
            }
        }
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        let criticalListenersSetup = 0;
        
        // Mode selection buttons (critical)
        if (this.elements.selectRealtimeBtn) {
            try {
                console.log('✅ Setting up real-time button event listener');
                this.elements.selectRealtimeBtn.addEventListener('click', (e) => {
                    console.log('🎯 Real-time mode button clicked');
                    this.selectMode('realtime', e.target);
                });
                criticalListenersSetup++;
            } catch (error) {
                console.error('❌ Error setting up real-time button listener:', error);
                return false;
            }
        } else {
            console.error('❌ Real-time button not found, cannot set up event listener');
            return false;
        }

        if (this.elements.selectOfflineBtn) {
            try {
                console.log('✅ Setting up offline button event listener');
                this.elements.selectOfflineBtn.addEventListener('click', (e) => {
                    console.log('🎯 Offline mode button clicked');
                    this.selectMode('offline', e.target);
                });
                criticalListenersSetup++;
            } catch (error) {
                console.error('❌ Error setting up offline button listener:', error);
                return false;
            }
        } else {
            console.error('❌ Offline button not found, cannot set up event listener');
            return false;
        }

        // Back buttons (optional but important)
        if (this.elements.backFromRealtime) {
            try {
                this.elements.backFromRealtime.addEventListener('click', () => {
                    console.log('🔙 Back from real-time clicked');
                    this.showModeSelection();
                });
                console.log('✅ Back from real-time button listener setup');
            } catch (error) {
                console.warn('⚠️ Error setting up back from real-time listener:', error);
            }
        }

        if (this.elements.backFromOffline) {
            try {
                this.elements.backFromOffline.addEventListener('click', () => {
                    console.log('🔙 Back from offline clicked');
                    this.showModeSelection();
                });
                console.log('✅ Back from offline button listener setup');
            } catch (error) {
                console.warn('⚠️ Error setting up back from offline listener:', error);
            }
        }

        // Duration slider (optional)
        if (this.elements.recordingDuration && this.elements.durationValue) {
            try {
                this.elements.recordingDuration.addEventListener('input', (e) => {
                    const duration = parseInt(e.target.value);
                    this.elements.durationValue.textContent = duration;
                    
                    if (this.elements.offlineStartButtonText) {
                        this.elements.offlineStartButtonText.textContent = `録音開始 (${duration}秒)`;
                    }
                    
                    // Update app recording duration if available
                    if (window.app) {
                        window.app.recordingDuration = duration;
                    }
                });
                console.log('✅ Duration slider listener setup');
            } catch (error) {
                console.warn('⚠️ Error setting up duration slider listener:', error);
            }
        }
        
        // Offline mode recording buttons (optional)
        const offlineStartBtn = document.getElementById('offlineStartButton');
        const offlineStopBtn = document.getElementById('offlineStopButton');
        
        if (offlineStartBtn) {
            try {
                offlineStartBtn.addEventListener('click', async () => {
                    console.log('🎯 Offline start button clicked');
                    if (window.app) {
                        const success = await window.app.startRecording();
                        console.log(`🎯 Offline recording start result: ${success}`);
                    }
                });
                console.log('✅ Offline start button listener setup');
            } catch (error) {
                console.warn('⚠️ Error setting up offline start listener:', error);
            }
        }
        
        if (offlineStopBtn) {
            try {
                offlineStopBtn.addEventListener('click', () => {
                    console.log('🎯 Offline stop button clicked');
                    if (window.app) {
                        window.app.stopRecording();
                    }
                });
                console.log('✅ Offline stop button listener setup');
            } catch (error) {
                console.warn('⚠️ Error setting up offline stop listener:', error);
            }
        }
        
        // Check if critical listeners were setup (need both mode selection buttons)
        if (criticalListenersSetup >= 2) {
            console.log(`✅ Event listeners setup complete (${criticalListenersSetup}/2 critical listeners)`);
            return true;
        } else {
            console.error(`❌ Event listeners setup failed (${criticalListenersSetup}/2 critical listeners)`);
            return false;
        }
    }

    selectMode(mode, buttonElement) {
        console.log(`🎯 selectMode called with mode: ${mode}, button:`, buttonElement);
        
        if (this.isTransitioning) {
            console.log('⏳ Mode transition already in progress, ignoring click');
            return;
        }

        console.log(`🔄 Selecting mode: ${mode}`);
        this.isTransitioning = true;
        this.currentMode = mode;

        // Show immediate visual feedback
        this.showImmediateFeedback(mode, buttonElement);

        // Show loading overlay
        this.showLoadingOverlay(mode);

        // Perform mode transition after short delay
        setTimeout(() => {
            try {
                this.performModeTransition(mode);
            } catch (error) {
                console.error('❌ Error during mode transition:', error);
                this.handleTransitionError(error);
            } finally {
                this.hideLoadingOverlay();
                this.isTransitioning = false;
            }
        }, 1500); // Show loading for 1.5 seconds
    }

    showImmediateFeedback(mode, buttonElement) {
        console.log(`📝 Showing immediate feedback for ${mode} mode`);

        // Reset all cards first
        this.resetAllCards();

        // Highlight selected card and button
        const card = mode === 'realtime' ? this.elements.realtimeModeCard : this.elements.offlineModeCard;
        
        if (card) {
            card.classList.add('selecting');
            console.log(`✅ Added selecting class to ${mode} card`);
        }

        if (buttonElement) {
            buttonElement.classList.add('selecting');
            buttonElement.textContent = '選択中...';
            buttonElement.disabled = true;
            console.log(`✅ Updated button text and state for ${mode}`);
        }
    }

    resetAllCards() {
        // Remove selecting classes from all cards and buttons
        [this.elements.realtimeModeCard, this.elements.offlineModeCard].forEach(card => {
            if (card) {
                card.classList.remove('selecting', 'error-state', 'success-state');
            }
        });

        [this.elements.selectRealtimeBtn, this.elements.selectOfflineBtn].forEach(btn => {
            if (btn) {
                btn.classList.remove('selecting');
                btn.disabled = false;
            }
        });

        // Reset button texts
        if (this.elements.selectRealtimeBtn) {
            this.elements.selectRealtimeBtn.textContent = 'リアルタイムモードを選択';
        }
        if (this.elements.selectOfflineBtn) {
            this.elements.selectOfflineBtn.textContent = 'オフラインモードを選択';
        }
    }

    showLoadingOverlay(mode) {
        const modeText = mode === 'realtime' ? 'リアルタイム' : 'オフライン';
        
        // Remove existing overlay if present
        this.hideLoadingOverlay();

        // Create new overlay
        const overlay = document.createElement('div');
        overlay.id = 'simpleModeLoadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${modeText}モード準備中</div>
            <div class="loading-subtext">インターフェースを準備しています...</div>
        `;

        document.body.appendChild(overlay);
        console.log(`📝 Loading overlay shown for ${mode} mode`);
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('simpleModeLoadingOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
            console.log('📝 Loading overlay hidden');
        }
    }

    performModeTransition(mode) {
        console.log(`🔄 Performing transition to ${mode} mode`);

        // Hide mode selection panel
        if (this.elements.modeSelectionPanel) {
            this.elements.modeSelectionPanel.style.display = 'none';
            console.log('✅ Mode selection panel hidden');
        }

        // Hide all interfaces first
        this.hideAllInterfaces();

        // Show selected interface
        if (mode === 'realtime') {
            this.showRealtimeInterface();
        } else if (mode === 'offline') {
            this.showOfflineInterface();
        }

        console.log(`✅ Mode transition to ${mode} completed`);
    }

    hideAllInterfaces() {
        const interfaces = [
            this.elements.realtimeInterface,
            this.elements.offlineInterface,
            this.elements.realtimeResults,
            this.elements.offlineResults
        ];

        interfaces.forEach(interface => {
            if (interface) {
                interface.style.display = 'none';
                interface.classList.remove('visible');
            }
        });

        console.log('✅ All interfaces hidden');
    }

    showRealtimeInterface() {
        console.log('🎯 Showing real-time interface');

        if (this.elements.realtimeInterface) {
            this.elements.realtimeInterface.style.display = 'block';
            this.elements.realtimeInterface.classList.add('interface-transition');
            
            // Trigger animation
            setTimeout(() => {
                this.elements.realtimeInterface.classList.add('visible');
            }, 50);
            
            console.log('✅ Real-time interface displayed');
        }

        if (this.elements.realtimeResults) {
            this.elements.realtimeResults.style.display = 'block';
            this.elements.realtimeResults.classList.add('interface-transition');
            
            setTimeout(() => {
                this.elements.realtimeResults.classList.add('visible');
            }, 100);
            
            console.log('✅ Real-time results displayed');
        }

        // Show success feedback on mode card
        if (this.elements.realtimeModeCard) {
            this.elements.realtimeModeCard.classList.remove('selecting');
            this.elements.realtimeModeCard.classList.add('success-state');
        }
    }

    showOfflineInterface() {
        console.log('🎯 Showing offline interface');

        if (this.elements.offlineInterface) {
            this.elements.offlineInterface.style.display = 'block';
            this.elements.offlineInterface.classList.add('interface-transition');
            
            setTimeout(() => {
                this.elements.offlineInterface.classList.add('visible');
            }, 50);
            
            console.log('✅ Offline interface displayed');
        }

        if (this.elements.offlineResults) {
            this.elements.offlineResults.style.display = 'block';
            this.elements.offlineResults.classList.add('interface-transition');
            
            setTimeout(() => {
                this.elements.offlineResults.classList.add('visible');
            }, 100);
            
            console.log('✅ Offline results displayed');
        }

        // Show helpful instructions
        this.showOfflineInstructions();

        // Show success feedback on mode card
        if (this.elements.offlineModeCard) {
            this.elements.offlineModeCard.classList.remove('selecting');
            this.elements.offlineModeCard.classList.add('success-state');
        }
    }

    showOfflineInstructions() {
        // Create instruction notification
        const instruction = document.createElement('div');
        instruction.id = 'offlineInstructionNotification';
        instruction.style.cssText = `
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
            opacity: 1;
            transition: opacity 0.3s ease;
        `;

        instruction.innerHTML = `
            <strong>📊 オフラインモード</strong><br>
            録音時間を設定して「録音開始」ボタンをクリックしてください。<br>
            録音完了後、詳細な分析結果を表示します。
        `;

        document.body.appendChild(instruction);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (instruction && instruction.parentNode) {
                instruction.style.opacity = '0';
                setTimeout(() => {
                    if (instruction.parentNode) {
                        instruction.parentNode.removeChild(instruction);
                    }
                }, 300);
            }
        }, 5000);

        console.log('📝 Offline instructions shown');
    }

    showModeSelection() {
        console.log('🎯 Showing mode selection');

        // Reset state
        this.currentMode = null;
        this.isTransitioning = false;

        // Hide loading overlay
        this.hideLoadingOverlay();

        // Hide all interfaces
        this.hideAllInterfaces();

        // Reset all cards
        this.resetAllCards();

        // Show mode selection panel
        if (this.elements.modeSelectionPanel) {
            this.elements.modeSelectionPanel.style.display = 'block';
            this.elements.modeSelectionPanel.classList.add('interface-transition');
            
            setTimeout(() => {
                this.elements.modeSelectionPanel.classList.add('visible');
            }, 50);
            
            console.log('✅ Mode selection panel displayed');
        }

        // Clean up any instruction notifications
        const existingInstruction = document.getElementById('offlineInstructionNotification');
        if (existingInstruction && existingInstruction.parentNode) {
            existingInstruction.parentNode.removeChild(existingInstruction);
        }

        console.log('✅ Mode selection setup complete');
    }

    handleTransitionError(error) {
        console.error('❌ Mode transition error:', error);

        // Show error state on current card
        const card = this.currentMode === 'realtime' ? 
            this.elements.realtimeModeCard : this.elements.offlineModeCard;
        
        if (card) {
            card.classList.remove('selecting', 'success-state');
            card.classList.add('error-state');
        }

        // Reset after 3 seconds
        setTimeout(() => {
            this.showModeSelection();
        }, 3000);
    }

    getCurrentMode() {
        return this.currentMode;
    }

    isTransitionInProgress() {
        return this.isTransitioning;
    }
}

// Create global instance
window.simpleModeManager = new SimpleModeManager();

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleModeManager;
}
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
        
        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        console.log('🎯 Initializing SimpleModeManager...');
        
        try {
            // Cache all DOM elements with error handling
            this.cacheElements();
            
            // Set up event listeners with error handling
            this.setupEventListeners();
            
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
                        totalElements: Object.keys(this.elements).length
                    }
                );
            }
            
        } catch (error) {
            console.error('❌ SimpleModeManager initialization failed:', error);
            
            if (window.errorLogger) {
                window.errorLogger.log(error, 'Mode Manager Init', {
                    domReady: document.readyState,
                    elementsAttempted: Object.keys(this.elements || {}).length
                });
            }
            
            // Create fallback mode manager
            this.createFallbackModeManager();
        }
    }

    cacheElements() {
        console.log('📋 Caching DOM elements...');
        
        // Initialize elements object
        this.elements = {};
        
        // Element selectors with fallback descriptions
        const elementSelectors = {
            // Mode selection elements
            modeSelectionPanel: { selector: '.mode-selection-panel', type: 'class', required: true },
            realtimeModeCard: { selector: 'realtimeModeCard', type: 'id', required: false },
            offlineModeCard: { selector: 'offlineModeCard', type: 'id', required: false },
            selectRealtimeBtn: { selector: 'selectRealtimeMode', type: 'id', required: true },
            selectOfflineBtn: { selector: 'selectOfflineMode', type: 'id', required: true },
            
            // Interface elements
            realtimeInterface: { selector: 'realtimeInterface', type: 'id', required: true },
            offlineInterface: { selector: 'offlineInterface', type: 'id', required: true },
            realtimeResults: { selector: 'realtimeResults', type: 'id', required: false },
            offlineResults: { selector: 'offlineResults', type: 'id', required: false },
            
            // Back buttons
            backFromRealtime: { selector: 'backFromRealtime', type: 'id', required: false },
            backFromOffline: { selector: 'backFromOffline', type: 'id', required: false },
            
            // Other controls
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
        
        // Check for missing required elements
        if (missingRequired.length > 0) {
            const error = new Error(`Missing required elements: ${missingRequired.join(', ')}`);
            if (window.errorLogger) {
                window.errorLogger.log(error, 'Mode Manager Required Elements', {
                    missingRequired,
                    foundElements,
                    totalElements: Object.keys(elementSelectors).length,
                    domReady: document.readyState
                });
            }
            throw error;
        }
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
        // Mode selection buttons
        if (this.elements.selectRealtimeBtn) {
            this.elements.selectRealtimeBtn.addEventListener('click', (e) => {
                console.log('🎯 Real-time mode button clicked');
                this.selectMode('realtime', e.target);
            });
        }

        if (this.elements.selectOfflineBtn) {
            this.elements.selectOfflineBtn.addEventListener('click', (e) => {
                console.log('🎯 Offline mode button clicked');
                this.selectMode('offline', e.target);
            });
        }

        // Back buttons
        if (this.elements.backFromRealtime) {
            this.elements.backFromRealtime.addEventListener('click', () => {
                console.log('🔙 Back from real-time clicked');
                this.showModeSelection();
            });
        }

        if (this.elements.backFromOffline) {
            this.elements.backFromOffline.addEventListener('click', () => {
                console.log('🔙 Back from offline clicked');
                this.showModeSelection();
            });
        }

        // Duration slider
        if (this.elements.recordingDuration && this.elements.durationValue) {
            this.elements.recordingDuration.addEventListener('input', (e) => {
                const duration = parseInt(e.target.value);
                this.elements.durationValue.textContent = duration;
                
                if (this.elements.offlineStartButtonText) {
                    this.elements.offlineStartButtonText.textContent = `録音開始 (${duration}秒)`;
                }
            });
        }
    }

    selectMode(mode, buttonElement) {
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
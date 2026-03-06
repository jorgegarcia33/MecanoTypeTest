/**
 * @fileoverview UI module for MecanoType
 * Handles all DOM manipulation, event listeners, and visual feedback
 */

import { audio, initAudio, playSound } from './audio.js';
import { config, setStorageItem } from './config.js';
import { data, applyTranslations } from './data.js';
import { game, initGame, handleKeydown, checkCapsLockState } from './game.js';
import { stats, renderUserStats, renderGlobalStatsTable, currentSort, resetUserStats } from './stats.js';
import { t } from './utils.js';

// ===================================
// UI State
// ===================================

export const ui = {
    currentView: 'game',
    paperScrollY: 100,
};

// ===================================
// DOM Element References
// ===================================

export const timerContainer = document.getElementById('timer-container');
export const timerDisplay = document.getElementById('timer-display');

export const gameArea = document.getElementById('game-area');
export const wordsContainer = document.getElementById('words');
export const statsContainer = document.getElementById('stats');
export const wpmEl = document.getElementById('wpm');
export const accEl = document.getElementById('acc');
export const errorsEl = document.getElementById('errors');
export const weakKeysEl = document.getElementById('weak-keys');
export const restartBtn = document.getElementById('restart-button');
export const soundBtn = document.getElementById('sound-btn');
export const suddenDeathBtn = document.getElementById('sudden-death-btn');
export const numbersBtn = document.getElementById('numbers-btn');
export const uppercaseBtn = document.getElementById('uppercase-btn');
export const symbolsBtn = document.getElementById('symbols-btn');
export const zenBtn = document.getElementById('zen-btn');
export const settingsBtn = document.getElementById('settings-btn');
export const closeSettingsBtn = document.getElementById('close-settings-btn');
export const statsBtn = document.getElementById('stats-btn');
export const closeStatsBtn = document.getElementById('close-stats-btn');
export const resetStatsBtn = document.getElementById('reset-stats-btn');
export const globalStatsTableBody = document.querySelector('#global-stats-table tbody');
export const mobileInput = document.getElementById('mobile-input');

// ===================================
// Loading & Toast Functions
// ===================================

/**
 * Hide the loading overlay with fade animation
 */
export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', or 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}" aria-hidden="true"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Get icon name for toast type
 * @param {string} type - Toast type
 * @returns {string} Font Awesome icon name
 */
function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || icons.info;
}

/**
 * Show a confirmation modal
 * @param {string} message - The confirmation message
 * @param {Function} onConfirm - Callback when confirmed
 * @param {Function} onCancel - Callback when cancelled (optional)
 */
export function showConfirmModal(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirm-modal');
    const messageEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    const backdrop = modal?.querySelector('.modal-backdrop');
    
    if (!modal || !messageEl) return;
    
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    
    // Focus the cancel button for safety
    cancelBtn?.focus();
    
    const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn?.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        backdrop?.removeEventListener('click', handleCancel);
    };
    
    const handleConfirm = () => {
        cleanup();
        onConfirm?.();
    };
    
    const handleCancel = () => {
        cleanup();
        onCancel?.();
    };
    
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    backdrop?.addEventListener('click', handleCancel);
}

// ===================================
// Timer Display
// ===================================

export function updateTimerDisplay() {
    timerDisplay.textContent = game.timeLeft;
}

export function updateSettingsVisibility() {
    const wordsSetting = document.getElementById('setting-words-count');
    const timeSetting = document.getElementById('setting-time-limit');

    if (config.gameMode === 'time') {
        wordsSetting.classList.add('hidden');
        timeSetting.classList.remove('hidden');
    } else {
        wordsSetting.classList.remove('hidden');
        timeSetting.classList.add('hidden');
    }
}

export function switchView(newView) {
    if (ui.currentView === newView) return;
    
    // Update timer visibility only when leaving the game view.
    if (ui.currentView === 'game' && config.gameMode === 'time') {
        timerContainer.classList.add('hidden');
    }
    
    playSound('tear');
    const oldPaper = gameArea.cloneNode(true);
    oldPaper.id = 'old-paper';
    oldPaper.style.position = 'absolute';
    oldPaper.style.top = '0';
    oldPaper.style.left = '0';
    oldPaper.style.width = '100%';
    oldPaper.style.height = '100%';
    oldPaper.style.zIndex = '10';
    oldPaper.style.transform = gameArea.style.transform || 'translateY(100px)';
    oldPaper.style.transition = 'none';
    
    oldPaper.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    gameArea.parentElement.appendChild(oldPaper);
    void oldPaper.offsetWidth;
    oldPaper.classList.add('tearing');
    oldPaper.style.transition = 'transform 0.6s ease-in, opacity 0.6s ease-in';
    oldPaper.style.transform = 'translate(1000px, -200px) rotate(15deg)';
    oldPaper.style.opacity = '0';
    setTimeout(() => oldPaper.remove(), 600);

    ui.currentView = newView;
    
    document.getElementById('words').classList.add('hidden');
    document.getElementById('settings-sheet').classList.add('hidden');
    document.getElementById('stats-sheet').classList.add('hidden');
    statsContainer.classList.add('hidden');
    document.getElementById('restart-note').classList.add('hidden');
    restartBtn.classList.add('hidden');

    ui.paperScrollY = 100;
    gameArea.style.transition = 'none';
    gameArea.style.transform = 'translateY(100%)';

    if (newView === 'game') {
        initGame(false); 
    } else if (newView === 'settings') {
        document.getElementById('settings-sheet').classList.remove('hidden');
    } else if (newView === 'stats') {
        document.getElementById('stats-sheet').classList.remove('hidden');
        renderGlobalStatsTable();
        renderUserStats();
    }

    settingsBtn.classList.toggle('active', newView === 'settings');
    statsBtn.classList.toggle('active', newView === 'stats');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            gameArea.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
            gameArea.style.transform = `translateY(${ui.paperScrollY}px)`;
        });
    });
}

export function showZenPopup(btn, enabled) {
    const popup = document.createElement('div');
    popup.className = 'zen-popup';
    popup.textContent = `${t('settings.zenMode')} ${enabled ? t('settings.on') : t('settings.off')}`;
    Object.assign(popup.style, {
        position: 'absolute',
        zIndex: 9999,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        borderRadius: '6px',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        opacity: '0',
        transform: 'translateY(0)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
        pointerEvents: 'none'
    });

    document.body.appendChild(popup);

    const rect = btn.getBoundingClientRect();

    popup.style.left = `${rect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top - 10}px`;

    requestAnimationFrame(() => {
        const r = btn.getBoundingClientRect();
        const left = r.left + r.width / 2 - popup.offsetWidth / 2;
        const top = r.top - popup.offsetHeight - 8;
        popup.style.left = `${Math.max(8, left)}px`;
        popup.style.top = `${Math.max(8, top)}px`;
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(-4px)';
    });

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(0)';
        setTimeout(() => popup.remove(), 200);
    }, 1000);
}

export function toggleZenMode() {
    if (zenBtn) {
        zenBtn.classList.toggle('active', !!config.zenModeEnabled);
        zenBtn.dataset.zen = config.zenModeEnabled ? 'true' : 'false';
        zenBtn.addEventListener('click', () => {
            config.zenModeEnabled = !config.zenModeEnabled;
            if (config.zenModeEnabled) {
                config.numbersEnabled = false;
                config.uppercaseEnabled = false;
                config.symbolsEnabled = false;
                config.suddenDeathEnabled = false;
                numbersBtn.classList.remove('active');
                uppercaseBtn.classList.remove('active');
                symbolsBtn.classList.remove('active');
                suddenDeathBtn.classList.remove('active');
            }
            localStorage.setItem('mecano_zen_mode', config.zenModeEnabled);
            zenBtn.classList.toggle('active', !!config.zenModeEnabled);
            zenBtn.dataset.zen = config.zenModeEnabled ? 'true' : 'false';
            zenBtn.setAttribute('aria-pressed', config.zenModeEnabled ? 'true' : 'false');
            if (ui.currentView === 'game') initGame();
            showZenPopup(zenBtn, config.zenModeEnabled);
            zenBtn.blur();
        });
    }
}

export function toggleDarkMode() {
    if (config.currentTheme === 'dark') document.body.classList.add('dark-mode');
}

export function updateThemeToggleIcon() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (config.currentTheme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
}

export function changeAudioIcon() {
    if (audio.soundEnabled) {
        soundBtn.classList.add('active');
        soundBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

export function initializeSettingsEventListeners() {
    const headerThemeToggle = document.getElementById('theme-toggle');
    if (headerThemeToggle) {
        headerThemeToggle.addEventListener('click', () => {
            config.currentTheme = config.currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('mecano_theme', config.currentTheme);
            
            if (config.currentTheme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            updateThemeToggleIcon();
            
            document.querySelectorAll('[data-theme]').forEach(b => {
                b.classList.toggle('active', b.dataset.theme === config.currentTheme);
            });
            
            playSound('click');
        });
    }

    document.querySelectorAll('[data-theme]').forEach(btn => {
        btn.addEventListener('click', () => {
            config.currentTheme = btn.dataset.theme;
            localStorage.setItem('mecano_theme', config.currentTheme);
            
            if (config.currentTheme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            updateThemeToggleIcon();

            // Update UI buttons
            document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            playSound('click');
        });
    });

    document.querySelectorAll('[data-game-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.gameMode === config.gameMode);

    btn.addEventListener('click', () => {
        config.gameMode = btn.dataset.gameMode;
        localStorage.setItem('mecano_game_mode', config.gameMode);

        document.querySelectorAll('[data-game-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        updateSettingsVisibility();
    });
    });

    document.querySelectorAll('[data-time]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.time) === config.timeLimit);

    btn.addEventListener('click', () => {
        config.timeLimit = parseInt(btn.dataset.time);
        localStorage.setItem('mecano_time_limit', config.timeLimit);

        document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
    });

    updateSettingsVisibility();

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            document.getElementById('stats-profile').classList.toggle('hidden', tab !== 'profile');
            document.getElementById('stats-keys').classList.toggle('hidden', tab !== 'keys');
        });
    });
}

export function toggleMobile() {
    if (mobileInput) {
        window.addEventListener('touchstart', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.modal')) {
                mobileInput.focus();
            }
        }, { passive: true });

        window.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.modal')) {
                mobileInput.focus();
            }
        });

        // Character input via input event — always gives correctly composed characters
        // (handles dead keys / accented chars on Linux reliably)
        mobileInput.addEventListener('input', (e) => {
            if (e.inputType === 'deleteContentBackward') {
                handleKeydown({ key: 'Backspace', preventDefault: () => {} });
                mobileInput.value = '';
                return;
            }
            if (e.inputType === 'insertLineBreak' || (e.data && e.data.includes('\n'))) {
                handleKeydown({ key: 'Enter', preventDefault: () => {} });
                mobileInput.value = '';
                return;
            }

            const value = mobileInput.value;

            // If value only contains dead key accent marks (´ ` ^ ~ ¨), the user
            // pressed a dead key and hasn't typed the vowel yet — wait for it.
            // Don't clear the value so the browser can compose the character (´ + a → á)
            if (/^[´`^~¨]+$/.test(value)) return;

            mobileInput.value = '';
            if (value) {
                for (const c of value) {
                    if (c === ' ') {
                        handleKeydown({ key: ' ', preventDefault: () => {} });
                    } else {
                        handleKeydown({ key: c, preventDefault: () => {} });
                    }
                }
            }
        });

        // Special keys handled via keydown on the hidden input
        mobileInput.addEventListener('keydown', (e) => {
            checkCapsLockState(e); // Ensure CapsLock is checked before stopping propagation
            e.stopPropagation();
            if (e.key === 'Tab' || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                handleKeydown(e);
            }
        });

        mobileInput.addEventListener('keyup', (e) => {
            checkCapsLockState(e); // Ensure CapsLock is checked on keyup too
        });

        // Keep hidden input focused during game
        mobileInput.focus();
    }
}

export function initButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            stats.currentFilter = btn.dataset.filter;
            renderGlobalStatsTable();
        });
    });

    document.querySelectorAll('#global-stats-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'desc';
            }
            renderGlobalStatsTable();
        });
    });

    // Generic Dropdown Setting Handler
    document.querySelectorAll('select[data-setting]').forEach(select => {
        const settingProp = select.dataset.setting;

        select.addEventListener('change', (e) => {
            let value = e.target.value;

            // Handle numeric values
            if (!isNaN(value) && settingProp !== 'currentLanguage') {
                value = parseInt(value);
            }

            // Update Config/Data
            if (settingProp === 'wordCount') {
                data.wordCount = value;
            } else {
                config[settingProp] = value;
            }

            // Persistence: Convert camelCase to snake_case for localStorage
            // Maintain backward compatibility with existing keys
            const keyMap = {
                currentLanguage: 'language',
                currentTheme: 'theme'
            };
            const snakeProp = settingProp.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            const storageKey = `mecano_${keyMap[settingProp] || snakeProp}`;
            localStorage.setItem(storageKey, value);

            // Side Effects
            if (settingProp === 'currentLanguage') {
                applyTranslations();
                if (ui.currentView === 'stats') renderGlobalStatsTable();
            }

            if (settingProp === 'gameMode') {
                updateSettingsVisibility();
            }

            if (settingProp === 'currentTheme') {
                document.body.classList.toggle('dark-mode', value === 'dark');
            }

            if (ui.currentView === 'game') {
                initGame(false, false);
            }

            playSound('click');
        });
    });

    settingsBtn.addEventListener('click', () => {
        if (ui.currentView === 'settings') {
            switchView('game');
            return;
        }

        // Sync all dropdowns with current config
        document.querySelectorAll('select[data-setting]').forEach(select => {
            const prop = select.dataset.setting;
            select.value = (prop === 'wordCount') ? data.wordCount : config[prop];
        });

        // Ensure visibility of mode-dependent settings is correct
        updateSettingsVisibility();

        // Sync remaining buttons
        if (zenBtn) zenBtn.classList.toggle('active', !!config.zenModeEnabled);
        
        switchView('settings');
    });

    closeSettingsBtn.addEventListener('click', () => {
        switchView('game');
    });

    numbersBtn.addEventListener('click', () => {
        config.numbersEnabled = !config.numbersEnabled;
        numbersBtn.classList.toggle('active');
        if (config.numbersEnabled && config.zenModeEnabled) {
            config.zenModeEnabled = false;
            if (zenBtn) {
                zenBtn.classList.remove('active');
                zenBtn.dataset.zen = 'false';
                zenBtn.setAttribute('aria-pressed', 'false');
                localStorage.setItem('mecano_zen_mode', false);
            }
        }
        if (ui.currentView === 'game') initGame();
        numbersBtn.blur();
    });

    uppercaseBtn.addEventListener('click', () => {
        config.uppercaseEnabled = !config.uppercaseEnabled;
        uppercaseBtn.classList.toggle('active');
        // If enabling uppercase, disable zen mode
        if (config.uppercaseEnabled && config.zenModeEnabled) {
            config.zenModeEnabled = false;
            if (zenBtn) {
                zenBtn.classList.remove('active');
                zenBtn.dataset.zen = 'false';
                zenBtn.setAttribute('aria-pressed', 'false');
                localStorage.setItem('mecano_zen_mode', false);
            }
        }
        if (ui.currentView === 'game') initGame();
        uppercaseBtn.blur();
    });

    symbolsBtn.addEventListener('click', () => {
        config.symbolsEnabled = !config.symbolsEnabled;
        symbolsBtn.classList.toggle('active');
        if (config.symbolsEnabled && config.zenModeEnabled) {
            config.zenModeEnabled = false;
            if (zenBtn) {
                zenBtn.classList.remove('active');
                zenBtn.dataset.zen = 'false';
                zenBtn.setAttribute('aria-pressed', 'false');
                localStorage.setItem('mecano_zen_mode', false);
            }
        }
        if (ui.currentView === 'game') initGame();
        symbolsBtn.blur();
    });

    soundBtn.addEventListener('click', () => {
        audio.soundEnabled = !audio.soundEnabled;
        soundBtn.classList.toggle('active');
        soundBtn.innerHTML = audio.soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
        if (audio.soundEnabled) initAudio();
    });

    suddenDeathBtn.addEventListener('click', () => {
        config.suddenDeathEnabled = !config.suddenDeathEnabled;
        suddenDeathBtn.classList.toggle('active');
        if (config.suddenDeathEnabled && config.zenModeEnabled) {
            config.zenModeEnabled = false;
            if (zenBtn) {
                zenBtn.classList.remove('active');
                zenBtn.dataset.zen = 'false';
                zenBtn.setAttribute('aria-pressed', 'false');
                localStorage.setItem('mecano_zen_mode', false);
            }
        }
        if (ui.currentView === 'game') initGame();
    });

    statsBtn.addEventListener('click', () => {
        if (ui.currentView === 'stats') {
            switchView('game');
        } else {
            switchView('stats');
        }
    });

    closeStatsBtn.addEventListener('click', () => {
        switchView('game');
    });

    resetStatsBtn.addEventListener('click', () => {
        showConfirmModal(
            t("alerts.resetHistory"),
            () => {
                // On confirm
                resetUserStats();
                stats.charStats = {};
                localStorage.removeItem('mecano_char_stats');
                renderGlobalStatsTable();
                weakKeysEl.textContent = "-";
                showToast(t("toast.statsReset") || "Statistics reset successfully", "success");
            }
        );
    });

    // Update aria-pressed attributes for toggle buttons
    updateButtonAriaStates();
}

/**
 * Update aria-pressed states for all toggle buttons
 */
function updateButtonAriaStates() {
    numbersBtn?.setAttribute('aria-pressed', config.numbersEnabled);
    uppercaseBtn?.setAttribute('aria-pressed', config.uppercaseEnabled);
    symbolsBtn?.setAttribute('aria-pressed', config.symbolsEnabled);
    suddenDeathBtn?.setAttribute('aria-pressed', config.suddenDeathEnabled);
    soundBtn?.setAttribute('aria-pressed', audio.soundEnabled);
}

export function scrollPaper() {
    window.addEventListener('wheel', (e) => {
        if (ui.currentView === 'game') return;
        
        ui.paperScrollY -= e.deltaY * 0.5;
        
        if (ui.paperScrollY > 100) ui.paperScrollY = 100;
        
        const activeSheet = document.querySelector('.sheet-content:not(.hidden)');
        if (activeSheet) {
            const contentHeight = activeSheet.offsetHeight;
            const minScroll = -contentHeight + 400; 
            if (ui.paperScrollY < minScroll) ui.paperScrollY = minScroll;
        }

        gameArea.style.transform = `translateY(${ui.paperScrollY}px)`;
    });
}
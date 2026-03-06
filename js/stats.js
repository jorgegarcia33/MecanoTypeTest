/**
 * @fileoverview Statistics module for MecanoType
 * Handles tracking, storage, and display of user statistics
 */

import { globalStatsTableBody } from './ui.js';
import { t, formatTime } from './utils.js';

// ===================================
// Constants
// ===================================

/** Character filter categories */
export const CHAR_FILTERS = {
    all: () => true,
    lowercase: (char) => /[a-zñ]/.test(char),
    uppercase: (char) => /[A-ZÑ]/.test(char),
    accents: (char) => /[áéíóúüàèìòùâêîôûäëïöüÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ]/.test(char),
    numbers: (char) => /[0-9]/.test(char),
    symbols: (char) => !/[a-zñA-ZÑ0-9áéíóúüàèìòùâêîôûäëïöüÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ]/.test(char),
};

// ===================================
// Statistics State
// ===================================

/**
 * Global character statistics
 * @type {Object}
 */
export const stats = {
    charStats: loadCharStats(),
    currentFilter: 'lowercase',
};

/**
 * User profile statistics
 * @type {Object}
 */
export const userStats = loadUserStats();

/**
 * Current sort configuration for the stats table
 * @type {Object}
 */
export const currentSort = { column: 'rate', direction: 'desc' };

// ===================================
// Storage Functions
// ===================================

/**
 * Load character statistics from localStorage
 * @returns {Object} Character statistics or empty object
 */
function loadCharStats() {
    try {
        return JSON.parse(localStorage.getItem('mecano_char_stats')) || {};
    } catch (error) {
        console.warn('Failed to load character stats:', error);
        return {};
    }
}

/**
 * Load user statistics from localStorage
 * @returns {Object} User statistics with defaults
 */
function loadUserStats() {
    try {
        const stored = JSON.parse(localStorage.getItem('mecano_user_stats'));
        return {
            started: stored?.started || 0,
            completed: stored?.completed || 0,
            time: stored?.time || 0,
            records: stored?.records || {}
        };
    } catch (error) {
        console.warn('Failed to load user stats:', error);
        return { started: 0, completed: 0, time: 0, records: {} };
    }
}

/**
 * Save user statistics to localStorage
 */
export function saveUserStats() {
    try {
        localStorage.setItem('mecano_user_stats', JSON.stringify(userStats));
    } catch (error) {
        console.warn('Failed to save user stats:', error);
    }
}

/**
 * Save character statistics to localStorage
 */
export function saveCharStats() {
    try {
        localStorage.setItem('mecano_char_stats', JSON.stringify(stats.charStats));
    } catch (error) {
        console.warn('Failed to save character stats:', error);
    }
}

// ===================================
// Render Functions
// ===================================

export function renderUserStats() {
    document.getElementById('profile-started').textContent = userStats.started;
    document.getElementById('profile-completed').textContent = userStats.completed;
    document.getElementById('profile-time').textContent = formatTime(userStats.time);

    const counts = [10, 25, 50, 100];
    
    counts.forEach(count => {
        const wpmEl = document.getElementById(`rec-${count}-wpm`);
        const accEl = document.getElementById(`rec-${count}-acc`);
        
        if (wpmEl && accEl) {
            const record = userStats.records[count];
            
            if (record && typeof record === 'object' && 'wpm' in record) {
                wpmEl.textContent = record.wpm;
                accEl.textContent = record.acc + '%';
            } else {
                wpmEl.textContent = '-';
                accEl.textContent = '-';
            }
        }
    });
}

/**
 * Render the global statistics table
 * Filters and sorts entries based on current settings
 */
export function renderGlobalStatsTable() {
    if (!globalStatsTableBody) return;
    
    globalStatsTableBody.innerHTML = '';
    
    // Update sort indicators in table headers
    document.querySelectorAll('#global-stats-table th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === currentSort.column) {
            th.classList.add(currentSort.direction);
        }
    });

    // Filter entries based on current filter
    const filterFn = CHAR_FILTERS[stats.currentFilter] || CHAR_FILTERS.all;
    const entries = Object.entries(stats.charStats)
        .filter(([char]) => filterFn(char))
        .sort((a, b) => {
            const [charA, statsA] = a;
            const [charB, statsB] = b;
            
            const rateA = statsA.total > 0 ? (statsA.errors / statsA.total) : 0;
            const rateB = statsB.total > 0 ? (statsB.errors / statsB.total) : 0;

            let valA, valB;

            switch (currentSort.column) {
                case 'char':
                    valA = charA;
                    valB = charB;
                    break;
                case 'total':
                    valA = statsA.total;
                    valB = statsB.total;
                    break;
                case 'errors':
                    valA = statsA.errors;
                    valB = statsB.errors;
                    break;
                case 'rate':
                default:
                    valA = rateA;
                    valB = rateB;
                    break;
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

    // Show empty state if no data
    if (entries.length === 0) {
        const row = document.createElement('tr');
        row.className = 'empty-row';
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = t("stats.noData");
        cell.className = 'empty-cell';
        row.appendChild(cell);
        globalStatsTableBody.appendChild(row);
        return;
    }

    // Render entries
    entries.forEach(([char, charStats]) => {
        if (charStats.total === 0) return; 
        
        const row = document.createElement('tr');
        const errorRate = ((charStats.errors / charStats.total) * 100).toFixed(1);
        const errorRateNum = parseFloat(errorRate);
        
        // Add visual indicator for high error rates
        let errorClass = '';
        if (errorRateNum > 20) errorClass = 'high-error';
        else if (errorRateNum > 10) errorClass = 'medium-error';
        else if (errorRateNum > 0) errorClass = 'low-error';
        
        row.innerHTML = `
            <td class="char-cell"><span class="char-display">${escapeHtml(char)}</span></td>
            <td>${charStats.total.toLocaleString()}</td>
            <td>${charStats.errors.toLocaleString()}</td>
            <td class="${errorClass}">${errorRate}%</td>
        `;
        globalStatsTableBody.appendChild(row);
    });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Check if a new record was set and return true if so
 * @param {number} wordCount - The word count for this test
 * @param {number} wpm - Words per minute achieved
 * @param {number} accuracy - Accuracy percentage
 * @returns {boolean} Whether a new record was set
 */
export function checkAndSaveRecord(wordCount, wpm, accuracy) {
    if (wordCount === 'infinite' || !wordCount) return false;
    
    const count = parseInt(wordCount);
    if (isNaN(count)) return false;
    
    // Initialize record if doesn't exist
    if (!userStats.records[count] || typeof userStats.records[count] !== 'object' || !('wpm' in userStats.records[count])) {
        userStats.records[count] = { wpm: 0, acc: 0 };
    }
    
    // Check if new record
    if (wpm > userStats.records[count].wpm) {
        userStats.records[count] = { wpm, acc: accuracy };
        saveUserStats();
        return true;
    }
    
    return false;
}
/**
 * Reset user statistics in localStorage and memory
 */
export function resetUserStats() {
    try {
        localStorage.removeItem('mecano_user_stats');
        
        // Clear in-memory stats
        userStats.started = 0;
        userStats.completed = 0;
        userStats.time = 0;
        userStats.records = {};

        // Re-render UI
        renderUserStats();
    } catch (error) {
        console.warn('Failed to delete user stats:', error);
    }
}

/**
 * UI Controls Module
 * Handles loading indicators, status messages, and UI feedback
 */

function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    if (message) {
        overlay.querySelector('p').textContent = message;
    }
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function showProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    progressBar.classList.add('loading');
    progressBar.style.width = '30%';
}

function updateProgressBar(percent) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = percent + '%';
}

function hideProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '100%';
    setTimeout(() => {
        progressBar.classList.remove('loading');
        progressBar.style.width = '0%';
    }, 300);
}

function showStatus(message) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.classList.add('show');
}

function hideStatus() {
    document.getElementById('status-message').classList.remove('show');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

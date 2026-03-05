/**
 * Main Application Entry Point
 * Know Your City - Interactive Map Platform
 */

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    // Initialize map
    initMap();
    map.addLayer(drawnItems);
    
    // Load initial data
    loadMapData().then(() => {
        loadViewportData();
    });
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Button controls
    document.getElementById('view-btn').addEventListener('click', enableViewMode);
    document.getElementById('explore-btn').addEventListener('click', enableExploreMode);
    document.getElementById('close-info').addEventListener('click', function () {
        document.getElementById('info-panel').classList.add('hidden');
    });
    
    // Map events
    map.on('moveend', debounce(loadViewportData, 500));
    map.on('zoomend', function () {
        updateLabelsVisibility();
        debounce(loadViewportData, 500)();
    });
}

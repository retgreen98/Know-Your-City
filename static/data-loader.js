/**
 * Data Loading Module
 * Handles API calls and data fetching
 */

let isLoading = false;

function loadMapData() {
    showLoading('Loading map data...');
    
    return fetch('/api/load_map')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            mapBounds = data.bounds;
            funcGroupColors = data.colors || {};
            
            // Create legend
            if (data.func_groups && data.func_groups.length > 0) {
                createLegend(data.func_groups, funcGroupColors);
            }
            
            // Add labels
            if (data.district_labels && data.district_labels.length > 0) {
                addDistrictLabelsBatch(data.district_labels);
            }
            
            if (data.admin_labels && data.admin_labels.length > 0) {
                addAdminLabels(data.admin_labels);
            }
            
            // Load admin boundaries
            if (data.has_admin_boundaries) {
                setTimeout(() => loadAdminBoundaries(), 100);
            }
            
            updateLabelsVisibility();
            fitMapToBounds(mapBounds);
            hideLoading();
            
            return data;
        })
        .catch(error => {
            console.error('Failed to load data:', error);
            alert('Failed to load data: ' + error);
            hideLoading();
            throw error;
        });
}

function loadViewportData() {
    if (isLoading || !mapBounds) return;
    
    isLoading = true;
    showProgressBar();
    
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    fetch('/api/load_viewport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bounds: {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            },
            zoom: zoom
        })
    })
    .then(response => {
        updateProgressBar(60);
        return response.json();
    })
    .then(data => {
        if (data.error) {
            console.error('Failed to load viewport data:', data.error);
            return;
        }
        
        updateProgressBar(80);
        displayGeoJSON(data);
        hideProgressBar();
    })
    .catch(error => {
        console.error('Failed to load viewport data:', error);
        hideProgressBar();
    })
    .finally(() => {
        isLoading = false;
    });
}

function loadAdminBoundaries() {
    fetch('/api/load_admin_boundaries')
        .then(response => response.json())
        .then(geojson => {
            if (!geojson.error) {
                addAdminBoundaries(geojson);
            }
        })
        .catch(error => {
            console.error('Failed to load admin boundaries:', error);
        });
}

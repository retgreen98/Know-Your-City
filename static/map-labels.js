/**
 * Map Labels Module
 * Handles district labels, admin boundaries, and legend
 */

let districtLabelsLayer = L.layerGroup();
let adminBoundariesLayer = L.layerGroup();
let adminLabelsLayer = L.layerGroup();

function createLegend(funcGroups, colors) {
    const legendDiv = document.getElementById('legend');
    let html = '<h4>Legend</h4>';
    
    funcGroups.forEach(group => {
        const color = colors[group] || '#7f8c8d';
        html += `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${color};"></span>
                <span class="legend-label">${group}</span>
            </div>
        `;
    });
    
    legendDiv.innerHTML = html;
}

function addDistrictLabelsBatch(labels, batchSize = 50) {
    districtLabelsLayer.clearLayers();
    let index = 0;
    
    function addBatch() {
        const end = Math.min(index + batchSize, labels.length);
        
        for (let i = index; i < end; i++) {
            const label = labels[i];
            const marker = L.marker([label.lat, label.lng], {
                icon: L.divIcon({
                    className: 'district-label',
                    html: `<div class="district-label-text">${label.name}</div>`,
                    iconSize: [100, 20],
                    iconAnchor: [50, 10]
                })
            });
            districtLabelsLayer.addLayer(marker);
        }
        
        index = end;
        if (index < labels.length) {
            setTimeout(addBatch, 0);
        }
    }
    
    addBatch();
}

function addAdminBoundaries(geojson) {
    adminBoundariesLayer.clearLayers();
    
    const layer = L.geoJSON(geojson, {
        style: {
            color: '#b0b0b0',
            weight: 1.5,
            opacity: 0.6,
            fillOpacity: 0,
            dashArray: '3, 3'
        }
    });
    
    adminBoundariesLayer.addLayer(layer);
}

function addAdminLabels(labels) {
    adminLabelsLayer.clearLayers();
    
    labels.forEach(label => {
        const marker = L.marker([label.lat, label.lng], {
            icon: L.divIcon({
                className: 'admin-label',
                html: `<div class="admin-label-text">${label.name}</div>`,
                iconSize: [120, 30],
                iconAnchor: [60, 15]
            })
        });
        adminLabelsLayer.addLayer(marker);
    });
}

function updateLabelsVisibility() {
    const zoom = map.getZoom();
    
    // District labels: show when zoom > 13
    if (zoom > 13) {
        if (!map.hasLayer(districtLabelsLayer)) {
            map.addLayer(districtLabelsLayer);
        }
    } else {
        if (map.hasLayer(districtLabelsLayer)) {
            map.removeLayer(districtLabelsLayer);
        }
    }
    
    // Admin boundaries and labels: show when zoom <= 13
    if (zoom <= 13) {
        if (!map.hasLayer(adminBoundariesLayer)) {
            map.addLayer(adminBoundariesLayer);
        }
        if (!map.hasLayer(adminLabelsLayer)) {
            map.addLayer(adminLabelsLayer);
        }
    } else {
        if (map.hasLayer(adminBoundariesLayer)) {
            map.removeLayer(adminBoundariesLayer);
        }
        if (map.hasLayer(adminLabelsLayer)) {
            map.removeLayer(adminLabelsLayer);
        }
    }
}

/**
 * Feature Modes Module
 * Handles view mode and explore mode functionality
 */

let currentMode = null;
let drawControl = null;
let drawnItems = new L.FeatureGroup();
let polylineMenuOpen = false;

function enableViewMode() {
    currentMode = 'view';
    disableDrawMode();
    
    document.getElementById('view-btn').classList.add('active');
    document.getElementById('explore-btn').classList.remove('active');
    
    showStatus('Click on a feature to view details');
}

function enableExploreMode() {
    currentMode = 'explore';
    
    document.getElementById('explore-btn').classList.add('active');
    document.getElementById('view-btn').classList.remove('active');
    document.getElementById('info-panel').classList.add('hidden');
    
    showStatus('Draw a region to explore');
    
    if (!drawControl) {
        drawControl = new L.Control.Draw({
            draw: {
                polygon: { allowIntersection: false, showArea: true },
                rectangle: true,
                circle: false,
                marker: false,
                polyline: false,  // 禁用默认折线工具
                circlemarker: false
            },
            edit: false
        });
        map.addControl(drawControl);
        
        // 清理多余的 Leaflet.Draw 元素
        const cleanupExtraElements = () => {
            document.querySelectorAll('.leaflet-draw-draw-polyline').forEach(btn => btn.remove());
            document.querySelectorAll('a[title*="polyline"]').forEach(btn => btn.remove());
        };
        
        setTimeout(cleanupExtraElements, 100);
        setTimeout(cleanupExtraElements, 500);
        
        addPolylineButton();  // 先添加画线按钮
        addCustomDeleteButton();  // 后添加删除按钮（在下面）
    }
    
    map.on(L.Draw.Event.CREATED, function (e) {
        // Skip polyline - handled separately in startPolylineDrawing()
        if (e.layerType === 'polyline') {
            return;
        }
        
        // Clear all previous drawings and analysis
        clearAllDrawings();
        
        // Add new drawing
        drawnItems.addLayer(e.layer);
        
        // Analyze region (polygon or rectangle)
        analyzeRegion(e.layer.toGeoJSON());
    });
}

function disableDrawMode() {
    if (drawControl) {
        map.removeControl(drawControl);
        drawControl = null;
    }
    removeCustomDeleteButton();
    removePolylineButton();
    drawnItems.clearLayers();
    map.off(L.Draw.Event.CREATED);
    
    // 清理所有绘图相关的图层
    clearAllDrawings();
}

function addCustomDeleteButton() {
    const deleteButton = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar leaflet-draw-toolbar-top');
    deleteButton.id = 'custom-delete-btn';
    deleteButton.style.marginTop = '10px';
    
    const deleteLink = L.DomUtil.create('a', '', deleteButton);  // 移除 leaflet-draw-edit-remove 类
    deleteLink.href = '#';
    deleteLink.title = 'Delete shape';
    deleteLink.innerHTML = '🗑️';
    deleteLink.style.cursor = 'pointer';
    
    L.DomEvent.on(deleteLink, 'click', function(e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        clearAllDrawings();
        showStatus('All cleared');
        setTimeout(hideStatus, 2000);
    });
    
    const drawToolbar = document.querySelector('.leaflet-draw-toolbar');
    if (drawToolbar && drawToolbar.parentNode) {
        drawToolbar.parentNode.appendChild(deleteButton);
    }
}

function removeCustomDeleteButton() {
    const deleteButton = document.getElementById('custom-delete-btn');
    if (deleteButton) {
        deleteButton.remove();
    }
}

// Clear all drawings and analysis results
function clearAllDrawings() {
    // Clear drawn items (user drawings)
    drawnItems.clearLayers();
    
    // Clear node markers and buffers
    if (nodeMarkersLayer) {
        map.removeLayer(nodeMarkersLayer);
        nodeMarkersLayer = null;
    }
    if (nodeBuffersLayer) {
        map.removeLayer(nodeBuffersLayer);
        nodeBuffersLayer = null;
    }
    
    // Clear metro line layer
    if (metroLineLayer) {
        map.removeLayer(metroLineLayer);
        metroLineLayer = null;
    }
    
    // Hide info panel
    document.getElementById('info-panel').classList.add('hidden');
}

// Polyline button and menu functions
function addPolylineButton() {
    const polylineButton = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar leaflet-draw-toolbar-top');
    polylineButton.id = 'custom-polyline-btn';
    polylineButton.style.marginTop = '10px';
    
    const polylineLink = L.DomUtil.create('a', '', polylineButton);
    polylineLink.href = '#';
    polylineLink.title = 'Draw line with buffer';
    polylineLink.innerHTML = '📏';
    polylineLink.style.cursor = 'pointer';
    
    L.DomEvent.on(polylineLink, 'click', function(e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        showPolylineOptions();
    });
    
    const drawToolbar = document.querySelector('.leaflet-draw-toolbar');
    if (drawToolbar && drawToolbar.parentNode) {
        drawToolbar.parentNode.appendChild(polylineButton);
    }
}

function removePolylineButton() {
    const polylineButton = document.getElementById('custom-polyline-btn');
    if (polylineButton) {
        polylineButton.remove();
    }
}

// 显示折线选项工具栏
function showPolylineOptions() {
    const oldToolbar = document.getElementById('polyline-options-toolbar');
    if (oldToolbar) {
        oldToolbar.remove();
    }
    
    // 创建工具栏容器
    const toolbar = document.createElement('div');
    toolbar.id = 'polyline-options-toolbar';
    toolbar.className = 'custom-draw-actions';
    
    // 强制设置内联样式确保可见
    toolbar.style.cssText = `
        position: fixed !important;
        top: 60px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 10000 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
    `;
    
    // 创建按钮列表
    const ul = document.createElement('ul');
    ul.style.cssText = `
        list-style: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        background: rgba(0, 0, 0, 0.5) !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
    `;
    
    // Draw a line 按钮
    const drawLi = document.createElement('li');
    drawLi.style.cssText = `
        margin: 0 !important;
        padding: 0 !important;
        border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
    `;
    const drawLink = document.createElement('a');
    drawLink.href = '#';
    drawLink.textContent = 'Draw a line';
    drawLink.style.cssText = `
        display: block !important;
        padding: 10px 20px !important;
        color: white !important;
        text-decoration: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
    `;
    drawLink.onclick = function(e) {
        e.preventDefault();
        hidePolylineOptions();
        startPolylineDrawing();
        return false;
    };
    drawLi.appendChild(drawLink);
    ul.appendChild(drawLi);
    
    // Select from Overpass 按钮
    const overpassLi = document.createElement('li');
    overpassLi.style.cssText = `
        margin: 0 !important;
        padding: 0 !important;
        border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
    `;
    const overpassLink = document.createElement('a');
    overpassLink.href = '#';
    overpassLink.textContent = 'Select lines from Overpass';
    overpassLink.style.cssText = `
        display: block !important;
        padding: 10px 20px !important;
        color: white !important;
        text-decoration: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
    `;
    overpassLink.onclick = function(e) {
        e.preventDefault();
        hidePolylineOptions();
        loadMetroLines();
        return false;
    };
    overpassLi.appendChild(overpassLink);
    ul.appendChild(overpassLi);
    
    // Cancel 按钮
    const cancelLi = document.createElement('li');
    cancelLi.className = 'leaflet-draw-actions-cancel';
    cancelLi.style.cssText = `
        margin: 0 !important;
        padding: 0 !important;
        border-left: 1px solid rgba(255, 255, 255, 0.2) !important;
    `;
    const cancelLink = document.createElement('a');
    cancelLink.href = '#';
    cancelLink.textContent = 'Cancel';
    cancelLink.style.cssText = `
        display: block !important;
        padding: 10px 20px !important;
        color: white !important;
        text-decoration: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
    `;
    cancelLink.onclick = function(e) {
        e.preventDefault();
        hidePolylineOptions();
        return false;
    };
    cancelLi.appendChild(cancelLink);
    ul.appendChild(cancelLi);
    
    toolbar.appendChild(ul);
    document.body.appendChild(toolbar);
}

// 隐藏折线选项工具栏
function hidePolylineOptions() {
    const toolbar = document.getElementById('polyline-options-toolbar');
    if (toolbar) {
        toolbar.remove();
    }
}

function startPolylineDrawing() {
    showStatus('Draw a line (click to add points, double-click to finish)');
    
    // Enable polyline drawing without adding toolbar buttons
    const polylineDrawer = new L.Draw.Polyline(map, {
        shapeOptions: {
            color: '#3388ff',
            weight: 4,
            opacity: 0.8
        },
        showLength: true,
        metric: true
    });
    
    // Start drawing immediately
    polylineDrawer.enable();
    
    // Listen for completion
    map.once(L.Draw.Event.CREATED, function(e) {
        if (e.layerType === 'polyline') {
            // Clear all previous drawings and analysis
            clearAllDrawings();
            
            // Add new drawing
            drawnItems.addLayer(e.layer);
            
            // Analyze
            analyzePolylineBuffer(e.layer.toGeoJSON());
        }
    });
}

// Metro lines functionality
let metroLinesData = null;
let metroLineLayer = null;

function loadMetroLines() {
    showStatus('Loading metro lines...');
    
    fetch('/api/get_metro_lines')
        .then(response => response.json())
        .then(data => {
            hideStatus();
            
            if (data.error) {
                alert('Error loading metro lines: ' + data.error);
                return;
            }
            
            metroLinesData = data.lines;
            showMetroLinesPanel(data.lines);
        })
        .catch(error => {
            hideStatus();
            alert('Failed to load metro lines: ' + error);
        });
}

function showMetroLinesPanel(lines) {
    let html = '<h4 style="margin-bottom: 15px; color: #2c3e50; font-size: 16px;">Select Metro Line</h4>';
    html += '<div class="metro-lines-list">';
    
    lines.forEach((line, index) => {
        const displayName = line.ref ? `${line.ref} - ${line.name}` : line.name;
        html += `
            <div class="metro-line-item" onclick="selectMetroLine(${index})" style="border-left-color: ${line.colour};">
                <span class="metro-line-color" style="background-color: ${line.colour};"></span>
                <span class="metro-line-name">${displayName}</span>
                <span class="metro-line-stations">${line.stations.length} stations</span>
            </div>
        `;
    });
    
    html += '</div>';
    
    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
    
    // 隐藏返回按钮（在选择列表页面）
    document.getElementById('back-btn').classList.add('hidden');
}

function selectMetroLine(index) {
    const line = metroLinesData[index];
    
    showStatus(`Analyzing ${line.name}...`);
    
    // Clear all previous drawings and analysis
    clearAllDrawings();
    
    // Display line on map
    if (line.geometry && line.geometry.coordinates.length > 0) {
        metroLineLayer = L.geoJSON({
            type: 'Feature',
            geometry: line.geometry
        }, {
            style: {
                color: line.colour,
                weight: 4,
                opacity: 0.8
            }
        }).addTo(map);
        
        // Zoom to line
        map.fitBounds(metroLineLayer.getBounds());
    }
    
    // 显示返回按钮
    const backBtn = document.getElementById('back-btn');
    backBtn.classList.remove('hidden');
    backBtn.onclick = function() {
        // 先清除地图上的线路和分析结果（但不隐藏面板）
        if (nodeMarkersLayer) {
            map.removeLayer(nodeMarkersLayer);
            nodeMarkersLayer = null;
        }
        if (nodeBuffersLayer) {
            map.removeLayer(nodeBuffersLayer);
            nodeBuffersLayer = null;
        }
        if (metroLineLayer) {
            map.removeLayer(metroLineLayer);
            metroLineLayer = null;
        }
        drawnItems.clearLayers();
        
        // 然后返回到线路选择页面
        showMetroLinesPanel(metroLinesData);
    };
    
    // Analyze stations
    analyzeMetroStations(line);
}

function analyzeMetroStations(line) {
    // Create station coordinates array
    const stations = line.stations.map(station => [station.lon, station.lat]);
    
    // Create a polyline from stations
    const polylineGeoJSON = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: stations
        }
    };
    
    // Analyze using existing function, with back button enabled
    analyzePolylineBuffer(polylineGeoJSON, true);
}

function analyzeRegion(regionGeoJSON) {
    showStatus('Analyzing region...');
    
    fetch('/api/analyze_region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionGeoJSON })
    })
    .then(response => response.json())
    .then(data => {
        hideStatus();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        if (data.message) {
            alert(data.message);
            return;
        }
        
        displayAnalysisResults(data);
    })
    .catch(error => {
        hideStatus();
        alert('Analysis failed: ' + error);
    });
}

function analyzePolylineBuffer(polylineGeoJSON, showBackButton = false) {
    showStatus('Analyzing nodes along the line...');
    
    fetch('/api/analyze_polyline_nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            polyline: polylineGeoJSON,
            buffer_distance: 500  // 500 meters per node
        })
    })
    .then(response => response.json())
    .then(data => {
        hideStatus();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        if (data.message) {
            alert(data.message);
            return;
        }
        
        // Display node markers and buffers
        if (data.nodes) {
            displayNodeMarkersAndBuffers(data.nodes);
        }
        
        // Display results with back button control
        displayPolylineNodeResults(data, showBackButton);
    })
    .catch(error => {
        hideStatus();
        alert('Analysis failed: ' + error);
    });
}

let nodeMarkersLayer = null;
let nodeBuffersLayer = null;

// Color palette for nodes
const nodeColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
    '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#c0392b'
];

function displayNodeMarkersAndBuffers(nodes) {
    // Remove old layers
    if (nodeMarkersLayer) {
        map.removeLayer(nodeMarkersLayer);
    }
    if (nodeBuffersLayer) {
        map.removeLayer(nodeBuffersLayer);
    }
    
    nodeMarkersLayer = L.layerGroup();
    nodeBuffersLayer = L.layerGroup();
    
    nodes.forEach((node, index) => {
        const color = nodeColors[index % nodeColors.length];
        
        // Add buffer zone
        if (node.buffer_geojson) {
            const bufferLayer = L.geoJSON(node.buffer_geojson, {
                style: {
                    color: color,
                    weight: 2,
                    opacity: 0.5,
                    fillColor: color,
                    fillOpacity: 0.1,
                    dashArray: '5, 5'
                }
            });
            nodeBuffersLayer.addLayer(bufferLayer);
        }
        
        // Add node marker
        const marker = L.circleMarker([node.lat, node.lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        });
        
        marker.bindPopup(`<b>Node ${index + 1}</b><br>${node.dominant_function || 'Unknown'}`);
        nodeMarkersLayer.addLayer(marker);
    });
    
    nodeBuffersLayer.addTo(map);
    nodeMarkersLayer.addTo(map);
}

function displayPolylineNodeResults(data, showBackButton = false) {
    const nodes = data.nodes || [];
    
    let html = '<h4 style="margin-bottom: 15px; color: #2c3e50; font-size: 16px;">Functional zones traversed</h4>';
    
    html += '<div class="node-results-list">';
    
    nodes.forEach((node, index) => {
        const color = nodeColors[index % nodeColors.length];
        const regionName = node.region_name || 'Unknown';
        const dominantFunc = node.dominant_function || 'Unknown';
        const count = node.feature_count || 0;
        const percentage = node.dominant_percentage || 0;
        
        // 构建显示文本：地名 - 功能区
        const displayText = `${regionName} - ${dominantFunc}`;
        
        html += `
            <div class="node-result-item">
                <div class="node-header">
                    <span class="node-marker" style="background-color: ${color};"></span>
                    <span class="node-number">Node ${index + 1}</span>
                </div>
                <div class="node-function">
                    <span class="legend-color" style="background-color: ${funcGroupColors[dominantFunc] || '#7f8c8d'};"></span>
                    <span class="node-function-name">${displayText}</span>
                </div>
                <div class="node-stats">
                    ${count} items | ${percentage.toFixed(1)}% coverage
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
    
    // 控制返回按钮的显示/隐藏
    const backBtn = document.getElementById('back-btn');
    if (showBackButton) {
        backBtn.classList.remove('hidden');
    } else {
        backBtn.classList.add('hidden');
    }
}

function displayAnalysisResults(data) {
    const title = data.title || 'Function Group';
    const results = data.results || [];
    
    let html = `<h4 style="margin-bottom: 15px; color: #2c3e50; font-size: 16px;">${title}</h4>`;
    
    results.sort((a, b) => b.percentage - a.percentage);
    
    html += '<div class="function-group-list">';
    
    results.forEach((item) => {
        const funcGroup = item.func_group;
        const color = funcGroupColors[funcGroup] || '#7f8c8d';
        
        html += `
            <div class="function-group-item">
                <div class="function-group-header">
                    <span class="legend-color" style="background-color: ${color};"></span>
                    <span class="function-group-name">${funcGroup}</span>
                </div>
                <div class="function-group-stats">
                    <span class="stat-item">${item.count} items</span>
                    <span class="stat-divider">|</span>
                    <span class="stat-item">${item.percentage.toFixed(1)}%</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
    
    // 隐藏返回按钮（区域分析结果）
    document.getElementById('back-btn').classList.add('hidden');
}

function displayFeatureProperties(props) {
    const fieldMapping = {
        'Func_Group': 'Function',
        'fclass': 'Category',
        'name': 'Name'
    };
    
    let html = '<div class="feature-info-card">';
    
    for (let key in fieldMapping) {
        if (props.hasOwnProperty(key) && props[key] !== null && props[key] !== '') {
            const label = fieldMapping[key];
            html += `
                <div class="info-row">
                    <span class="info-label">${label}:</span>
                    <span class="info-value">${props[key]}</span>
                </div>
            `;
        }
    }
    
    html += '</div>';
    
    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
    
    // 隐藏返回按钮（要素属性查看）
    document.getElementById('back-btn').classList.add('hidden');
}

let map;
let geoJsonLayer;
let adminBoundaryLayer;  // 行政区边界图层
let drawControl;
let drawnItems;
let currentMode = null;
let mapBounds = null;
let isLoading = false;
let funcGroupColors = {};  // 存储颜色映射

// 初始化地图
function initMap() {
    map = L.map('map', {
        preferCanvas: false,  // 使用 SVG 渲染，支持更好的交互
        zoomControl: false  // 去掉缩放按钮
    }).setView([22.3193, 114.1694], 11); // 香港中心
    
    // 监听缩放事件，强制重置图层样式并调试
    map.on('zoomend', function() {
        const zoom = map.getZoom();
        console.log('缩放到级别:', zoom);
        
        // 强制重置所有图层的透明度
        document.querySelectorAll('.leaflet-pane').forEach(pane => {
            pane.style.opacity = '1';
            pane.style.filter = 'none';
        });
        
        // 调试：检查背景色
        const mapEl = document.getElementById('map');
        const bgColor = window.getComputedStyle(mapEl).backgroundColor;
        console.log('地图背景色:', bgColor);
        
        // 调试：检查底图颜色
        if (basemapOutlineLayer) {
            console.log('底图图层存在');
        }
    });

    // ========== 添加底图 ==========
    
    // 设置纯色背景（浅灰色）
    map.getPane('tilePane').style.backgroundColor = '#f5f5f5';
    
    // 选项1: OpenStreetMap 无标签（陆地 + 道路，无标签）
    const basemapOSMNoLabels = L.tileLayer('https://tiles.wmflabs.org/osm-no-labels/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18
    });
    
    // 选项2: CartoDB Voyager 无标签（陆地 + 道路，浅色）
    const basemapVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    });
    
    // 选项3: Esri World Gray Canvas（陆地轮廓，极简）
    const basemapEsriGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 16
    });
    
    // 选项4: OpenTopoMap（地形 + 道路，无标签）
    const basemapOpenTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap © OpenTopoMap',
        subdomains: 'abc',
        maxZoom: 17
    });
    
    // 默认使用 Esri World Gray Canvas（极简灰色，只有陆地轮廓）
    basemapEsriGray.addTo(map);
    
    // 其他选项（取消注释来切换）：
    // basemapOSMNoLabels.addTo(map);   // OSM 无标签
    // basemapVoyager.addTo(map);       // CartoDB Voyager
    // basemapOpenTopo.addTo(map);      // OpenTopoMap
    // basemapOpenTopo.addTo(map);      // OpenTopoMap
    // loadBasemapOutline();            // 本地 shapefile

    // 添加比例尺
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 200
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    loadMapData();

    // 监听地图移动和缩放事件
    map.on('moveend', debounce(loadViewportData, 500));
    map.on('zoomend', function () {
        updateLabelsVisibility();
        debounce(loadViewportData, 500)();
    });
}

// 防抖函数
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

// 加载地图数据（只获取边界）
function loadMapData() {
    console.log('1. 开始加载地图数据...');
    showLoading('Loading map data...');

    const startTime = performance.now();

    fetch('/api/load_map')
        .then(response => {
            console.log('2. 收到响应:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('3. 解析 JSON 完成');

            if (data.error) {
                alert('Error: ' + data.error);
                hideLoading();
                return;
            }

            mapBounds = data.bounds;
            funcGroupColors = data.colors || {};

            const loadTime = performance.now() - startTime;
            console.log(`4. 数据加载完成，耗时: ${loadTime.toFixed(0)}ms`);
            console.log(`   统计数据: ${data.count} 个要素`);
            console.log(`   显示数据: ${data.display_count} 个要素`);

            // 创建图例
            console.log('5. 创建图例...');
            if (data.func_groups && data.func_groups.length > 0) {
                createLegend(data.func_groups, funcGroupColors);
            }

            // 添加选区标签（可能很慢，因为有 452 个）
            console.log('6. 添加选区标签...', data.district_labels ? data.district_labels.length : 0);
            if (data.district_labels && data.district_labels.length > 0) {
                // 分批添加，避免阻塞
                addDistrictLabelsBatch(data.district_labels);
            }

            // 异步加载行政区边界（避免阻塞初始加载）
            console.log('7. 准备加载行政区边界...');
            if (data.has_admin_boundaries) {
                setTimeout(() => loadAdminBoundaries(), 100);
            }

            // 添加行政区标签
            console.log('8. 添加行政区标签...');
            if (data.admin_labels && data.admin_labels.length > 0) {
                addAdminLabels(data.admin_labels);
            }

            // 根据初始缩放级别显示相应标签
            console.log('9. 更新标签可见性...');
            updateLabelsVisibility();

            // 缩放到数据范围
            console.log('10. 缩放到数据范围...');
            if (mapBounds) {
                const bounds = [[mapBounds[1], mapBounds[0]], [mapBounds[3], mapBounds[2]]];
                map.fitBounds(bounds);
            }

            console.log('11. 隐藏加载动画...');
            hideLoading();

            // 加载当前视口的数据
            console.log('12. 加载视口数据...');
            loadViewportData();
        })
        .catch(error => {
            console.error('Failed to load data:', error);
            alert('Failed to load data: ' + error);
            hideLoading();
        });
}

// 加载视口内的数据
function loadViewportData() {
    if (isLoading || !mapBounds) return;

    isLoading = true;
    showProgressBar();  // 显示进度条
    
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    const startTime = performance.now();

    fetch('/api/load_viewport', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
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
            updateProgressBar(60);  // 数据接收中
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error('加载视口数据失败:', data.error);
                hideProgressBar();
                isLoading = false;
                return;
            }

            updateProgressBar(80);  // 数据解析完成
            
            const loadTime = performance.now() - startTime;
            console.log(`数据加载耗时: ${loadTime.toFixed(0)}ms, 要素数: ${data.features.length}`);

            displayGeoJSON(data);
            
            hideProgressBar();  // 隐藏进度条
            isLoading = false;
        })
        .catch(error => {
            console.error('加载视口数据失败:', error);
            hideProgressBar();
            isLoading = false;
        });
}

// 显示 GeoJSON 数据（混合模式：VectorGrid + 普通 GeoJSON）
function displayGeoJSON(geojson) {
    console.log('displayGeoJSON 被调用，要素数:', geojson.features.length);
    
    // 完全清除旧图层
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }

    // 根据缩放级别和要素数量选择渲染方式
    const currentZoom = map.getZoom();
    const featureCount = geojson.features.length;
    
    // 中高缩放级别时，使用普通 GeoJSON（避免 VectorGrid 颜色变暗问题）
    if (currentZoom >= 14) {
        console.log(`缩放级别 ${currentZoom}，要素数 ${featureCount}，使用普通 GeoJSON（避免 VectorGrid 变暗）`);
        useNormalGeoJSON(geojson);
        return;
    }
    
    // 尝试使用 VectorGrid（性能更好）
    if (typeof L.vectorGrid !== 'undefined') {
        console.log('使用 VectorGrid 渲染');
        try {
            const vectorTileOptions = {
                rendererFactory: L.svg.tile,
                maxZoom: 18,
                minZoom: 8,
                tolerance: 3,
                extent: 4096,
                buffer: 64,
                vectorTileLayerStyles: {
                    sliced: function(properties, zoom) {
                        const dataType = properties._data_type;

                        if (dataType === 'display') {
                            return {
                                stroke: true,
                                color: '#B0B0B0',
                                weight: 1,
                                opacity: 0.6,
                                fill: true,
                                fillColor: '#B0B0B0',
                                fillOpacity: 0.3
                            };
                        }

                        const funcGroup = properties.Func_Group;
                        let color = funcGroupColors[funcGroup] || '#7f8c8d';

                        // 高缩放级别时降低透明度，避免重叠变暗
                        let fillOpacity = 0.4;
                        let strokeOpacity = 0.8;
                        
                        if (zoom >= 16) {
                            fillOpacity = 0.5;  // 提高填充透明度
                            strokeOpacity = 0.9;  // 提高边框透明度
                        }

                        return {
                            stroke: true,
                            color: color,
                            weight: 2,
                            opacity: strokeOpacity,
                            fill: true,
                            fillColor: color,
                            fillOpacity: fillOpacity
                        };
                    }
                },
                interactive: true,
                getFeatureId: function(f) {
                    return f.properties.id || f.properties.OBJECTID;
                },
                pane: 'overlayPane'
            };

            geoJsonLayer = L.vectorGrid.slicer(geojson, vectorTileOptions);
            
            // VectorGrid 点击事件
            geoJsonLayer.on('click', function(e) {
                console.log('VectorGrid 点击:', e);
                if (currentMode === 'view' && e.layer && e.layer.properties) {
                    displayFeatureProperties(e.layer.properties);
                }
            });
            
            geoJsonLayer.addTo(map);
            console.log(`✓ 使用 VectorGrid 渲染 ${geojson.features.length} 个要素`);
            console.log(`  当前缩放级别: ${map.getZoom()}`);
            
        } catch (error) {
            console.error('VectorGrid 渲染失败，回退到普通 GeoJSON:', error);
            useNormalGeoJSON(geojson);
        }
    } else {
        console.log('VectorGrid 未加载，使用普通 GeoJSON');
        useNormalGeoJSON(geojson);
    }
    
    console.log('displayGeoJSON 完成');
}

// 使用普通 GeoJSON 渲染（备用方案）
function useNormalGeoJSON(geojson) {
    console.log('useNormalGeoJSON 开始，要素数:', geojson.features.length);
    
    geoJsonLayer = L.geoJSON(geojson, {
        style: function (feature) {
            const dataType = feature.properties._data_type;

            if (dataType === 'display') {
                return {
                    color: '#B0B0B0',
                    weight: 1,
                    opacity: 0.6,
                    fillColor: '#B0B0B0',
                    fillOpacity: 0.3
                };
            }

            const funcGroup = feature.properties.Func_Group;
            let color = funcGroupColors[funcGroup] || '#7f8c8d';

            return {
                color: color,
                weight: 2,
                opacity: 0.8,
                fillColor: color,
                fillOpacity: 0.4
            };
        },
        onEachFeature: function (feature, layer) {
            layer.on('click', function (e) {
                console.log('普通 GeoJSON 点击:', e);
                if (currentMode === 'view') {
                    L.DomEvent.stopPropagation(e);
                    displayFeatureProperties(feature.properties);
                }
            });
        }
    }).addTo(map);
    
    console.log(`✓ 使用普通 GeoJSON 渲染 ${geojson.features.length} 个要素`);
}

// 清理未使用的变量警告
// basemapOSMNoLabels, basemapVoyager, basemapOpenTopo 保留供用户切换使用

// 显示要素信息
function showFeatureInfo(feature) {
    const props = feature.properties;
    let html = '<h4 style="margin-bottom: 15px;">要素属性</h4>';

    for (let key in props) {
        if (props.hasOwnProperty(key) && props[key] !== null && props[key] !== '') {
            html += `
                <div class="info-item">
                    <div class="info-label">${key}:</div>
                    <div class="info-value">${props[key]}</div>
                </div>
            `;
        }
    }

    if (html === '<h4 style="margin-bottom: 15px;">要素属性</h4>') {
        html += '<p>该要素没有属性信息</p>';
    }

    document.getElementById('info-content').innerHTML = html;
    document.getElementById('info-panel').classList.remove('hidden');
}

// 查看模式
function enableViewMode() {
    currentMode = 'view';
    disableDrawMode();

    document.getElementById('view-btn').classList.add('active');
    document.getElementById('explore-btn').classList.remove('active');

    showStatus('Click on a feature to view details');
    
    // VectorGrid 的点击事件已经在 displayGeoJSON 中绑定
    // 不需要额外处理
}

// 地图点击事件
function onMapClick(e) {
    if (currentMode !== 'view') return;

    showStatus('Querying feature info...');

    fetch('/api/get_feature_info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lat: e.latlng.lat,
            lng: e.latlng.lng
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
                showStatus(data.message);
                setTimeout(hideStatus, 2000);
                return;
            }

            if (data.properties) {
                displayFeatureProperties(data.properties);
            }
        })
        .catch(error => {
            hideStatus();
            console.error('Query failed:', error);
        });
}

// 显示要素属性
function displayFeatureProperties(props) {
    // 只显示 Func_Group, fclass, name 三个字段
    const fieldMapping = {
        'Func_Group': 'Function',
        'fclass': 'Category',
        'name': 'Name'
    };
    
    let html = '<div class="feature-info-card">';
    
    // 按顺序显示字段
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
}

// 探索模式
function enableExploreMode() {
    currentMode = 'explore';

    document.getElementById('explore-btn').classList.add('active');
    document.getElementById('view-btn').classList.remove('active');
    document.getElementById('info-panel').classList.add('hidden');

    showStatus('Draw a rectangle or shape to explore');

    // 启用绘制工具（移除 edit 功能，只保留 draw 和 delete）
    if (!drawControl) {
        drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true
                },
                rectangle: true,
                circle: false,
                marker: false,
                polyline: false,
                circlemarker: false
            },
            edit: false  // 完全禁用编辑功能
        });
        map.addControl(drawControl);
        
        // 添加自定义删除按钮
        addCustomDeleteButton();
    }

    // 监听绘制完成事件
    map.on(L.Draw.Event.CREATED, function (e) {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        analyzeRegion(e.layer.toGeoJSON());
    });
}

// 禁用绘制模式
function disableDrawMode() {
    if (drawControl) {
        map.removeControl(drawControl);
        drawControl = null;
    }
    // 移除自定义删除按钮
    removeCustomDeleteButton();
    drawnItems.clearLayers();
    map.off(L.Draw.Event.CREATED);
    map.off('click', onMapClick);
}

// 添加自定义删除按钮
function addCustomDeleteButton() {
    const deleteButton = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar leaflet-draw-toolbar-top');
    deleteButton.id = 'custom-delete-btn';
    deleteButton.style.marginTop = '10px';
    
    const deleteLink = L.DomUtil.create('a', 'leaflet-draw-edit-remove', deleteButton);
    deleteLink.href = '#';
    deleteLink.title = 'Delete shape';
    deleteLink.innerHTML = '🗑️';
    
    L.DomEvent.on(deleteLink, 'click', function(e) {
        L.DomEvent.preventDefault(e);
        drawnItems.clearLayers();
        document.getElementById('info-panel').classList.add('hidden');
        showStatus('Shape cleared');
        setTimeout(hideStatus, 2000);
    });
    
    const drawToolbar = document.querySelector('.leaflet-draw-toolbar');
    if (drawToolbar && drawToolbar.parentNode) {
        drawToolbar.parentNode.appendChild(deleteButton);
    }
}

// 移除自定义删除按钮
function removeCustomDeleteButton() {
    const deleteButton = document.getElementById('custom-delete-btn');
    if (deleteButton) {
        deleteButton.remove();
    }
}

// 分析区域
function analyzeRegion(regionGeoJSON) {
    showStatus('Analyzing region...');

    fetch('/api/analyze_region', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region: regionGeoJSON
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

            displayAnalysisResults(data);
        })
        .catch(error => {
            hideStatus();
            console.error('Analysis failed:', error);
            alert('Analysis failed: ' + error);
        });
}

// 显示分析结果
function displayAnalysisResults(data) {
    const title = data.title || 'Function Group';
    const results = data.results || [];
    
    let html = `<h4 style="margin-bottom: 15px; color: #2c3e50; font-size: 16px;">${title}</h4>`;
    
    // 按面积占比排序
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
}

// 显示/隐藏加载动画
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

// 进度条控制
function showProgressBar() {
    const progressBar = document.getElementById('progress-bar');
    progressBar.classList.add('loading');
    progressBar.style.width = '30%';  // 开始加载
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

// 显示/隐藏状态消息
function showStatus(message) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.classList.add('show');
}

function hideStatus() {
    document.getElementById('status-message').classList.remove('show');
}

// 事件监听
document.getElementById('view-btn').addEventListener('click', enableViewMode);
document.getElementById('explore-btn').addEventListener('click', enableExploreMode);
document.getElementById('close-info').addEventListener('click', function () {
    document.getElementById('info-panel').classList.add('hidden');
});

// 创建图例
function createLegend(funcGroups, colors) {
    const legendDiv = document.getElementById('legend');

    let html = '<h4>Legend</h4>';

    funcGroups.forEach(group => {
        const color = colors[group] || '#7f8c8d';
        console.log(`图例项: ${group} -> ${color}`);  // 调试输出
        html += `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${color};"></span>
                <span class="legend-label">${group}</span>
            </div>
        `;
    });

    // 不再显示道路/铁路/水路的图例（使用外部底图）

    legendDiv.innerHTML = html;
}

// 存储标签图层
let districtLabelsLayer = L.layerGroup();
let adminBoundariesLayer = L.layerGroup();
let adminLabelsLayer = L.layerGroup();

// 分批添加选区标签（避免阻塞）
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
        } else {
            console.log(`✓ 添加了 ${labels.length} 个选区标签`);
        }
    }

    addBatch();
}

// 添加选区标签
function addDistrictLabels(labels) {
    districtLabelsLayer.clearLayers();

    labels.forEach(label => {
        const marker = L.marker([label.lat, label.lng], {
            icon: L.divIcon({
                className: 'district-label',
                html: `<div class="district-label-text">${label.name}</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        });
        districtLabelsLayer.addLayer(marker);
    });

    console.log(`添加了 ${labels.length} 个选区标签`);
}

// 异步加载行政区边界
function loadAdminBoundaries() {
    console.log('异步加载行政区边界...');

    fetch('/api/load_admin_boundaries')
        .then(response => response.json())
        .then(geojson => {
            if (geojson.error) {
                console.error('加载行政区边界失败:', geojson.error);
                return;
            }

            addAdminBoundaries(geojson);
        })
        .catch(error => {
            console.error('加载行政区边界失败:', error);
        });
}

// 添加行政区边界
function addAdminBoundaries(geojson) {
    adminBoundariesLayer.clearLayers();

    const layer = L.geoJSON(geojson, {
        style: {
            color: '#b0b0b0',  // 浅灰色边界
            weight: 1.5,       // 细一半（原来是3）
            opacity: 0.6,
            fillOpacity: 0,    // 不填充
            dashArray: '3, 3'  // 全虚线
        }
    });

    adminBoundariesLayer.addLayer(layer);
    console.log(`✓ 行政区边界加载完成`);
}

// 添加行政区标签
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

    console.log(`添加了 ${labels.length} 个行政区标签`);
}

// 根据缩放级别更新标签显示
function updateLabelsVisibility() {
    const zoom = map.getZoom();
    
    // 选区标签：zoom > 12 时显示
    if (zoom > 13) {
        if (!map.hasLayer(districtLabelsLayer)) {
            map.addLayer(districtLabelsLayer);
        }
    } else {
        if (map.hasLayer(districtLabelsLayer)) {
            map.removeLayer(districtLabelsLayer);
        }
    }
    
    // 行政区边界和标签：zoom <= 12 时显示
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

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    initMap();
});

/**
 * Map Initialization Module
 * Handles map setup and basemap configuration
 */

let map;
let mapBounds = null;

function initMap() {
    map = L.map('map', {
        preferCanvas: false,
        zoomControl: false,
        maxZoom: 20  // 允许缩放到 LOD 18
    }).setView([22.3193, 114.1694], 11);
    
    // Add basemap
    const basemapEsriGray = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: '© Esri',
            maxZoom: 20,  // 允许底图缩放到更高级别
            maxNativeZoom: 16  // 底图原生最大级别是 16，超过会复用
        }
    );
    basemapEsriGray.addTo(map);
    
    // Add scale control
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 200
    }).addTo(map);
    
    return map;
}

function fitMapToBounds(bounds) {
    if (bounds && map) {
        const leafletBounds = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]];
        map.fitBounds(leafletBounds);
    }
}

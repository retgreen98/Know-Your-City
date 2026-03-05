/**
 * Map Renderer Module
 * Handles GeoJSON rendering and layer management
 */

let geoJsonLayer = null;
let funcGroupColors = {};

function displayGeoJSON(geojson) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }
    
    const currentZoom = map.getZoom();
    
    // Use normal GeoJSON for high zoom levels
    if (currentZoom >= 14) {
        useNormalGeoJSON(geojson);
        return;
    }
    
    // Try VectorGrid for better performance
    if (typeof L.vectorGrid !== 'undefined') {
        try {
            useVectorGrid(geojson);
        } catch (error) {
            console.error('VectorGrid failed, fallback to normal GeoJSON:', error);
            useNormalGeoJSON(geojson);
        }
    } else {
        useNormalGeoJSON(geojson);
    }
}

function useVectorGrid(geojson) {
    const vectorTileOptions = {
        rendererFactory: L.svg.tile,
        maxZoom: 18,
        minZoom: 8,
        tolerance: 3,
        extent: 4096,
        buffer: 64,
        vectorTileLayerStyles: {
            sliced: function(properties, zoom) {
                const funcGroup = properties.Func_Group;
                let color = funcGroupColors[funcGroup] || '#7f8c8d';
                let fillOpacity = zoom >= 16 ? 0.5 : 0.4;
                let strokeOpacity = zoom >= 16 ? 0.9 : 0.8;
                
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
        }
    };
    
    geoJsonLayer = L.vectorGrid.slicer(geojson, vectorTileOptions);
    
    geoJsonLayer.on('click', function(e) {
        if (currentMode === 'view' && e.layer && e.layer.properties) {
            displayFeatureProperties(e.layer.properties);
        }
    });
    
    geoJsonLayer.addTo(map);
}

function useNormalGeoJSON(geojson) {
    geoJsonLayer = L.geoJSON(geojson, {
        style: function (feature) {
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
                if (currentMode === 'view') {
                    L.DomEvent.stopPropagation(e);
                    displayFeatureProperties(feature.properties);
                }
            });
        }
    }).addTo(map);
}

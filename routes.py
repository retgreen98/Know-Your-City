"""
API 路由模块
"""

from flask import jsonify, request, render_template
import json
from shapely.geometry import shape, box, Point
import geopandas as gpd

from config import FUNC_GROUP_COLORS
from data_loader import data_loader


def register_routes(app):
    """注册所有路由"""
    
    @app.route('/')
    def index():
        """主页"""
        return render_template('index.html')
    
    @app.route('/api/load_map')
    def load_map():
        """加载地图初始数据"""
        import numpy as np
        
        # 计算总边界
        all_bounds = []
        
        if data_loader.gdf_data is not None and not data_loader.gdf_data.empty:
            all_bounds.append(data_loader.gdf_data.total_bounds)
        
        if data_loader.gdf_display is not None and not data_loader.gdf_display.empty:
            all_bounds.append(data_loader.gdf_display.total_bounds)
        
        if not all_bounds:
            return jsonify({"error": "无法加载 shapefile 数据"}), 500
        
        # 合并边界
        all_bounds = np.array(all_bounds)
        bounds = [
            all_bounds[:, 0].min(),
            all_bounds[:, 1].min(),
            all_bounds[:, 2].max(),
            all_bounds[:, 3].max(),
        ]
        
        # 获取所有 Func_Group 类型（排除 Unclassified）
        func_groups = []
        if data_loader.gdf_data is not None and 'Func_Group' in data_loader.gdf_data.columns:
            all_groups = data_loader.gdf_data['Func_Group'].dropna().unique().tolist()
            func_groups = sorted([g for g in all_groups if g.lower() != 'unclassified'])
        
        # 生成选区标签
        district_labels = []
        if data_loader.gdf_districts is not None:
            for idx, row in data_loader.gdf_districts.iterrows():
                centroid = row.geometry.centroid
                ename = row.get('ENAME', '')
                if ename:
                    district_labels.append({
                        'lat': centroid.y,
                        'lng': centroid.x,
                        'name': ename
                    })
        
        # 生成行政区标签
        admin_labels = []
        if data_loader.gdf_admin_boundaries is not None:
            for idx, row in data_loader.gdf_admin_boundaries.iterrows():
                centroid = row.geometry.centroid
                name_en = row.get('NAME_EN', '')
                if name_en:
                    admin_labels.append({
                        'lat': centroid.y,
                        'lng': centroid.x,
                        'name': name_en
                    })
        
        return jsonify({
            "type": "FeatureCollection",
            "features": [],
            "bounds": bounds,
            "count": len(data_loader.gdf_data) if data_loader.gdf_data is not None else 0,
            "display_count": len(data_loader.gdf_display) if data_loader.gdf_display is not None else 0,
            "func_groups": func_groups,
            "colors": FUNC_GROUP_COLORS,
            "district_labels": district_labels,
            "admin_labels": admin_labels,
            "has_admin_boundaries": data_loader.gdf_admin_boundaries is not None
        })
    
    @app.route('/api/load_admin_boundaries')
    def load_admin_boundaries():
        """单独加载行政区边界（简化版本）"""
        if data_loader.gdf_admin_boundaries is None:
            return jsonify({"error": "行政区数据未加载"}), 404
        
        try:
            # 简化行政区边界
            gdf_admin_simplified = data_loader.gdf_admin_boundaries.copy()
            gdf_admin_simplified['geometry'] = gdf_admin_simplified['geometry'].simplify(
                tolerance=0.001,
                preserve_topology=True
            )
            
            admin_boundaries = json.loads(gdf_admin_simplified.to_json())
            return jsonify(admin_boundaries)
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/load_viewport', methods=['POST'])
    def load_viewport():
        """根据视口加载数据"""
        try:
            bounds_data = request.json.get('bounds')
            zoom = request.json.get('zoom', 11)
            
            # 创建边界框
            bbox = box(
                bounds_data['west'],
                bounds_data['south'],
                bounds_data['east'],
                bounds_data['north']
            )
            
            all_features = []
            
            # 获取对应缩放级别的数据
            gdf_for_zoom = data_loader.get_data_for_zoom(zoom)
            
            if gdf_for_zoom is not None:
                viewport_data = gdf_for_zoom[gdf_for_zoom.intersects(bbox)].copy()
                viewport_data['_data_type'] = 'analysis'
                
                geojson = json.loads(viewport_data.to_json())
                all_features.extend(geojson['features'])
            
            return jsonify({
                "type": "FeatureCollection",
                "features": all_features
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/analyze_region', methods=['POST'])
    def analyze_region():
        """分析用户绘制的区域"""
        if data_loader.gdf_data is None:
            return jsonify({"error": "数据未加载"}), 500
        
        try:
            # 获取用户绘制的区域
            region_geojson = request.json.get('region')
            region_shape = shape(region_geojson['geometry'])
            
            # 转换为 UTM 投影
            gdf_region = gpd.GeoDataFrame([1], geometry=[region_shape], crs="EPSG:4326")
            gdf_region_projected = gdf_region.to_crs("EPSG:32650")
            region_projected = gdf_region_projected.geometry.iloc[0]
            
            # 找出区域的地名（选区名称）
            region_name = "未知区域"
            
            if data_loader.gdf_districts is not None:
                gdf_districts_projected = data_loader.gdf_districts.to_crs("EPSG:32650")
                
                intersecting_districts = gdf_districts_projected[
                    gdf_districts_projected.intersects(region_projected)
                ].copy()
                
                if not intersecting_districts.empty:
                    intersecting_districts['overlap_area'] = intersecting_districts.geometry.apply(
                        lambda geom: geom.intersection(region_projected).area
                    )
                    
                    largest_district = intersecting_districts.nlargest(1, 'overlap_area').iloc[0]
                    region_name = largest_district.get('ENAME', '未知区域')
            
            # 使用最高精度的数据进行分析
            gdf_analysis = data_loader.gdf_data
            if data_loader.lod_data and 18 in data_loader.lod_data:
                gdf_analysis = data_loader.lod_data[18]
            
            # 边界框快速筛选
            bbox = region_shape.bounds
            bbox_filter = (
                (gdf_analysis.geometry.bounds['minx'] <= bbox[2]) &
                (gdf_analysis.geometry.bounds['maxx'] >= bbox[0]) &
                (gdf_analysis.geometry.bounds['miny'] <= bbox[3]) &
                (gdf_analysis.geometry.bounds['maxy'] >= bbox[1])
            )
            gdf_filtered = gdf_analysis[bbox_filter].copy()
            
            # 投影
            gdf_projected = gdf_filtered.to_crs("EPSG:32650")
            
            # 找出相交的要素
            intersecting = gdf_projected[gdf_projected.intersects(region_projected)].copy()
            
            if intersecting.empty:
                return jsonify({"message": "区域内没有要素"})
            
            # 裁剪并计算面积
            intersecting['clipped_geom'] = intersecting.geometry.apply(
                lambda geom: geom.intersection(region_projected)
            )
            intersecting['area'] = intersecting['clipped_geom'].area
            
            total_area = region_projected.area
            
            # 按 Func_Group 统计
            func_group_stats = {}
            
            for idx, row in intersecting.iterrows():
                func_group = row.get('Func_Group', '未知')
                area = row['area']
                
                if func_group not in func_group_stats:
                    func_group_stats[func_group] = {
                        'count': 0,
                        'total_area': 0,
                    }
                
                func_group_stats[func_group]['count'] += 1
                func_group_stats[func_group]['total_area'] += area
            
            # 计算占比
            for func_group, stats in func_group_stats.items():
                stats['percentage'] = (stats['total_area'] / total_area) * 100
            
            # 找出数量第一和面积第一
            sorted_by_count = sorted(
                func_group_stats.items(),
                key=lambda x: x[1]['count'],
                reverse=True
            )
            sorted_by_area = sorted(
                func_group_stats.items(),
                key=lambda x: x[1]['percentage'],
                reverse=True
            )
            
            top_by_count = sorted_by_count[0][0] if sorted_by_count else None
            top_by_area = sorted_by_area[0][0] if sorted_by_area else None
            
            # 生成标题
            title_parts = []
            if top_by_count and top_by_area:
                if top_by_count == top_by_area:
                    title_parts.append(f"{region_name} - {top_by_count}")
                else:
                    title_parts.append(f"{region_name} - {top_by_count}")
                    title_parts.append(f"{region_name} - {top_by_area}")
            
            # 生成所有 Function Group 的结果列表
            results = []
            for func_group, stats in func_group_stats.items():
                # 过滤掉 Unclassified
                if func_group.lower() != 'unclassified':
                    results.append({
                        'func_group': func_group,
                        'count': stats['count'],
                        'percentage': stats['percentage']
                    })
            
            return jsonify({
                'title': ' | '.join(title_parts) if title_parts else region_name,
                'results': results
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/get_metro_lines', methods=['GET'])
    def get_metro_lines():
        """获取香港地铁线路"""
        try:
            import requests
            
            # 使用边界框查询
            query = """
            [out:json][timeout:60];
            (
              relation["route"="subway"](22.1,113.8,22.6,114.4);
              relation["route"="light_rail"](22.1,113.8,22.6,114.4);
            );
            out body;
            >;
            out skel qt;
            """
            
            overpass_url = "https://overpass-api.de/api/interpreter"
            response = requests.post(overpass_url, data={"data": query}, timeout=60)
            
            if response.status_code != 200:
                error_msg = f"API returned status {response.status_code}"
                return jsonify({"error": error_msg}), 500
            
            osm_data = response.json()
            
            # 处理数据
            lines = []
            nodes_dict = {}
            ways_dict = {}
            
            # 先收集所有节点和路径
            for element in osm_data['elements']:
                if element['type'] == 'node':
                    nodes_dict[element['id']] = {
                        'lat': element['lat'],
                        'lon': element['lon']
                    }
                elif element['type'] == 'way':
                    ways_dict[element['id']] = element.get('nodes', [])
            
            # 处理线路
            for element in osm_data['elements']:
                if element['type'] == 'relation':
                    tags = element.get('tags', {})
                    route_type = tags.get('route', '')
                    
                    if route_type not in ['subway', 'light_rail']:
                        continue
                    
                    # 提取站点（role=stop 或 role=platform）
                    stations = []
                    for member in element.get('members', []):
                        if member.get('role') in ['stop', 'stop_exit_only', 'stop_entry_only', '']:
                            if member['type'] == 'node' and member['ref'] in nodes_dict:
                                node = nodes_dict[member['ref']]
                                stations.append({
                                    'name': tags.get('name', 'Unknown Station'),
                                    'lat': node['lat'],
                                    'lon': node['lon']
                                })
                    
                    # 提取线路几何（用于显示）
                    line_coords = []
                    for member in element.get('members', []):
                        if member['type'] == 'way' and member['ref'] in ways_dict:
                            way_nodes = ways_dict[member['ref']]
                            for node_id in way_nodes:
                                if node_id in nodes_dict:
                                    node = nodes_dict[node_id]
                                    line_coords.append([node['lon'], node['lat']])
                    
                    line_data = {
                        'id': element['id'],
                        'name': tags.get('name', 'Unknown Line'),
                        'ref': tags.get('ref', ''),
                        'colour': tags.get('colour', '#888888'),
                        'stations': stations,
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': line_coords
                        } if line_coords else None
                    }
                    
                    if stations:
                        lines.append(line_data)
            
            return jsonify({
                'lines': lines,
                'count': len(lines)
            })
            
        except requests.exceptions.Timeout:
            return jsonify({"error": "Request timeout - please try again"}), 500
        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"Network error: {str(e)}"}), 500
        except Exception as e:
            return jsonify({"error": f"Error: {str(e)}"}), 500
    
    @app.route('/api/analyze_polyline_nodes', methods=['POST'])
    def analyze_polyline_nodes():
        """分析折线每个节点的缓冲区"""
        if data_loader.gdf_data is None:
            return jsonify({"error": "数据未加载"}), 500
        
        try:
            polyline_geojson = request.json.get('polyline')
            buffer_distance = request.json.get('buffer_distance', 500)
            
            coordinates = polyline_geojson['geometry']['coordinates']
            
            # 使用最高精度的数据
            gdf_analysis = data_loader.gdf_data
            if data_loader.lod_data and 18 in data_loader.lod_data:
                gdf_analysis = data_loader.lod_data[18]
            
            gdf_analysis_projected = gdf_analysis.to_crs("EPSG:32650")
            
            node_results = []
            
            for idx, coord in enumerate(coordinates):
                lng, lat = coord
                
                # 创建点
                point = Point(lng, lat)
                gdf_point = gpd.GeoDataFrame([1], geometry=[point], crs="EPSG:4326")
                point_projected = gdf_point.to_crs("EPSG:32650").geometry.iloc[0]
                
                # 创建缓冲区
                buffer_projected = point_projected.buffer(buffer_distance)
                
                # 转回 WGS84 用于前端显示
                gdf_buffer = gpd.GeoDataFrame([1], geometry=[buffer_projected], crs="EPSG:32650")
                buffer_wgs84 = gdf_buffer.to_crs("EPSG:4326").geometry.iloc[0]
                buffer_geojson = json.loads(gpd.GeoSeries([buffer_wgs84]).to_json())
                
                # 获取地名
                node_region_name = "Unknown"
                
                if data_loader.gdf_districts is not None:
                    gdf_districts_projected = data_loader.gdf_districts.to_crs("EPSG:32650")
                    containing_districts = gdf_districts_projected[
                        gdf_districts_projected.contains(point_projected)
                    ]
                    
                    if not containing_districts.empty:
                        node_region_name = containing_districts.iloc[0].get('ENAME', 'Unknown')
                    else:
                        gdf_districts_projected['distance'] = gdf_districts_projected.distance(point_projected)
                        nearest = gdf_districts_projected.nsmallest(1, 'distance')
                        
                        if not nearest.empty:
                            distance = nearest.iloc[0]['distance']
                            if distance < 1000:
                                node_region_name = nearest.iloc[0].get('ENAME', 'Unknown')
                
                # 边界框快速筛选
                bbox = buffer_projected.bounds
                bbox_filter = (
                    (gdf_analysis_projected.geometry.bounds['minx'] <= bbox[2]) &
                    (gdf_analysis_projected.geometry.bounds['maxx'] >= bbox[0]) &
                    (gdf_analysis_projected.geometry.bounds['miny'] <= bbox[3]) &
                    (gdf_analysis_projected.geometry.bounds['maxy'] >= bbox[1])
                )
                gdf_filtered = gdf_analysis_projected[bbox_filter].copy()
                
                if gdf_filtered.empty:
                    node_results.append({
                        'lat': lat,
                        'lng': lng,
                        'region_name': node_region_name,
                        'dominant_function': 'No features',
                        'feature_count': 0,
                        'dominant_percentage': 0,
                        'buffer_geojson': buffer_geojson
                    })
                    continue
                
                # 找出相交的要素
                intersecting = gdf_filtered[gdf_filtered.intersects(buffer_projected)].copy()
                
                if intersecting.empty:
                    node_results.append({
                        'lat': lat,
                        'lng': lng,
                        'region_name': node_region_name,
                        'dominant_function': 'No features',
                        'feature_count': 0,
                        'dominant_percentage': 0,
                        'buffer_geojson': buffer_geojson
                    })
                    continue
                
                # 裁剪并计算面积
                intersecting['clipped_geom'] = intersecting.geometry.apply(
                    lambda geom: geom.intersection(buffer_projected)
                )
                intersecting['area'] = intersecting['clipped_geom'].area
                
                buffer_area = buffer_projected.area
                
                # 按 Func_Group 统计
                func_group_stats = {}
                for _, row in intersecting.iterrows():
                    func_group = row.get('Func_Group', 'Unknown')
                    area = row['area']
                    
                    if func_group not in func_group_stats:
                        func_group_stats[func_group] = {
                            'count': 0,
                            'total_area': 0,
                        }
                    
                    func_group_stats[func_group]['count'] += 1
                    func_group_stats[func_group]['total_area'] += area
                
                # 找出主导功能区（按面积）
                if func_group_stats:
                    dominant_func = max(func_group_stats.items(), key=lambda x: x[1]['total_area'])[0]
                    dominant_area = func_group_stats[dominant_func]['total_area']
                    dominant_percentage = (dominant_area / buffer_area) * 100
                    feature_count = func_group_stats[dominant_func]['count']
                else:
                    dominant_func = 'Unknown'
                    dominant_percentage = 0
                    feature_count = 0
                
                node_results.append({
                    'lat': lat,
                    'lng': lng,
                    'region_name': node_region_name,
                    'dominant_function': dominant_func,
                    'feature_count': feature_count,
                    'dominant_percentage': dominant_percentage,
                    'buffer_geojson': buffer_geojson
                })
            
            return jsonify({
                'nodes': node_results
            })
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500

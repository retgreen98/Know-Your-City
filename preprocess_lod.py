"""
预处理脚本：为不同缩放级别生成 LOD（Level of Detail）数据

原理：
1. 为每个缩放级别计算"过小"的阈值（像素面积）
2. 将过小的同类要素（相同 Func_Group）合并
3. 保存为不同的文件或数据库表

使用：
python preprocess_lod.py
"""

import geopandas as gpd
import pandas as pd
from shapely.ops import unary_union
from shapely.geometry import MultiPolygon, Polygon
import os
import glob

# 配置
SHP_DIR = r"D:\AIProject\KNOW_YOUR_CITY\重分类数据"
OUTPUT_DIR = r"D:\AIProject\KNOW_YOUR_CITY\LOD数据"

# 缩放级别配置
# Leaflet zoom levels: 0-18
# 我们为 zoom 8, 10, 12, 14, 16 生成 LOD
# 更激进的合并策略，减少要素数量，提高性能
ZOOM_LEVELS = {
    8: {'min_area_m2': 500000, 'buffer_m': 200},   # 非常激进：合并 < 50万m² (约 0.5km²)
    10: {'min_area_m2': 100000, 'buffer_m': 100},  # 激进：合并 < 10万m² (约 0.1km²)
    12: {'min_area_m2': 10000, 'buffer_m': 50},    # 中等：合并 < 1万m² (约 100m×100m)
    14: {'min_area_m2': 1000, 'buffer_m': 20},     # 轻微：合并 < 1000m² (约 30m×30m)
    # 16, 18 不处理，使用原始数据
}

def calculate_min_area_pixels(zoom, screen_width=1920, screen_height=1080):
    """
    计算在给定缩放级别下，多少平方米对应 1 像素
    
    参数：
    - zoom: Leaflet 缩放级别
    - screen_width, screen_height: 屏幕分辨率
    
    返回：
    - min_area_m2: 最小可见面积（平方米）
    """
    # Leaflet 在 zoom 0 时，整个世界是 256x256 像素
    # 每增加一级，分辨率翻倍
    
    # 地球周长约 40,075,017 米
    earth_circumference = 40075017
    
    # 在给定 zoom 下，每像素代表多少米
    meters_per_pixel = earth_circumference / (256 * (2 ** zoom))
    
    # 假设一个要素至少要 5x5 像素才能看清
    min_pixels = 25  # 5x5
    
    # 计算最小面积（平方米）
    min_area_m2 = (meters_per_pixel ** 2) * min_pixels
    
    return min_area_m2

def merge_small_features(gdf, min_area_m2, buffer_m, simplify_tolerance=None):
    """
    合并过小的同类要素
    
    参数：
    - gdf: GeoDataFrame（已投影到 UTM）
    - min_area_m2: 最小面积阈值（平方米）
    - buffer_m: 缓冲区距离（米），用于判断"邻近"
    - simplify_tolerance: 简化容差（米），用于减少顶点数量
    
    返回：
    - 合并后的 GeoDataFrame
    """
    print(f"  最小面积阈值: {min_area_m2:.0f} m²")
    print(f"  缓冲区距离: {buffer_m} m")
    if simplify_tolerance:
        print(f"  简化容差: {simplify_tolerance} m")
    
    # 计算面积
    gdf['area_m2'] = gdf.geometry.area
    
    # 分离大要素和小要素
    large_features = gdf[gdf['area_m2'] >= min_area_m2].copy()
    small_features = gdf[gdf['area_m2'] < min_area_m2].copy()
    
    print(f"  大要素: {len(large_features)} 个")
    print(f"  小要素: {len(small_features)} 个")
    
    # 如果指定了简化容差，简化大要素的几何
    if simplify_tolerance and not large_features.empty:
        print(f"  简化大要素几何...")
        large_features['geometry'] = large_features['geometry'].simplify(
            tolerance=simplify_tolerance,
            preserve_topology=True
        )
    
    if small_features.empty:
        return large_features.drop(columns=['area_m2'])
    
    # 按 Func_Group 分组合并小要素
    merged_features = []
    
    for func_group in small_features['Func_Group'].unique():
        group_features = small_features[small_features['Func_Group'] == func_group]
        
        if len(group_features) == 0:
            continue
        
        # 创建缓冲区并合并
        buffered = group_features.geometry.buffer(buffer_m)
        
        # 合并重叠的缓冲区
        merged_geom = unary_union(buffered)
        
        # 如果是 MultiPolygon，分解为多个 Polygon
        if isinstance(merged_geom, MultiPolygon):
            geoms = list(merged_geom.geoms)
        else:
            geoms = [merged_geom]
        
        # 为每个合并后的几何创建要素
        for geom in geoms:
            # 去除缓冲区（负缓冲）
            geom_unbuffered = geom.buffer(-buffer_m)
            
            if geom_unbuffered.is_empty or geom_unbuffered.area < min_area_m2:
                continue
            
            # 简化合并后的几何
            if simplify_tolerance:
                geom_unbuffered = geom_unbuffered.simplify(
                    tolerance=simplify_tolerance,
                    preserve_topology=True
                )
            
            merged_features.append({
                'Func_Group': func_group,
                'geometry': geom_unbuffered,
                '_merged': True  # 标记为合并要素
            })
    
    print(f"  合并后: {len(merged_features)} 个要素")
    
    # 合并大要素和合并后的小要素
    if merged_features:
        merged_gdf = gpd.GeoDataFrame(merged_features, crs=gdf.crs)
        large_features['_merged'] = False
        result = pd.concat([large_features, merged_gdf], ignore_index=True)
    else:
        large_features['_merged'] = False
        result = large_features
    
    return result.drop(columns=['area_m2'])

def process_lod():
    """处理所有文件，生成 LOD 数据"""
    
    # 创建输出目录
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 查找所有 shapefile
    shp_files = glob.glob(os.path.join(SHP_DIR, "*.shp"))
    
    if not shp_files:
        print(f"错误: 在 {SHP_DIR} 中没有找到 shapefile")
        return
    
    print("=" * 60)
    print("开始处理 LOD 数据")
    print("=" * 60)
    
    for shp_file in shp_files:
        filename = os.path.basename(shp_file)
        print(f"\n处理文件: {filename}")
        
        try:
            # 读取数据
            gdf = gpd.read_file(shp_file)
            
            # 检查 Func_Group 字段
            if 'Func_Group' not in gdf.columns:
                print(f"  跳过: 没有 Func_Group 字段")
                continue
            
            # 转换为 WGS84
            if gdf.crs and gdf.crs != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            
            # 转换为 UTM Zone 50N（适合香港）用于面积计算
            gdf_utm = gdf.to_crs("EPSG:32650")
            
            print(f"  原始要素数: {len(gdf_utm)}")
            
            # 为每个缩放级别生成 LOD
            for zoom, config in ZOOM_LEVELS.items():
                print(f"\n  处理 Zoom {zoom}:")
                
                # 根据缩放级别确定简化容差
                # 小缩放级别（远距离）可以更激进地简化
                simplify_tolerance = None
                if zoom <= 8:
                    simplify_tolerance = 50  # 50米
                elif zoom <= 10:
                    simplify_tolerance = 20  # 20米
                elif zoom <= 12:
                    simplify_tolerance = 10  # 10米
                
                # 合并小要素
                gdf_lod = merge_small_features(
                    gdf_utm.copy(),
                    config['min_area_m2'],
                    config['buffer_m'],
                    simplify_tolerance
                )
                
                # 转换回 WGS84
                gdf_lod = gdf_lod.to_crs("EPSG:4326")
                
                # 保存
                output_filename = filename.replace('.shp', f'_zoom{zoom}.shp')
                output_path = os.path.join(OUTPUT_DIR, output_filename)
                gdf_lod.to_file(output_path)
                
                print(f"  ✓ 保存到: {output_filename}")
            
            # 复制原始文件用于高缩放级别（16, 18）
            for zoom in [16, 18]:
                output_filename = filename.replace('.shp', f'_zoom{zoom}.shp')
                output_path = os.path.join(OUTPUT_DIR, output_filename)
                gdf.to_file(output_path)
                print(f"  ✓ 复制原始数据到: {output_filename}")
            
        except Exception as e:
            print(f"  ✗ 处理失败: {e}")
    
    print("\n" + "=" * 60)
    print("LOD 数据生成完成！")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 60)

if __name__ == '__main__':
    process_lod()

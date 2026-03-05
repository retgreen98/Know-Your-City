"""
生成矢量切片（MVT 格式）

使用 tippecanoe 或 Python 库生成矢量切片
"""

import geopandas as gpd
import json
import os
from pathlib import Path
from config import SHP_DIR_ANALYSIS, SHP_DIR_DISPLAY, SHP_DIR_LOD

def generate_mbtiles():
    """
    生成 MBTiles 格式的矢量切片
    
    需要安装 tippecanoe:
    - macOS: brew install tippecanoe
    - Linux: https://github.com/felt/tippecanoe
    - Windows: 使用 WSL 或 Docker
    """
    
    print("=" * 60)
    print("生成矢量切片")
    print("=" * 60)
    
    # 1. 合并所有 LOD 18 数据为一个 GeoJSON
    output_dir = Path("vector_tiles")
    output_dir.mkdir(exist_ok=True)
    
    geojson_file = output_dir / "all_data.geojson"
    
    print("\n1. 合并数据为 GeoJSON...")
    
    all_features = []
    
    # 加载 LOD 18 数据
    lod_dir = Path(SHP_DIR_LOD) / "zoom18"
    if lod_dir.exists():
        for shp_file in lod_dir.glob("*.shp"):
            print(f"  读取: {shp_file.name}")
            gdf = gpd.read_file(shp_file)
            
            # 过滤 Unclassified
            if 'Func_Group' in gdf.columns:
                gdf = gdf[gdf['Func_Group'].str.lower() != 'unclassified']
            
            # 转换为 GeoJSON features
            geojson = json.loads(gdf.to_json())
            all_features.extend(geojson['features'])
    
    # 加载显示数据
    display_dir = Path(SHP_DIR_DISPLAY)
    if display_dir.exists():
        for shp_file in display_dir.glob("*.shp"):
            if shp_file.name in ['道路.shp', '铁路.shp', '水路.shp']:
                print(f"  读取: {shp_file.name}")
                gdf = gpd.read_file(shp_file)
                
                # 添加数据类型标记
                gdf['_data_type'] = 'display'
                
                geojson = json.loads(gdf.to_json())
                all_features.extend(geojson['features'])
    
    # 保存为 GeoJSON
    full_geojson = {
        "type": "FeatureCollection",
        "features": all_features
    }
    
    print(f"\n2. 保存 GeoJSON: {len(all_features)} 个要素")
    with open(geojson_file, 'w', encoding='utf-8') as f:
        json.dump(full_geojson, f)
    
    print(f"  文件大小: {geojson_file.stat().st_size / 1024 / 1024:.1f} MB")
    
    # 3. 使用 tippecanoe 生成 MBTiles
    mbtiles_file = output_dir / "tiles.mbtiles"
    
    print("\n3. 生成矢量切片...")
    print("  需要安装 tippecanoe")
    print("  命令:")
    print(f"  tippecanoe -o {mbtiles_file} -Z8 -z18 --drop-densest-as-needed {geojson_file}")
    print("\n  参数说明:")
    print("  -Z8: 最小缩放级别 8")
    print("  -z18: 最大缩放级别 18")
    print("  --drop-densest-as-needed: 自动简化密集区域")
    
    # 尝试运行 tippecanoe
    import subprocess
    try:
        cmd = [
            'tippecanoe',
            '-o', str(mbtiles_file),
            '-Z8', '-z18',
            '--drop-densest-as-needed',
            '--force',  # 覆盖已存在的文件
            str(geojson_file)
        ]
        
        print("\n  执行中...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"\n✓ 矢量切片生成成功: {mbtiles_file}")
            print(f"  文件大小: {mbtiles_file.stat().st_size / 1024 / 1024:.1f} MB")
        else:
            print(f"\n✗ 生成失败:")
            print(result.stderr)
            
    except FileNotFoundError:
        print("\n✗ tippecanoe 未安装")
        print("\n安装方法:")
        print("  macOS: brew install tippecanoe")
        print("  Linux: https://github.com/felt/tippecanoe")
        print("  Windows: 使用 WSL 或 Docker")

if __name__ == '__main__':
    generate_mbtiles()

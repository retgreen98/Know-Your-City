"""
数据加载模块
"""

import geopandas as gpd
import pandas as pd
import os
import glob
from config import *


class DataLoader:
    """数据加载器"""
    
    def __init__(self):
        self.gdf_data = None  # 原始统计数据
        self.gdf_display = None  # 仅显示数据
        self.gdf_districts = None  # 选区数据
        self.gdf_admin_boundaries = None  # 行政区分界
        self.gdf_basemap = None  # 底图数据（香港陆地）
        self.lod_data = {}  # LOD 数据缓存 {zoom_level: gdf}
    
    def load_all(self):
        """加载所有数据"""
        print("=" * 60)
        print("开始加载数据...")
        print("=" * 60)
        
        # 加载统计数据
        if USE_LOD and os.path.exists(SHP_DIR_LOD):
            self._load_lod_data()
        else:
            self._load_analysis_data()
        
        # 加载显示数据
        self._load_display_data()
        
        # 加载选区数据
        self._load_districts()
        
        # 加载行政区分界
        self._load_admin_boundaries()
        
        # 加载底图
        self._load_basemap()
        
        print("=" * 60)
        print("数据加载完成！")
        print("=" * 60)
    
    def _load_analysis_data(self):
        """加载统计数据（原始数据）"""
        print("\n正在加载统计数据...")
        shp_files = glob.glob(os.path.join(SHP_DIR_ANALYSIS, "*.shp"))
        
        if not shp_files:
            print(f"警告: 在 {SHP_DIR_ANALYSIS} 中没有找到 shapefile")
            return
        
        gdfs = []
        total_before_filter = 0
        total_filtered = 0
        
        for shp_file in shp_files:
            try:
                gdf = gpd.read_file(shp_file)
                if gdf.crs and gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                
                if 'Func_Group' not in gdf.columns:
                    print(f"警告: {os.path.basename(shp_file)} 没有 Func_Group 字段，跳过")
                    continue
                
                original_count = len(gdf)
                total_before_filter += original_count
                
                # 过滤掉 Unclassified
                gdf = gdf[~gdf['Func_Group'].str.lower().isin(['unclassified'])].copy()
                
                filtered_count = original_count - len(gdf)
                total_filtered += filtered_count
                
                if len(gdf) > 0:
                    gdfs.append(gdf)
                    if filtered_count > 0:
                        print(f"✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素 (过滤 {filtered_count} 个 Unclassified)")
                    else:
                        print(f"✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素")
                else:
                    print(f"⚠ {os.path.basename(shp_file)} - 全部为 Unclassified，跳过")
                    
            except Exception as e:
                print(f"✗ 加载 {shp_file} 失败: {e}")
        
        if gdfs:
            self.gdf_data = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
            print(f"统计数据总计: {len(self.gdf_data)} 个要素")
            if total_filtered > 0:
                print(f"已过滤 Unclassified: {total_filtered} 个要素")
    
    def _load_lod_data(self):
        """初始化 LOD 数据（不实际加载，只检查文件是否存在）"""
        print("\n正在初始化 LOD 数据...")
        
        # 获取所有 LOD 级别
        lod_levels = set()
        for zoom_range, lod_level in LOD_ZOOM_MAPPING.items():
            lod_levels.add(lod_level)
        
        # 只检查文件是否存在，不实际加载
        available_levels = []
        for lod_level in sorted(lod_levels):
            pattern = os.path.join(SHP_DIR_LOD, f"*_zoom{lod_level}.shp")
            shp_files = glob.glob(pattern)
            
            if shp_files:
                available_levels.append(lod_level)
                print(f"  ✓ LOD {lod_level}: {len(shp_files)} 个文件")
            else:
                print(f"  ✗ LOD {lod_level}: 未找到文件")
        
        if not available_levels:
            print("  警告: 没有找到任何 LOD 数据，将使用原始数据")
            self._load_analysis_data()
            return
        
        # 只加载最高级别的数据（用于区域分析）
        highest_level = max(available_levels)
        print(f"\n加载最高精度数据 (LOD {highest_level}) 用于区域分析...")
        
        pattern = os.path.join(SHP_DIR_LOD, f"*_zoom{highest_level}.shp")
        shp_files = glob.glob(pattern)
        
        gdfs = []
        total_filtered = 0
        
        for shp_file in shp_files:
            try:
                gdf = gpd.read_file(shp_file)
                if gdf.crs and gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                
                # 过滤掉 Unclassified
                if 'Func_Group' in gdf.columns:
                    original_count = len(gdf)
                    gdf = gdf[~gdf['Func_Group'].str.lower().isin(['unclassified'])].copy()
                    filtered_count = original_count - len(gdf)
                    total_filtered += filtered_count
                    
                    if len(gdf) > 0:
                        gdfs.append(gdf)
                        if filtered_count > 0:
                            print(f"  ✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素 (过滤 {filtered_count} 个)")
                        else:
                            print(f"  ✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素")
                else:
                    gdfs.append(gdf)
                    print(f"  ✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素")
                    
            except Exception as e:
                print(f"  ✗ 加载 {shp_file} 失败: {e}")
        
        if gdfs:
            self.gdf_data = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
            print(f"  总计: {len(self.gdf_data)} 个要素")
            if total_filtered > 0:
                print(f"  已过滤 Unclassified: {total_filtered} 个要素")
        
        print(f"\nLOD 初始化完成，可用级别: {available_levels}")
        print("其他级别将在需要时动态加载")
    
    def _load_display_data(self):
        """加载仅显示数据"""
        print("\n正在加载仅显示数据...")
        shp_files = glob.glob(os.path.join(SHP_DIR_DISPLAY, "*.shp"))
        
        if not shp_files:
            print(f"提示: 在 {SHP_DIR_DISPLAY} 中没有找到 shapefile")
            return
        
        gdfs = []
        for shp_file in shp_files:
            # 跳过行政区分界（单独加载）
            if '行政区分界' in shp_file:
                continue
            
            try:
                gdf = gpd.read_file(shp_file)
                if gdf.crs and gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                gdfs.append(gdf)
                print(f"✓ {os.path.basename(shp_file)} - {len(gdf)} 个要素")
            except Exception as e:
                print(f"✗ 加载 {shp_file} 失败: {e}")
        
        if gdfs:
            self.gdf_display = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
            print(f"显示数据总计: {len(self.gdf_display)} 个要素")
    
    def _load_districts(self):
        """加载选区数据"""
        print("\n正在加载选区数据...")
        try:
            self.gdf_districts = gpd.read_file(DISTRICT_SHP)
            if self.gdf_districts.crs and self.gdf_districts.crs != "EPSG:4326":
                self.gdf_districts = self.gdf_districts.to_crs("EPSG:4326")
            print(f"✓ 选区数据加载成功: {len(self.gdf_districts)} 个选区")
        except Exception as e:
            print(f"✗ 加载选区数据失败: {e}")
            self.gdf_districts = None
    
    def _load_admin_boundaries(self):
        """加载行政区分界"""
        print("\n正在加载行政区分界...")
        try:
            self.gdf_admin_boundaries = gpd.read_file(ADMIN_BOUNDARY_SHP)
            if self.gdf_admin_boundaries.crs and self.gdf_admin_boundaries.crs != "EPSG:4326":
                self.gdf_admin_boundaries = self.gdf_admin_boundaries.to_crs("EPSG:4326")
            print(f"✓ 行政区分界加载成功: {len(self.gdf_admin_boundaries)} 个行政区")
        except Exception as e:
            print(f"✗ 加载行政区分界失败: {e}")
            self.gdf_admin_boundaries = None
    
    def _load_basemap(self):
        """加载底图（香港陆地）"""
        print("\n正在加载底图...")
        try:
            self.gdf_basemap = gpd.read_file(BASEMAP_SHP)
            if self.gdf_basemap.crs and self.gdf_basemap.crs != "EPSG:4326":
                self.gdf_basemap = self.gdf_basemap.to_crs("EPSG:4326")
            
            # 简化几何形状以提高性能
            self.gdf_basemap['geometry'] = self.gdf_basemap['geometry'].simplify(
                tolerance=0.0005,  # 约 50 米
                preserve_topology=True
            )
            
            print(f"✓ 底图加载成功: {len(self.gdf_basemap)} 个要素")
        except Exception as e:
            print(f"✗ 加载底图失败: {e}")
            self.gdf_basemap = None
    
    def get_lod_level(self, zoom):
        """根据缩放级别获取对应的 LOD 级别"""
        for zoom_range, lod_level in LOD_ZOOM_MAPPING.items():
            if zoom_range[0] <= zoom < zoom_range[1]:
                return lod_level
        return 18  # 默认最高级别
    
    def _load_lod_level(self, lod_level):
        """动态加载指定 LOD 级别的数据"""
        if lod_level in self.lod_data:
            return self.lod_data[lod_level]
        
        print(f"动态加载 LOD {lod_level}...")
        
        pattern = os.path.join(SHP_DIR_LOD, f"*_zoom{lod_level}.shp")
        shp_files = glob.glob(pattern)
        
        if not shp_files:
            print(f"  警告: 没有找到 LOD {lod_level} 的文件，使用原始数据")
            return self.gdf_data
        
        gdfs = []
        total_filtered = 0
        
        for shp_file in shp_files:
            try:
                gdf = gpd.read_file(shp_file)
                if gdf.crs and gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                
                # 过滤掉 Unclassified
                if 'Func_Group' in gdf.columns:
                    original_count = len(gdf)
                    gdf = gdf[~gdf['Func_Group'].str.lower().isin(['unclassified'])].copy()
                    filtered_count = original_count - len(gdf)
                    total_filtered += filtered_count
                    
                    if len(gdf) > 0:
                        gdfs.append(gdf)
                else:
                    gdfs.append(gdf)
                    
            except Exception as e:
                print(f"  ✗ 加载 {shp_file} 失败: {e}")
        
        if gdfs:
            self.lod_data[lod_level] = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
            print(f"  ✓ LOD {lod_level} 加载完成: {len(self.lod_data[lod_level])} 个要素")
            if total_filtered > 0:
                print(f"  已过滤 Unclassified: {total_filtered} 个要素")
            return self.lod_data[lod_level]
        
        return self.gdf_data
    
    def get_data_for_zoom(self, zoom):
        """获取指定缩放级别的数据（懒加载）"""
        if not USE_LOD:
            return self.gdf_data
        
        lod_level = self.get_lod_level(zoom)
        
        # 懒加载：只在需要时加载
        return self._load_lod_level(lod_level)


# 全局数据加载器实例
data_loader = DataLoader()

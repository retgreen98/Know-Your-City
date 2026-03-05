"""检查所有 Func_Group 的值"""
import geopandas as gpd
import glob
import os

SHP_DIR = r"D:\AIProject\KNOW_YOUR_CITY\重分类数据"

print("=" * 60)
print("检查所有 Func_Group 值")
print("=" * 60)

shp_files = glob.glob(os.path.join(SHP_DIR, "*.shp"))

all_func_groups = set()

for shp_file in shp_files:
    try:
        gdf = gpd.read_file(shp_file)
        filename = os.path.basename(shp_file)
        
        if 'Func_Group' in gdf.columns:
            unique_values = gdf['Func_Group'].dropna().unique()
            print(f"\n文件: {filename}")
            print(f"  要素数: {len(gdf)}")
            print(f"  Func_Group 值:")
            for val in unique_values:
                print(f"    - {val}")
                all_func_groups.add(val)
        else:
            print(f"\n文件: {filename} - 没有 Func_Group 字段")
    except Exception as e:
        print(f"\n文件: {filename} - 读取失败: {e}")

print("\n" + "=" * 60)
print("所有唯一的 Func_Group 值:")
print("=" * 60)
for fg in sorted(all_func_groups):
    print(f"  '{fg}'")

print(f"\n总计: {len(all_func_groups)} 种类型")

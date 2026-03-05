"""
快速测试数据加载性能
"""

import time
from config import USE_LOD
from data_loader import DataLoader

print("=" * 60)
print("数据加载性能测试")
print("=" * 60)
print(f"USE_LOD: {USE_LOD}")
print("=" * 60)

# 测试数据加载
loader = DataLoader()

start_time = time.time()
print("\n开始加载数据...")

loader.load_all()

end_time = time.time()
elapsed = end_time - start_time

print("\n" + "=" * 60)
print(f"加载完成！耗时: {elapsed:.2f} 秒")
print("=" * 60)

# 显示加载的数据信息
if loader.gdf_data is not None:
    print(f"统计数据: {len(loader.gdf_data)} 个要素")
else:
    print("统计数据: 未加载")

if loader.gdf_display is not None:
    print(f"显示数据: {len(loader.gdf_display)} 个要素")
else:
    print("显示数据: 未加载")

if loader.gdf_districts is not None:
    print(f"选区数据: {len(loader.gdf_districts)} 个选区")
else:
    print("选区数据: 未加载")

if loader.gdf_admin_boundaries is not None:
    print(f"行政区: {len(loader.gdf_admin_boundaries)} 个行政区")
else:
    print("行政区: 未加载")

if USE_LOD:
    print(f"LOD 缓存: {len(loader.lod_data)} 个级别")
    for level, gdf in loader.lod_data.items():
        print(f"  LOD {level}: {len(gdf)} 个要素")

print("=" * 60)

# 性能建议
if elapsed > 10:
    print("\n⚠️ 警告: 加载时间过长！")
    print("\n建议：")
    print("1. 在 config.py 中设置 USE_LOD = False")
    print("2. 检查数据文件大小")
    print("3. 考虑减少数据量")
elif elapsed > 5:
    print("\n⚠️ 提示: 加载时间较长")
    print("建议启用 LOD 以提高性能")
else:
    print("\n✓ 加载速度良好！")

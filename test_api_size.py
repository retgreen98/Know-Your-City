"""
测试 API 响应大小
"""

import json
import sys
from flask import Flask
from routes import register_routes
from data_loader import data_loader

# 创建测试应用
app = Flask(__name__)
register_routes(app)

print("=" * 60)
print("API 响应大小测试")
print("=" * 60)

# 加载数据
print("\n加载数据...")
data_loader.load_all()

# 测试 /api/load_map
print("\n" + "=" * 60)
print("测试 /api/load_map")
print("=" * 60)

with app.test_client() as client:
    response = client.get('/api/load_map')
    data = response.get_json()
    
    # 计算大小
    json_str = json.dumps(data)
    size_bytes = len(json_str.encode('utf-8'))
    size_kb = size_bytes / 1024
    size_mb = size_kb / 1024
    
    print(f"响应大小: {size_bytes:,} 字节")
    print(f"         {size_kb:.2f} KB")
    print(f"         {size_mb:.2f} MB")
    
    # 分析各部分大小
    print("\n各部分大小:")
    for key, value in data.items():
        if key == 'admin_boundaries':
            continue  # 已移除
        
        part_str = json.dumps(value)
        part_size = len(part_str.encode('utf-8'))
        part_kb = part_size / 1024
        
        print(f"  {key}: {part_kb:.2f} KB")
    
    # 性能评估
    print("\n性能评估:")
    if size_mb > 10:
        print("  ❌ 太大！响应时间会很慢")
        print("  建议: 减少返回的数据量")
    elif size_mb > 5:
        print("  ⚠️ 较大，可能影响性能")
        print("  建议: 考虑优化")
    elif size_mb > 1:
        print("  ⚠️ 中等大小，可接受")
    else:
        print("  ✓ 大小合理，性能良好")

# 测试 /api/load_admin_boundaries
print("\n" + "=" * 60)
print("测试 /api/load_admin_boundaries")
print("=" * 60)

with app.test_client() as client:
    response = client.get('/api/load_admin_boundaries')
    
    if response.status_code == 200:
        data = response.get_json()
        
        json_str = json.dumps(data)
        size_bytes = len(json_str.encode('utf-8'))
        size_kb = size_bytes / 1024
        size_mb = size_kb / 1024
        
        print(f"响应大小: {size_bytes:,} 字节")
        print(f"         {size_kb:.2f} KB")
        print(f"         {size_mb:.2f} MB")
        
        if size_mb > 5:
            print("  ⚠️ 行政区边界较大，但异步加载不影响初始加载")
        else:
            print("  ✓ 大小合理")
    else:
        print(f"  ✗ 请求失败: {response.status_code}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)

"""
配置文件
"""

# ============================================
# 数据目录配置
# ============================================

# 参与统计的数据（原始数据，用于区域分析）
SHP_DIR_ANALYSIS = r"D:\AIProject\KNOW_YOUR_CITY\重分类数据"

# 仅显示的数据（不参与统计）
SHP_DIR_DISPLAY = r"D:\AIProject\KNOW_YOUR_CITY\仅显示"

# LOD（Level of Detail）数据目录
SHP_DIR_LOD = r"D:\AIProject\KNOW_YOUR_CITY\LOD数据"

# 选区边界文件路径
DISTRICT_SHP = r"D:\AIProject\KNOW_YOUR_CITY\2019区议会选区分界.shp"

# 行政区分界文件路径
ADMIN_BOUNDARY_SHP = r"D:\AIProject\KNOW_YOUR_CITY\仅显示\行政区分界.shp"

# 底图文件路径（香港陆地轮廓）
BASEMAP_SHP = r"D:\AIProject\KNOW_YOUR_CITY\仅显示\香港陆地.shp"

# ============================================
# LOD 配置
# ============================================

# 是否启用 LOD（Level of Detail）
# True: 使用 LOD 数据（需要先运行 preprocess_lod.py）
# False: 使用原始数据（如果 LOD 加载有问题，可以临时禁用）
USE_LOD = True  # 临时禁用，测试是否是 LOD 的问题

# LOD 缩放级别映射
LOD_ZOOM_MAPPING = {
    # zoom 范围 -> LOD 级别
    (0, 9): 8,
    (9, 11): 10,
    (11, 13): 12,
    (13, 15): 14,
    (15, 17): 16,
    (17, 20): 18,
}

# ============================================
# Func_Group 颜色映射
# ============================================

FUNC_GROUP_COLORS = {
    'Residential': '#F3D1C4',  # 居住 - 红色
    'Commercial / Retail': '#F2C6A0',  # 商业/零售 - 青色
    'Industrial': '#B8C2CC',  # 工业 - 灰色
    'Transportation': '#A3B9BF',  # 交通 - 橙色
    'Recreation / Open Space': '#CDE8B0',  # 休闲/开放空间 - 绿色
    'Education': '#BFD8E6',  # 教育 - 蓝色
    'Institutional / Public': '#EAD8B1',  # 机构/公共 - 紫色
    'Utilities': '#E5E1A8',  # 公用设施 - 橙红
    'Agricultural / Rural': '#A8D5BA',  # 农业/乡村 - 黄色
    'Natural Features': '#A8DADC',  # 自然特征 - 深绿
    'reservior': '#45b7d1',  # 水库 - 浅蓝
}

# ============================================
# 服务器配置
# ============================================

DEBUG = True
PORT = 5000
HOST = '127.0.0.1'

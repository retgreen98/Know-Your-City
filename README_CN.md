# Know Your City - 交互式地图分析平台

基于 Flask + Leaflet.js 的城市功能区可视化与分析系统。

## 项目架构

```
KIRO_Project/
├── app.py                      # 应用入口
├── config.py                   # 配置文件
├── data_loader.py              # 数据加载模块
├── routes.py                   # API 路由
├── preprocess_lod.py           # LOD 数据预处理工具
├── requirements.txt            # Python 依赖
├── static/                     # 前端资源
│   ├── main.js                 # 主入口
│   ├── map-init.js             # 地图初始化
│   ├── map-renderer.js         # 地图渲染
│   ├── map-labels.js           # 标签显示
│   ├── data-loader.js          # 数据加载
│   ├── feature-modes.js        # 功能模式
│   ├── ui-controls.js          # UI 控制
│   └── style.css               # 样式
└── templates/
    └── index.html              # HTML 模板
```

## 后端文件说明

### `app.py`
**应用程序入口**
- 初始化 Flask 应用
- 配置 HTTP 压缩（gzip）
- 注册路由
- 启动 Web 服务器
- 显示启动信息

### `config.py`
**配置文件**
- 定义数据文件路径（Shapefile、GeoJSON）
- LOD（Level of Detail）缩放级别配置
- 功能区颜色映射
- 服务器参数（HOST、PORT、DEBUG）

### `data_loader.py`
**数据加载与管理**
- 加载多层级 LOD 数据（zoom 8-18）
- 加载选区和行政区边界数据
- 加载底图数据（道路、水路、铁路等）
- 提供数据查询接口
- 根据缩放级别动态返回相应精度的数据
- 过滤 Unclassified 要素

### `routes.py`
**API 路由定义**

提供以下 API 接口：

- `GET /` - 主页面
- `GET /api/load_map` - 加载地图初始数据（边界、图例、标签）
- `GET /api/load_admin_boundaries` - 加载行政区边界（简化版）
- `POST /api/load_viewport` - 根据视口和缩放级别加载数据
- `POST /api/analyze_region` - 分析多边形/矩形区域的功能区分布
- `POST /api/analyze_polyline_nodes` - 分析折线节点的缓冲区功能区
- `GET /api/get_metro_lines` - 从 OSM Overpass API 获取香港地铁线路

### `preprocess_lod.py`
**LOD 数据预处理工具**
- 生成不同缩放级别的优化数据
- 合并小面积要素
- 简化几何形状
- 减少数据量，提升性能

## 前端文件说明

### `templates/index.html`
**HTML 模板**
- 定义页面结构
- 地图容器
- 控制按钮（Check / Dig In）
- 信息面板
- 图例
- 加载动画和进度条

### `static/main.js`
**主入口文件**
- 初始化应用
- 协调各模块
- 设置事件监听
- 启动地图加载流程

### `static/map-init.js`
**地图初始化**
- 创建 Leaflet 地图实例
- 设置底图图层（OpenStreetMap）
- 配置地图参数（中心点、缩放级别、最大/最小缩放）
- 添加比例尺控件
- 设置地图事件监听（moveend、zoomend）

### `static/map-renderer.js`
**地图渲染**
- 渲染 GeoJSON 数据到地图
- 应用功能区颜色样式
- 处理要素点击事件
- 管理图层显示/隐藏
- 添加行政区边界

### `static/map-labels.js`
**标签显示**
- 渲染选区标签（批量优化）
- 渲染行政区标签
- 根据缩放级别控制标签显示/隐藏
- 标签样式和位置管理

### `static/data-loader.js`
**数据加载**
- 从后端 API 获取数据
- 处理视口变化
- 实现 LOD 数据加载
- 管理加载状态
- 显示/隐藏进度条

### `static/feature-modes.js`
**功能模式管理**

实现两种交互模式：

**Check 模式（查看模式）**
- 点击要素查看详细信息
- 显示功能区、类别、名称等属性

**Dig In 模式（探索模式）**
- 绘制多边形/矩形分析区域功能区分布
- 绘制折线分析沿线节点的功能区（500m 缓冲区）
- 从 OSM 获取并选择地铁线路进行分析
- 显示分析结果和统计数据
- 支持返回线路选择列表
- 清除所有绘图和分析结果

### `static/ui-controls.js`
**UI 控制**
- 管理按钮状态（active/inactive）
- 显示/隐藏信息面板
- 显示状态消息
- 控制加载动画
- 管理图例显示
- 进度条控制

### `static/style.css`
**样式定义**
- 地图和控件样式
- 信息面板样式
- 按钮和工具栏样式
- 图例样式
- 动画效果
- 响应式布局

## 主要功能

### 1. 多层级数据可视化（LOD）
- 根据缩放级别自动加载相应精度的数据
- zoom 8-10: 高度简化数据
- zoom 12-14: 中等精度数据
- zoom 16-18: 高精度原始数据
- 优化性能，减少数据传输量

### 2. 功能区查看（Check 模式）
- 点击地图要素查看详细信息
- 显示功能区类型、类别、名称等属性

### 3. 区域分析（Dig In 模式）
- 绘制多边形或矩形选择区域
- 统计区域内各功能区的数量和占比
- 显示区域名称（选区）
- 按占比排序显示结果

### 4. 折线缓冲区分析
- 手动绘制折线
- 为每个节点创建 500m 缓冲区
- 分析每个节点周边的主要功能区
- 显示地名和功能区信息
- 可视化节点和缓冲区

### 5. 地铁线路分析
- 从 OSM Overpass API 获取香港地铁线路
- 显示线路列表（包括站点数量）
- 选择线路进行分析
- 显示沿线各站点的功能区分布
- 支持返回线路列表
- 在地图上显示线路和站点

## 技术栈

### 后端
- **Python 3.x**
- **Flask** - Web 框架
- **Flask-Compress** - HTTP 压缩
- **GeoPandas** - 地理数据处理
- **Shapely** - 几何运算
- **Requests** - HTTP 请求

### 前端
- **Leaflet.js** - 地图库
- **Leaflet.Draw** - 绘图工具
- **GeoJSON-VT** - 矢量切片
- **Leaflet.VectorGrid** - 矢量网格渲染

## 安装和运行

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 配置数据路径
编辑 `config.py`，设置 Shapefile 数据路径

### 3. 生成 LOD 数据（可选但推荐）
```bash
python preprocess_lod.py
```

### 4. 启动应用
```bash
python app.py
```

### 5. 访问应用
打开浏览器访问 `http://127.0.0.1:5000`

## 数据要求

### Shapefile 格式
- **必须包含** `Func_Group` 字段（功能区类型）
- 建议包含 `fclass` 字段（类别）
- 建议包含 `name` 字段（名称）
- 坐标系统：WGS84 (EPSG:4326)

### LOD 数据结构
```
data/lod_data/
├── 文件名_zoom8.shp
├── 文件名_zoom10.shp
├── 文件名_zoom12.shp
├── 文件名_zoom14.shp
├── 文件名_zoom16.shp
└── 文件名_zoom18.shp
```

## 性能优化

1. **LOD 系统** - 根据缩放级别加载不同精度的数据
2. **视口裁剪** - 只加载可见区域的数据
3. **几何简化** - 低缩放级别使用简化的几何形状
4. **要素合并** - 合并小面积要素减少数据量
5. **HTTP 压缩** - 使用 gzip 压缩响应数据
6. **批量标签渲染** - 优化标签显示性能
7. **动态数据加载** - 按需加载 LOD 数据

## 许可证

MIT License

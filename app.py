"""
在线地图平台 - 主程序

模块说明：
- config.py: 配置文件
- data_loader.py: 数据加载模块
- routes.py: API 路由模块
- app.py: 主程序（本文件）
"""

from flask import Flask
from flask_compress import Compress
from config import DEBUG, PORT, HOST, USE_LOD
from data_loader import data_loader
from routes import register_routes

# 创建 Flask 应用
app = Flask(__name__)

# 启用 HTTP 压缩（gzip）
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/javascript',
    'application/json', 'application/javascript'
]
app.config['COMPRESS_LEVEL'] = 6  # 压缩级别 1-9，6 是平衡点
app.config['COMPRESS_MIN_SIZE'] = 500  # 只压缩大于 500 字节的响应
Compress(app)

# 注册路由
register_routes(app)

def main():
    """主函数"""
    import os
    
    # 只在主进程中加载数据（避免 reloader 重复加载）
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print("=" * 60)
        print("Know Your City - Interactive Map Platform")
        print("=" * 60)
        
        # 显示配置信息
        if USE_LOD:
            print("✓ LOD Mode: Enabled (zoom-based data optimization)")
        else:
            print("✓ Standard Mode: Using original data")
        
        print("=" * 60)
        print("\nInitializing...")
    
    # 加载数据（只在 reloader 进程中执行一次）
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        data_loader.load_all()
        print("\n" + "=" * 60)
        print(f"Server running: http://{HOST}:{PORT}")
        print("Press Ctrl+C to stop")
        print("=" * 60 + "\n")
    
    # 启动服务器
    app.run(debug=DEBUG, host=HOST, port=PORT, use_reloader=DEBUG)

if __name__ == '__main__':
    main()

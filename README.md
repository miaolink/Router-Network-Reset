# Router Network Reset

> 一键重置路由器网络，实时监控流量、连接、内存等状态，支持自定义IP、端口和Token，界面美观，适合自用和二次开发。

![b6c2c5a8faf7e0d7093fe9c1defc677b](https://github.com/user-attachments/assets/5cf350f1-c9d9-45d8-b1c1-60ddd8c97118)
![bada1e6fef23236ff9bf3ac32da4e7bb](https://github.com/user-attachments/assets/cfee088a-91a9-4323-af6b-e91bbbe66c52)



## 功能特性
- 实时流量监控（上传/下载速率折线图，单位自适应）
- 连接数、内存、代理链等状态一目了然
- 一键重置网络连接
- 连接详情支持断开单个连接
- 支持明暗主题切换
- 支持自定义路由器IP、端口、Token
- 响应式美观UI，适合浏览器插件弹窗

## 安装与使用
1. 克隆本项目到本地：
   ```bash
   git clone https://github.com/miaolink/Router-Network-Reset.git
   ```
2. 打开 Chrome 扩展管理页面，开启"开发者模式"
3. 点击"加载已解压的扩展程序"，选择本项目文件夹
4. 在插件弹窗中设置路由器信息（IP、端口、Token）
5. 即可实时监控和管理你的路由器网络

## 目录结构
```
├── popup.html         # 主界面
├── popup.js           # 前端逻辑
├── echarts.min.js     # 图表库（本地）
├── manifest.json      # 插件配置
├── pwa-192x192.png    # 图标
├── README.md          # 项目说明
└── ...
```

## 界面预览
![cd14c7016439685825e0c2770a9b61a6](https://github.com/user-attachments/assets/d9f6f4da-7d6d-45a0-b2ed-cd8afb607159)
![a6ce0e5827bceef430146c2f6dde4095](https://github.com/user-attachments/assets/0326801f-ebdc-4f17-9f7f-5a4b5dd4388f)



## 参与贡献
欢迎提交PR、Issue，或自定义开发！

## License
MIT 

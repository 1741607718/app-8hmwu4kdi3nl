# 内网API代理服务部署指南

## 概述
由于内网API地址（api.wzbc.edu.cn）无法从公网访问，我们设计了一个专门的代理服务来解决这个问题。此代理服务部署在内网环境中，可以访问内网API并将数据提供给前端应用。

## 目录结构
```
internal-proxy/
├── package.json          # 项目依赖配置
├── tsconfig.json         # TypeScript配置
├── src/
│   └── index.ts          # 主服务文件
└── dist/                 # 编译后的输出目录
```

## 安装和部署

### 1. 安装依赖
```bash
cd internal-proxy
npm install
```

### 2. 编译TypeScript
```bash
npm run build
```

### 3. 启动服务
```bash
npm start
```

或者使用开发模式（带热重载）：
```bash
npm run dev
```

## API端点

### 车辆数据API
- 端点: `GET /api/vehicle`
- 参数:
  - `startDate` (可选): 开始日期，格式为 "YYYY-MM-DD"
  - `endDate` (可选): 结束日期，格式为 "YYYY-MM-DD"
- 示例: `http://localhost:3001/api/vehicle?startDate=2025-01-01&endDate=2025-01-31`

### 消防设备数据API
- 端点: `GET /api/fire-safety`
- 参数:
  - `startDate` (可选): 开始日期，格式为 "YYYY-MM-DD"
  - `endDate` (可选): 结束日期，格式为 "YYYY-MM-DD"
- 示例: `http://localhost:3001/api/fire-safety?startDate=2025-01-01&endDate=2025-01-31`

### 健康检查端点
- 端点: `GET /health`
- 返回服务状态和时间戳

## 配置前端环境变量

在前端项目中，需要配置以下环境变量：

```bash
# .env 文件
VITE_INTERNAL_PROXY_URL=http://your-proxy-server:3001
```

如果没有设置此环境变量，默认使用 `http://localhost:3001`。

## 部署到内网服务器

### 1. 在内网服务器上部署
将 `internal-proxy` 目录复制到内网服务器上，确保该服务器能够访问内网API。

### 2. 使用PM2进行进程管理（推荐）
```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name "internal-api-proxy"

# 设置开机自启
pm2 startup
pm2 save
```

### 3. 配置反向代理（可选）
如果需要使用域名访问，可以配置Nginx反向代理：

```nginx
server {
    listen 80;
    server_name proxy.your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 安全考虑

1. **访问控制**: 在生产环境中，建议添加访问控制机制，如API密钥验证
2. **HTTPS**: 生产环境应使用HTTPS加密传输
3. **防火墙**: 限制对代理服务的访问，只允许前端应用服务器访问

## 故障排除

### 1. 连接超时
检查代理服务器是否能访问内网API地址。

### 2. API返回错误
检查API配置信息（applyId, secretKey）是否正确。

### 3. 前端无法访问代理服务
确认VITE_INTERNAL_PROXY_URL环境变量配置正确，且网络连通性正常。

## 维护

定期检查服务日志，监控API调用成功率和响应时间。根据需要调整超时设置和错误处理逻辑。
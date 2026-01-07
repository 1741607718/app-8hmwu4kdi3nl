# 项目启动说明

## 启动内部代理服务和前端开发服务器

由于终端配置问题，您需要手动启动内部代理服务和前端开发服务器。

### 方法一：使用 npm 脚本（推荐）

1. 首先，启动内部代理服务：
```bash
cd /home/lw/projects/app-8hmwu4kdi3nl
npm run proxy
```

2. 在另一个终端窗口中，启动前端开发服务器：
```bash
cd /home/lw/projects/app-8hmwu4kdi3nl
npm run dev
```

### 方法二：使用并发启动脚本

1. 安装依赖：
```bash
cd /home/lw/projects/app-8hmwu4kdi3nl
npm install concurrently
```

2. 使用并发脚本启动两个服务：
```bash
cd /home/lw/projects/app-8hmwu4kdi3nl
npm run dev:all
```

### 方法三：使用启动脚本

1. 使用提供的启动脚本：
```bash
cd /home/lw/projects/app-8hmwu4kdi3nl
node start-dev-server.js
```

## 确保内部代理服务正常运行

内部代理服务应该运行在端口 3003 上，提供以下API端点：

- 车辆API: `http://localhost:3003/api/vehicle`
- 车辆登记API: `http://localhost:3003/api/vehicle-registration`
- 访客API: `http://localhost:3003/api/visitor`
- 所有车辆登记数据API: `http://localhost:3003/api/vehicle-registration-all`

## 常见问题

1. 如果访问 `http://localhost:3003/health` 返回正常响应，说明代理服务已启动成功。

2. 如果出现 `ERR_CONNECTION_REFUSED` 错误，请确认内部代理服务正在运行。

3. 确保已正确安装依赖：
```bash
npm install
cd internal-proxy
npm install
```
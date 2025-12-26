# 消防安全一张表 - 部署文档

## 系统概述

消防安全一张表是一个基于Web的消防安全数据展示平台，提供车辆管理、人员管理、消防设备、安保监控等多维度安全信息的统一展示和管理。

## 技术架构

### 前端技术栈
- React 18 + TypeScript
- Vite (构建工具)
- shadcn/ui + Tailwind CSS (UI框架)
- React Router v6 (路由管理)
- Recharts (数据可视化)
- date-fns (日期处理)

### 后端服务
- Supabase (BaaS平台)
  - PostgreSQL 数据库
  - 用户认证系统
  - 行级安全策略 (RLS)

## 环境要求

### 开发环境
- Node.js >= 20.x
- npm >= 10.x
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

### 生产环境
- 静态文件服务器 (Nginx, Apache, CDN等)
- Supabase 项目 (云端或自托管)

## 快速部署

### 1. 在线部署 (推荐)

系统已配置好所有必要的环境变量和数据库，可以直接使用。

**访问地址**: 由部署平台提供

**首次使用步骤**:
1. 访问系统登录页面
2. 点击"注册"标签
3. 输入用户名和密码（首个注册用户自动成为管理员）
4. 登录系统，系统会自动初始化模拟数据

### 2. 本地开发部署

#### 步骤1: 获取代码
```bash
# 解压代码包到本地目录
cd fire-safety-platform
```

#### 步骤2: 安装依赖
```bash
npm install
```

#### 步骤3: 启动开发服务器
```bash
npm run dev -- --host 127.0.0.1
```

#### 步骤4: 访问系统
打开浏览器访问: `http://127.0.0.1:5173`

### 3. 生产环境部署

#### 步骤1: 构建生产版本
```bash
npm run build
```

构建完成后，会在项目根目录生成 `dist` 文件夹。

#### 步骤2: 部署到服务器

**使用 Nginx**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**使用 Apache**:
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist

    <Directory /path/to/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # 启用 URL 重写
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

## 数据库配置

### Supabase 配置

系统已自动配置 Supabase 连接，环境变量存储在 `.env` 文件中：

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 数据库表结构

系统包含以下数据表：

1. **profiles** - 用户配置表
   - 存储用户信息、角色、权限
   - 首个用户自动设为管理员

2. **vehicle_data** - 车辆数据表
   - 存储车辆通行记录
   - 支持历史数据查询

3. **fire_equipment_data** - 消防设备数据表
   - 存储设备检测记录
   - 设备状态监控

4. **personnel_stats** - 人员统计表
   - 人员数量统计
   - 访客数据记录

5. **security_stats** - 安保统计表
   - 监控设备状态
   - 案事件记录

6. **dormitory_stats** - 宿管统计表
   - 住宿人数统计
   - 归宿情况记录

### 数据库迁移

数据库结构已通过 Supabase Migration 自动创建，无需手动执行 SQL。

## 外部API配置

### 车辆管理API
- **接口地址**: `https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC`
- **Apply ID**: `40664926031250432`
- **Secret Key**: `6bbfe313481a41d7882e7db89a467b7d`

### 消防安全API
- **接口地址**: `https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz`
- **Apply ID**: `40664926031250432`
- **Secret Key**: `6bbfe313481a41d7882e7db89a467b7d`

配置文件位置: `src/services/externalApi.ts`

如需修改API配置，请编辑该文件中的配置常量。

## 用户管理

### 角色说明

**管理员 (admin)**:
- 查看所有数据
- 导出数据
- 管理用户权限
- 访问权限管理页面

**普通用户 (user)**:
- 查看所有数据
- 需授权才能导出数据
- 无法管理其他用户

### 权限管理

管理员可以在"权限管理"页面进行以下操作：
1. 查看所有用户列表
2. 修改用户角色（管理员/普通用户）
3. 授予或取消数据导出权限

### 测试账号

系统提供以下测试账号（需先注册）：
- 管理员: `admin` / `123456`
- 普通用户: `user` / `123456`

## 功能测试

### 测试清单

- [ ] 用户注册功能
- [ ] 用户登录功能
- [ ] 数据总览页面
- [ ] 车辆管理模块
  - [ ] 数据查询
  - [ ] 图表展示
  - [ ] 数据导出
- [ ] 消防安全模块
  - [ ] 设备状态查看
  - [ ] 统计图表
- [ ] 人员管理模块
- [ ] 安保监控模块
- [ ] 宿管数据模块
- [ ] 权限管理功能（管理员）
  - [ ] 用户列表
  - [ ] 角色修改
  - [ ] 权限授予

### 性能测试

建议测试指标：
- 页面加载时间 < 2秒
- 数据查询响应 < 1秒
- 图表渲染流畅
- 移动端适配良好

## 监控与维护

### 日志查看

**浏览器控制台**:
- 打开浏览器开发者工具 (F12)
- 查看 Console 标签页
- 查看 Network 标签页（API请求）

**Supabase 日志**:
- 登录 Supabase 控制台
- 查看 Database 日志
- 查看 Auth 日志

### 常见问题排查

**问题1: 登录后白屏**
- 检查浏览器控制台错误
- 确认 Supabase 连接正常
- 清除浏览器缓存重试

**问题2: 数据不显示**
- 检查网络请求是否成功
- 确认用户已登录
- 查看数据库是否有数据

**问题3: 导出功能无法使用**
- 确认用户有导出权限
- 检查浏览器是否阻止下载
- 查看控制台错误信息

## 安全建议

### 生产环境安全配置

1. **启用 HTTPS**
   - 使用 SSL/TLS 证书
   - 强制 HTTPS 访问

2. **配置 CORS**
   - 在 Supabase 中配置允许的域名
   - 限制 API 访问来源

3. **定期备份**
   - 定期备份 Supabase 数据库
   - 保存配置文件备份

4. **密码策略**
   - 要求强密码
   - 定期更换密码
   - 启用双因素认证（如需要）

5. **监控异常**
   - 监控异常登录
   - 监控 API 调用频率
   - 设置告警机制

## 升级与扩展

### 版本升级

```bash
# 更新依赖
npm update

# 重新构建
npm run build
```

### 功能扩展

**添加新模块**:
1. 在 `src/pages/` 创建新页面组件
2. 在 `src/routes.tsx` 注册路由
3. 在 `MainLayout.tsx` 添加导航项
4. 如需数据库，在 Supabase 创建新表

**集成 CAS 认证**:
1. 修改 `src/contexts/AuthContext.tsx`
2. 添加 CAS OAuth 2.0 流程
3. 配置回调地址

## 技术支持

### 文档资源
- React 官方文档: https://react.dev
- Supabase 文档: https://supabase.com/docs
- shadcn/ui 文档: https://ui.shadcn.com
- Tailwind CSS 文档: https://tailwindcss.com

### 联系方式
如有问题，请联系技术支持团队。

---

**文档版本**: 1.0  
**最后更新**: 2025-12-26  
**适用版本**: 消防安全一张表 v1.0

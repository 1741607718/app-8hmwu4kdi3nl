# Supabase Edge Function 部署说明

## 问题描述
CAS 统一身份认证功能出现 `net::ERR_NAME_NOT_RESOLVED` 错误，导致无法调用 Supabase Edge Function。

## 解决方案

### 1. 确保安装 Supabase CLI
```bash
# 安装 Supabase CLI
npm install -g supabase
```

### 2. 检查当前部署状态
```bash
# 检查部署状态
pnpm check:deploy
```

### 3. 登录 Supabase 项目
```bash
supabase login
```

### 4. 链接到你的 Supabase 项目
```bash
# 在项目根目录下执行
supabase link --project-ref ggpysmxalhbwaebdxfah
```

### 5. 部署 Edge Function
```bash
# 部署 cas-exchange-token 函数
supabase functions deploy cas-exchange-token
```

### 6. 设置环境变量（密钥）- **重要**
Edge Function 中使用的环境变量名称与前端不同：

```bash
# CAS OAuth2.0 配置
supabase secrets set OAUTH_SERVER_URL="https://cas.wzbc.edu.cn"
supabase secrets set OAUTH_CLIENT_ID="eclBK03n7FUfSlJi"
supabase secrets set OAUTH_CLIENT_SECRET="5MVevItUIigYVWptOO3D7Q"
supabase secrets set OAUTH_REDIRECT_URI="https://fsif.wzbc.edu.cn/auth/callback"

# Supabase 配置
supabase secrets set SUPABASE_URL="https://ggpysmxalhbwaebdxfah.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHlzbXhhbGhid2FlYmR4ZmFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc4MDI5MiwiZXhwIjoyMDgyMzU2MjkyfQ.I9xclcqhSVPf5LMomP5cShipOMJsV3PKtDjELMr8zpQ"
```

### 7. 更新前端环境变量
确保 `.env` 文件包含以下变量：
```env
VITE_SUPABASE_URL=https://ggpysmxalhbwaebdxfah.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHlzbXhhbGhid2FlYmR4ZmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODAyOTIsImV4cCI6MjA4MjM1NjI5Mn0.q_HOXswp2hmUnqq32jxD-1J-4qpHUYyX23Yn3y2R1jg
VITE_CAS_CLIENT_ID=eclBK03n7FUfSlJi
VITE_CAS_CLIENT_SECRET=5MVevItUIigYVWptOO3D7Q
VITE_CAS_SERVER_URL=https://cas.wzbc.edu.cn
VITE_CAS_CALLBACK_URL=https://fsif.wzbc.edu.cn/auth/callback
```

### 8. 重新部署函数（如果需要）
```bash
supabase functions deploy cas-exchange-token --no-verify-jwt
```

## 故障排除

### 检查函数状态
```bash
pnpm check:deploy
# 或
supabase functions list
```

### 查看函数日志
```bash
supabase functions logs cas-exchange-token
```

### 验证环境变量
确保在 Supabase 项目仪表板的 Settings > Environment variables 中也配置了相关变量。

## 注意事项

1. 确保域名解析正常，检查网络连接
2. 确保 CAS 服务器 URL 可访问
3. JWT 验证可能需要禁用（根据需要添加 `--no-verify-jwt` 参数）
4. 检查防火墙和网络策略是否允许外部请求
5. 如果遇到旧 URL 缓存问题，请参考 FIX_ISSUE.md 文档
6. 部署后需要几分钟时间才能生效
7. **重要**：Edge Function 使用的环境变量名称与前端不同，确保在 Supabase 中设置了正确的变量名称
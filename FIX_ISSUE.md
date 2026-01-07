# 修复旧 URL 缓存问题

## 问题描述
您的 Supabase 项目 URL 已更新为 `https://ggpysmxalhbwaebdxfah.supabase.co`，但应用仍在尝试访问旧的 URL `rimapofcyhccgjgwaukw.supabase.co`。

## 根本原因
这个问题通常是由于以下原因之一：
1. 浏览器缓存了旧的 JavaScript 构建文件
2. Vite 开发服务器缓存了旧的环境变量
3. 旧的构建产物仍在使用
4. 环境变量配置不正确或未正确加载
5. Supabase Edge Function 未部署到当前项目（已确认函数已部署）
6. **最关键的：构建缓存或浏览器缓存导致旧代码仍在运行**

## 解决方案

### 1. 使用检查工具验证环境
```bash
# 检查当前环境变量配置
pnpm check:env

# 检查 Supabase 部署状态
pnpm check:deploy
```

### 2. 彻底清理开发环境缓存
```bash
# 使用清理脚本
pnpm clean:cache

# 额外清理可能的缓存
rm -rf node_modules/.vite/deps
rm -rf .vite
```

### 3. 确保 Supabase Edge Function 已正确部署
根据检查结果，函数已正确部署到项目中。

### 4. 环境变量配置
确保您的 `.env` 文件包含正确的配置：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://ggpysmxalhbwaebdxfah.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHlzbXhhbGhid2FlYmR4ZmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODAyOTIsImV4cCI6MjA4MjM1NjI5Mn0.q_HOXswp2hmUnqq32jxD-1J-4qpHUYyX23Yn3y2R1jg

# 注意：SUPABASE_SERVICE_ROLE_KEY 不应以 VITE_ 开头，因为它在客户端代码中暴露是不安全的
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHlzbXhhbGhid2FlYmR4ZmFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc4MDI5MiwiZXhwIjoyMDgyMzU2MjkyfQ.I9xclcqhSVPf5LMomP5cShipOMJsV3PKtDjELMr8zpQ

# CAS 统一身份认证配置
VITE_CAS_CLIENT_ID=eclBK03n7FUfSlJi
VITE_CAS_CLIENT_SECRET=5MVevItUIigYVWptOO3D7Q
VITE_CAS_SERVER_URL=https://cas.wzbc.edu.cn
VITE_CAS_CALLBACK_URL=https://fsif.wzbc.edu.cn/auth/callback
```

### 5. 完整重启开发服务器
```bash
# 停止当前的开发服务器 (Ctrl+C)
# 彻底清理缓存
rm -rf node_modules/.vite
pnpm clean:cache
# 重新启动
pnpm dev
```

### 6. 强制浏览器刷新
**这是最关键的步骤：**
- 完全关闭浏览器标签页或浏览器窗口
- 打开新的无痕/隐私模式窗口
- 访问开发服务器地址
- 或者使用快捷键组合：Ctrl+Shift+Delete (Windows) 或 Cmd+Shift+Delete (Mac) 清除浏览器缓存

### 7. 验证环境变量是否正确加载
启动开发服务器后，在浏览器中打开开发者工具，检查控制台输出，确认以下信息：
- `Supabase 配置检查:` 日志显示正确的 URL
- `当前 URL 包含正确的项目 ID` 提示
- 不再显示 `警告: 当前 Supabase URL 可能不是最新的项目 URL`

### 8. 部署到生产环境（如果适用）
如果您已经构建了生产版本，请重新构建：

```bash
pnpm build
```

## 验证修复
1. 检查浏览器控制台，确认显示的 URL 是新的 `ggpysmxalhbwaebdxfah.supabase.co`
2. 运行 `pnpm check:env` 确认环境变量正确
3. 运行 `pnpm check:deploy` 确认函数已部署
4. 尝试访问 CAS 登录，确认不再出现域名解析错误
5. 检查网络标签，确认请求发送到正确的域名

## 重要提示
- 环境变量只在构建时被注入，因此需要重启开发服务器或重新构建才能生效
- 浏览器可能会缓存旧的 JavaScript 文件，因此清除缓存很重要
- 确保所有环境变量文件（.env, .env.local 等）都使用了正确的 URL
- 使用 `pnpm clean:cache` 和 `pnpm check:env` 脚本来诊断和清理问题
- 注意：只有需要在客户端访问的变量才应使用 `VITE_` 前缀，服务端密钥不应在客户端暴露
- Supabase Edge Function 必须部署到正确的项目才能访问
- 部署后需要几分钟时间才能生效
- 根据检查结果，函数已正确部署，问题可能在环境变量加载
- **最关键：浏览器缓存可能导致旧代码继续运行，必须强制刷新或使用无痕模式**
# Supabase Edge Function 问题诊断

## 问题现象
- 前端报错：`net::ERR_NAME_NOT_RESOLVED`
- Edge Function 日志显示 200 状态
- URL: `https://rimapofcyhccgjgwaukw.supabase.co/functions/v1/cas-exchange-token`

## 可能原因分析

### 1. 项目 ID 不存在或无效
URL `rimapofcyhccgjgwaukw.supabase.co` 中的 `rimapofcyhccgjgwaukw` 是 Supabase 项目 ID，如果该项目不存在或已删除，将导致域名解析失败。

### 2. 项目未正确部署函数
即使项目存在，如果 Edge Function 未部署，也会导致此错误。

### 3. 旧的 URL 缓存问题（常见情况）
您的当前项目 URL 是 `https://ggpysmxalhbwaebdxfah.supabase.co`，但代码仍在使用旧的 URL `rimapofcyhccgjgwaukw.supabase.co`。这通常是因为：
- 浏览器缓存了旧的构建文件
- Vite 开发服务器缓存了旧的环境变量
- 旧的构建产物仍在使用
- Supabase Edge Function 未部署到当前项目

## 诊断步骤

### 1. 检查环境变量配置
确保 `.env` 文件包含正确的配置：

```env
VITE_SUPABASE_URL=https://ggpysmxalhbwaebdxfah.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. 验证项目是否真实存在
- 访问 Supabase 仪表板 (https://app.supabase.com)
- 确认项目 ID `ggpysmxalhbwaebdxfah` 对应的项目是否存在

### 3. 检查函数部署状态
运行以下命令检查函数是否已部署：

```bash
pnpm check:deploy
```

### 4. 检查函数部署状态详细步骤
如果上述命令不可用，手动检查：

```bash
# 检查 Supabase CLI 是否安装
supabase --version

# 检查函数列表
supabase functions list

# 检查特定函数状态
supabase functions logs cas-exchange-token
```

### 5. 重新部署函数（如果项目存在）
```bash
# 部署函数
supabase functions deploy cas-exchange-token --project-ref ggpysmxalhbwaebdxfah

# 设置环境变量
supabase secrets set --project-ref ggpysmxalhbwaebdxfah \
  CAS_CLIENT_ID="eclBK03n7FUfSlJi" \
  CAS_CLIENT_SECRET="5MVevItUIigYVWptOO3D7Q" \
  CAS_SERVER_URL="https://cas.wzbc.edu.cn" \
  CAS_CALLBACK_URL="https://fsif.wzbc.edu.cn/auth/callback" \
  SUPABASE_URL="https://ggpysmxalhbwaebdxfah.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHlzbXhhbGhid2FlYmR4ZmFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc4MDI5MiwiZXhwIjoyMDgyMzU2MjkyfQ.I9xclcqhSVPf5LMomP5cShipOMJsV3PKtDjELMr8zpQ"
```

## 解决方案

### 方案 1：解决旧 URL 缓存问题（最可能的情况）
1. 清理开发环境缓存
2. 确保使用正确的环境变量
3. 重启开发服务器
4. 验证并部署 Supabase Edge Function

### 方案 2：项目存在但函数未部署
按上述步骤重新部署函数

### 方案 3：项目不存在
1. 在 Supabase 仪表板创建新项目
2. 获取新项目的 URL 和 anon key
3. 更新环境变量
4. 部署函数

### 方案 4：DNS 或网络问题
- 检查本地 DNS 设置
- 尝试使用不同网络连接
- 清除 DNS 缓存

## 验证步骤
部署完成后，通过以下方式验证：
1. 运行 `pnpm check:deploy` 确认函数已部署
2. 在浏览器中访问 `https://ggpysmxalhbwaebdxfah.supabase.co/functions/v1/cas-exchange-token`（应返回 405 Method Not Allowed 而不是 DNS 错误）
3. 在浏览器控制台检查网络标签，确认请求是否正常发送
4. 检查 Supabase 仪表板中的函数日志

## 重要提示
- 确保项目 ID 在所有配置中保持一致
- 重新部署函数后需要几分钟时间才能生效
- 如果使用了自定义域名，确保 DNS 设置正确
- 环境变量只在构建时被注入，因此需要重启开发服务器或重新构建才能生效
- 部署 Edge Function 后必须设置相应的环境变量
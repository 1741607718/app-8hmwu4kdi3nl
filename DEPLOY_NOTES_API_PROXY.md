# Supabase API 代理函数部署说明

## 问题描述
前端直接调用外部API（`api.wzbc.edu.cn`）时出现CORS错误，因为外部API没有设置适当的CORS头。

## 解决方案
创建一个Supabase Edge Function作为API代理，绕过浏览器的CORS限制。

## 部署步骤

### 1. 部署Edge Function
```bash
# 部署API代理函数
supabase functions deploy api-proxy --project-ref ggpysmxalhbwaebdxfah
```

### 2. 验证部署
```bash
# 检查函数是否部署成功
supabase functions list

# 查看函数日志（用于调试）
supabase functions logs api-proxy
```

### 3. 测试函数
部署后，前端将通过以下URL调用外部API：
- 车辆API: `https://ggpysmxalhbwaebdxfah.supabase.co/functions/v1/api-proxy/vehicle?...`
- 消防API: `https://ggpysmxalhbwaebdxfah.supabase.co/functions/v1/api-proxy/fire-safety?...`

## 调试说明
如果函数返回400错误，请检查函数日志：
```bash
supabase functions logs api-proxy
```

常见问题：
1. 路径解析错误 - 检查函数是否能正确解析URL路径
2. 外部API连接问题 - 检查外部API是否可访问
3. 参数传递问题 - 确保查询参数正确传递

## 配置说明
API代理函数将：
1. 接收前端请求
2. 转发请求到外部API（`api.wzbc.edu.cn`）
3. 将外部API响应返回给前端
4. 自动处理CORS头部

## 注意事项
1. 确保Supabase项目ID正确（当前为`ggpysmxalhbwaebdxfah`）
2. 确保外部API配置在Edge Function中正确设置
3. 函数部署后可能需要几分钟生效
4. 监控函数调用日志以排查问题
5. 部署后清理浏览器缓存以确保前端使用最新代码

## 环境变量
Edge Function会使用硬编码的外部API配置，无需额外设置环境变量。
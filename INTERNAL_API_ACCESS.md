# 内网API访问解决方案

## 问题描述
- api.wzbc.edu.cn 是一个内网地址，并没有暴露到公网
- Supabase Edge Function 无法访问内网地址，导致DNS解析错误
- 前端需要获取车辆管理和消防设备数据，但无法直接访问内网API

## 解决方案

### 方案一：Supabase Edge Function 代理（已尝试，存在限制）

我们最初尝试使用Supabase Edge Function作为API代理，但遇到了网络访问限制问题：

```typescript
// supabase/functions/api-proxy/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // ... CORS处理 ...
  
  const url = new URL(req.url);
  const path = url.pathname;
  
  try {
    // 这里会失败，因为Supabase Edge Function无法访问内网地址
    const response = await fetch(`${API_BASE_URL}${path}?${url.searchParams}`, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...response.headers },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `API代理错误: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 方案二：专门的内网代理服务（推荐）

为解决内网API访问问题，我们设计了一个专门的内网代理服务，该服务部署在能够访问内网API的环境中。

#### 架构设计

```
前端应用 (公网) 
    ↓ (HTTP请求)
内网代理服务 (内网环境) 
    ↓ (访问内网API)
内网API (api.wzbc.edu.cn)
```

#### 实现详情

1. **内网代理服务** (`internal-proxy/`)
   - 基于Express和TypeScript构建
   - 部署在内网环境中，能够访问api.wzbc.edu.cn
   - 提供标准HTTP API接口供前端调用

2. **代理服务代码** (`internal-proxy/src/index.ts`)
   ```typescript
   // 实现了车辆和消防设备API的代理
   app.get('/api/vehicle', async (req: Request, res: Response) => { ... });
   app.get('/api/fire-safety', async (req: Request, res: Response) => { ... });
   ```

3. **前端配置** (`src/services/externalApi.ts`)
   ```typescript
   const INTERNAL_PROXY_CONFIG = {
     baseUrl: import.meta.env.VITE_INTERNAL_PROXY_URL || 'http://localhost:3001',
   };
   ```

#### 部署步骤

1. 将 `internal-proxy` 目录部署到内网服务器
2. 确保服务器能够访问 `api.wzbc.edu.cn:8888`
3. 安装依赖并启动服务：
   ```bash
   cd internal-proxy
   npm install
   npm run build
   npm start
   ```
4. 配置前端环境变量：
   ```bash
   VITE_INTERNAL_PROXY_URL=http://your-proxy-server:3001
   ```

#### API端点

- 车辆数据: `GET /api/vehicle?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- 消防设备: `GET /api/fire-safety?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- 健康检查: `GET /health`

## 优势

1. **网络可达性**: 代理服务部署在内网环境中，可以访问内网API
2. **安全性**: 避免了直接暴露内网API到公网
3. **可维护性**: 独立的服务，易于维护和扩展
4. **容错性**: 可以在代理服务中添加缓存、重试等机制
5. **灵活性**: 可以根据需要添加认证、限流等中间件

## 注意事项

- 代理服务需要部署在能够访问内网API的服务器上
- 需要确保代理服务的安全性，防止未授权访问
- 建议添加监控和日志记录功能
- 考虑高可用性和负载均衡需求

## 相关文件

- [internal-proxy/package.json](file:///home/lw/projects/app-8hmwu4kdi3nl/internal-proxy/package.json) - 代理服务依赖配置
- [internal-proxy/src/index.ts](file:///home/lw/projects/app-8hmwu4kdi3nl/internal-proxy/src/index.ts) - 代理服务主实现
- [src/services/externalApi.ts](file:///home/lw/projects/app-8hmwu4kdi3nl/src/services/externalApi.ts) - 前端API调用逻辑
- [INTERNAL_PROXY_DEPLOYMENT.md](file:///home/lw/projects/app-8hmwu4kdi3nl/INTERNAL_PROXY_DEPLOYMENT.md) - 部署指南
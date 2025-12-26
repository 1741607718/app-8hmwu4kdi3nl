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
2. **重要**: 点击"创建测试账号"按钮，系统会自动创建以下测试账号：
   - 管理员: `admin` / `123456`
   - 普通用户: `user` / `123456`
3. 使用测试账号登录系统
4. 系统会自动初始化模拟数据

**注意事项**:
- 首次部署后必须先创建测试账号才能登录
- 如果忘记创建测试账号，可以在登录页面点击"创建测试账号"按钮
- 测试账号只需创建一次，之后可以直接使用

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

## CAS统一身份认证对接详细配置

### 1. CAS认证流程说明

CAS (Central Authentication Service) 是一个单点登录协议，本系统支持CAS OAuth 2.0认证方式。

#### 认证流程图
```
用户 -> 应用 -> CAS认证服务器 -> 用户登录 -> 返回授权码 -> 应用换取Token -> 获取用户信息 -> 登录成功
```

### 2. 配置准备

#### 2.1 获取CAS应用凭证

从CAS管理员处获取以下信息：
- **Client ID**: `eclBK03n7FUfSlJi`
- **Client Secret**: `5MVevItUIigYVWptOO3D7Q`
- **CAS服务器地址**: 例如 `https://cas.example.com`
- **回调地址**: 您的应用域名 + `/auth/callback`，例如 `https://your-domain.com/auth/callback`

#### 2.2 配置环境变量

在 `.env` 文件中添加：
```env
VITE_CAS_CLIENT_ID=eclBK03n7FUfSlJi
VITE_CAS_CLIENT_SECRET=5MVevItUIigYVWptOO3D7Q
VITE_CAS_SERVER_URL=https://cas.example.com
VITE_CAS_CALLBACK_URL=https://your-domain.com/auth/callback
```

### 3. 代码实现步骤

#### 3.1 创建CAS认证服务

创建文件 `src/services/casAuth.ts`:

```typescript
// CAS OAuth 2.0 认证服务
const CAS_CONFIG = {
  clientId: import.meta.env.VITE_CAS_CLIENT_ID,
  clientSecret: import.meta.env.VITE_CAS_CLIENT_SECRET,
  serverUrl: import.meta.env.VITE_CAS_SERVER_URL,
  callbackUrl: import.meta.env.VITE_CAS_CALLBACK_URL,
};

/**
 * 步骤1: 跳转到CAS授权页面
 */
export function redirectToCASLogin() {
  const state = generateRandomState(); // 生成随机state防止CSRF
  sessionStorage.setItem('cas_state', state);

  const authUrl = new URL(`${CAS_CONFIG.serverUrl}/cas/oauth2.0/authorize`);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', CAS_CONFIG.clientId);
  authUrl.searchParams.append('redirect_uri', CAS_CONFIG.callbackUrl);
  authUrl.searchParams.append('state', state);

  window.location.href = authUrl.toString();
}

/**
 * 步骤2: 处理CAS回调，获取授权码
 */
export function handleCASCallback(): { code: string; state: string } | null {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const savedState = sessionStorage.getItem('cas_state');

  // 验证state
  if (!code || !state || state !== savedState) {
    console.error('CAS回调验证失败');
    return null;
  }

  sessionStorage.removeItem('cas_state');
  return { code, state };
}

// 生成随机state
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
```

#### 3.2 创建CAS Token交换Edge Function

创建文件 `supabase/functions/cas-exchange-token/index.ts`:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()

    // CAS配置
    const CAS_CONFIG = {
      clientId: Deno.env.get('CAS_CLIENT_ID'),
      clientSecret: Deno.env.get('CAS_CLIENT_SECRET'),
      serverUrl: Deno.env.get('CAS_SERVER_URL'),
      callbackUrl: Deno.env.get('CAS_CALLBACK_URL'),
    }

    // 步骤1: 使用授权码换取Access Token
    const tokenUrl = new URL(`${CAS_CONFIG.serverUrl}/cas/oauth2.0/accessToken`)
    tokenUrl.searchParams.append('grant_type', 'authorization_code')
    tokenUrl.searchParams.append('client_id', CAS_CONFIG.clientId!)
    tokenUrl.searchParams.append('client_secret', CAS_CONFIG.clientSecret!)
    tokenUrl.searchParams.append('redirect_uri', CAS_CONFIG.callbackUrl!)
    tokenUrl.searchParams.append('code', code)

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      throw new Error('获取Access Token失败')
    }

    // 步骤2: 使用Access Token获取用户信息
    const userInfoUrl = `${CAS_CONFIG.serverUrl}/cas/oauth2.0/profile`
    const userInfoResponse = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })
    const userInfo = await userInfoResponse.json()

    // 步骤3: 在Supabase中创建或更新用户
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 使用CAS用户ID作为邮箱
    const email = `${userInfo.id}@cas.miaoda.com`
    
    // 创建或获取用户
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        cas_id: userInfo.id,
        username: userInfo.attributes?.username || userInfo.id,
        name: userInfo.attributes?.name,
      }
    })

    if (userError && !userError.message.includes('already registered')) {
      throw userError
    }

    // 生成Supabase session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })

    if (sessionError) throw sessionError

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        user: userInfo
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

#### 3.3 配置Edge Function环境变量

使用Supabase CLI配置Edge Function的环境变量：

```bash
# 设置CAS配置
supabase secrets set CAS_CLIENT_ID=eclBK03n7FUfSlJi
supabase secrets set CAS_CLIENT_SECRET=5MVevItUIigYVWptOO3D7Q
supabase secrets set CAS_SERVER_URL=https://cas.example.com
supabase secrets set CAS_CALLBACK_URL=https://your-domain.com/auth/callback
```

#### 3.4 部署Edge Function

```bash
# 部署CAS Token交换函数
supabase functions deploy cas-exchange-token
```

或者在代码中自动部署（系统已集成）。

### 4. 测试CAS认证

#### 4.1 测试流程

1. 访问登录页面
2. 点击"使用CAS统一身份认证登录"
3. 跳转到CAS登录页面
4. 输入CAS账号密码
5. 授权后跳转回应用
6. 自动完成登录

#### 4.2 常见问题排查

**问题1: 回调地址不匹配**
- 检查CAS应用配置中的回调地址是否正确
- 确保回调地址与代码中配置一致

**问题2: Client Secret泄露**
- 确保Token交换在Edge Function中完成
- 不要在前端代码中暴露Client Secret

**问题3: State验证失败**
- 检查sessionStorage是否被清除
- 确保state在整个流程中保持一致

## Supabase Edge Function部署详细说明

### 1. Edge Function简介

Supabase Edge Function是基于Deno运行时的无服务器函数，可以用于：
- 处理敏感操作（如Token交换）
- 执行后台任务
- 实现自定义API
- 集成第三方服务

### 2. Edge Function项目结构

```
project/
├── supabase/
│   └── functions/
│       ├── init-test-accounts/     # 初始化测试账号
│       │   └── index.ts
│       ├── cas-exchange-token/     # CAS Token交换
│       │   └── index.ts
│       └── your-function/          # 自定义函数
│           └── index.ts
```

### 3. 创建Edge Function

#### 3.1 基本模板

创建文件 `supabase/functions/your-function-name/index.ts`:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

// CORS配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取请求参数
    const { param1, param2 } = await req.json()

    // 创建Supabase客户端（使用用户token）
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 或使用Service Role Key（管理员权限）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 业务逻辑
    const result = await doSomething(param1, param2)

    // 返回成功响应
    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    // 返回错误响应
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function doSomething(param1: string, param2: string) {
  // 实现业务逻辑
  return { result: 'success' }
}
```

### 4. 部署Edge Function

#### 4.1 自动部署（推荐）

本项目已集成Edge Function自动部署功能。创建或修改Edge Function文件后，系统会自动部署。

已部署的Edge Function：
- `init-test-accounts`: 初始化测试账号

#### 4.2 手动部署（使用Supabase CLI）

如果需要手动部署：

```bash
# 安装Supabase CLI
npm install -g supabase

# 登录
supabase login

# 部署单个函数
supabase functions deploy function-name

# 部署所有函数
supabase functions deploy

# 查看函数列表
supabase functions list

# 查看函数日志
supabase functions logs function-name --follow

# 删除函数
supabase functions delete function-name
```

### 5. 配置Edge Function环境变量

#### 5.1 使用Supabase CLI

```bash
# 设置单个secret
supabase secrets set SECRET_NAME=secret_value

# 批量设置secrets
supabase secrets set SECRET1=value1 SECRET2=value2

# 查看所有secrets（只显示名称）
supabase secrets list

# 删除secret
supabase secrets unset SECRET_NAME
```

#### 5.2 通过Supabase Dashboard

1. 登录 Supabase Dashboard
2. 选择项目
3. 进入 Edge Functions 页面
4. 选择函数
5. 点击 "Secrets" 标签
6. 添加或修改环境变量

### 6. 调用Edge Function

#### 6.1 从前端调用

```typescript
import { supabase } from '@/db/supabase';

// 调用Edge Function
const { data, error } = await supabase.functions.invoke('function-name', {
  body: {
    param1: 'value1',
    param2: 'value2',
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

// 处理错误
if (error) {
  const errorMsg = await error?.context?.text();
  console.error('Edge Function错误:', errorMsg || error?.message);
  return;
}

// 使用返回数据
console.log('返回数据:', data);
```

#### 6.2 从其他Edge Function调用

```typescript
// 在Edge Function中调用另一个Edge Function
const response = await fetch(
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/other-function`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ param: 'value' }),
  }
)

const data = await response.json()
```

### 7. Edge Function最佳实践

#### 7.1 错误处理

```typescript
try {
  // 业务逻辑
  const result = await riskyOperation()
  
  return new Response(
    JSON.stringify({ success: true, data: result }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
} catch (error) {
  console.error('函数执行错误:', error)
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.status || 500
    }
  )
}
```

#### 7.2 认证和授权

```typescript
// 获取当前用户
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  {
    global: {
      headers: { Authorization: req.headers.get('Authorization')! },
    },
  }
)

const { data: { user }, error } = await supabaseClient.auth.getUser()

if (error || !user) {
  return new Response(
    JSON.stringify({ error: '未授权' }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401
    }
  )
}

// 检查用户角色
const { data: profile } = await supabaseClient
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'admin') {
  return new Response(
    JSON.stringify({ error: '权限不足' }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403
    }
  )
}
```

#### 7.3 日志记录

```typescript
// 使用console.log记录日志
console.log('函数开始执行', { param1, param2 })
console.error('发生错误', { error: error.message, stack: error.stack })
console.warn('警告信息', { warning: 'something' })

// 日志会显示在Supabase Dashboard的Logs页面
```

### 8. Edge Function限制

- **执行时间**: 最长150秒
- **内存**: 512MB
- **请求大小**: 最大10MB
- **响应大小**: 最大6MB
- **并发**: 根据项目套餐限制
- **依赖**: 仅支持npm和JSR包，不支持URL imports

### 9. 常见问题

**Q: Edge Function部署失败？**
A: 检查代码语法、依赖导入、环境变量配置

**Q: 如何调试Edge Function？**
A: 使用console.log输出日志，在Dashboard查看

**Q: Edge Function可以访问数据库吗？**
A: 可以，使用Supabase客户端访问

**Q: 如何保护敏感信息？**
A: 使用环境变量(secrets)存储，不要硬编码

**Q: 响应Content-Type有限制吗？**
A: 是的，只能使用: application/json, application/octet-stream, text/event-stream, multipart/form-data

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

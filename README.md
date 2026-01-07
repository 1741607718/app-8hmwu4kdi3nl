# 欢迎使用你的秒哒应用代码包
秒哒应用链接
    URL:https://www.miaoda.cn/projects/app-8hmwu4kdi3nl

## 介绍

**消防安全一张表** 是一个基于Web的消防安全数据展示平台，集成车辆管理、人行管理、消防设备、安保数据等多维度安全信息，为学校管理层提供全面的安全态势感知和数据决策支持。

### 核心功能

- 🔐 **用户认证与权限管理**：支持用户名密码登录，基于角色的权限控制系统
- 🚗 **车辆管理**：车辆通行记录、车流量统计、历史趋势分析
- 👥 **人员管理**：校园人数统计、人流量监测、访客数据
- 🔥 **消防安全**：消防设备状态监控、报警统计、设备检测记录
- 🛡️ **安保监控**：监控在线状态、案事件统计、反诈劝阻记录
- 🏢 **宿管数据**：住宿人数统计、归宿情况监控
- 📊 **数据可视化**：历史数据对比图表、趋势分析
- 📥 **数据导出**：支持CSV格式数据导出（需权限）

### 技术特点

- 🎨 **现代化UI设计**：采用安全蓝主题色，卡片式布局，清晰的视觉层级
- 📱 **响应式布局**：桌面优先设计，完美适配移动端
- 🔒 **安全可靠**：基于Supabase的RLS策略，确保数据安全
- ⚡ **高性能**：使用React + Vite构建，快速响应
- 🎯 **易于扩展**：模块化设计，便于后续功能扩展

## 目录结构

```
├── README.md # 说明文档
├── components.json # 组件库配置
├── index.html # 入口文件
├── package.json # 包管理
├── postcss.config.js # postcss 配置
├── public # 静态资源目录
│   ├── favicon.png # 图标
│   └── images # 图片资源
├── src # 源码目录
│   ├── App.tsx # 入口文件
│   ├── components # 组件目录
│   ├── contexts # 上下文目录
│   ├── db # 数据库配置目录
│   ├── hooks # 通用钩子函数目录
│   ├── index.css # 全局样式
│   ├── layout # 布局目录
│   ├── lib # 工具库目录
│   ├── main.tsx # 入口文件
│   ├── routes.tsx # 路由配置
│   ├── pages # 页面目录
│   ├── services  # 数据库交互目录
│   ├── types   # 类型定义目录
├── tsconfig.app.json  # ts 前端配置文件
├── tsconfig.json # ts 配置文件
├── tsconfig.node.json # ts node端配置文件
└── vite.config.ts # vite 配置文件
```

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI组件库**：shadcn/ui + Tailwind CSS
- **路由管理**：React Router v6
- **图表库**：Recharts
- **后端服务**：Supabase (PostgreSQL + Auth + RLS)
- **日期处理**：date-fns
- **代码规范**：Biome

## 快速开始

### 首次使用

1. **创建测试账号**
   - 访问登录页面
   - **重要**: 点击"创建测试账号"按钮
   - 系统会自动创建以下测试账号：
     - 管理员: `admin` / `123456`
     - 普通用户: `user` / `123456`

2. **登录系统**
   - 使用测试账号登录
   - 系统会自动生成模拟数据用于演示

3. **管理权限**
   - 管理员可在"权限管理"页面管理其他用户
   - 可以设置用户角色（管理员/普通用户）
   - 可以授予或取消数据导出权限

### 测试账号

**重要提示**: 首次部署后，数据库中没有预置账号，必须先点击登录页面的"创建测试账号"按钮！

创建后可使用以下账号：
- **管理员**：用户名 `admin`，密码 `123456`
- **普通用户**：用户名 `user`，密码 `123456`

## 功能模块说明

### 1. 数据总览
- 展示各模块关键指标统计
- 快速访问各功能模块
- 实时数据更新

### 2. 车辆管理
- 车辆通行记录查询
- 车流量趋势图表
- 支持日期范围筛选
- 数据导出功能（需权限）

### 3. 消防安全
- 消防设备状态监控
- 设备正常率统计
- 设备状态分布图
- 检测记录查询

### 4. 人员管理
- 在校人数统计
- 访客数据统计
- 人流量监测

### 5. 安保监控
- 监控设备在线状态
- 案事件统计
- 反诈劝阻记录

### 6. 宿管数据
- 住宿人数统计
- 归宿情况监控
- 归宿率统计

### 7. 权限管理（仅管理员）
- 用户列表查看
- 角色管理
- 权限分配

## 外部API配置

系统已配置以下外部API接口：

### 车辆管理API
- **Base URL**: `https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC`
- **Apply ID**: `40664926031250432`
- **Secret Key**: `6bbfe313481a41d7882e7db89a467b7d`

### 消防安全API
- **Base URL**: `https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz`
- **Apply ID**: `40664926031250432`
- **Secret Key**: `6bbfe313481a41d7882e7db89a467b7d`

配置文件位置：`src/services/externalApi.ts`

## 数据库结构

系统使用Supabase PostgreSQL数据库，包含以下主要表：

- `profiles`: 用户配置表
- `vehicle_data`: 车辆数据缓存表
- `fire_equipment_data`: 消防设备数据表
- `personnel_stats`: 人员统计表
- `security_stats`: 安保统计表
- `dormitory_stats`: 宿管统计表

所有表都启用了RLS（行级安全策略），确保数据安全。

## 权限说明

### 角色类型
- **管理员（admin）**：拥有所有权限，可以管理用户和权限
- **普通用户（user）**：可以查看数据，但默认无导出权限

### 权限控制
- 数据查看：所有认证用户
- 数据导出：需要管理员授权或管理员角色
- 用户管理：仅管理员
- 权限管理：仅管理员

## 部署说明

### 环境变量

系统已自动配置以下环境变量：
- `VITE_SUPABASE_URL`: Supabase项目URL
- `VITE_SUPABASE_ANON_KEY`: Supabase匿名密钥

### 生产部署

1. 构建生产版本：
```bash
npm run build
```

2. 部署dist目录到静态服务器

3. 确保Supabase项目正常运行

## 后续扩展

### CAS OAuth 2.0集成（待实现）

系统预留了CAS认证集成接口，可按需求文档中的配置进行集成：
- Client ID: `eclBK03n7FUfSlJi`
- Client Secret: `5MVevItUIigYVWptOO3D7Q`

集成位置：`src/contexts/AuthContext.tsx`

### 实时数据同步

可以通过定时任务或Webhook方式，定期从外部API获取最新数据并存储到数据库。

## 常见问题

**Q: 首次登录没有数据怎么办？**
A: 系统会在首次访问时自动生成模拟数据。如果没有，请刷新页面。

**Q: 忘记管理员密码怎么办？**
A: 可以通过Supabase控制台直接修改数据库中的用户角色。

**Q: 如何添加新的数据模块？**
A: 参考现有模块（如VehiclesPage.tsx），创建新的页面组件，并在routes.tsx中注册路由。

**Q: 数据导出功能无法使用？**
A: 请确认当前用户是管理员或已被授予导出权限。

## 本地开发

### 如何在本地编辑代码？

您可以选择 [VSCode](https://code.visualstudio.com/Download) 或者您常用的任何 IDE 编辑器，唯一的要求是安装 Node.js 和 npm.

### 环境要求

```
# Node.js ≥ 20
# npm ≥ 10
例如：
# node -v   # v20.18.3
# npm -v    # 10.8.2
```

具体安装步骤如下：

### 在 Windows 上安装 Node.js

```
# Step 1: 访问Node.js官网：https://nodejs.org/，点击下载后，会根据你的系统自动选择合适的版本（32位或64位）。
# Step 2: 运行安装程序：下载完成后，双击运行安装程序。
# Step 3: 完成安装：按照安装向导完成安装过程。
# Step 4: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 在 macOS 上安装 Node.js

```
# Step 1: 使用Homebrew安装（推荐方法）：打开终端。输入命令brew install node并回车。如果尚未安装Homebrew，需要先安装Homebrew，
可以通过在终端中运行如下命令来安装：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
或者使用官网安装程序：访问Node.js官网。下载macOS的.pkg安装包。打开下载的.pkg文件，按照提示完成安装。
# Step 2: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 安装完后按照如下步骤操作：

```
# Step 1: 下载代码包
# Step 2: 解压代码包
# Step 3: 用IDE打开代码包，进入代码目录
# Step 4: IDE终端输入命令行，安装依赖：npm i
# Step 5: IDE终端输入命令行，启动开发服务器：npm run dev -- --host 127.0.0.1
```

### 如何开发后端服务？

配置环境变量，安装相关依赖
如需使用数据库，请使用 supabase 官方版本或自行部署开源版本的 Supabase

### 如何配置应用中的三方 API？

具体三方 API 调用方法，请参考帮助文档：[源码导出](https://cloud.baidu.com/doc/MIAODA/s/Xmewgmsq7)，了解更多详细内容。

## 了解更多

您也可以查看帮助文档：[源码导出](https://cloud.baidu.com/doc/MIAODA/s/Xmewgmsq7)，了解更多详细内容。

# 校园安全管理系统

## 项目概述
这是一个基于Supabase和React/Vite的校园安全管理系统，集成了CAS统一身份认证，支持车辆管理和消防设备监控等功能。

## 功能特性

### CAS统一身份认证
- 集成学校统一身份认证系统
- 自动同步用户真实姓名和用户名
- 解决了显示"普通用户"的问题

### 车辆管理系统
- 实时监控校园车辆通行记录
- 按日期范围查询车辆数据
- 车辆通行统计分析

### 消防设备监控
- 消防设备状态监控
- 定期检查记录管理
- 设备状态统计分析

## 技术架构

### 前端技术栈
- React 18
- TypeScript
- Vite 构建工具
- Tailwind CSS 样式

### 后端技术栈
- Supabase (数据库和认证)
- Supabase Edge Functions (API代理)
- PostgreSQL 数据库

### 内网API代理
- 专门的内网代理服务 (Express + TypeScript)
- 解决内网API访问限制问题

## 部署说明

### 前端部署
1. 安装依赖: `npm install`
2. 配置环境变量:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_INTERNAL_PROXY_URL=your_internal_proxy_url
   ```
3. 构建项目: `npm run build`
4. 部署到静态服务器

### 内网代理服务部署
1. 将 `internal-proxy` 目录部署到内网服务器
2. 确保服务器可以访问 `api.wzbc.edu.cn:8888`
3. 安装依赖: `npm install`
4. 编译: `npm run build`
5. 启动服务: `npm start`

## 环境配置

### 前端环境变量 (.env)
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_INTERNAL_PROXY_URL=your_internal_proxy_url
```

### 内网代理服务环境变量
代理服务不需要特殊环境变量，但需要确保网络连通性。

## 问题解决

### CAS登录显示真实用户名
- 通过修改Supabase触发器函数解决
- 优先使用CAS返回的真实姓名而非从邮箱提取的用户名

### 登录界面闪烁问题
- 修复了CAS回调页面的路由守卫逻辑
- 统一了登录状态显示界面

### 内网API访问问题
- 设计了专门的内网代理服务解决网络访问限制
- 通过代理服务获取车辆和消防设备数据

## 目录结构

```
.
├── src/                    # 前端源代码
│   ├── components/         # React组件
│   ├── pages/              # 页面组件
│   ├── contexts/           # React上下文
│   ├── db/                 # 数据库相关
│   ├── services/           # 服务层
│   └── types/              # 类型定义
├── supabase/              # Supabase配置
│   ├── functions/         # Edge Functions
│   └── migrations/        # 数据库迁移
├── internal-proxy/        # 内网代理服务
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── docs/                  # 文档
└── .env.example           # 环境变量示例
```

## 维护说明

### 数据库迁移
- 重要数据库变更通过SQL迁移脚本管理
- [00002_fix_cas_username_extraction.sql](file:///home/lw/projects/app-8hmwu4kdi3nl/supabase/migrations/00002_fix_cas_username_extraction.sql) - 修复CAS用户名提取
- [00003_add_name_to_profiles.sql](file:///home/lw/projects/app-8hmwu4kdi3nl/supabase/migrations/00003_add_name_to_profiles.sql) - 添加姓名字段

### API变更
- 外部API调用通过内网代理服务进行
- 前端不再直接访问内网API

## 相关文档

- [INTERNAL_API_ACCESS.md](file:///home/lw/projects/app-8hmwu4kdi3nl/INTERNAL_API_ACCESS.md) - 内网API访问解决方案
- [INTERNAL_PROXY_DEPLOYMENT.md](file:///home/lw/projects/app-8hmwu4kdi3nl/INTERNAL_PROXY_DEPLOYMENT.md) - 内网代理服务部署指南

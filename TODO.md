# Task: 消防安全一张表 - Fire Safety Data Platform

## Plan
- [x] 步骤1: 设计系统并初始化Supabase数据库(Completed)
  - [x] 设计配色方案和主题系统
  - [x] 初始化Supabase并创建数据库表结构
  - [x] 配置用户认证和权限系统
  - [x] 创建RLS策略和辅助函数
- [x] 步骤2: 实现用户认证系统(Completed)
  - [x] 修改AuthContext支持用户名密码登录
  - [x] 创建登录页面
  - [x] 配置RouteGuard和公共路由
  - [x] 实现管理员权限管理页面
- [x] 步骤3: 创建核心布局和导航(Completed)
  - [x] 创建主布局组件(带侧边栏和顶部导航)
  - [x] 实现响应式侧边栏导航
  - [x] 添加用户状态显示和登出功能
- [x] 步骤4: 实现数据服务层(Completed)
  - [x] 创建外部API调用服务(车辆、消防)
  - [x] 创建Supabase数据API封装
  - [x] 实现数据缓存和历史记录存储
- [x] 步骤5: 开发核心功能模块(Completed)
  - [x] 车辆管理模块(数据展示、查询、导出)
  - [x] 人员管理模块
  - [x] 消防安全模块
  - [x] 安保监控模块
  - [x] 宿管数据模块
- [x] 步骤6: 实现数据可视化(Completed)
  - [x] 集成图表库(recharts)
  - [x] 创建历史数据对比图表组件
  - [x] 实现各模块的趋势分析图表
- [x] 步骤7: 实现高级功能(Completed)
  - [x] 时间范围选择器
  - [x] 数据导出功能
  - [x] 数据下钻详情页
  - [x] 权限控制集成
- [x] 步骤8: 完成测试和优化(Completed)
  - [x] 运行lint检查并修复所有问题
  - [x] 测试所有功能模块
  - [x] 优化响应式布局

## Notes
- 用户提供的API凭证:
  - Vehicle API: https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC
  - Fire Safety API: https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz
  - Apply ID: 40664926031250432
  - Secret Key: 6bbfe313481a41d7882e7db89a467b7d
- 测试账号: admin/123456 (管理员), user/123456 (普通用户)
- 配色方案: 安全蓝(#1E88E5)主色调, 警示橙(#FF9800), 危险红(#F44336)
- 需要支持CAS OAuth 2.0认证(后续集成)
- 桌面优先的响应式设计
- 卡片式布局展示各数据模块

## 实现完成
✅ 所有核心功能已实现
✅ 用户认证系统完成(用户名密码登录)
✅ 权限管理系统完成
✅ 数据展示模块完成(车辆、消防、人员、安保、宿管)
✅ 数据可视化图表完成
✅ 响应式布局完成
✅ Lint检查通过
✅ 测试账号初始化功能完成(Edge Function)
✅ 详细部署文档完成(包含CAS认证和Edge Function部署说明)

## 首次使用说明
**重要**: 首次部署后必须先创建测试账号！

1. 访问登录页面
2. 点击"创建测试账号"按钮（调用Edge Function自动创建）
3. 系统会创建以下账号：
   - 管理员: admin / 123456
   - 普通用户: user / 123456
4. 使用测试账号登录
5. 系统会自动生成模拟数据用于演示
6. 管理员可在权限管理页面管理其他用户的角色和权限

## 已部署的Edge Function
- `init-test-accounts`: 初始化测试账号（管理员和普通用户）

## 文档清单
- README.md: 项目介绍和快速开始
- TODO.md: 开发任务清单（本文件）
- docs/DEPLOYMENT.md: 详细部署文档（包含CAS认证对接和Edge Function部署）
- docs/USER_GUIDE.md: 用户使用手册
- docs/DELIVERY.md: 项目交付说明

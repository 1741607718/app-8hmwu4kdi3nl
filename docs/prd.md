# 消防安全一张表需求文档

## 1. 网站概述

### 1.1 网站名称
消防安全一张表

### 1.2 网站描述
基于Web的消防安全数据展示平台，集成车辆管理、人行管理、消防设备、安保数据等多维度安全信息，为学校管理层提供全面的安全态势感知和数据决策支持。\n
## 2. 核心功能

### 2.1 用户认证与授权

#### 2.1.1 CAS认证对接指南
**支持版本：** 1.5.0+\n
**对接准备：**\n- 提供应用域名、回调地址，完成应用注册后，将client_id、client_secret给到应用对接方
- clientId: eclBK03n7FUfSlJi
- clientSecret:5MVevItUIigYVWptOO3D7Q

**认证流程：**\n
##### 2.1.2 获取授权码（Authorization Code）\n**步骤1：跳转到授权页面**\n用户访问第三方应用，若未登录时，第三方应用需要将用户浏览器重定向到认证服务的OAuth2授权页面/cas/oauth2.0/authorize，同时可带上以下参数：\n
- `response_type`: 固定值 code
- `client_id`: 应用注册时生成的唯一标识
- `redirect_uri`: 第三方应用的回调地址（须和应用注册时的回调地址保持匹配）\n- `state`: 第三方应用生成的随机字符串，返回时会原样返回，用于防止CSRF攻击

**请求示例：**\nGET /cas/oauth2.0/authorize?response_type=code&client_id=CijBwB5EwTTXouO7&redirect_uri=https://example.com/oauth2/authcode&state=YOUR_RANDOM_STATE HTTP/1.1
Host: cas.example.com

**步骤2：用户登录**\n用户在登录页面输入自己的用户名、密码进行登录，OAuth Server（CAS认证）对用户进行认证，并由用户进行确认授权。\n
**步骤3：响应处理**\n- **认证成功：** OAuth Server（CAS认证）会将授权码（authorization code）通过redirect_uri，以code参数名传递给第三方应用
- **认证失败：** 重新回到登录页面并显示错误信息

**成功响应示例：**\nHTTP/1.1 302 Found
Location: https://example.com/oauth2/authcode?code=OC-2-lO-RjC5flQ3fqsw2LV0bAYEvy6rVfyXV&state=YOUR_RANDOM_STATE

##### 2.1.3 使用授权码换取 Access Token
**步骤1：获取授权码**\n第三方应用从浏览器请求中获取code参数值，并校验state的一致性

**步骤2：换取 Access Token**\n第三方应用请求/oauth2.0/accessToken，以换取Access Token，并获取JSON格式的响应结果

**请求参数：**\n- `grant_type`: 固定值 authorization_code
- `client_id`: 应用注册时生成的唯一标识
- `client_secret`: 应用注册时生成的密钥
- `redirect_uri`: 与认证登录时的redirect_uri保持一致
- `code`: 认证登录返回的授权码（Authorization Code）\n
**请求示例：**\nGET /cas/oauth2.0/accessToken?grant_type=authorization_code&client_id=CijBwB5EwTTXouO7&client_secret=O8dOsXE7p7yMbh18KEP2Z6&redirect_uri=https://example.com/oauth2/authcode&code=OC-2-lO-RjC5flQ3fqsw2LV0bAYEvy6rVfyXV HTTP/1.1
Host: cas.example.com

**响应成功：**\nHTTP/2 200
content-type: application/json;charset=UTF-8

{access_token":AT-1-4OAC0xUWy-QX0zfMr2ERQHUCxbTRSJZ-}\n
#### 2.1.4 测试账号配置
**管理员账号：**\n- 账号名：admin
- 密码：123456
- 权限级别：超级管理员，拥有所有功能模块的查看、编辑、导出权限

**普通用户账号：**\n- 账号名：user
- 密码：123456
- 权限级别：基础用户，可查看车辆管理、人员管理、消防安全等核心数据，但无导出权限

**测试环境访问地址：**\n- http://test.safetytable.com

**手动登录方式：**\n- 用户可在测试环境下直接使用上述账号密码进行手动登录测试
- 支持账号密码登录和CAS认证登录双重方式

### 2.2 权限管理系统
- 基于部门组织身份的权限授予
- 手动批量设置权限功能
- 权限范围配置：设定用户可访问的数据类别
- 数据范围控制：限定用户可访问的数据地域范围
- 角色权限分离：不同角色分配相应权限等级

### 2.3 数据展示与查询
- 车辆管理数据：车辆登记、车流量统计、车辆超速、访客车辆、车库车位
- 人员管理数据：校园人数统计、人流量监测、访客数据
- 消防安全数据：消防设备状态、报警统计
- 安保监控数据：监控在线状态、校园案事件统计、反诈劝阻记录
- 宿管数据：住宿人数统计、归宿情况监控

### 2.4 数据操作功能
- 数据查询：支持按时间周期（当日、自定义时间段）查询
- 数据导出：支持将查询结果导出为标准格式
- 下钻功能：支持明细数据查看

## 3. 技术配置

### 3.1 API接口配置
#### 车辆通行数据API
- Base URL: https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC
- Apply ID: 40664926031250432
- Secret Key: 6bbfe313481a41d7882e7db89a467b7d

#### 消防安全数据API
- Base URL: https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz
- Apply ID: 40664926031250432
- Secret Key: 6bbfe313481a41d7882e7db89a467b7d

### 3.2 数据字段说明
- 车辆信息：车牌号(cph)、识别状态(qcysdm/qcysmc)、站点信息(sbtdbm/sbtdmc)、通过时间(zpsj)\n- 消防设备：检测日期(dqrq)、设备编号(bh)、设备状态(syjf)、位置信息(dxwb/bm)\n
## 4. 对于每个模块展示出历史数据的对比统计图，方便展示数据的变化趋势。\n
## 5. 部署方式

### 5.1 在线快速部署
- 一键部署功能
- 云端服务器配置
- 自动化部署流程

### 5.2 离线部署方式
- 本地服务器安装包
- 数据库配置指导
- 服务启动脚本
- 配置文件模板

## 6. 说明文档

### 6.1 开发文档
- 技术架构说明
- API接口调用规范
- 数据模型设计
- 权限控制实现

### 6.2 部署文档
- 环境要求
- 安装步骤
- 配置指导
- 错误排查

### 6.3 测试文档
- 功能测试用例
- 性能测试方案
- 数据验证标准
- 边界条件测试

### 6.4 上线文档
- 切换策略
- 回滚方案
- 监控指标
- 用户培训材料

### 6.5 统一身份认证对接手册
- OAuth 2.0配置详细说明
- CAS集成步骤指南
- 用户信息同步机制
- 错误处理和排查
- 回调接口规范
- 测试验证流程

## 7. 界面设计要求

### 7.1 响应式布局
- 支持PC端和移动端访问
- 移动端优先的设计理念
- 自适应屏幕尺寸的响应式布局

### 7.2 交互设计
- 简洁直观的操作界面
- 数据表格和图表结合展示
- 按钮式查询和导出操作
- 下拉菜单选择查询条件

### 7.3 设计风格
- 配色方案：以安全蓝(#1E88E5)为主色调，搭配警示橙(#FF9800)和危险红(#F44336)\n- 布局方式：卡片式布局，每个数据模块独立展示
- 视觉细节：圆角卡片设计，清晰的数据层级和状态指示
- 整体风格：专业、简洁、信息密度适中的政务类数据展示界面
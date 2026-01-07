# 安装 pnpm 指南

## 问题描述
在 Ubuntu/Debian 系统上使用 `sudo apt install pnpm` 时出现 "无法定位软件包 pnpm" 的错误。

## 解决方案

### 方法 1：使用 npm 安装（推荐）
如果您系统已安装 Node.js 和 npm，可以使用以下命令安装 pnpm：

```bash
# 使用 npm 全局安装 pnpm
npm install -g pnpm

# 或者使用 npx 临时安装
npx pnpm add -g pnpm
```

### 方法 2：使用独立脚本安装
```bash
# 使用 curl 安装
curl -fsSL https://get.pnpm.io/install.sh | sh -

# 或使用 wget 安装
wget -qO- https://get.pnpm.io/install.sh | sh -
```

### 方法 3：使用 Corepack（如果 Node.js 版本 >= 14.19.0）
```bash
# 启用 Corepack
corepack enable

# 安装 pnpm
corepack prepare pnpm@latest --activate
```

### 方法 4：添加 NodeSource 仓库（如果需要）
```bash
# 添加 NodeSource 仓库（如果系统没有 Node.js 或版本较旧）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 然后使用 npm 安装 pnpm
npm install -g pnpm
```

## 验证安装
```bash
# 检查 pnpm 版本
pnpm --version

# 检查 pnpm 是否正确安装
which pnpm
```

## 项目中使用 pnpm
安装完成后，您可以继续使用项目中的命令：

```bash
# 检查环境变量
pnpm check:env

# 清理缓存
pnpm clean:cache

# 启动开发服务器
pnpm dev
```

## 注意事项
- 不建议在安装开发工具时使用 sudo，因为这可能导致权限问题
- 如果您没有安装 Node.js，请先安装 Node.js LTS 版本
- 对于生产环境部署，建议使用项目中锁定的版本管理工具
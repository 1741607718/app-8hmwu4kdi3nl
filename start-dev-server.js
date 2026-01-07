#!/usr/bin/env node

// 启动开发服务器的脚本
const { spawn } = require('child_process');
const path = require('path');

console.log('正在启动开发服务器...');

// 启动内部代理服务
console.log('启动内部代理服务 (端口 3003)...');
const proxy = spawn('npx', ['tsx', 'internal-proxy/src/index.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

proxy.on('error', (err) => {
  console.error('启动内部代理服务失败:', err.message);
});

proxy.on('close', (code) => {
  console.log(`内部代理服务已退出，退出码: ${code}`);
  process.exit(code);
});

// 等待代理服务启动后，启动前端开发服务器
setTimeout(() => {
  console.log('启动前端开发服务器 (端口 5173)...');
  const frontend = spawn('npx', ['vite'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env }
  });

  frontend.on('error', (err) => {
    console.error('启动前端开发服务器失败:', err.message);
  });

  frontend.on('close', (code) => {
    console.log(`前端开发服务器已退出，退出码: ${code}`);
    process.exit(code);
  });

  // 如果前端进程退出，也退出此脚本
  frontend.on('exit', (code) => {
    process.exit(code);
  });
}, 3000); // 等待3秒让代理服务先启动

// 监听 Ctrl+C 信号并优雅地关闭服务
process.on('SIGINT', () => {
  console.log('\n正在关闭开发服务器...');
  proxy.kill();
  process.exit(0);
});
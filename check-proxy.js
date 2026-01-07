#!/usr/bin/env node

// 检查内部代理服务是否运行的脚本
const http = require('http');

function checkProxy() {
  console.log('正在检查内部代理服务 (http://localhost:3003) ...');
  
  const request = http.request(
    'http://localhost:3003/health',
    { method: 'GET', timeout: 5000 },
    (res) => {
      console.log(`代理服务响应状态: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ 内部代理服务运行正常');
          try {
            const healthInfo = JSON.parse(data);
            console.log('健康信息:', healthInfo);
          } catch (e) {
            console.log('响应内容:', data);
          }
        } else {
          console.log('❌ 内部代理服务响应异常');
          console.log('响应内容:', data);
        }
      });
    }
  );
  
  request.on('error', (err) => {
    console.log('❌ 无法连接到内部代理服务');
    console.log('错误信息:', err.message);
    console.log('\n请确保已启动内部代理服务:');
    console.log('方法1: 在项目根目录运行 `npm run proxy`');
    console.log('方法2: 在 internal-proxy 目录运行 `npx tsx src/index.ts`');
  });
  
  request.on('timeout', () => {
    console.log('❌ 连接内部代理服务超时');
    request.destroy();
  });
  
  request.end();
}

checkProxy();
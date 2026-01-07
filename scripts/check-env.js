/**
 * 环境变量检查脚本
 * 验证 Supabase 配置是否正确
 */

import fs from 'fs';
import path from 'path';

console.log('检查环境变量配置...');

// 检查 .env 文件
const envFiles = ['.env.local', '.env', '.env.example'];
let foundEnvFile = null;

for (const file of envFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    foundEnvFile = filePath;
    console.log(`✓ 找到环境文件: ${file}`);
    
    // 读取并检查内容
    const content = fs.readFileSync(filePath, 'utf8');
    const supabaseUrlMatch = content.match(/VITE_SUPABASE_URL=(.*)/);
    const supabaseAnonKeyMatch = content.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    const supabaseServiceRoleKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
    
    if (supabaseUrlMatch) {
      const url = supabaseUrlMatch[1];
      console.log(`  VITE_SUPABASE_URL: ${url}`);
      
      if (url.includes('ggpysmxalhbwaebdxfah')) {
        console.log('  ✓ URL 包含正确的项目 ID');
      } else {
        console.log('  ⚠ URL 不包含正确的项目 ID');
        console.log('  预期项目 ID: ggpysmxalhbwaebdxfah');
      }
    } else {
      console.log('  ⚠ VITE_SUPABASE_URL 未在环境文件中定义');
    }
    
    if (supabaseAnonKeyMatch) {
      const key = supabaseAnonKeyMatch[1];
      if (key && key.trim()) {
        console.log('  ✓ VITE_SUPABASE_ANON_KEY 已定义');
      } else {
        console.log('  ⚠ VITE_SUPABASE_ANON_KEY 为空');
      }
    } else {
      console.log('  ⚠ VITE_SUPABASE_ANON_KEY 未在环境文件中定义');
    }
    
    if (supabaseServiceRoleKeyMatch) {
      const key = supabaseServiceRoleKeyMatch[1];
      if (key && key.trim()) {
        console.log('  ✓ SUPABASE_SERVICE_ROLE_KEY 已定义');
      } else {
        console.log('  ⚠ SUPABASE_SERVICE_ROLE_KEY 为空');
      }
    } else {
      console.log('  ⚠ SUPABASE_SERVICE_ROLE_KEY 未在环境文件中定义');
    }
    
    break;
  }
}

if (!foundEnvFile) {
  console.log('⚠ 未找到任何环境文件 (.env, .env.local)');
  console.log('请创建 .env 文件并添加以下内容：');
  console.log('VITE_SUPABASE_URL=https://ggpysmxalhbwaebdxfah.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=your-anon-key-here');
}

// 检查当前运行时环境变量（仅在 Node.js 环境中有效）
console.log('\n当前运行时环境变量：');
console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? process.env.VITE_SUPABASE_URL : '未设置');
console.log('- VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '[已设置]' : '未设置');

if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_URL.includes('ggpysmxalhbwaebdxfah')) {
  console.log('✓ 运行时环境变量使用正确的项目 URL');
} else if (process.env.VITE_SUPABASE_URL) {
  console.log('⚠ 运行时环境变量使用非预期的项目 URL');
  console.log('  预期项目 ID: ggpysmxalhbwaebdxfah');
} else {
  console.log('⚠ 运行时环境变量未设置');
}

console.log('\n如果问题仍然存在，请执行以下操作：');
console.log('1. 运行: node scripts/clean-dev-cache.js');
console.log('2. 关闭当前开发服务器');
console.log('3. 确保 .env 文件配置正确');
console.log('4. 重启开发服务器: pnpm dev');
console.log('5. 清除浏览器缓存或使用无痕模式');
console.log('6. 检查浏览器控制台确认环境变量是否正确加载');
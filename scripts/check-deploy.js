/**
 * 检查 Supabase Edge Function 部署状态
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('检查 Supabase Edge Function 部署状态...');

try {
  // 检查 Supabase CLI 是否已安装
  try {
    const version = execSync('supabase --version', { encoding: 'utf-8' });
    console.log('✓ Supabase CLI 已安装:', version.trim());
  } catch (error) {
    console.log('⚠ Supabase CLI 未安装或不可用');
    console.log('  请运行: npm install -g supabase');
    process.exit(1);
  }

  // 检查项目是否已链接
  try {
    const projectId = execSync('supabase status', { encoding: 'utf-8' });
    console.log('✓ 项目状态:', projectId.trim());
  } catch (error) {
    console.log('⚠ 项目未链接到 Supabase');
    console.log('  请运行: supabase link --project-ref ggpysmxalhbwaebdxfah');
  }

  // 检查函数列表
  try {
    const functionsList = execSync('supabase functions list', { encoding: 'utf-8' });
    console.log('函数列表:', functionsList);
    
    if (functionsList.includes('cas-exchange-token')) {
      console.log('✓ cas-exchange-token 函数已部署');
    } else {
      console.log('⚠ cas-exchange-token 函数未部署');
      console.log('  请运行: supabase functions deploy cas-exchange-token');
    }
  } catch (error) {
    console.log('⚠ 无法获取函数列表:', error.message);
    console.log('  可能需要先链接项目: supabase link --project-ref ggpysmxalhbwaebdxfah');
  }

  // 检查配置文件
  const configFile = './supabase/config.toml';
  if (fs.existsSync(configFile)) {
    const config = fs.readFileSync(configFile, 'utf-8');
    console.log('✓ Supabase 配置文件存在');
    
    if (config.includes('cas-exchange-token')) {
      console.log('✓ cas-exchange-token 函数在配置中定义');
    } else {
      console.log('⚠ cas-exchange-token 函数未在配置中定义');
    }
  } else {
    console.log('⚠ Supabase 配置文件不存在');
  }

  // 检查函数文件
  const functionFile = './supabase/functions/cas-exchange-token/index.ts';
  if (fs.existsSync(functionFile)) {
    console.log('✓ Edge Function 文件存在');
  } else {
    console.log('⚠ Edge Function 文件不存在');
  }

  console.log('\n如果函数未部署，请执行以下命令:');
  console.log('1. supabase link --project-ref ggpysmxalhbwaebdxfah');
  console.log('2. supabase functions deploy cas-exchange-token');
  console.log('3. supabase secrets set CAS_CLIENT_ID="eclBK03n7FUfSlJi"');
  console.log('4. supabase secrets set CAS_CLIENT_SECRET="5MVevItUIigYVWptOO3D7Q"');
  console.log('5. supabase secrets set CAS_SERVER_URL="https://cas.wzbc.edu.cn"');
  console.log('6. supabase secrets set CAS_CALLBACK_URL="https://fsif.wzbc.edu.cn/auth/callback"');
  console.log('7. supabase secrets set SUPABASE_URL="https://ggpysmxalhbwaebdxfah.supabase.co"');
  console.log('8. supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');

} catch (error) {
  console.error('检查过程中出现错误:', error.message);
}
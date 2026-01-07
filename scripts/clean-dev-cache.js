/**
 * 清理开发环境缓存脚本
 * 用于解决 Supabase URL 缓存问题
 */

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

console.log('开始清理开发环境缓存...');

try {
  // 1. 清理 .vite 缓存
  const viteCacheDir = join(process.cwd(), 'node_modules/.vite');
  if (existsSync(viteCacheDir)) {
    console.log('删除 Vite 缓存目录...');
    rmSync(viteCacheDir, { recursive: true, force: true });
  }

  // 2. 清理 .vite 根目录缓存（如果存在）
  const rootViteDir = join(process.cwd(), '.vite');
  if (existsSync(rootViteDir)) {
    console.log('删除根目录 Vite 缓存...');
    rmSync(rootViteDir, { recursive: true, force: true });
  }

  // 3. 清理 dist 构建目录（如果存在）
  const distDir = join(process.cwd(), 'dist');
  if (existsSync(distDir)) {
    console.log('删除构建目录...');
    rmSync(distDir, { recursive: true, force: true });
  }

  // 4. 清理临时构建缓存
  const tempBuildDir = join(process.cwd(), '.temp-build');
  if (existsSync(tempBuildDir)) {
    console.log('删除临时构建目录...');
    rmSync(tempBuildDir, { recursive: true, force: true });
  }

  console.log('\n清理完成！');
  console.log('接下来请执行以下操作：');
  console.log('1. 关闭当前的开发服务器 (Ctrl+C)');
  console.log('2. 完全关闭浏览器窗口');
  console.log('3. 重新启动开发服务器: pnpm dev');
  console.log('4. 使用无痕/隐私模式打开浏览器');
  console.log('5. 检查浏览器控制台确认新的 Supabase URL');

  // 5. 检查当前环境变量
  console.log('\n当前环境变量检查：');
  console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_URL.includes('ggpysmxalhbwaebdxfah')) {
    console.log('✓ 当前环境变量使用正确的项目 URL');
  } else {
    console.log('⚠ 当前环境变量可能未使用正确的项目 URL');
    console.log('  请确保 .env 文件包含: VITE_SUPABASE_URL=https://ggpysmxalhbwaebdxfah.supabase.co');
  }
} catch (error) {
  console.error('清理过程中出现错误:', error.message);
}
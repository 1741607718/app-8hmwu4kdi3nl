import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase 配置检查:');
console.log('- URL:', supabaseUrl);
console.log('- Anon Key 存在:', !!supabaseAnonKey);
console.log('- URL 有效性:', supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://'));

// 验证 Supabase 配置
if (!supabaseUrl) {
  console.error('错误: VITE_SUPABASE_URL 环境变量未设置');
} else if (!supabaseUrl.includes('ggpysmxalhbwaebdxfah')) {
  console.warn('警告: 当前 Supabase URL 可能不是最新的项目 URL');
  console.log('当前 URL:', supabaseUrl);
  console.log('最新项目 URL 应包含: ggpysmxalhbwaebdxfah');
} else {
  console.log('✓ 当前 URL 包含正确的项目 ID');
}

if (!supabaseAnonKey) {
  console.error('错误: VITE_SUPABASE_ANON_KEY 环境变量未设置');
}

// 添加额外的调试信息
console.log('检查是否可以从浏览器访问 Supabase 函数端点...');
if (supabaseUrl) {
  const functionsUrl = supabaseUrl.replace('supabase.co', 'supabase.co/functions/v1');
  console.log('函数端点 URL:', functionsUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
            
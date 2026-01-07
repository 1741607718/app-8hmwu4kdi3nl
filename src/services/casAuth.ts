import { supabase } from '@/db/supabase';

/**
 * 处理CAS回调，验证state参数并提取code
 */
export function handleCASCallback() {
  // 从URL中获取参数
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  // 从sessionStorage中获取之前保存的state
  const savedState = sessionStorage.getItem('cas_state');
  
  console.log('处理CAS回调:', { code, state, savedState });

  // 验证state
  if (!code || !state || state !== savedState) {
    console.error('CAS回调验证失败', { code, state, savedState, valid: state === savedState });
    return null;
  }

  sessionStorage.removeItem('cas_state');
  return { code, state };
}

/**
 * 执行CAS登录流程
 */
export async function performCASLogin(code: string) {
  // 检查Supabase配置
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 配置缺失，请检查环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  }
  
  // 尝试调用Supabase函数
  const supabase = (await import('@/db/supabase')).supabase;
  
  const response = await supabase.functions.invoke('cas-exchange-token', {
    body: { code }
  });
  
  if (response.error) {
    throw response.error;
  }
  
  return response.data;
}

// 生成随机state
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 重定向到CAS登录
 */
export function redirectToCASLogin() {
  const state = generateRandomState();
  sessionStorage.setItem('cas_state', state);
  
  // 构建CAS登录URL
  const CAS_CONFIG = {
    serverUrl: import.meta.env.VITE_CAS_SERVER_URL || 'https://cas.wzbc.edu.cn',
    clientId: import.meta.env.VITE_CAS_CLIENT_ID || 'eclBK03n7FUfSlJi',
    redirectUri: import.meta.env.VITE_CAS_CALLBACK_URL || window.location.origin + '/auth/callback',
  };

  // 确保serverUrl以/cas结尾
  let baseUrl = CAS_CONFIG.serverUrl;
  if (!baseUrl.endsWith('/cas')) {
    baseUrl = baseUrl + '/cas';
  }
  if (!baseUrl.endsWith('/')) {
    baseUrl = baseUrl + '/';
  }

  const casLoginUrl = `${baseUrl}oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(CAS_CONFIG.clientId)}&redirect_uri=${encodeURIComponent(CAS_CONFIG.redirectUri)}&state=${encodeURIComponent(state)}`;

  // 重定向到CAS登录页面
  window.location.href = casLoginUrl;
}
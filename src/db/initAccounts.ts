import { supabase } from './supabase';

/**
 * 初始化测试账号
 * 调用Edge Function创建admin和user测试账号
 */
export async function initTestAccounts() {
  try {
    const { data, error } = await supabase.functions.invoke('init-test-accounts', {
      body: {},
    });

    if (error) {
      const errorMsg = await error?.context?.text();
      console.error('初始化测试账号失败:', errorMsg || error?.message);
      return { success: false, error: errorMsg || error?.message };
    }

    console.log('测试账号初始化成功:', data);
    return { success: true, data };
  } catch (error) {
    console.error('初始化测试账号异常:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

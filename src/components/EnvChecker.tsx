import React from 'react';

const EnvChecker: React.FC = () => {
  const envVars = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    casClientId: import.meta.env.VITE_CAS_CLIENT_ID,
    casServerUrl: import.meta.env.VITE_CAS_SERVER_URL,
    casCallbackUrl: import.meta.env.VITE_CAS_CALLBACK_URL,
  };

  const isSupabaseConfigValid = envVars.supabaseUrl && envVars.supabaseUrl.includes('ggpysmxalhbwaebdxfah');
  const isCasConfigValid = envVars.casClientId && envVars.casServerUrl && envVars.casCallbackUrl;

  return (
    <div className="p-4 bg-gray-100 rounded-lg max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">环境变量检查</h2>
      
      <div className="space-y-2">
        <div className={`p-2 rounded ${envVars.supabaseUrl ? 'bg-green-100' : 'bg-red-100'}`}>
          <strong>VITE_SUPABASE_URL:</strong> {envVars.supabaseUrl || '未设置'}
          {envVars.supabaseUrl && (
            <span className="ml-2">
              {isSupabaseConfigValid ? '✓ 正确' : '⚠ 不正确'}
            </span>
          )}
        </div>
        
        <div className={`p-2 rounded ${envVars.supabaseAnonKey ? 'bg-green-100' : 'bg-red-100'}`}>
          <strong>VITE_SUPABASE_ANON_KEY:</strong> {envVars.supabaseAnonKey ? '[已设置]' : '未设置'}
        </div>
        
        <div className={`p-2 rounded ${envVars.casClientId ? 'bg-green-100' : 'bg-red-100'}`}>
          <strong>VITE_CAS_CLIENT_ID:</strong> {envVars.casClientId || '未设置'}
        </div>
        
        <div className={`p-2 rounded ${envVars.casServerUrl ? 'bg-green-100' : 'bg-red-100'}`}>
          <strong>VITE_CAS_SERVER_URL:</strong> {envVars.casServerUrl || '未设置'}
        </div>
        
        <div className={`p-2 rounded ${envVars.casCallbackUrl ? 'bg-green-100' : 'bg-red-100'}`}>
          <strong>VITE_CAS_CALLBACK_URL:</strong> {envVars.casCallbackUrl || '未设置'}
        </div>
      </div>
      
      <div className="mt-4 p-3 rounded bg-blue-50">
        <h3 className="font-semibold">配置状态:</h3>
        <p>Supabase 配置: {isSupabaseConfigValid ? '✓ 有效' : '⚠ 无效'}</p>
        <p>CAS 配置: {isCasConfigValid ? '✓ 有效' : '⚠ 无效'}</p>
      </div>
    </div>
  );
};

export default EnvChecker;
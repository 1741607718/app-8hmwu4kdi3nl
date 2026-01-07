// Supabase Edge Function 作为外部API代理
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// 外部API配置
const VEHICLE_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

const FIRE_SAFETY_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

serve(async (req) => {
  console.log('API代理函数被调用:', req.method, req.url);

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // 从路径中提取API类型，路径格式为 /functions/v1/api-proxy/vehicle 或 /functions/v1/api-proxy/fire-safety
    const pathParts = url.pathname.split('/');
    console.log('原始路径:', url.pathname);
    console.log('路径部分:', pathParts);
    
    // 在Supabase Edge Function中，请求路径是 /functions/v1/api-proxy/{type}
    // 所以我们要找的是 'api-proxy' 后面的部分
    let apiType = '';
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === 'api-proxy' && i + 1 < pathParts.length) {
        apiType = pathParts[i + 1];
        break;
      }
    }
    
    console.log('检测到的API类型:', apiType);
    const queryParams = url.search;

    let apiUrl: string;
    let config: typeof VEHICLE_API_CONFIG;

    // 根据API类型选择配置
    if (apiType === 'vehicle') {
      config = VEHICLE_API_CONFIG;
      apiUrl = `${config.baseUrl}${queryParams}`;
    } else if (apiType === 'fire-safety') {
      config = FIRE_SAFETY_API_CONFIG;
      apiUrl = `${config.baseUrl}${queryParams}`;
    } else {
      return new Response(
        JSON.stringify({ error: '不支持的API类型' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('请求外部API:', apiUrl);

    // 调用外部API
    const externalResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!externalResponse.ok) {
      throw new Error(`外部API请求失败: ${externalResponse.status} ${externalResponse.statusText}`);
    }

    const data = await externalResponse.json();

    console.log('外部API响应成功');

    // 返回响应
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('API代理错误:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '未知错误',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
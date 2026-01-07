// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req) => {
  console.log('=== Edge Function 被调用 ===');
  console.log('请求方法:', req.method);
  console.log('请求URL:', req.url);

  // 处理 CORS preflight 请求
  if (req.method === 'OPTIONS') {
    console.log('处理 OPTIONS 请求');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 记录原始请求体
    const rawBody = await req.text();
    console.log('原始请求体:', rawBody);

    let code = '';
    try {
      const data = JSON.parse(rawBody);
      code = data.code;
      console.log('解析到的code:', code ? `${code.substring(0, 10)}...` : '空');
    } catch (e) {
      console.error('解析JSON失败:', e.message);
      throw new Error('请求体不是有效的JSON格式');
    }

    if (!code) {
      throw new Error('请求中缺少授权码 (code)')
    }

    // 1. CAS / OAuth2 配置
    const CAS_CONFIG = {
      serverUrl: Deno.env.get('OAUTH_SERVER_URL') || 'https://cas.wzbc.edu.cn',
      clientId: Deno.env.get('OAUTH_CLIENT_ID') || 'eclBK03n7FUfSlJi',
      clientSecret: Deno.env.get('OAUTH_CLIENT_SECRET') || '5MVevItUIigYVWptOO3D7Q',
      redirectUri: Deno.env.get('OAUTH_REDIRECT_URI') || 'https://fsif.wzbc.edu.cn/auth/callback',
    }

    console.log('使用的CAS配置:', {
      serverUrl: CAS_CONFIG.serverUrl,
      clientId: CAS_CONFIG.clientId,
      clientSecret: '***隐藏***',
      redirectUri: CAS_CONFIG.redirectUri
    });

    // 检查必需的配置
    if (!CAS_CONFIG.serverUrl || !CAS_CONFIG.clientId || !CAS_CONFIG.clientSecret || !CAS_CONFIG.redirectUri) {
      console.error('CAS_CONFIG 检查失败:', {
        serverUrl: !!CAS_CONFIG.serverUrl,
        clientId: !!CAS_CONFIG.clientId,
        clientSecret: !!CAS_CONFIG.clientSecret,
        redirectUri: !!CAS_CONFIG.redirectUri
      });
      throw new Error('缺少必需的CAS配置环境变量 (OAUTH_SERVER_URL, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)')
    }

    // 2. 步骤1: 使用授权码换取 Access Token
    // 根据CAS文档，使用GET请求 + Basic Auth认证
    const tokenUrl = new URL(`${CAS_CONFIG.serverUrl}/cas/oauth2.0/accessToken`);
    tokenUrl.searchParams.append('grant_type', 'authorization_code');
    tokenUrl.searchParams.append('redirect_uri', CAS_CONFIG.redirectUri);
    tokenUrl.searchParams.append('code', code);

    console.log('请求Access Token URL:', tokenUrl.toString());

    // 生成Basic Auth凭证
    const basicAuth = btoa(`${CAS_CONFIG.clientId}:${CAS_CONFIG.clientSecret}`);

    console.log('尝试GET请求获取Access Token...');
    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      }
    });

    console.log('Token响应状态:', tokenResponse.status, tokenResponse.statusText);

    const tokenResponseText = await tokenResponse.text();
    console.log('Token响应原始文本:', tokenResponseText);

    // 处理响应格式 - CAS可能返回JSON或URL编码格式
    let tokenData: any = {};

    if (tokenResponseText.includes('access_token=')) {
      // 如果是URL编码格式 (access_token=xxx&expires_in=3600)
      console.log('检测到URL编码格式响应');
      const params = new URLSearchParams(tokenResponseText);
      tokenData = Object.fromEntries(params.entries());
    } else {
      // 尝试解析为JSON
      try {
        tokenData = JSON.parse(tokenResponseText);
        console.log('成功解析为JSON格式');
      } catch (e) {
        // 如果GET失败，尝试POST方法
        console.log('尝试POST请求获取Access Token...');

        const formData = new URLSearchParams();
        formData.append('grant_type', 'authorization_code');
        formData.append('client_id', CAS_CONFIG.clientId);
        formData.append('client_secret', CAS_CONFIG.clientSecret);
        formData.append('redirect_uri', CAS_CONFIG.redirectUri);
        formData.append('code', code);

        const postResponse = await fetch(`${CAS_CONFIG.serverUrl}/cas/oauth2.0/accessToken`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: formData
        });

        const postText = await postResponse.text();
        console.log('POST响应状态:', postResponse.status, postResponse.statusText);
        console.log('POST响应文本:', postText);

        if (postText.includes('access_token=')) {
          const params = new URLSearchParams(postText);
          tokenData = Object.fromEntries(params.entries());
        } else {
          try {
            tokenData = JSON.parse(postText);
          } catch (parseError) {
            throw new Error(`无法解析CAS响应: ${postText.substring(0, 200)}`);
          }
        }
      }
    }

    console.log('解析后的Token数据:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    });

    if (!tokenData.access_token) {
      throw new Error(`获取Access Token失败: ${tokenData.error_description || tokenData.error || '未知错误'}`)
    }

    console.log('成功获取到 Access Token');

    // 3. 步骤2: 使用 Access Token 获取用户信息
    const userInfoUrl = new URL(`${CAS_CONFIG.serverUrl}/cas/oauth2.0/profile`);
    userInfoUrl.searchParams.append('access_token', tokenData.access_token);

    console.log('请求用户信息URL:', userInfoUrl.toString());

    const userInfoResponse = await fetch(userInfoUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    console.log('用户信息响应状态:', userInfoResponse.status, userInfoResponse.statusText);
    const userInfoResponseText = await userInfoResponse.text();
    console.log('用户信息响应原始文本:', userInfoResponseText);

    if (!userInfoResponse.ok) {
        throw new Error(`获取用户信息失败: ${userInfoResponse.status} ${userInfoResponse.statusText}`);
    }

    let userInfo;
    try {
        userInfo = JSON.parse(userInfoResponseText);
    } catch (e) {
        throw new Error(`解析用户信息失败: 响应不是有效的JSON。响应体: ${userInfoResponseText.substring(0, 200)}`);
    }

    console.log('成功获取到用户信息:', JSON.stringify({
      id: userInfo.id,
      attributes: userInfo.attributes
    }, null, 2));

    // 4. 步骤3: 在 Supabase 中创建或更新用户
    const supabaseAdmin = createClient(
      'https://ggpysmxalhbwaebdxfah.supabase.co',  // 硬编码
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      throw new Error('缺少Supabase环境变量 SUPABASE_SERVICE_ROLE_KEY');
    }

    // 使用CAS用户ID作为邮箱的唯一标识
    const email = `${userInfo.id}@cas.wzbc.edu.cn`;
    console.log('为用户生成的邮箱:', email);

    // 尝试创建用户，如果已存在则继续
    console.log(`尝试创建用户 ${email}...`);
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        cas_id: userInfo.id,
        username: userInfo.attributes?.username || userInfo.attributes?.name || userInfo.attributes?.displayName || userInfo.id,
        name: userInfo.attributes?.name || userInfo.attributes?.displayName || userInfo.id,
        full_name: userInfo.attributes?.name || userInfo.attributes?.displayName || userInfo.id, // 添加完整姓名字段
      }
    });

    if (createUserError) {
      // 关键修复：用户已存在是正常情况，不应该抛错
      if (createUserError.message.includes('already registered') ||
          createUserError.message.includes('email address has already been registered') ||
          createUserError.code === 'email_exists') {
        console.log(`用户 ${email} 已存在，这是正常情况，继续处理...`);
        // 不要抛出错误，继续执行
      } else {
        console.error('创建用户时出错:', createUserError);
        // 只有非"用户已存在"的错误才抛出
        throw createUserError;
      }
    } else {
      console.log('成功创建新用户');
    }

    // 5. 为用户生成一个可登录的 Session
    console.log('为用户生成登录Session...');
    
    // 获取前端应用的正确URL作为重定向目标
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://fsif.wzbc.edu.cn';
    console.log('前端URL:', frontendUrl);
    
    // 确保使用正确的参数结构
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        // 使用 emailRedirectTo 而不是 redirectTo
        emailRedirectTo: frontendUrl,
      }
    });

    if (sessionError) {
      console.error('生成登录链接时出错:', sessionError);
      // 这里需要检查是否是"用户不存在"的错误
      if (sessionError.message.includes('No such user') ||
          sessionError.message.includes('User not found')) {
        // 如果用户不存在，但我们已经尝试创建了，这可能是个问题
        throw new Error('用户创建失败，无法生成登录链接');
      }
      throw sessionError;
    }

    console.log('生成的会话数据:', JSON.stringify(sessionData, null, 2));
    
    console.log('=== 函数执行成功 ===');
    
    // 6. 返回成功响应给前端
    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        user: {
          id: userInfo.id,
          email: email,
          name: userInfo.attributes?.name || userInfo.attributes?.displayName || userInfo.id,
          username: userInfo.attributes?.username || userInfo.id
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('=== Edge Function 执行错误 ===');
    console.error('错误类型:', error.constructor?.name);
    console.error('错误信息:', error.message);

    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
})
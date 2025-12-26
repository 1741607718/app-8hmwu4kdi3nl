import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建 Supabase Admin 客户端
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 创建管理员账号
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@miaoda.com',
      password: '123456',
      email_confirm: true,
      user_metadata: {
        username: 'admin'
      }
    })

    if (adminError && !adminError.message.includes('already registered')) {
      throw adminError
    }

    // 创建普通用户账号
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'user@miaoda.com',
      password: '123456',
      email_confirm: true,
      user_metadata: {
        username: 'user'
      }
    })

    if (userError && !userError.message.includes('already registered')) {
      throw userError
    }

    // 如果用户已存在，获取用户信息
    let adminId = adminData?.user?.id
    let userId = userData?.user?.id

    if (!adminId) {
      const { data: existingAdmin } = await supabaseAdmin.auth.admin.listUsers()
      const admin = existingAdmin.users.find(u => u.email === 'admin@miaoda.com')
      adminId = admin?.id
    }

    if (!userId) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const user = existingUsers.users.find(u => u.email === 'user@miaoda.com')
      userId = user?.id
    }

    // 确保 profiles 表中有对应记录
    if (adminId) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: adminId,
          username: 'admin',
          email: 'admin@miaoda.com',
          role: 'admin',
          permissions: { canExport: true, dataScope: [] }
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('创建管理员profile失败:', profileError)
      }
    }

    if (userId) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          username: 'user',
          email: 'user@miaoda.com',
          role: 'user',
          permissions: { canExport: false, dataScope: [] }
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('创建普通用户profile失败:', profileError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '测试账号创建成功',
        accounts: [
          { username: 'admin', password: '123456', role: '管理员' },
          { username: 'user', password: '123456', role: '普通用户' }
        ]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

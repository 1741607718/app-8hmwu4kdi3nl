import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { handleCASCallback } from '@/services/casAuth';
import { supabase } from '@/db/supabase';

export default function CASCallbackPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const handleCASLogin = async () => {
      try {
        const casData = handleCASCallback();
        if (!casData) {
          throw new Error('CAS回调验证失败');
        }

        // 检查 Supabase 客户端配置
        console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
        console.log('Supabase Anon Key 存在:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
        
        // 验证环境变量
        if (!import.meta.env.VITE_SUPABASE_URL) {
          throw new Error('环境变量 VITE_SUPABASE_URL 未设置');
        }
        if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
          throw new Error('环境变量 VITE_SUPABASE_ANON_KEY 未设置');
        }
        
        // 调用Supabase Edge Function来处理CAS token交换
        console.log('开始调用Supabase函数: cas-exchange-token');
        console.log('授权码:', casData.code);
        
        const response = await supabase.functions.invoke('cas-exchange-token', {
          body: {
            code: casData.code,
          },
        });

        console.log('Supabase函数响应:', response);

        if (response.error) {
          console.error('Supabase函数调用错误详情:', response.error);
          console.error('错误名称:', response.error.name);
          console.error('错误消息:', response.error.message);
          console.error('错误代码:', (response.error as any).code);
          throw new Error(response.error.message || '调用Supabase函数失败');
        }

        const data = response.data;
        if (!data || !data.success) {
          throw new Error(data?.error || 'CAS认证失败');
        }

        // CAS 认证成功，现在需要完成登录流程
        const { session, user } = data;
        
        console.log('收到服务器响应:', { session, user });
        
        // 尝试从 Supabase 生成的 session 中获取登录链接
        let actionLink = null;
        
        // 根据日志，正确的数据结构是 session.properties.action_link
        if (session && session.properties && session.properties.action_link) {
          actionLink = session.properties.action_link;
        } 
        // 检查其他可能的字段
        else if (session && session.properties?.email_otp) {
          console.log('发现 email_otp，尝试使用 OTP 登录');
          // 使用 OTP 登录
          const { error } = await supabase.auth.signInWithOtp({
            email: user.email,
            options: {
              emailRedirectTo: window.location.origin,
            }
          });
          
          if (error) {
            console.error('OTP 登录失败:', error);
          } else {
            console.log('OTP 登录请求已发送');
          }
        }
        // 检查其他可能的链接字段
        else if (session?.action_link) {
          actionLink = session.action_link;
        }
        else if (session?.url) {
          actionLink = session.url;
        }
        
        if (actionLink) {
          console.log('检测到登录链接，跳转到:', actionLink);
          // 重定向到 magic link 完成登录
          window.location.href = actionLink;
          return; // 立即返回，不执行后续导航
        } else {
          console.log('未找到action_link，当前会话数据结构:', session);
          // 如果没有找到 action_link，说明可能Edge Function逻辑有变化
          // 我们仍然等待认证状态同步
          toast({
            title: '处理中',
            description: '正在处理认证，请稍候...',
          });
          
          // 持续检查认证状态，直到用户被认证或超时
          const checkAuthStatus = async (maxAttempts = 30) => { // 最多等待30秒
            for (let i = 0; i < maxAttempts; i++) {
              // 检查当前URL是否包含认证相关的参数
              const currentUrl = new URL(window.location.href);
              const error = currentUrl.searchParams.get('error');
              
              if (error) {
                console.error('URL中包含错误参数:', error);
                throw new Error(`认证过程中出现错误: ${error}`);
              }
              
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                console.log('用户已认证，跳转到主页');
                // 刷新用户配置以确保获取最新信息
                await refreshProfile();
                navigate('/');
                return true; // 成功
              }
              
              // 等待1秒再检查
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log('等待认证超时');
            return false; // 超时
          };
          
          // 开始检查认证状态
          const authenticated = await checkAuthStatus();
          
          if (!authenticated) {
            // 如果超时仍未认证，跳转到登录页
            toast({
              title: '认证超时',
              description: '认证状态同步超时，请重新登录',
              variant: 'destructive',
            });
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('CAS登录失败:', error);
        let errorMessage = 'CAS认证失败';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        // 特别处理网络错误
        if (errorMessage.includes('net::ERR_NAME_NOT_RESOLVED') || 
            errorMessage.includes('Failed to send a request to the Edge Function')) {
          errorMessage = '无法连接到认证服务器，请检查网络连接或联系管理员';
        }
        
        toast({
          title: '登录失败',
          description: `错误: ${errorMessage}`,
          variant: 'destructive',
        });
        
        // 添加重试选项或返回登录页
        setTimeout(() => {
          navigate('/login');
        }, 5000); // 5秒后自动跳转回登录页
      }
    };

    handleCASLogin();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold">正在处理CAS认证...</h3>
              <p className="text-muted-foreground mt-2">正在同步您的账户信息</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setSessionFlag(name: string, value: string): void {
  try {
    sessionStorage.setItem(name, value);
  } catch {
    // ignore
  }
}

export default function CASCallbackPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const processingRef = useRef(false);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleCASLogin = async () => {
      if (processingRef.current) {
        return;
      }
      processingRef.current = true;

      const safeNavigate = (path: string) => {
        window.location.replace(path);
      };

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        const parseApiResponse = async (response: Response) => {
          const rawText = await response.text();

          try {
            return JSON.parse(rawText);
          } catch {
            const compactText = rawText.replace(/\s+/g, ' ').trim();
            throw new Error(compactText.slice(0, 240) || `认证服务返回了非 JSON 响应（HTTP ${response.status}）`);
          }
        };

        if (!code) {
          safeNavigate('/login');
          return;
        }

        const lastProcessedCode = sessionStorage.getItem('cas_last_processed_code') || getCookie('cas_last_processed_code');
        if (code === lastProcessedCode) {
          safeNavigate('/');
          return;
        }

        setSessionFlag('cas_last_processed_code', code);

        const sessionCheckResponse = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
        });

        let sessionCheck: { success?: boolean; data?: { id?: string } } = { success: false };
        try {
          sessionCheck = await parseApiResponse(sessionCheckResponse);
        } catch {
          sessionCheck = { success: false };
        }

        if (sessionCheck.success && sessionCheck.data?.id) {
          safeNavigate('/');
          return;
        }

        const postResponse = await fetch('/api/auth/cas/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state: state || '' }),
        });

        let data = await parseApiResponse(postResponse);

        if (!data.success && (data.error?.includes('授权码') || data.error?.includes('invalid_request'))) {
          const params = new URLSearchParams({ code, state: state || '' });
          const getResponse = await fetch(`/api/auth/cas/callback?${params.toString()}`);
          data = await parseApiResponse(getResponse);
        }

        if (!data.success) {
          throw new Error(data.error || 'CAS认证失败');
        }

        const token = data.token || data.data?.token;
        const user = data.user || data.data?.user;

        if (!token || !user?.id) {
          throw new Error('认证服务未返回有效登录信息');
        }

        localStorage.setItem('token', token);
        localStorage.setItem('userId', user.id);

        setStatus('success');
        safeNavigate('/');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'CAS认证失败';
        setStatus('error');
        toast({
          title: '登录失败',
          description: errorMessage,
          variant: 'destructive',
        });
        setTimeout(() => navigate('/login'), 5000);
      }
    };

    void handleCASLogin();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
          {status === 'processing' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">正在处理CAS认证...</h3>
                <p className="text-muted-foreground mt-2">正在同步您的账户信息</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">登录成功</h3>
                <p className="text-muted-foreground mt-2">正在跳转到主页...</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">登录失败</h3>
                <p className="text-muted-foreground mt-2">认证过程中出现错误</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

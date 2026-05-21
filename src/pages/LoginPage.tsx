

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, UserRound, Loader2 } from 'lucide-react';
import { redirectToCASLogin } from '@/services/casAuth';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
      return;
    }

    const hasToken = Boolean(localStorage.getItem('token'));
    const isLoggingOut = sessionStorage.getItem('logging_out') === 'true';
    const hasCode = new URLSearchParams(location.search).has('code');

    if (!hasToken && !isLoggingOut && !hasCode) {
      void autoLogin();
    }
  }, [user, navigate, from, location.search]);

  const autoLogin = async () => {
    setError('');
    setLoading(true);
    setShowLoading(true);

    try {
      // 直接调用 CAS 登录
      redirectToCASLogin();
    } catch (err) {
      setError('CAS登录失败，请重试');
      setLoading(false);
      setShowLoading(false);
    }
  };

  const handleCASLogin = async () => {
    autoLogin();
  };

  // 如果正在加载，显示加载界面
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">准备跳转到统一身份认证...</h3>
                <p className="text-muted-foreground mt-2">请稍候，正在前往学校CAS登录页面</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">消防安全一张表</CardTitle>
          <CardDescription>
            温州商学院安全数据展示平台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="button" 
              className="w-full h-12 text-lg" 
              onClick={handleCASLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在跳转...
                </>
              ) : (
                <>
                  <UserRound className="mr-2 h-4 w-4" />
                  点击进入统一身份认证
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground mt-4">
              点击按钮后将跳转到学校统一身份认证
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

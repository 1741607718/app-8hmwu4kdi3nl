import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Key } from 'lucide-react';
import { initTestAccounts } from '@/db/initAccounts';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [initLoading, setInitLoading] = useState(false);
  const [initSuccess, setInitSuccess] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/';

  const handleInitTestAccounts = async () => {
    setInitLoading(true);
    setError('');
    try {
      const result = await initTestAccounts();
      if (result.success) {
        setInitSuccess(true);
        setError('');
        alert('测试账号初始化成功！\n\n管理员: admin / 123456\n普通用户: user / 123456\n\n请使用上述账号登录');
      } else {
        setError(result.error || '初始化失败');
      }
    } catch (err) {
      setError('初始化失败，请重试');
    } finally {
      setInitLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证用户名格式
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('用户名只能包含字母、数字和下划线');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('密码长度至少为6位');
        setLoading(false);
        return;
      }

      const result = activeTab === 'login' 
        ? await signIn(username, password)
        : await signUp(username, password);

      if (result.error) {
        if (result.error.message.includes('Invalid login credentials')) {
          setError('用户名或密码错误');
        } else if (result.error.message.includes('User already registered')) {
          setError('用户名已存在');
        } else {
          setError(result.error.message);
        }
      } else {
        // 登录成功，跳转到之前的页面或首页
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

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
            安全数据展示平台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">或</span>
                  </div>
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleInitTestAccounts}
                  disabled={initLoading || initSuccess}
                >
                  <Key className="mr-2 h-4 w-4" />
                  {initLoading ? '初始化中...' : initSuccess ? '测试账号已创建' : '创建测试账号'}
                </Button>

                <div className="text-sm text-muted-foreground text-center mt-4">
                  <p>测试账号：</p>
                  <p>管理员: admin / 123456</p>
                  <p>普通用户: user / 123456</p>
                  <p className="text-xs mt-2 text-warning">首次使用请先点击"创建测试账号"</p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">用户名</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="字母、数字、下划线"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="至少6位"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '注册中...' : '注册'}
                </Button>

                <div className="text-sm text-muted-foreground text-center mt-4">
                  <p>注册后自动登录</p>
                  <p>首个注册用户将成为管理员</p>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

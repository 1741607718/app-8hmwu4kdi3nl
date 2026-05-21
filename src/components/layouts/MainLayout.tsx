import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Car, 
  Users, 
  Flame, 
  Shield, 
  Building2, 
  Menu, 
  LogOut, 
  User,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

interface MainLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    title: '数据总览',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: '车辆数据',
    href: '/vehicles',
    icon: Car,
  },
  {
    title: '人员数据',
    href: '/personnel',
    icon: Users,
  },
  {
    title: '消防数据',
    href: '/fire-safety',
    icon: Flame,
  },
  {
    title: '安全数据',
    href: '/security',
    icon: Shield,
  },
  {
    title: '宿管数据',
    href: '/dormitory',
    icon: Building2,
  },
  {
    title: '权限管理',
    href: '/admin',
    icon: Settings,
    adminOnly: true,
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { profile } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return profile?.role === 'admin';
    }
    return true;
  });

  return (
    <nav className="space-y-1">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-linear-to-r from-sidebar-primary to-chart-2 text-sidebar-primary-foreground shadow-[0_10px_30px_-16px_hsl(var(--sidebar-primary)/0.8)]'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground hover:translate-x-1'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 检测是否在钉钉环境中
  const isInDingTalk = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('dingtalk') || userAgent.includes('dingtalk') ||
           (window as any).DD || (window as any).dingtalk;
  };

  // 检测是否为移动设备
  const isMobileDevice = () => {
    return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // 判断是否在钉钉移动端环境中
  const shouldHideUserMarker = isInDingTalk() && isMobileDevice();

  const handleSignOut = async () => {
    if (shouldHideUserMarker) {
      // 在钉钉移动端环境中，不执行登出操作
      return;
    }
    await signOut();
    navigate('/login');
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_24%),radial-gradient(circle_at_bottom_right,hsl(var(--chart-2)/0.08),transparent_20%)]" />
      {/* 桌面侧边栏 */}
      <aside className="relative hidden w-72 shrink-0 border-r border-sidebar-border/70 bg-sidebar/95 backdrop-blur-xl lg:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="border-b border-sidebar-border/70 p-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="rounded-2xl bg-linear-to-br from-sidebar-primary/30 to-chart-2/20 p-3 shadow-inner ring-1 ring-white/10">
                <Shield className="h-6 w-6 text-sidebar-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">消防安全</h1>
                <p className="text-xs text-sidebar-foreground/60">数据展示平台</p>
              </div>
            </Link>
          </div>

          {/* 导航 */}
          <div className="flex-1 p-4 overflow-y-auto">
            <NavLinks />
          </div>

          {/* 用户信息 - 在钉钉移动端环境中隐藏 */}
          {!shouldHideUserMarker && (
            <div className="p-4 border-t border-sidebar-border bg-sidebar-muted/30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {profile?.name?.slice(0, 1) || profile?.username?.slice(0, 1) || <User className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-medium truncate">{profile?.name || profile?.username}</div>
                      <div className="text-xs text-muted-foreground truncate">{profile?.role === 'admin' ? '系统管理员' : '普通用户'}</div>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>用户选项</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {profile?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Settings className="w-4 h-4 mr-2" />
                      权限管理
                    </DropdownMenuItem>
                  )}
                  {!shouldHideUserMarker && (
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700">
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
          <div className="flex h-16 items-center gap-4 px-4 xl:px-6">
            {/* 移动端菜单按钮 */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">打开菜单</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader>
                  <SheetTitle>
                    <VisuallyHidden>菜单</VisuallyHidden>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full bg-sidebar">
                  {/* Logo */}
                  <div className="p-6 border-b border-sidebar-border">
                    <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h1 className="text-lg font-bold text-sidebar-foreground">消防安全</h1>
                        <p className="text-xs text-sidebar-foreground/60">数据展示平台</p>
                      </div>
                    </Link>
                  </div>

                  {/* 导航 */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
                  </div>

                  {/* 底部用户信息 - 在钉钉移动端环境中隐藏 */}
                  {!shouldHideUserMarker && (
                    <div className="p-4 border-t border-sidebar-border bg-sidebar-muted/30">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                              {profile?.name?.slice(0, 1) || profile?.username?.slice(0, 1) || <User className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="text-sm font-medium truncate">{profile?.name || profile?.username}</div>
                              <div className="text-xs text-muted-foreground truncate">{profile?.role === 'admin' ? '系统管理员' : '普通用户'}</div>
                            </div>
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>用户选项</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {profile?.role === 'admin' && (
                            <DropdownMenuItem onClick={() => navigate('/admin')}>
                              <Settings className="w-4 h-4 mr-2" />
                              权限管理
                            </DropdownMenuItem>
                          )}
                          {!shouldHideUserMarker && (
                            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-700">
                              <LogOut className="w-4 h-4 mr-2" />
                              退出登录
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* 标题 */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold lg:hidden">消防安全一张表</h2>
            </div>

            {/* 用户菜单 - 在钉钉移动端环境中隐藏 */}
            {!shouldHideUserMarker && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                    <span className="sr-only">用户菜单</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.name || profile?.username || '用户'}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.role === 'admin' ? '管理员' : '普通用户'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {profile?.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" />
                          权限管理
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* 在钉钉移动端环境中显示占位元素，保持布局一致 */}
            {shouldHideUserMarker && (
              <div className="w-8 h-8"></div>
            )}
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

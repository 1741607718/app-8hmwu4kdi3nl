import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
    title: '权限数据',
    href: '/admin/permissions',
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
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* 桌面侧边栏 */}
      <aside className="hidden lg:block w-64 border-r bg-sidebar shrink-0">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-2">
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
            <NavLinks />
          </div>

          {/* 用户信息 */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.name || profile?.username || '用户'}
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  {profile?.role === 'admin' ? '管理员' : '普通用户'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
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
                </div>
              </SheetContent>
            </Sheet>

            {/* 标题 */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold lg:hidden">消防安全一张表</h2>
            </div>

            {/* 用户菜单 */}
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
                      <Link to="/admin/permissions" className="cursor-pointer">
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

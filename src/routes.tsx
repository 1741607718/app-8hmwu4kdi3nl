import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import PersonnelPage from './pages/PersonnelPage';
import FireSafetyPage from './pages/FireSafetyPage';
import SecurityPage from './pages/SecurityPage';
import DormitoryPage from './pages/DormitoryPage';
import AdminPermissionsPage from './pages/AdminPermissionsPage';
import LoginPage from './pages/LoginPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '数据总览',
    path: '/',
    element: <DashboardPage />
  },
  {
    name: '车辆管理',
    path: '/vehicles',
    element: <VehiclesPage />
  },
  {
    name: '人员管理',
    path: '/personnel',
    element: <PersonnelPage />
  },
  {
    name: '消防安全',
    path: '/fire-safety',
    element: <FireSafetyPage />
  },
  {
    name: '安保监控',
    path: '/security',
    element: <SecurityPage />
  },
  {
    name: '宿管数据',
    path: '/dormitory',
    element: <DormitoryPage />
  },
  {
    name: '权限管理',
    path: '/admin/permissions',
    element: <AdminPermissionsPage />
  },
  {
    name: '登录',
    path: '/login',
    element: <LoginPage />,
    visible: false
  }
];

export default routes;

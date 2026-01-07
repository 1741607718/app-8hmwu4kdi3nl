export type PermissionLevel = 'module' | 'stats' | 'detail';

export interface Permission {
  id: string;
  code: string; // e.g., 'dormitory:view', 'dormitory:stats', 'dormitory:detail'
  name: string;
  type: PermissionLevel;
  parentId?: string;
  description?: string;
  children?: Permission[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // List of Permission IDs
}

export interface UserPermission extends Role {
    userId: string;
}

// Global definition of all available permissions in the system
export const SYSTEM_PERMISSIONS: Permission[] = [
  // 宿舍数据
  {
    id: 'dormitory',
    code: 'dormitory',
    name: '宿舍数据模块',
    type: 'module',
    children: [
      { id: 'dormitory-stats', code: 'dormitory:stats', name: '统计数据查询', type: 'stats', parentId: 'dormitory' },
      { id: 'dormitory-detail', code: 'dormitory:detail', name: '详细表单查询', type: 'detail', parentId: 'dormitory' }
    ]
  },
  // 车辆数据
  {
    id: 'vehicle',
    code: 'vehicle',
    name: '车辆数据模块',
    type: 'module',
    children: [
      { id: 'vehicle-stats', code: 'vehicle:stats', name: '统计数据查询', type: 'stats', parentId: 'vehicle' },
      { id: 'vehicle-detail', code: 'vehicle:detail', name: '详细表单查询', type: 'detail', parentId: 'vehicle' }
    ]
  },
   // 人员管理
   {
    id: 'personnel',
    code: 'personnel',
    name: '人员数据模块',
    type: 'module',
    children: [
      { id: 'personnel-stats', code: 'personnel:stats', name: '统计数据查询', type: 'stats', parentId: 'personnel' },
      { id: 'personnel-detail', code: 'personnel:detail', name: '详细表单查询', type: 'detail', parentId: 'personnel' }
    ]
  },
  // 消防数据
  {
    id: 'fire-safety',
    code: 'fire-safety',
    name: '消防数据模块',
    type: 'module',
    children: [
      { id: 'fire-safety-stats', code: 'fire-safety:stats', name: '统计数据查询', type: 'stats', parentId: 'fire-safety' },
      { id: 'fire-safety-detail', code: 'fire-safety:detail', name: '详细表单查询', type: 'detail', parentId: 'fire-safety' }
    ]
  },
  // 安全数据
  {
    id: 'security',
    code: 'security',
    name: '安全数据模块',
    type: 'module',
    children: [
      { id: 'security-stats', code: 'security:stats', name: '统计数据查询', type: 'stats', parentId: 'security' },
      { id: 'security-detail', code: 'security:detail', name: '详细表单查询', type: 'detail', parentId: 'security' }
    ]
  },
  // 权限管理 (Admin only usually)
  {
    id: 'admin',
    code: 'admin',
    name: '系统管理',
    type: 'module',
    children: [
        { id: 'admin-permissions', code: 'admin:permissions', name: '权限管理', type: 'stats', parentId: 'admin' }
    ]
  }
];

export const flattenPermissions = (perms: Permission[]): Permission[] => {
    let result: Permission[] = [];
    perms.forEach(p => {
        result.push(p);
        if (p.children) {
            result = result.concat(flattenPermissions(p.children));
        }
    });
    return result;
}


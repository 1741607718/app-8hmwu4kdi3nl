import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, Save, User, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/types';

export default function AdminPage() {
  const { profile, updateUserPermissions } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  // 编辑状态
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [tempPermissions, setTempPermissions] = useState<any>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取用户列表失败');
      }

      const data = result.data as Profile[];
      setUsers(data);
      const depts = Array.from(new Set(data.map((u) => u.department).filter(Boolean))) as string[];
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       user.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = departmentFilter ? user.department === departmentFilter : true;
    return matchesSearch && matchesDept;
  });

  const handleEditClick = (user: Profile) => {
    setEditingUser(user.id);
    setTempPermissions(user.permissions || {});
  };

  const handlePermissionChange = (module: string, value: string) => {
    setTempPermissions((prev: any) => ({
      ...prev,
      [module]: parseInt(value)
    }));
  };

  const handleSave = async (userId: string) => {
    try {
      await updateUserPermissions(userId, tempPermissions);

      setUsers(users.map(u => u.id === userId ? { ...u, permissions: tempPermissions } : u));
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('更新权限失败');
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setTempPermissions({});
  };

  const handleQuickAction = (level: number) => {
    setTempPermissions({
      vehicle: level,
      personnel: level,
      dormitory: level,
      fireSafety: level,
      security: level
    });
  };

  const getPermissionLabel = (level: number | undefined) => {
    switch(level) {
      case 3: return '完全控制 (导出全部)';
      case 2: return '详细访问 (查看详情/导出)';
      case 1: return '仅查看统计';
      default: return '无权限';
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>您没有权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            权限管理
          </h1>
          <p className="text-muted-foreground mt-1">管理用户对各模块的访问与导出权限</p>
        </div>
      </div>

      <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/6 shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]" />
              用户列表
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名/姓名"
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="筛选部门" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有部门</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/60 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>车辆模块权限</TableHead>
                  <TableHead>人员模块权限</TableHead>
                  <TableHead>宿舍模块权限</TableHead>
                  <TableHead>消防模块权限</TableHead>
                  <TableHead>安保模块权限</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center h-24">加载中...</TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center h-24">未找到用户</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{user.name || user.username}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatDateTime(user.created_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={user.last_login ? '' : 'text-muted-foreground'}>
                            {user.last_login ? formatDateTime(user.last_login) : '从未登录'}
                          </span>
                        </div>
                      </TableCell>

                      {editingUser === user.id ? (
                        <>
                          <TableCell>
                            <Select
                              value={String(tempPermissions.vehicle ?? 1)}
                              onValueChange={(v) => handlePermissionChange('vehicle', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">无权限</SelectItem>
                                <SelectItem value="1">统计</SelectItem>
                                <SelectItem value="2">详情+导出</SelectItem>
                                <SelectItem value="3">全部导出</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(tempPermissions.personnel ?? 1)}
                              onValueChange={(v) => handlePermissionChange('personnel', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">无权限</SelectItem>
                                <SelectItem value="1">统计</SelectItem>
                                <SelectItem value="2">详情+导出</SelectItem>
                                <SelectItem value="3">全部导出</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(tempPermissions.dormitory ?? 1)}
                              onValueChange={(v) => handlePermissionChange('dormitory', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">无权限</SelectItem>
                                <SelectItem value="1">统计</SelectItem>
                                <SelectItem value="2">详情+导出</SelectItem>
                                <SelectItem value="3">全部导出</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(tempPermissions.fireSafety ?? 1)}
                              onValueChange={(v) => handlePermissionChange('fireSafety', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">无权限</SelectItem>
                                <SelectItem value="1">统计</SelectItem>
                                <SelectItem value="2">详情+导出</SelectItem>
                                <SelectItem value="3">全部导出</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={String(tempPermissions.security ?? 1)}
                              onValueChange={(v) => handlePermissionChange('security', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">无权限</SelectItem>
                                <SelectItem value="1">统计</SelectItem>
                                <SelectItem value="2">详情+导出</SelectItem>
                                <SelectItem value="3">全部导出</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-end gap-1 mb-2">
                                <span className="text-xs text-muted-foreground self-center mr-1">一键设置:</span>
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleQuickAction(1)}>统计</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleQuickAction(2)}>详情</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleQuickAction(3)}>全部</Button>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="default" onClick={() => handleSave(user.id)}>
                                  <Save className="h-4 w-4 mr-1" /> 保存
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                              </div>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Badge className={user.permissions?.vehicle ? "bg-primary/90" : ""} variant={user.permissions?.vehicle ? "default" : "secondary"}>
                              {getPermissionLabel(user.permissions?.vehicle)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={user.permissions?.personnel ? "bg-[color:#06B6D4] text-white hover:bg-[color:#0891B2]" : ""} variant={user.permissions?.personnel ? "default" : "secondary"}>
                              {getPermissionLabel(user.permissions?.personnel)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={user.permissions?.dormitory ? "bg-[color:#10B981] text-white hover:bg-[color:#059669]" : ""} variant={user.permissions?.dormitory ? "default" : "secondary"}>
                              {getPermissionLabel(user.permissions?.dormitory)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={user.permissions?.fireSafety ? "bg-[color:#F59E0B] text-white hover:bg-[color:#D97706]" : ""} variant={user.permissions?.fireSafety ? "default" : "secondary"}>
                              {getPermissionLabel(user.permissions?.fireSafety)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={user.permissions?.security ? "bg-[color:#6366F1] text-white hover:bg-[color:#4F46E5]" : ""} variant={user.permissions?.security ? "default" : "secondary"}>
                              {getPermissionLabel(user.permissions?.security)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => handleEditClick(user)}>
                              编辑
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

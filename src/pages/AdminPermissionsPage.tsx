import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Shield, User } from 'lucide-react';
import { getAllProfiles, updateProfile } from '@/db/api';
import type { Profile } from '@/types/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function AdminPermissionsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadUsers();
  }, [profile, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllProfiles();
      setUsers(data);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载用户列表',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      setUpdating(userId);
      const success = await updateProfile(userId, { role: newRole });
      
      if (success) {
        toast({
          title: '更新成功',
          description: '用户角色已更新',
        });
        await loadUsers();
      } else {
        toast({
          title: '更新失败',
          description: '无法更新用户角色',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('更新角色失败:', error);
      toast({
        title: '更新失败',
        description: '操作失败，请重试',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleExportPermissionToggle = async (userId: string, currentPermissions: Profile['permissions']) => {
    try {
      setUpdating(userId);
      const newPermissions = {
        ...currentPermissions,
        canExport: !currentPermissions.canExport,
      };
      
      const success = await updateProfile(userId, { permissions: newPermissions });
      
      if (success) {
        toast({
          title: '更新成功',
          description: '导出权限已更新',
        });
        await loadUsers();
      } else {
        toast({
          title: '更新失败',
          description: '无法更新导出权限',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('更新权限失败:', error);
      toast({
        title: '更新失败',
        description: '操作失败，请重试',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          权限管理
        </h1>
        <p className="text-muted-foreground mt-1">管理用户角色和访问权限</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              管理员
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              普通用户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'user').length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>导出权限</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.permissions.canExport ? 'default' : 'outline'}>
                          {user.permissions.canExport ? '已授权' : '未授权'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.id !== profile.id && (
                            <>
                              <Select
                                value={user.role}
                                onValueChange={(value) => handleRoleChange(user.id, value as 'user' | 'admin')}
                                disabled={updating === user.id}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">普通用户</SelectItem>
                                  <SelectItem value="admin">管理员</SelectItem>
                                </SelectContent>
                              </Select>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportPermissionToggle(user.id, user.permissions)}
                                disabled={updating === user.id}
                              >
                                {user.permissions.canExport ? '取消导出' : '授权导出'}
                              </Button>
                            </>
                          )}
                          {user.id === profile.id && (
                            <span className="text-sm text-muted-foreground">当前用户</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无用户数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

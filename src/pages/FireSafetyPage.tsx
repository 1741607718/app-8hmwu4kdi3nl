import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Download, Flame, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getFireEquipmentData, getFireEquipmentStats } from '@/db/api';
import type { FireEquipmentData, DateRange } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';

export default function FireSafetyPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<FireEquipmentData[]>([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadFireSafetyData();
  }, [dateRange]);

  const loadFireSafetyData = async () => {
    try {
      setLoading(true);
      
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');

      const data = await getFireEquipmentData({
        startDate,
        endDate,
        limit: 100,
      });

      setEquipment(data);

      const statsData = await getFireEquipmentStats({
        startDate,
        endDate,
      });

      setStats(statsData);
    } catch (error) {
      console.error('加载消防数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }

    const headers = ['设备编号', '检测日期', '设备状态', '位置'];
    const rows = equipment.map(e => [
      e.equipment_number,
      e.check_date,
      e.status || '-',
      e.location_name || '-',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `消防设备数据_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const pieData = [
    { name: '正常', value: stats.normal, color: 'hsl(var(--chart-4))' },
    { name: '异常', value: stats.abnormal, color: 'hsl(var(--chart-3))' },
  ];

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
            <Flame className="h-7 w-7 text-primary" />
            消防安全
          </h1>
          <p className="text-muted-foreground mt-1">消防设备状态监控与管理</p>
        </div>

        <div className="flex flex-col @md:flex-row gap-2">
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  <>
                    {format(dateRange.from, 'yyyy-MM-dd')} - {format(dateRange.to, 'yyyy-MM-dd')}
                  </>
                ) : (
                  <span>选择日期范围</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                    setShowDatePicker(false);
                  }
                }}
                locale={zhCN}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button 
            onClick={handleExport}
            disabled={equipment.length === 0 || (!profile?.permissions?.canExport && profile?.role !== 'admin')}
          >
            <Download className="mr-2 h-4 w-4" />
            导出数据
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              设备总数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total} <span className="text-sm font-normal text-muted-foreground">台</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-chart-4" />
              正常设备
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">{stats.normal} <span className="text-sm font-normal text-muted-foreground">台</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              异常设备
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.abnormal} <span className="text-sm font-normal text-muted-foreground">台</span></div>
          </CardContent>
        </Card>
      </div>

      {/* 图表 */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>设备状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>设备正常率</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center">
                <div className="text-6xl font-bold text-primary">
                  {stats.total > 0 ? ((stats.normal / stats.total) * 100).toFixed(1) : 0}%
                </div>
                <p className="text-muted-foreground mt-4">设备正常率</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle>设备检测记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : equipment.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>设备编号</TableHead>
                    <TableHead>检测日期</TableHead>
                    <TableHead>设备状态</TableHead>
                    <TableHead>位置</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.equipment_number}</TableCell>
                      <TableCell>{item.check_date}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.status === '正常' || item.status === '0' ? 'default' : 'destructive'}
                        >
                          {item.status || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.location_name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

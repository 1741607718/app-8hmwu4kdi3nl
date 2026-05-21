import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Download, Flame, AlertTriangle, CheckCircle2, Search, Shield, BarChart2, X } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getFireEquipmentData, getFireEquipmentStats } from '@/db/api';
import type { FireEquipmentData, DateRange } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';

export default function FireSafetyPage() {
  const { profile } = useAuth();
  
  // 权限控制
  // 优先级: 显式设置权限 > 管理员默认权限(3) > 普通用户默认权限(1)
  const permissionLevel = profile?.permissions?.fireSafety ?? (profile?.role === 'admin' ? 3 : 1);
  const checkPermission = (minLevel: number) => permissionLevel >= minLevel;

  if (permissionLevel < 1) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">您没有权限访问消防安全模块</h2>
          <p className="text-sm text-muted-foreground mt-2">请联系管理员申请权限</p>
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<FireEquipmentData[]>([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredEquipment = useMemo(() => {
    if (!searchText.trim()) return equipment;
    const keyword = searchText.toLowerCase();
    return equipment.filter(
      (item) =>
        (item.equipment_number && String(item.equipment_number).toLowerCase().includes(keyword)) ||
        (item.location_name && String(item.location_name).toLowerCase().includes(keyword))
    );
  }, [equipment, searchText]);

  useEffect(() => {
    loadFireSafetyData();

    // 设置定时刷新，每5分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新消防数据...');
      loadFireSafetyData();
    }, 300000); // 300000ms = 5分钟

    return () => clearInterval(intervalId);
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
    // 检查导出权限 (等级2允许基础导出)
    if (!checkPermission(2)) {
      alert('您没有权限导出详细数据');
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
    { name: '正常', value: stats.normal, color: '#10B981' },
    { name: '异常', value: stats.abnormal, color: '#F59E0B' },
  ];

  const equipmentStatusChartConfig = {
    normal: { label: '正常', color: '#10B981' },
    abnormal: { label: '异常', color: '#F59E0B' },
  };

  const showStats = checkPermission(1);
  const showDetails = checkPermission(2);

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
          {/* 日期选择器通常关联统计和数据，如果两者都没权限，可能不需要？
              或者只要有L2权限就显示日期选择器。
          */}
          {showStats && (
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
          )}

          {showDetails && (
            <Button
              onClick={handleExport}
              disabled={equipment.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              导出数据
            </Button>
          )}
        </div>
      </div>

      {/* 统计视图 */}
      {!showStats ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <BarChart2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">您没有权限查看统计数据</p>
          </div>
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  设备总数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total} <span className="text-sm font-normal text-muted-foreground">台</span></div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[color:#10B981]" />
                  正常设备
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[color:#10B981]">{stats.normal} <span className="text-sm font-normal text-muted-foreground">台</span></div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-amber-500/10 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[color:#F59E0B]" />
                  异常设备
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[color:#F59E0B]">{stats.abnormal} <span className="text-sm font-normal text-muted-foreground">台</span></div>
              </CardContent>
            </Card>
          </div>

          {/* 图表 */}
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-2.5 w-2.5 rounded-full bg-[color:#10B981] shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
                  设备状态分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full rounded-2xl bg-muted" />
                ) : stats.total > 0 ? (
                  <ChartContainer config={equipmentStatusChartConfig} className="h-[300px] w-full aspect-auto">
                    <PieChart>
                      <defs>
                        <filter id="firePieShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="10" stdDeviation="12" floodOpacity="0.18" />
                        </filter>
                      </defs>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={pieData.map((item) => ({ ...item, key: item.name === '正常' ? 'normal' : 'abnormal' }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={94}
                        paddingAngle={4}
                        cornerRadius={10}
                        dataKey="value"
                        stroke="none"
                        filter="url(#firePieShadow)"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/8 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-2.5 w-2.5 rounded-full bg-[color:#1D4ED8] shadow-[0_0_0_6px_rgba(29,78,216,0.12)]" />
                  设备正常率
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-64 w-full rounded-2xl bg-muted" />
                ) : (
                  <div className="relative h-64 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-chart-4/10">
                    <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-primary/10 to-transparent" />
                    <div className="relative z-10 h-full flex flex-col items-center justify-center">
                      <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Health Score</div>
                      <div className="mt-4 bg-linear-to-r from-primary to-chart-4 bg-clip-text text-7xl font-black text-transparent">
                        {stats.total > 0 ? ((stats.normal / stats.total) * 100).toFixed(1) : 0}%
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">设备正常率</p>
                      <div className="mt-6 h-3 w-56 overflow-hidden rounded-full bg-muted/80 shadow-inner">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-primary via-chart-2 to-chart-4 transition-all duration-700"
                          style={{ width: `${stats.total > 0 ? (stats.normal / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 数据表格 - 仅在有详情权限时显示 */}
      {showDetails && (
        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]" />
                设备检测记录
                {searchText && (
                  <Badge variant="secondary" className="ml-2">
                    筛选 {filteredEquipment.length}/{equipment.length} 条
                  </Badge>
                )}
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="检索设备编号、位置..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 pr-8"
                />
                {searchText && (
                  <button
                    onClick={() => setSearchText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
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
                    {filteredEquipment.length > 0 ? (
                      filteredEquipment.map((item) => (
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
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                          未找到匹配 "{searchText}" 的记录
                        </TableCell>
                      </TableRow>
                    )}
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
      )}
    </div>
  );
}

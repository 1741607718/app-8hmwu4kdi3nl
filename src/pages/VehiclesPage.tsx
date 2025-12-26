import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Download, Car, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getVehicleData, getVehicleStats } from '@/db/api';
import type { VehicleData, DateRange } from '@/types/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function VehiclesPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadVehicleData();
  }, [dateRange]);

  const loadVehicleData = async () => {
    try {
      setLoading(true);
      
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');

      // 获取车辆数据
      const data = await getVehicleData({
        startDate,
        endDate,
        limit: 100,
      });

      setVehicles(data);

      // 获取统计数据用于图表
      const stats = await getVehicleStats({
        startDate,
        endDate,
      });

      // 转换为图表数据格式
      const chartDataArray = Object.entries(stats.byDate)
        .map(([date, count]) => ({
          date: format(new Date(date), 'MM-dd', { locale: zhCN }),
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setChartData(chartDataArray);
    } catch (error) {
      console.error('加载车辆数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }

    // 生成CSV
    const headers = ['车牌号', '识别状态', '站点', '通过时间'];
    const rows = vehicles.map(v => [
      v.plate_number,
      v.recognition_name || '-',
      v.station_name || '-',
      format(new Date(v.pass_time), 'yyyy-MM-dd HH:mm:ss'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // 下载
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `车辆数据_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const totalCount = vehicles.length;
  const todayCount = vehicles.filter(v => 
    format(new Date(v.pass_time), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).length;

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
            <Car className="h-7 w-7 text-primary" />
            车辆管理
          </h1>
          <p className="text-muted-foreground mt-1">车辆通行记录与统计分析</p>
        </div>

        <div className="flex flex-col @md:flex-row gap-2">
          {/* 日期选择 */}
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

          {/* 导出按钮 */}
          <Button 
            onClick={handleExport}
            disabled={vehicles.length === 0 || (!profile?.permissions?.canExport && profile?.role !== 'admin')}
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
              总通行量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今日通行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              日均通行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.length > 0 ? Math.round(chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length) : 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">辆</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表 */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              车流量趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="通行量"
                  />
                </LineChart>
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
            <CardTitle>每日通行量对比</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" name="通行量" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle>通行记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : vehicles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>车牌号</TableHead>
                    <TableHead>识别状态</TableHead>
                    <TableHead>站点</TableHead>
                    <TableHead>通过时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.plate_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {vehicle.recognition_name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{vehicle.station_name || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(vehicle.pass_time), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
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

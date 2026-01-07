import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Camera, AlertTriangle, BarChart2, Users, Clock, Calendar, UserCheck } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { 
  fetchSafetyVisitReservationStats, 
  SafetyVisitReservationStats 
} from '@/services/externalApi';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DateRange {
  from: Date;
  to: Date;
}

export default function SecurityPage() {
  const showStats = true;
  
  // 添加安全观预约统计相关状态
  const [loading, setLoading] = useState(false);
  const [reservationStats, setReservationStats] = useState<SafetyVisitReservationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 日期选择相关状态
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const dateRangeDisplay = `${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`;

  const presetDateRanges = [
    { value: 'today', label: '今天', days: 0 },
    { value: 'last3days', label: '最近3天', days: 3 },
    { value: 'last7days', label: '最近7天', days: 7 },
    { value: 'last30days', label: '最近30天', days: 30 },
  ];

  // 处理点击外部关闭日期选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateRangePickerRef.current && !dateRangePickerRef.current.contains(event.target as Node)) {
        setIsCustomDateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 加载安全观预约统计数据
  useEffect(() => {
    loadReservationStats();
  }, [dateRange]);

  const loadReservationStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchSafetyVisitReservationStats({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });
      
      if (result.success && result.data) {
        setReservationStats(result.data);
      } else {
        setError(result.error || '获取安全观预约数据失败');
      }
    } catch (err) {
      console.error('加载安全观预约数据失败:', err);
      setError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 头部标题和日期选择 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            安全数据
          </h1>
          <p className="text-muted-foreground mt-1">监控设备状态与安全事件统计</p>
        </div>

        <div className="relative" ref={dateRangePickerRef}>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
            onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {dateRangeDisplay}
          </Button>

          {isCustomDateOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 bg-white border rounded-md shadow-lg p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">开始日期</label>
                    <input
                      type="date"
                      value={format(dateRange.from, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const newFromDate = new Date(e.target.value);
                        newFromDate.setHours(0, 0, 0, 0);
                        setDateRange(prev => ({ ...prev, from: newFromDate }));
                      }}
                      className="w-full rounded border p-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">结束日期</label>
                    <input
                      type="date"
                      value={format(dateRange.to, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const newToDate = new Date(e.target.value);
                        newToDate.setHours(23, 59, 59, 999);
                        setDateRange(prev => ({ ...prev, to: newToDate }));
                      }}
                      className="w-full rounded border p-2"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">预设范围:</p>
                  <div className="flex flex-wrap gap-2">
                    {presetDateRanges.map((range) => (
                      <Button
                        key={range.value}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const endDate = new Date();
                          const startDate = new Date();
                          if (range.days > 0) {
                            startDate.setDate(endDate.getDate() - range.days);
                          } else {
                            startDate.setHours(0, 0, 0, 0);
                            endDate.setHours(23, 59, 59, 999);
                          }
                          setDateRange({ from: startDate, to: endDate });
                          setIsCustomDateOpen(false);
                        }}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!showStats ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <BarChart2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">您没有权限查看统计数据</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  监控在线
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156/160 <span className="text-sm font-normal text-muted-foreground">台</span></div>
                <p className="text-xs text-muted-foreground mt-1">在线率: 97.5%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  本月案事件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3 <span className="text-sm font-normal text-muted-foreground">起</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">反诈劝阻</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12 <span className="text-sm font-normal text-muted-foreground">次</span></div>
              </CardContent>
            </Card>
          </div>

          {/* 安全观预约统计卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                安全观预约统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center text-red-500 py-8">{error}</div>
              ) : reservationStats ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-muted-foreground">总预约</span>
                    </div>
                    <div className="text-xl font-bold text-blue-700 mt-1">{reservationStats.total}</div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-muted-foreground">今日预约</span>
                    </div>
                    <div className="text-xl font-bold text-green-700 mt-1">{reservationStats.byDate[new Date().toISOString().split('T')[0]] || 0}</div>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-muted-foreground">预约部门</span>
                    </div>
                    <div className="text-xl font-bold text-purple-700 mt-1">{Object.keys(reservationStats.byDepartment).length}</div>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-muted-foreground">有效预约</span>
                    </div>
                    <div className="text-xl font-bold text-orange-700 mt-1">
                      {reservationStats.byStatus['已完成'] || reservationStats.byStatus['已批准'] || 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">暂无数据</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>监控设备分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                数据图表开发中...
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
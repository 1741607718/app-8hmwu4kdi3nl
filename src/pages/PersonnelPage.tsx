import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Users, TrendingUp, ChevronLeft, ChevronRight, X, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { fetchVisitorData, fetchVisitorStats, fetchVisitorEntryData, fetchVisitorEntryStats, fetchVisitedStats, fetchHumanTrafficStats } from '@/services/externalApi';
import type { VisitorApiData, VisitorEntryApiData } from '@/services/externalApi';
import { cn } from '@/lib/utils';

interface DateRange {
  from: Date;
  to: Date;
}

type ModalType = 'visitor' | 'visitor-entry' | null;

export default function PersonnelPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visitorData, setVisitorData] = useState<VisitorApiData[]>([]);
  const [visitorEntryData, setVisitorEntryData] = useState<VisitorEntryApiData[]>([]);
  const [visitedChartData, setVisitedChartData] = useState<{ date: string; visitCount: number; visitedPersonCount: number }[]>([]);
  const [totalVisitorCount, setTotalVisitorCount] = useState(0);
  const [totalVisitorEntryCount, setTotalVisitorEntryCount] = useState(0);
  const [humanTrafficStats, setHumanTrafficStats] = useState<{
    library: number;
    skybridge: number;
    total: number;
  }>({ library: 0, skybridge: 0, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalType, setModalType] = useState<ModalType>(null);

  // 日期选择相关状态
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setHours(0, 0, 0, 0)),
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

    // 辅助函数：获取精确的查询时间字符串
    const getPreciseDateString = (date: Date, isEndDate: boolean = false) => {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday && isEndDate) {
        // 如果是结束日期且是今天，使用当前时间
        return format(now, 'yyyy-MM-dd HH:mm:ss');
      } else if (isEndDate) {
        // 如果是结束日期但不是今天，使用当天的最后一秒
        return format(date, 'yyyy-MM-dd 23:59:59');
      } else {
        // 如果是开始日期，使用当天的第一秒
        return format(date, 'yyyy-MM-dd 00:00:00');
      }
    };

    // 加载数据
    useEffect(() => {
    loadStats();
    }, [dateRange]);

  useEffect(() => {
    if (modalType === 'visitor') {
      loadVisitorList();
    } else if (modalType === 'visitor-entry') {
      loadVisitorEntryList();
    }
  }, [dateRange, currentPage, modalType]);

    const loadStats = async () => {
    setLoading(true);
    setError(null);

    // 使用精确的时间格式
    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      // 1. 加载统计数据 (并行加载)
      const [statsResult, entryStatsResult, visitedStatsResult, humanTrafficResult] = await Promise.all([
        fetchVisitorStats({ startDate, endDate, personnelMode: true }),
        fetchVisitorEntryStats({ startDate, endDate }),
        fetchVisitedStats({ startDate, endDate }),
        fetchHumanTrafficStats({ startDate, endDate })
      ]);

      if (statsResult.success && statsResult.data) {
        setTotalVisitorCount(statsResult.data.total);
      }

      if (entryStatsResult.success && entryStatsResult.data) {
        setTotalVisitorEntryCount(entryStatsResult.data.total);
      }

      if (humanTrafficResult.success && humanTrafficResult.data) {
        setHumanTrafficStats({
          library: humanTrafficResult.data.library,
          skybridge: humanTrafficResult.data.skybridge,
          total: humanTrafficResult.data.total
        });
      }

      if (visitedStatsResult.success && visitedStatsResult.data) {
        // 处理被访数据图表
        const dateList = [];
        const currentDate = new Date(startDate);
        const endDateObj = new Date(endDate);
        while (currentDate <= endDateObj) {
          dateList.push(format(currentDate, 'yyyy-MM-dd'));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const chartDataArray = dateList.map(date => ({
          date: format(new Date(date), 'MM-dd', { locale: zhCN }),
          visitCount: visitedStatsResult.data?.byDate[date]?.visitCount || 0,
          visitedPersonCount: visitedStatsResult.data?.byDate[date]?.visitedPersonCount || 0,
        }));
        setVisitedChartData(chartDataArray);
      }

    } catch (err) {
      console.error('加载人员统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

    const loadVisitorList = async () => {
    setLoading(true);
    // 使用精确的时间格式
    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      // 2. 加载列表数据
      const listResult = await fetchVisitorData({
        startDate,
        endDate,
        page: currentPage,
        pageSize,
        personnelMode: true
      });

      if (listResult.success && listResult.data) {
        setVisitorData(listResult.data);
      } else {
        setVisitorData([]);
      }
    } catch (err) {
      console.error('加载访客列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

    const loadVisitorEntryList = async () => {
    setLoading(true);
    // 使用精确的时间格式
    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      const listResult = await fetchVisitorEntryData({
        startDate,
        endDate,
        page: currentPage,
        pageSize
      });

      if (listResult.success && listResult.data) {
        setVisitorEntryData(listResult.data);
      } else {
        setVisitorEntryData([]);
      }
    } catch (err) {
      console.error('加载访客入校列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (modalType === 'visitor') {
      const headers = ['姓名', '车牌号', '来访事由', '受访部门', '被拜访人', '审批状态', '到访时间', '离校时间'];
      const rows = visitorData.map(v => [
        v.xm || '-',
        v.cp || '-',
        v.lfsy || '-',
        v.bfbm || '-',
        v.bfr || '-',
        v.system_status || '-',
        v.dfsj || '-',
        v.lfsj || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `访客预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'visitor-entry') {
      const headers = ['访客姓名', '入校时间', '联系电话', '身份证号', '扫码人'];
      const rows = visitorEntryData.map(v => [
        v.xm || '-',
        v.smsj || '-',
        v.lxdh || '-',
        v.sfzh || '-',
        v.smrxm || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `访客入校数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    }
  };

  const handleModalOpen = (type: ModalType) => {
    setModalType(type);
    setCurrentPage(1);
  };

  const handleModalClose = () => {
    setModalType(null);
    setCurrentPage(1);
  };

  const showStats = true;

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 头部标题和日期选择 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            人员数据
          </h1>
          <p className="text-muted-foreground mt-1">校园人员统计与流量监测</p>
        </div>

        {showStats && (
          <div className="relative" ref={dateRangePickerRef}>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
              onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
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

                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => setIsCustomDateOpen(false)}>完成</Button>
                </div>
              </div>
            )}
          </div>
        )}
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
          {/* 这里是原来的统计卡片和图表内容，保持不变，但被包裹在 fragment 中 */}
          {/* 统计卡片网格 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
              className={cn("transition-shadow cursor-pointer hover:shadow-md")}
              onClick={() => handleModalOpen('visitor-entry')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">访客预约人数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalVisitorCount}</div>
                <p className="text-xs text-muted-foreground">当前筛选区间</p>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow cursor-pointer hover:shadow-md")}
              onClick={() => handleModalOpen('visitor-entry')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">访客入校人数</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalVisitorEntryCount}</div>
                <p className="text-xs text-muted-foreground">当前筛选区间</p>
              </CardContent>
            </Card>

            {/* 人流量卡片保持展示 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">图书馆人流量</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{humanTrafficStats.library}</div>
                <p className="text-xs text-muted-foreground">实时统计</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">天桥人流量</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{humanTrafficStats.skybridge}</div>
                <p className="text-xs text-muted-foreground">实时统计</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>被访数据统计图</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={visitedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Legend />
                    <Bar dataKey="visitCount" name="被访次数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="visitedPersonCount" name="被访人数" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 模态框 */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="personnel-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="personnel-modal-title" className="text-lg font-semibold">
                {modalType === 'visitor' && '访客预约详细记录'}
                {modalType === 'visitor-entry' && '访客入校详细记录'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={modalType === 'visitor' ? visitorData.length === 0 : visitorEntryData.length === 0}
                >
                  导出
                </Button>
                <Button variant="ghost" size="icon" onClick={handleModalClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {modalType === 'visitor' && (
                            <>
                              <TableHead>姓名</TableHead>
                              <TableHead>车牌号</TableHead>
                              <TableHead>来访事由</TableHead>
                              <TableHead>受访部门</TableHead>
                              <TableHead>被拜访人</TableHead>
                              <TableHead>审批状态</TableHead>
                              <TableHead>到访时间</TableHead>
                              <TableHead>离校时间</TableHead>
                            </>
                          )}
                          {modalType === 'visitor-entry' && (
                            <>
                              <TableHead>访客姓名</TableHead>
                              <TableHead>入校时间</TableHead>
                              <TableHead>联系电话</TableHead>
                              <TableHead>身份证号</TableHead>
                              <TableHead>扫码人</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modalType === 'visitor' ? (
                          visitorData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          ) : (
                            visitorData.map((visitor, index) => (
                              <TableRow key={visitor.guid || index}>
                                <TableCell className="font-medium">{visitor.xm || '-'}</TableCell>
                                <TableCell>{visitor.cp || '-'}</TableCell>
                                <TableCell>{visitor.lfsy || '-'}</TableCell>
                                <TableCell>{visitor.bfbm || '-'}</TableCell>
                                <TableCell>{visitor.bfr || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={visitor.system_status === '已审批' ? 'default' : 'secondary'}>
                                    {visitor.system_status || '未知'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{visitor.dfsj || '-'}</TableCell>
                                <TableCell>{visitor.lfsj || '-'}</TableCell>
                              </TableRow>
                            ))
                          )
                        ) : (
                          visitorEntryData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          ) : (
                            visitorEntryData.map((entry, index) => (
                              <TableRow key={entry.guid || index}>
                                <TableCell className="font-medium">{entry.xm || '-'}</TableCell>
                                <TableCell>{entry.smsj ? format(new Date(entry.smsj), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                                <TableCell>{entry.lxdh || '-'}</TableCell>
                                <TableCell>{entry.sfzh || '-'}</TableCell>
                                <TableCell>{entry.smrxm || '-'}</TableCell>
                              </TableRow>
                            ))
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {modalType === 'visitor' ? totalVisitorCount : totalVisitorEntryCount} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {currentPage} / {Math.ceil((modalType === 'visitor' ? totalVisitorCount : totalVisitorEntryCount) / pageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage >= Math.ceil((modalType === 'visitor' ? totalVisitorCount : totalVisitorEntryCount) / pageSize) || loading}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


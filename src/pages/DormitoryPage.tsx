import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, UserCheck, UserX, CalendarIcon, AlertTriangle, Shield, BarChart2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchDormitoryStats, fetchDormitoryData } from '@/services/externalApi';
import { useAuth } from '@/contexts/AuthContext';

interface DateRange {
  from: Date;
  to: Date;
}

// 宿舍数据类型定义
interface DormitoryData {
  id: number;
  xh: string; // 学号
  xm: string; // 姓名
  xy: string; // 学院
  zy: string; // 专业
  bj: string; // 班级
  ldmc: string; // 楼栋名称
  fjh: string; // 房间号
  kqzt_wg: string; // 考勤状态-晚归
  kqzt_tx: string; // 考勤状态-通宵
  kqzt_bg: string; // 考勤状态-未归
  kqrq: string; // 考勤日期
  xwzs: number; // 校外住宿状态
  qjbj: number; // 请假标记
}

interface DateRange {
  from: Date;
  to: Date;
}

type ModalType = 'late-return' | 'not-return' | null;

export default function DormitoryPage() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  interface BuildingStats {
    total: number;
    zc_count: number;
    tx_count: number;
    wg_count: number;
    bg_count: number;
    qj_count: number;
    not_in_school_count: number;
    no_record_count: number;
  }
  
  const [dormitoryStats, setDormitoryStats] = useState<{
    kqrq: string;
    total: number;
    zc_count: number;
    tx_count: number;
    wg_count: number;
    bg_count: number;
    qj_count: number;
    not_in_school_count: number;
    no_record_count: number;
    byBuilding?: Record<string, BuildingStats>;
  }>({ 
    kqrq: '',
    total: 0,
    zc_count: 0,
    tx_count: 0,
    wg_count: 0,
    bg_count: 0,
    qj_count: 0,
    not_in_school_count: 0,
    no_record_count: 0,
    byBuilding: {}
  });

  // 晚归和未归详细数据状态
  const [dormitoryData, setDormitoryData] = useState<DormitoryData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // 日期选择相关状态
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 1)),
    to: new Date(new Date().setDate(new Date().getDate())),
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

  // 加载数据
  useEffect(() => {
    loadStats();
  }, [dateRange]); // 住宿统计依赖时间区间

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDormitoryStats({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });
      if (result.success && result.data) {
        setDormitoryStats(result.data);
      } else {
        setError(result.error || '获取宿管数据失败');
      }
    } catch (err) {
      console.error('加载宿管数据失败:', err);
      setError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载详细数据（晚归或未归）
  const loadDormitoryDetails = async (type: ModalType, page: number) => {
    if (!type) return;
    
    setLoadingDetails(true);
    try {
      const result = await fetchDormitoryData({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        page,
        pageSize,
        filterType: type === 'late-return' ? 'wg' : 'bg' // wg=晚归, bg=未归
      });
      
      console.log(`加载${type === 'late-return' ? '晚归' : '未归'}详细数据结果:`, result);
      
      if (result.success && result.data) {
        setDormitoryData(result.data);
        setTotalRecords(result.total || 0);
        console.log(`成功加载${result.data.length}条${type === 'late-return' ? '晚归' : '未归'}数据`);
      } else {
        setDormitoryData([]);
        setTotalRecords(0);
        setError(result.error || '获取详细数据失败');
        console.log(`未能加载${type === 'late-return' ? '晚归' : '未归'}数据，原因:`, result.error);
      }
    } catch (err) {
      console.error(`加载${type === 'late-return' ? '晚归' : '未归'}详细数据失败:`, err);
      setDormitoryData([]);
      setTotalRecords(0);
      setError('加载详细数据失败');
    } finally {
      setLoadingDetails(false);
    }
  };

  // 模态框打开处理
  const handleModalOpen = (type: ModalType) => {
    setModalType(type);
    setCurrentPage(1);
    loadDormitoryDetails(type, 1); // 点击时才加载数据
  };

  // 模态框关闭处理
  const handleModalClose = () => {
    setModalType(null);
    setDormitoryData([]);
    setCurrentPage(1);
    setTotalRecords(0);
  };

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (modalType) {
      setCurrentPage(newPage);
      loadDormitoryDetails(modalType, newPage);
    }
  };

  // 导出功能
  const handleExport = () => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }

    if (dormitoryData.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (modalType === 'late-return') {
      headers = ['学号', '姓名', '学院', '专业', '班级', '楼栋', '房间号', '考勤日期', '晚归状态'];
      rows = dormitoryData.map(item => [
        item.xh || '-',
        item.xm || '-',
        item.xy || '-',
        item.zy || '-',
        item.bj || '-',
        item.ldmc || '-',
        item.fjh || '-',
        item.kqrq || '-',
        item.kqzt_wg || '-'
      ]);
    } else if (modalType === 'not-return') {
      headers = ['学号', '姓名', '学院', '专业', '班级', '楼栋', '房间号', '考勤日期', '未归状态'];
      rows = dormitoryData.map(item => [
        item.xh || '-',
        item.xm || '-',
        item.xy || '-',
        item.zy || '-',
        item.bj || '-',
        item.ldmc || '-',
        item.fjh || '-',
        item.kqrq || '-',
        item.kqzt_bg || '-'
      ]);
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // 下载
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${modalType === 'late-return' ? '晚归' : '未归'}数据_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  // 准备图表数据 - 按楼栋和考勤状态分布（用于堆叠条形图）
  const chartData = Object.entries(dormitoryStats.byBuilding || {}).map(([building, stats]) => ({
    building,
    zc_count: stats.zc_count,
    wg_count: stats.wg_count,
    bg_count: stats.bg_count,
    qj_count: stats.qj_count
  }));

  const showStats = true;

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 头部标题和日期选择 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            宿舍数据
          </h1>
          <p className="text-muted-foreground mt-1">宿舍入住与归宿情况监控</p>
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
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {!showStats ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <BarChart2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">您没有权限查看统计数据</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  总人数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : dormitoryStats.total.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{dormitoryStats.kqrq || '日期'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-chart-4" />
                  正常回寝
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-4">
                  {loading ? '...' : dormitoryStats.zc_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.zc_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow cursor-pointer hover:shadow-md")}
              onClick={() => handleModalOpen('late-return')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserX className="h-4 w-4 text-orange-500" />
                  晚归
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {loading ? '...' : dormitoryStats.wg_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.wg_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow cursor-pointer hover:shadow-md")}
              onClick={() => handleModalOpen('not-return')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  未归
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {loading ? '...' : dormitoryStats.bg_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.bg_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  请假
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : dormitoryStats.qj_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.qj_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  校外住宿
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : dormitoryStats.not_in_school_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.not_in_school_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  无记录
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : dormitoryStats.no_record_count.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground"> 人</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  占比: {dormitoryStats.total > 0 ? ((dormitoryStats.no_record_count / dormitoryStats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>各楼栋考勤状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] w-full">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Array.from(
                        new Map(
                          chartData.map(item => [item.building, item])
                        ).values()
                      )}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="building"
                        width={150}
                        tick={{ fontSize: 11 }}
                        interval={0}
                        tickFormatter={(value) => {
                          // 如果楼栋名称过长，进行截断或换行处理
                          if (value.length > 10) {
                            return value.substring(0, 10) + '...';
                          }
                          return value;
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="zc_count" name="正常回寝" stackId="a" fill="#10b981" />
                      <Bar dataKey="wg_count" name="晚归" stackId="a" fill="#f97316" />
                      <Bar dataKey="bg_count" name="未归" stackId="a" fill="#ef4444" />
                      <Bar dataKey="qj_count" name="请假" stackId="a" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex justify-center items-center h-full text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 晚归和未归详细数据模态框 */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="dormitory-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="dormitory-modal-title" className="text-lg font-semibold">
                {modalType === 'late-return' ? '晚归详细记录' : '未归详细记录'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={dormitoryData.length === 0}
                >
                  导出
                </Button>
                <Button variant="ghost" size="icon" onClick={handleModalClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loadingDetails ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>学号</TableHead>
                          <TableHead>姓名</TableHead>
                          <TableHead>学院</TableHead>
                          <TableHead>专业</TableHead>
                          <TableHead>班级</TableHead>
                          <TableHead>楼栋</TableHead>
                          <TableHead>房间号</TableHead>
                          <TableHead>考勤日期</TableHead>
                          <TableHead>
                            {modalType === 'late-return' ? '晚归状态' : '未归状态'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dormitoryData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              暂无数据
                            </TableCell>
                          </TableRow>
                        ) : (
                          dormitoryData.map((item, index) => (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium">{item.xh || '-'}</TableCell>
                              <TableCell>{item.xm || '-'}</TableCell>
                              <TableCell>{item.xy || '-'}</TableCell>
                              <TableCell>{item.zy || '-'}</TableCell>
                              <TableCell>{item.bj || '-'}</TableCell>
                              <TableCell>{item.ldmc || '-'}</TableCell>
                              <TableCell>{item.fjh || '-'}</TableCell>
                              <TableCell>{item.kqrq || '-'}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    modalType === 'late-return' 
                                      ? (item.kqzt_bg === '晚归回寝' ? 'default' : 'secondary') 
                                      : (item.kqzt_bg === '出寝未归' ? 'destructive' : 'secondary')
                                  }
                                >
                                  {modalType === 'late-return' ? item.kqzt_bg || '-' : item.kqzt_bg || '-'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {totalRecords} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {currentPage} / {Math.ceil(totalRecords / pageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(totalRecords / pageSize) || loadingDetails}
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
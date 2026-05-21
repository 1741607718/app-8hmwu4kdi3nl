import { format } from 'date-fns';
import { AlertTriangle, BarChart2, Building2, CalendarIcon, ChevronLeft, ChevronRight, Download, Search, Shield, UserCheck, Users, UserX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { maskSensitiveDataArray } from '@/lib/sensitiveDataMasker';
import { cn } from '@/lib/utils';
import { fetchDormitoryData, fetchDormitoryStats } from '@/services/externalApi';

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

type ModalType = 'late-return' | 'not-return' | 'leave' | 'out-school' | 'no-record' | 'all' | 'normal-return' | null;

const DORMITORY_CHART_COLORS = {
  normal: '#10B981',
  late: '#F59E0B',
  absent: '#EF4444',
  leave: '#64748B',
} as const;

export default function DormitoryPage() {
  const { profile } = useAuth();

  // 权限控制
  // 优先级: 显式设置权限 > 管理员默认权限(3) > 普通用户默认权限(1)
  const permissionLevel = profile?.permissions?.dormitory ?? (profile?.role === 'admin' ? 3 : 1);
  const checkPermission = (minLevel: number) => permissionLevel >= minLevel;

  if (permissionLevel < 1) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">您没有权限访问宿管数据模块</h2>
          <p className="text-sm text-muted-foreground mt-2">请联系管理员申请权限</p>
        </div>
      </div>
    );
  }

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
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [modalSearchText, setModalSearchText] = useState('');
  const [allDormitoryCache, setAllDormitoryCache] = useState<DormitoryData[]>([]);

  const filterBySearch = <T extends Record<string, any>>(data: T[], fields: string[]): T[] => {
    if (!modalSearchText.trim()) return data;
    const keyword = modalSearchText.toLowerCase();
    return data.filter((item) =>
      fields.some((field) => {
        const val = item[field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(keyword);
      })
    );
  };

  // 日期选择相关状态
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 1)),
    to: new Date(new Date().setDate(new Date().getDate() - 1)),
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

    // 设置定时刷新，每5分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新宿舍数据...');
      loadStats();
    }, 300000); // 300000ms = 5分钟

    return () => clearInterval(intervalId);
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
  const filterTypeMap: Record<string, string> = {
    'late-return': 'wg',
    'not-return': 'bg',
    'leave': 'qj',
    'out-school': 'xwzs',
    'no-record': 'no_record',
    'all': 'all',
    'normal-return': 'zc'
  };
  
  const typeLabelMap: Record<string, string> = {
    'late-return': '晚归',
    'not-return': '未归',
    'leave': '请假',
    'out-school': '校外住宿',
    'no-record': '无记录',
    'all': '全部',
    'normal-return': '正常回寝'
  };
  
  const loadDormitoryDetails = async (type: ModalType, page: number) => {
    if (!type) return;
    
    setLoadingDetails(true);
    try {
      const result = await fetchDormitoryData({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        page,
        pageSize,
        filterType: filterTypeMap[type] as any
      });
      
      console.log(`加载${typeLabelMap[type]}详细数据结果:`, result);
      
      if (result.success && result.data) {
        setDormitoryData(result.data);
        setTotalRecords(result.total || 0);
        console.log(`成功加载${result.data.length}条${typeLabelMap[type]}数据`);
      } else {
        setDormitoryData([]);
        setTotalRecords(0);
        setError(result.error || '获取详细数据失败');
        console.log(`未能加载${typeLabelMap[type]}数据，原因:`, result.error);
      }
    } catch (err) {
      console.error(`加载${typeLabelMap[type]}详细数据失败:`, err);
      setDormitoryData([]);
      setTotalRecords(0);
      setError('加载详细数据失败');
    } finally {
      setLoadingDetails(false);
    }
  };

  // 模态框打开处理
  const handleModalOpen = (type: ModalType) => {
    if (!checkPermission(2)) {
      alert('您没有权限查看详细表单');
      return;
    }
    setModalType(type);
    setCurrentPage(1);
    setModalSearchText('');
    loadDormitoryDetails(type, 1);
    loadAllDormitoryData(type);
  };

  const loadAllDormitoryData = async (type: ModalType) => {
    try {
      const filterTypeMap: Record<string, string> = {
        'late-return': 'wg', 'not-return': 'bg', 'leave': 'qj',
        'out-school': 'xwzs', 'no-record': 'no_record', 'all': 'all', 'normal-return': 'zc',
      };
      const filterType = filterTypeMap[type || ''] || 'all';
      const startDate = format(dateRange.from, 'yyyy-MM-dd') + ' 00:00:00';
      const endDate = format(dateRange.to, 'yyyy-MM-dd') + ' 23:59:59';
      const result = await fetchDormitoryData({ startDate, endDate, page: 1, pageSize: 100000, filterType });
      if (result.success && result.data) setAllDormitoryCache(result.data);
    } catch (e) { console.error('加载全部宿管数据失败:', e); }
  };

  const handleModalClose = () => {
    setModalType(null);
    setDormitoryData([]);
    setModalSearchText('');
  };

  // 分页处理
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (modalType) {
      loadDormitoryDetails(modalType, newPage);
    }
  };

  // 格式化为北京时间日期
  const formatToBeijingDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      // 处理日期字符串格式，支持多种输入格式
      let date: Date;

      if (typeof dateStr === 'string') {
        // 如果是ISO格式的日期时间字符串，直接解析
        if (dateStr.includes('T')) {
          date = new Date(dateStr);
        } else {
          // 如果是 YYYY-MM-DD 格式的日期字符串
          date = new Date(`${dateStr}T00:00:00`);
        }
      } else {
        date = new Date(dateStr);
      }
      
      if (isNaN(date.getTime())) return dateStr;

      // 使用 Intl.DateTimeFormat 强制转换为北京时间，格式 yyyy/MM/dd
      const formatted = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);

      // 将 / 替换为 -
      return formatted.replace(/\//g, '-');
    } catch (e) {
      return dateStr;
    }
  };

  // 导出功能
  const handleExport = async (exportMode: 'current' | 'selected' | 'all' = 'current') => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }

    let dataToExport = [...dormitoryData];

    if (exportMode === 'selected') {
      if (selectedItems.size === 0) {
        alert('请先选择要导出的数据');
        return;
      }
      dataToExport = dataToExport.filter(item => selectedItems.has(item.id));
    } else if (exportMode === 'all') {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      const filterTypeMap: Record<string, string> = {
        'late-return': 'wg',
        'not-return': 'bg',
        'leave': 'qj',
        'out-school': 'xwzs',
        'no-record': 'no_record'
      };
      const typeLabel = modalType === 'late-return' ? '晚归' : modalType === 'not-return' ? '未归' : modalType === 'leave' ? '请假' : modalType === 'out-school' ? '校外住宿' : '无记录';
      const confirmExport = window.confirm(`确定要导出 ${startDate} 到 ${endDate} 的所有${typeLabel}数据吗？`);
      if (!confirmExport) return;

      setLoadingDetails(true);
      try {
        const result = await fetchDormitoryData({
          startDate,
          endDate,
          page: 1,
          pageSize: 100000,
          filterType: modalType ? filterTypeMap[modalType] as 'wg' | 'bg' : undefined
        });
        if (result.data) {
          dataToExport = result.data;
        } else {
           alert('导出全量数据失败');
           return;
        }
      } catch (e) {
        console.error(e);
        alert('导出失败');
        return;
      } finally {
        setLoadingDetails(false);
      }
    }

    if (dataToExport.length === 0) {
       alert('没有数据可导出');
       return;
    }

    // 对敏感数据进行脱敏处理
    const maskedData = maskSensitiveDataArray(dataToExport, ['xh']);

    let headers: string[] = [];
    let rows: any[][] = [];
    const statusField = modalType === 'late-return' ? 'kqzt_wg' : modalType === 'not-return' ? 'kqzt_bg' : modalType === 'leave' ? 'qjbj' : modalType === 'out-school' ? 'xwzs' : 'kqzt_bg';
    const statusLabel = modalType === 'late-return' ? '晚归状态' : modalType === 'not-return' ? '未归状态' : modalType === 'leave' ? '请假状态' : modalType === 'out-school' ? '校外住宿状态' : '无记录状态';

    headers = ['学号', '姓名', '学院', '专业', '班级', '楼栋', '房间号', '考勤日期', statusLabel];
    rows = maskedData.map(item => [
      item.xh || '-',
      item.xm || '-',
      item.xy || '-',
      item.zy || '-',
      item.bj || '-',
      item.ldmc || '-',
      item.fjh || '-',
      formatToBeijingDate(item.kqrq),
      item[statusField] || '-'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const typeLabel = modalType === 'late-return' ? '晚归' : modalType === 'not-return' ? '未归' : modalType === 'leave' ? '请假' : modalType === 'out-school' ? '校外住宿' : '无记录';
    XLSX.writeFile(workbook, `${typeLabel}数据_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // 准备图表数据 - 按楼栋和考勤状态分布（用于堆叠条形图），按楼栋名称排序
  const chartData = Object.entries(dormitoryStats.byBuilding || {})
    .map(([building, stats]) => ({
      building,
      zc_count: stats.zc_count,
      wg_count: stats.wg_count,
      bg_count: stats.bg_count,
      qj_count: stats.qj_count
    }))
    .sort((a, b) => a.building.localeCompare(b.building, undefined, { numeric: true, sensitivity: 'base' }));

  const showStats = true;

  const filteredDormitoryData = useMemo(
    () => filterBySearch(modalSearchText ? allDormitoryCache : dormitoryData, ['xh', 'xm', 'xy', 'zy', 'bj', 'ldmc', 'fjh']),
    [modalSearchText, dormitoryData, allDormitoryCache]
  );

  const paginatedFilteredData = useMemo(() => {
    if (!modalSearchText) return filteredDormitoryData;
    const start = (currentPage - 1) * pageSize;
    return filteredDormitoryData.slice(start, start + pageSize);
  }, [filteredDormitoryData, currentPage, pageSize, modalSearchText]);

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
                            // 确保日期范围不会超过今天
                            const today = new Date();
                            const adjustedEndDate = endDate > today ? today : endDate;
                            const adjustedStartDate = startDate > today ? new Date(today.setDate(today.getDate() - 1)) : startDate;

                            setDateRange({ from: adjustedStartDate, to: adjustedEndDate });
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
            <Card
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('all')}
            >
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
                <p className="text-xs text-muted-foreground mt-1">{dateRangeDisplay}</p>
              </CardContent>
            </Card>

            <Card
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('normal-return')}
            >
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
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-orange-500/8 shadow-sm transition-all hover:shadow-md cursor-pointer")}
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
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-red-500/8 shadow-sm transition-all hover:shadow-md cursor-pointer")}
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

            <Card
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('leave')}
            >
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

            <Card
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('out-school')}
            >
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

            <Card
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('no-record')}
            >
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

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]" />
                各楼栋考勤状态分布
              </CardTitle>
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
                      <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border) / 0.5)" />
                      <XAxis type="number" />
                      <YAxis dataKey="building" type="category" width={80} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [value, name === 'zc_count' ? '正常回寝' : name === 'wg_count' ? '晚归' : name === 'bg_count' ? '未归' : name === 'qj_count' ? '请假' : name]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="zc_count" name="正常回寝" stackId="a" fill={DORMITORY_CHART_COLORS.normal} radius={[0, 8, 8, 0]} />
                      <Bar dataKey="wg_count" name="晚归" stackId="a" fill={DORMITORY_CHART_COLORS.late} radius={[0, 8, 8, 0]} />
                      <Bar dataKey="bg_count" name="未归" stackId="a" fill={DORMITORY_CHART_COLORS.absent} radius={[0, 8, 8, 0]} />
                      <Bar dataKey="qj_count" name="请假" stackId="a" fill={DORMITORY_CHART_COLORS.leave} radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
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
                {modalType === 'all' ? '全部详细记录' : modalType === 'normal-return' ? '正常回寝详细记录' : modalType === 'late-return' ? '晚归详细记录' : modalType === 'not-return' ? '未归详细记录' : modalType === 'leave' ? '请假详细记录' : modalType === 'out-school' ? '校外住宿详细记录' : '无记录详细记录'}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); setCurrentPage(1); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => { setModalSearchText(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="hidden sm:flex"
                  size="sm"
                  disabled={selectedItems.size === 0}
                  onClick={() => handleExport('selected')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出选中 ({selectedItems.size})
                </Button>
                {checkPermission(3) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('all')}
                  >
                     <Download className="mr-2 h-4 w-4" />
                    导出全部
                  </Button>
                )}
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
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                dormitoryData.length > 0 &&
                                dormitoryData.every(item => selectedItems.has(item.id))
                              }
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedItems);
                                dormitoryData.forEach(item => {
                                  if (checked) {
                                    newSelected.add(item.id);
                                  } else {
                                    newSelected.delete(item.id);
                                  }
                                });
                                setSelectedItems(newSelected);
                              }}
                            />
                          </TableHead>
                          <TableHead>学号</TableHead>
                          <TableHead>姓名</TableHead>
                          <TableHead>学院</TableHead>
                          <TableHead>专业</TableHead>
                          <TableHead>班级</TableHead>
                          <TableHead>楼栋</TableHead>
                          <TableHead>房间号</TableHead>
                          <TableHead>考勤日期</TableHead>
                          <TableHead>
                            {modalType === 'late-return' ? '晚归状态' : modalType === 'not-return' ? '未归状态' : modalType === 'leave' ? '请假状态' : modalType === 'out-school' ? '校外住宿状态' : '无记录状态'}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const sourceData = modalSearchText ? paginatedFilteredData : dormitoryData;
                          const maskedData = maskSensitiveDataArray(sourceData, ['xh']);
                          
                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.id || index}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedItems.has(item.id)}
                                    onCheckedChange={(checked) => {
                                      const newSelected = new Set(selectedItems);
                                      if (checked) {
                                        newSelected.add(item.id);
                                      } else {
                                        newSelected.delete(item.id);
                                      }
                                      setSelectedItems(newSelected);
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{item.xh || '-'}</TableCell>
                                <TableCell>{item.xm || '-'}</TableCell>
                                <TableCell>{item.xy || '-'}</TableCell>
                                <TableCell>{item.zy || '-'}</TableCell>
                                <TableCell>{item.bj || '-'}</TableCell>
                                <TableCell>{item.ldmc || '-'}</TableCell>
                                <TableCell>{item.fjh || '-'}</TableCell>
                                <TableCell>{formatToBeijingDate(item.kqrq)}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      modalType === 'leave'
                                        ? (item.qjbj === 1 ? 'default' : 'secondary')
                                        : modalType === 'out-school'
                                          ? (item.xwzs === 1 ? 'default' : 'secondary')
                                          : modalType === 'no-record'
                                            ? 'secondary'
                                            : modalType === 'late-return'
                                              ? (item.kqzt_bg === '晚归回寝' || item.kqzt_wg === '晚归回寝' ? 'default' : 'secondary')
                                              : (item.kqzt_bg === '出寝未归' || item.kqzt_bg === '返校未归' || item.kqzt_bg === '出校未归' ? 'destructive' : 'secondary')
                                    }
                                  >
                                    {modalType === 'leave'
                                      ? (item.qjbj === 1 ? '已请假' : '未请假')
                                      : modalType === 'out-school'
                                        ? (item.xwzs === 1 ? '校外住宿' : '校内住宿')
                                        : modalType === 'no-record'
                                          ? '无记录'
                                          : (item.kqzt_wg || item.kqzt_bg || '-')}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      {modalSearchText ? (
                        `共 ${filteredDormitoryData.length} 条记录（已筛选）`
                      ) : (
                        `共 ${totalRecords} 条记录`
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => modalSearchText ? setCurrentPage(p => Math.max(1, p - 1)) : handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {currentPage} / {modalSearchText ? (Math.max(1, Math.ceil(filteredDormitoryData.length / pageSize))) : (Math.ceil(totalRecords / pageSize) || 1)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => modalSearchText ? setCurrentPage(p => p + 1) : handlePageChange(currentPage + 1)}
                        disabled={modalSearchText ? currentPage >= Math.ceil(filteredDormitoryData.length / pageSize) : currentPage >= Math.ceil(totalRecords / pageSize)}
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

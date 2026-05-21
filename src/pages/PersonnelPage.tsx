import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Activity, BarChart2, CalendarIcon, ChevronLeft, ChevronRight, Download, Search, Shield, TrendingUp, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import type { OnlineUserData, OnlineUserStatsData, VisitorApiData, VisitorEntryApiData } from '@/services/externalApi';
import { fetchHumanTrafficStats, fetchOnlineUsersData, fetchOnlineUsersStats, fetchVisitedStats, fetchVisitorData, fetchVisitorEntryData, fetchVisitorEntryStats, fetchVisitorStats } from '@/services/externalApi';

interface DateRange {
  from: Date;
  to: Date;
}

type ModalType = 'visitor' | 'visitor-entry' | 'online-users' | null;

const PERSONNEL_CHART_COLORS = {
  visitCount: '#1D4ED8',
  visitedPersonCount: '#10B981',
  onlineBar: '#06B6D4',
  onlineLine: '#6366F1',
} as const;

export default function PersonnelPage() {
  const { profile } = useAuth();

  // 权限控制
  // 优先级: 显式设置权限 > 管理员默认权限(3) > 普通用户默认权限(1)
  const permissionLevel = profile?.permissions?.personnel ?? (profile?.role === 'admin' ? 3 : 1);
  const checkPermission = (minLevel: number) => permissionLevel >= minLevel;

  if (permissionLevel < 1) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">您没有权限访问人员管理模块</h2>
          <p className="text-sm text-muted-foreground mt-2">请联系管理员申请权限</p>
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visitorData, setVisitorData] = useState<VisitorApiData[]>([]);
  const [visitorEntryData, setVisitorEntryData] = useState<VisitorEntryApiData[]>([]);
  const [onlineUsersData, setOnlineUsersData] = useState<OnlineUserData[]>([]);
  const [visitedChartData, setVisitedChartData] = useState<{ date: string; visitCount: number; visitedPersonCount: number }[]>([]);
  const [onlineUsersChartData, setOnlineUsersChartData] = useState<{ time: string; count: number }[]>([]);
  const [totalVisitorCount, setTotalVisitorCount] = useState(0);
  const [totalVisitorEntryCount, setTotalVisitorEntryCount] = useState(0);
  const [totalOnlineUsersCount, setTotalOnlineUsersCount] = useState(0);
  const [humanTrafficStats, setHumanTrafficStats] = useState<{
    library: number;
    skybridge: number;
    total: number;
  }>({ library: 0, skybridge: 0, total: 0 });
  const [onlineUserStats, setOnlineUserStats] = useState<OnlineUserStatsData>({
    total: 0,
    students: 0,
    staff: 0,
    others: 0,
    byTime: {},
    byDeviceType: {},
    byLocation: {}
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [userTypeFilter, setUserTypeFilter] = useState<string | null>(null); // 用于过滤用户类型
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [modalSearchText, setModalSearchText] = useState('');

  // 全量数据缓存（用于检索）
  const [allVisitorCache, setAllVisitorCache] = useState<VisitorApiData[]>([]);
  const [allVisitorEntryCache, setAllVisitorEntryCache] = useState<VisitorEntryApiData[]>([]);
  const [allOnlineUsersCache, setAllOnlineUsersCache] = useState<OnlineUserData[]>([]);

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

    // 设置定时刷新，每1分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新人员数据...');
      loadStats();
    }, 60000); // 60000ms = 1分钟

    return () => clearInterval(intervalId);
    }, [dateRange]);

  useEffect(() => {
    if (modalType === 'visitor') {
      loadVisitorList();
    } else if (modalType === 'visitor-entry') {
      loadVisitorEntryList();
    } else if (modalType === 'online-users') {
      loadOnlineUsersList();
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
      const [statsResult, entryStatsResult, visitedStatsResult, humanTrafficResult, onlineStatsResult] = await Promise.all([
        fetchVisitorStats({ startDate, endDate, personnelMode: true }),
        fetchVisitorEntryStats({ startDate, endDate }),
        fetchVisitedStats({ startDate, endDate }),
        fetchHumanTrafficStats({ startDate, endDate }),
        fetchOnlineUsersStats({ startDate, endDate })
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

      if (onlineStatsResult.success && onlineStatsResult.data) {
        console.log('Online stats result:', onlineStatsResult.data);
        setOnlineUserStats(onlineStatsResult.data);
        setTotalOnlineUsersCount(onlineStatsResult.data.total || 0);

        // 准备在线用户图表数据
        const timeData = Object.entries(onlineStatsResult.data.byTime || {}).map(([time, count]) => ({
          time,
          count: count as number
        })).sort((a, b) => a.time.localeCompare(b.time));
        setOnlineUsersChartData(timeData);
      }

      if (visitedStatsResult.success && visitedStatsResult.data) {
        // 处理被访数据图表
        const dateList = [];
        // 使用开始日期和结束日期的日期部分进行比较
        const startDateOnly = new Date(startDate.split(' ')[0]);
        const endDateOnly = new Date(endDate.split(' ')[0]);
        
        const currentDate = new Date(startDateOnly);
        while (currentDate <= endDateOnly) {
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

    const loadOnlineUsersList = async () => {
    setLoadingOnline(true);
    // 使用精确的时间格式
    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      const listResult = await fetchOnlineUsersData({
        page: currentPage,
        pageSize,
        startDate,
        endDate,
        userType: userTypeFilter || undefined  // 传递用户类型过滤参数
      });

      if (listResult.success && listResult.data) {
        setOnlineUsersData(listResult.data);
        if (listResult.total !== undefined) {
          setTotalOnlineUsersCount(listResult.total);
        }
      } else {
        setOnlineUsersData([]);
        setTotalOnlineUsersCount(0);
      }
    } catch (err) {
      console.error('加载在线用户列表失败:', err);
    } finally {
      setLoadingOnline(false);
    }
  };

  const handleExport = async (exportMode: 'current' | 'selected' | 'all' = 'current') => {
    let dataToExport: any[] = [];
    let fileNameStub = '';

    if (modalType === 'visitor') {
      fileNameStub = '访客预约数据';
      if (exportMode === 'all') {
        // fetch all visitors
         const startDate = getPreciseDateString(dateRange.from);
         const endDate = getPreciseDateString(dateRange.to, true);
         const confirmExport = window.confirm(`确定要导出 ${startDate} 到 ${endDate} 的所有访客预约数据吗？`);
         if (!confirmExport) return;

         setLoading(true);
         try {
           const result = await fetchVisitorData({
             startDate,
             endDate,
             page: 1,
             pageSize: 100000, // Fetch all
             personnelMode: true
           });
           if (result.data) dataToExport = result.data;
         } catch (e) {
           console.error(e);
           alert('导出失败');
         } finally {
            setLoading(false);
         }
      } else {
         dataToExport = visitorData;
      }
    } else if (modalType === 'visitor-entry') {
      fileNameStub = '访客入校数据';
      if (exportMode === 'all') {
         const startDate = getPreciseDateString(dateRange.from);
         const endDate = getPreciseDateString(dateRange.to, true);
         const confirmExport = window.confirm(`确定要导出 ${startDate} 到 ${endDate} 的所有访客入校数据吗？`);
         if (!confirmExport) return;

         setLoading(true);
         try {
           const result = await fetchVisitorEntryData({
              startDate,
              endDate,
              page: 1,
              pageSize: 100000
           });
           if(result.data) dataToExport = result.data;
         } catch (e) {
            console.error(e);
            alert('导出失败');
         } finally {
            setLoading(false);
         }
      } else {
         dataToExport = visitorEntryData;
      }
    } else if (modalType === 'online-users') {
      fileNameStub = '在线用户数据';
      if (exportMode === 'all') {
          const confirmExport = window.confirm(`确定要导出所有在线用户数据吗？`);
          if (!confirmExport) return;

          setLoadingOnline(true);
          try {
             // Online users snapshots might not be queryable by date range in the same way or just current snapshot?
             // fetchOnlineUsersData takes page/pageSize.
             const result = await fetchOnlineUsersData({
                 page: 1,
                 pageSize: 100000
             });
             if(result.data) dataToExport = result.data;
          } catch(e) {
              console.error(e);
              alert('导出失败');
          } finally {
              setLoadingOnline(false);
          }
      } else {
          dataToExport = onlineUsersData;
      }
    }

    if (exportMode === 'selected') {
        if (selectedItems.size === 0) {
            alert('请先选择要导出的数据');
            return;
        }
        // Filter from CURRENT data because we don't fetch all for selection
        // This limitation is consistent with VehiclesPage
        dataToExport = dataToExport.filter((item: any) => {
            const id = modalType === 'online-users' ? item.fldUserId : item.guid;
            return selectedItems.has(String(id));
        });
    }

    if (dataToExport.length === 0) {
        if (exportMode !== 'all') alert('没有数据可导出'); // 'all' might have failed silently or showed error
        return;
    }

    let headers: string[] = [];
    let rows: any[][] = [];

    if (modalType === 'visitor') {
      // 对访客数据进行脱敏处理
      const maskedVisitorData = maskSensitiveDataArray(dataToExport, ['xm', 'cp', 'lxdh']);

      headers = ['姓名', '车牌号', '来访事由', '受访部门', '被拜访人', '审批状态', '到访时间', '离校时间'];
      rows = maskedVisitorData.map(v => [
        v.xm || '-',
        v.cp || '-',
        v.lfsy || '-',
        v.bfbm || '-',
        v.bfr || '-',
        v.system_status || '-',
        v.dfsj || '-',
        v.lfsj || '-'
      ]);
    } else if (modalType === 'visitor-entry') {
      // 对访客入校数据进行脱敏处理
      const maskedVisitorEntryData = maskSensitiveDataArray(dataToExport, ['xm', 'lxdh', 'sfzh']);

      headers = ['访客姓名', '入校时间', '联系电话', '身份证号', '扫码人'];
      rows = maskedVisitorEntryData.map(v => [
        v.xm || '-',
        v.smsj || '-',
        v.lxdh || '-',
        v.sfzh || '-',
        v.smrxm || '-'
      ]);
    } else if (modalType === 'online-users') {
      // 对在线用户数据进行脱敏处理
      const maskedOnlineUsersData = maskSensitiveDataArray(dataToExport, ['fldUserRealName', 'fldUserMac', 'fldUserIp', 'fldBindAccount']);

      headers = ['用户名', '真实姓名', '登录时间', 'MAC地址', 'IP地址', '绑定账号'];
      rows = maskedOnlineUsersData.map(v => [
        v.fldUserName || '-',
        v.fldUserRealName || '-',
        v.fldLoginDate ? format(new Date(v.fldLoginDate), 'yyyy-MM-dd HH:mm:ss') : '-',
        v.fldUserMac || '-',
        v.fldUserIp || '-',
        v.fldBindAccount || '-'
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // 导出文件
    XLSX.writeFile(workbook, `${fileNameStub}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleModalOpen = (type: ModalType, userType?: string) => {
    if (!checkPermission(2)) {
      alert('您没有权限查看详细表单');
      return;
    }
    setModalType(type);
    setUserTypeFilter(userType || null);
    setCurrentPage(1);
    setModalSearchText('');

    if (type === 'visitor') loadAllVisitors();
    else if (type === 'visitor-entry') loadAllVisitorEntries();
    else if (type === 'online-users') loadAllOnlineUsers(userType);
  };

  const loadAllVisitors = async () => {
    try {
      const startDate = getPreciseDateString(dateRange.from);
      const endDate = getPreciseDateString(dateRange.to, true);
      const result = await fetchVisitorData({ startDate, endDate, page: 1, pageSize: 100000 });
      if (result.success && result.data) setAllVisitorCache(result.data);
    } catch (e) { console.error('加载全部访客数据失败:', e); }
  };

  const loadAllVisitorEntries = async () => {
    try {
      const startDate = getPreciseDateString(dateRange.from);
      const endDate = getPreciseDateString(dateRange.to, true);
      const result = await fetchVisitorEntryData({ startDate, endDate, page: 1, pageSize: 100000 });
      if (result.success && result.data) setAllVisitorEntryCache(result.data);
    } catch (e) { console.error('加载全部入校数据失败:', e); }
  };

  const loadAllOnlineUsers = async (userType?: string) => {
    try {
      const result = await fetchOnlineUsersData({ userType, page: 1, pageSize: 100000 });
      if (result.success && result.data) setAllOnlineUsersCache(result.data);
    } catch (e) { console.error('加载全部在线用户数据失败:', e); }
  };

  const handleModalClose = () => {
    setModalType(null);
    setCurrentPage(1);
    setModalSearchText('');
  };

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

  const filteredVisitors = useMemo(
    () => filterBySearch(modalSearchText ? allVisitorCache : visitorData, ['xm', 'bfbm', 'bfr', 'lfsy', 'system_status']),
    [modalSearchText, visitorData, allVisitorCache]
  );
  const filteredVisitorEntries = useMemo(
    () => filterBySearch(modalSearchText ? allVisitorEntryCache : visitorEntryData, ['xm', 'smrxm', 'lxdh']),
    [modalSearchText, visitorEntryData, allVisitorEntryCache]
  );
  const filteredOnlineUsers = useMemo(
    () => filterBySearch(modalSearchText ? allOnlineUsersCache : onlineUsersData, ['fldUserName', 'fldUserRealName', 'department']),
    [modalSearchText, onlineUsersData, allOnlineUsersCache]
  );

  const paginatedFilteredVisitors = useMemo(() => {
    if (!modalSearchText) return filteredVisitors;
    const start = (currentPage - 1) * pageSize;
    return filteredVisitors.slice(start, start + pageSize);
  }, [filteredVisitors, currentPage, pageSize, modalSearchText]);

  const paginatedFilteredVisitorEntries = useMemo(() => {
    if (!modalSearchText) return filteredVisitorEntries;
    const start = (currentPage - 1) * pageSize;
    return filteredVisitorEntries.slice(start, start + pageSize);
  }, [filteredVisitorEntries, currentPage, pageSize, modalSearchText]);

  const paginatedFilteredOnlineUsers = useMemo(() => {
    if (!modalSearchText) return filteredOnlineUsers;
    const start = (currentPage - 1) * pageSize;
    return filteredOnlineUsers.slice(start, start + pageSize);
  }, [filteredOnlineUsers, currentPage, pageSize, modalSearchText]);

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
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm transition-all hover:shadow-md cursor-pointer")}
              onClick={() => handleModalOpen('visitor')}
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
              className={cn("border-border/60 bg-gradient-to-br from-background via-background to-chart-2/8 shadow-sm transition-all hover:shadow-md cursor-pointer")}
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
            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">图书馆人流量</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{humanTrafficStats.library}</div>
                <p className="text-xs text-muted-foreground">实时统计</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-1/8 shadow-sm">
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

          {/* 在校人员实时统计 */}
          <div className="mt-4 space-y-4">
            <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]" />
                  <Activity className="h-5 w-5 text-primary" />
                  在校人员实时统计
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {loadingOnline ? (
                  <div className="flex justify-center items-center h-24">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer border border-blue-200"
                      onClick={() => handleModalOpen('online-users')}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                           <p className="text-sm font-medium text-blue-600/80 mb-1">在校总人数</p>
                           <h3 className="text-3xl font-bold text-blue-700">{onlineUserStats.total || 0}</h3>
                        </div>
                        <div className="p-2 bg-blue-200/50 rounded-lg text-blue-700 group-hover:bg-blue-200 transition-colors">
                           <Users className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center text-xs text-blue-600/70">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
                        实时在线
                      </div>
                    </div>

                    <div
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer border border-emerald-200"
                      onClick={() => handleModalOpen('online-users', 'student')}
                    >
                       <div className="flex justify-between items-start">
                        <div>
                           <p className="text-sm font-medium text-emerald-600/80 mb-1">在校学生</p>
                           <h3 className="text-3xl font-bold text-emerald-700">{onlineUserStats.students || 0}</h3>
                        </div>
                        <div className="p-2 bg-emerald-200/50 rounded-lg text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                           <div className="font-serif font-bold text-lg leading-none">学</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center text-xs text-emerald-600/70">
                        占比 {onlineUserStats.total ? Math.round((onlineUserStats.students / onlineUserStats.total) * 100) : 0}%
                      </div>
                    </div>

                    <div
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer border border-purple-200"
                      onClick={() => handleModalOpen('online-users', 'staff')}
                    >
                       <div className="flex justify-between items-start">
                        <div>
                           <p className="text-sm font-medium text-purple-600/80 mb-1">在校教职工</p>
                           <h3 className="text-3xl font-bold text-purple-700">{onlineUserStats.staff || 0}</h3>
                        </div>
                        <div className="p-2 bg-purple-200/50 rounded-lg text-purple-700 group-hover:bg-purple-200 transition-colors">
                            <Shield className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center text-xs text-purple-600/70">
                        包含教师与行政人员
                      </div>
                    </div>

                    <div
                      className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer border border-orange-200"
                      onClick={() => handleModalOpen('online-users', 'other')}
                    >
                       <div className="flex justify-between items-start">
                        <div>
                           <p className="text-sm font-medium text-orange-600/80 mb-1">其他人员</p>
                           <h3 className="text-3xl font-bold text-orange-700">{onlineUserStats.others || 0}</h3>
                        </div>
                        <div className="p-2 bg-orange-200/50 rounded-lg text-orange-700 group-hover:bg-orange-200 transition-colors">
                           <div className="font-medium text-lg leading-none">?</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center text-xs text-orange-600/70">
                         未识别身份用户
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-1/8 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[color:#1D4ED8] shadow-[0_0_0_6px_rgba(29,78,216,0.12)]" />
                    访客预约数据趋势
                  </CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={visitedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="hsl(var(--border) / 0.5)" />
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
                      <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} />
                      <Legend />
                      <Bar dataKey="visitCount" name="被访次数" fill={PERSONNEL_CHART_COLORS.visitCount} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="visitedPersonCount" name="被访人数" fill={PERSONNEL_CHART_COLORS.visitedPersonCount} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[color:#06B6D4] shadow-[0_0_0_6px_rgba(6,182,212,0.12)]" />
                    校园在线用户趋势图
                  </CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={onlineUsersChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                      <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} />
                      <Legend />
                      <Bar dataKey="count" name="在线用户数" fill={PERSONNEL_CHART_COLORS.onlineBar} radius={[8, 8, 0, 0]} />
                      <Line type="monotone" dataKey="count" name="趋势线" stroke={PERSONNEL_CHART_COLORS.onlineLine} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
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
                {modalType === 'online-users' && '在线用户详细记录'}
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
                    <button
                      onClick={() => { setModalSearchText(''); setCurrentPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
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
              {(loading && (modalType === 'visitor' || modalType === 'visitor-entry')) ||
               (loadingOnline && modalType === 'online-users') ? (
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
                                (() => {
                                  let data: any[] = [];
                                  if (modalType === 'visitor') data = visitorData;
                                  else if (modalType === 'visitor-entry') data = visitorEntryData;
                                  else if (modalType === 'online-users') data = onlineUsersData;

                                  if (data.length === 0) return false;

                                  const ids = data.map((item: any) => String(modalType === 'online-users' ? item.fldUserId : item.guid));
                                  return ids.length > 0 && ids.every((id: string) => selectedItems.has(id));
                                })()
                              }
                              onCheckedChange={(checked) => {
                                  let data: any[] = [];
                                  if (modalType === 'visitor') data = visitorData;
                                  else if (modalType === 'visitor-entry') data = visitorEntryData;
                                  else if (modalType === 'online-users') data = onlineUsersData;

                                  const newSelected = new Set(selectedItems);
                                  data.forEach((item: any) => {
                                    const id = String(modalType === 'online-users' ? item.fldUserId : item.guid);
                                    if (checked) newSelected.add(id);
                                    else newSelected.delete(id);
                                  });
                                  setSelectedItems(newSelected);
                              }}
                            />
                          </TableHead>
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
                          {modalType === 'online-users' && (
                            <>
                              <TableHead>用户名</TableHead>
                              <TableHead>真实姓名</TableHead>
                              <TableHead>登录时间</TableHead>
                              {userTypeFilter !== 'other' && <TableHead>部门</TableHead>}
                              {userTypeFilter !== 'other' && <TableHead>性别</TableHead>}
                              <TableHead>用户类型</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          if (modalType === 'visitor') {
                            const maskedVisitorData = maskSensitiveDataArray(
                              modalSearchText ? paginatedFilteredVisitors : visitorData,
                              ['xm', 'cp', 'lxdh']
                            );

                            return maskedVisitorData.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                  {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              maskedVisitorData.map((visitor, index) => (
                                <TableRow key={visitor.guid || index}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedItems.has(String(visitor.guid))}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedItems);
                                        if (checked) newSelected.add(String(visitor.guid));
                                        else newSelected.delete(String(visitor.guid));
                                        setSelectedItems(newSelected);
                                      }}
                                    />
                                  </TableCell>
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
                                  <TableCell>{visitor.dfsj ? format(new Date(visitor.dfsj), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                                  <TableCell>{visitor.lfsj ? format(new Date(visitor.lfsj), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                                </TableRow>
                              ))
                            );
                          } else if (modalType === 'visitor-entry') {
                            const maskedVisitorEntryData = maskSensitiveDataArray(
                              modalSearchText ? paginatedFilteredVisitorEntries : visitorEntryData,
                              ['xm', 'lxdh', 'sfzh']
                            );

                            return maskedVisitorEntryData.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                  {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              maskedVisitorEntryData.map((entry, index) => (
                                <TableRow key={entry.guid || index}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedItems.has(String(entry.guid))}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedItems);
                                        if (checked) newSelected.add(String(entry.guid));
                                        else newSelected.delete(String(entry.guid));
                                        setSelectedItems(newSelected);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{entry.xm || '-'}</TableCell>
                                  <TableCell>{entry.smsj ? format(new Date(entry.smsj), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                                  <TableCell>{entry.lxdh || '-'}</TableCell>
                                  <TableCell>{entry.sfzh || '-'}</TableCell>
                                  <TableCell>{entry.smrxm || '-'}</TableCell>
                                </TableRow>
                              ))
                            );
                          } else {
                            const maskedOnlineUsersData = maskSensitiveDataArray(
                              modalSearchText ? paginatedFilteredOnlineUsers : onlineUsersData,
                              ['fldUserRealName', 'fldUserMac', 'fldUserIp', 'fldBindAccount']
                            );
                            
                            return maskedOnlineUsersData.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                  {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              maskedOnlineUsersData.map((user, index) => (
                                <TableRow key={user.fldUserId || index}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedItems.has(String(user.fldUserId))}
                                      onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedItems);
                                        if (checked) newSelected.add(String(user.fldUserId));
                                        else newSelected.delete(String(user.fldUserId));
                                        setSelectedItems(newSelected);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{user.fldUserName || '-'}</TableCell>
                                  <TableCell>{user.fldUserRealName || '-'}</TableCell>
                                  <TableCell>{user.fldLoginDate ? format(new Date(user.fldLoginDate), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                                  {userTypeFilter !== 'other' && <TableCell>{user.department || '-'}</TableCell>}
                                  {userTypeFilter !== 'other' && <TableCell>{user.gender || '-'}</TableCell>}
                                  <TableCell>{user.userType || '-'}</TableCell>
                                </TableRow>
                              ))
                            );
                          }
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      {modalSearchText ? (
                        `共 ${modalType === 'visitor' ? filteredVisitors.length :
                          modalType === 'visitor-entry' ? filteredVisitorEntries.length :
                          filteredOnlineUsers.length} 条记录（已筛选）`
                      ) : (
                        `共 ${modalType === 'visitor' ? totalVisitorCount :
                          modalType === 'visitor-entry' ? totalVisitorEntryCount : 
                          totalOnlineUsersCount} 条记录`
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 ||
                                 (modalType === 'visitor' && loading) ||
                                 (modalType === 'visitor-entry' && loading) ||
                                 (modalType === 'online-users' && loadingOnline)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {currentPage} / {modalSearchText ? (
                          Math.max(1, Math.ceil((modalType === 'visitor' ? filteredVisitors.length :
                            modalType === 'visitor-entry' ? filteredVisitorEntries.length :
                            filteredOnlineUsers.length) / pageSize))
                        ) : (
                          Math.ceil((modalType === 'visitor' ? totalVisitorCount :
                            modalType === 'visitor-entry' ? totalVisitorEntryCount :
                            totalOnlineUsersCount) / pageSize) || 1
                        )}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={(modalSearchText ? currentPage >= Math.ceil((modalType === 'visitor' ? filteredVisitors.length :
                          modalType === 'visitor-entry' ? filteredVisitorEntries.length :
                          filteredOnlineUsers.length) / pageSize) : currentPage >= Math.ceil(
                          (modalType === 'visitor' ? totalVisitorCount :
                            modalType === 'visitor-entry' ? totalVisitorEntryCount :
                            totalOnlineUsersCount) / pageSize
                        )) ||
                                 (modalType === 'visitor' && loading) ||
                                 (modalType === 'visitor-entry' && loading) ||
                                 (modalType === 'online-users' && loadingOnline)}
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



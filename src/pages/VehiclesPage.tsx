import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Download, Car, TrendingUp, AlertTriangle, Users, X, ChevronLeft, ChevronRight, Car as CarIcon, BarChart2, Shield } from 'lucide-react';

// 通用的日期验证函数
const isValidDate = (dateStr: string | undefined) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import type { VehicleData, DateRange } from '@/types/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVehicleData as apiFetchVehicleData, fetchVehicleRegistrationData, fetchVisitorData, fetchAllVehicleRegistrations, fetchVehicleStats, fetchVisitorStats, fetchAllVehicleData } from '@/services/externalApi';

// 定义车辆登记信息类型
interface VehicleRegistrationData {
  id: number | string;
  guid: string;
  gh?: string;
  bh?: string;
  xm?: string;
  lxfs?: string;
  bm?: string;
  cllx?: string;
  cp: string;
  djrq?: string; // 登记日期
  dqrq?: string; // 到期日期
  dxwb?: string;
  syjf?: string;
  data_source: string;
  raw_data: any;
}

// 定义访客数据类型
interface VisitorData {
  guid: string;
  xm?: string; // 姓名
  lfsy?: string; // 来访事由
  bfbm?: string; // 受访部门
  system_status?: string; // 审批状态
  lfsj?: string; // 离校时间
  dfsj?: string; // 到访时间
  cp?: string; // 车牌号（如果有）
  sfzh?: string; // 身份证号
  lxdh?: string; // 联系电话
  raw_data: any;
}

// 定义分页数据类型
interface PaginationData<T> {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

// 定义弹窗类型
type ModalType = 'passage' | 'speeding' | 'registration' | 'visitor' | null;

// 定义缓存数据类型
interface DataCache {
  passage: VehicleData[];
  speeding: VehicleData[];
  registration: VehicleRegistrationData[];
  visitor: VisitorData[];
}

// 地点名称映射表，用于简化过长的标签
const LOCATION_NAME_MAPPING: Record<string, string> = {
  // 原始完整名称映射
  '综合体双出_视频通道_1': '综合体双出',
  '博雅楼东侧雷视': '博雅楼东',
  '超豪4路口雷视': '超豪4',
  '综合体单入-屏_视频通道_1': '综合体单入',
  '博雅楼南侧雷视': '博雅楼南',
  '博闻楼东雷视': '博闻楼东',
  '德涵楼西出_视频通道_1': '德涵楼西出',
  '德涵楼西入_视频通道_1': '德涵楼西入',
  '南校区西门雷视': '南校区西门',
  '博雅楼B进-屏_视频通道_1': '博雅楼B进',
  '德涵楼东入-屏_视频通道_1': '德涵楼东入',
  '西门停车场入口_视频通道_1': '西门停车场入口',
  '西门停车场出口2_视频通道_1': '西门停车场出口2',
  '综合体双入-屏_视频通道_1': '综合体双入',
  '传媒与艺术设计学院': '传艺学院',
  '基本建设办公室（旧）': '基建办（旧）',
  '党群工作部(新闻中心)': '新闻中心',

  // 用户反馈的特殊情况
  '区西门雷视': '南校区西门',

  // 部分匹配关键词 (用于 formatLocationName 中的 includes 匹配)
  '综合体双出': '综合体双出',
  '博雅楼东侧': '博雅楼东',
  '超豪4路口': '超豪4',
  '综合体单入': '综合体单入',
  '博雅楼南侧': '博雅楼南',
  '博闻楼东': '博闻楼东',
  '德涵楼西出': '德涵楼西出',
  '德涵楼西入': '德涵楼西入',
  '南校区西门': '南校区西门',
  '博雅楼B进': '博雅楼B进',
  '德涵楼东入': '德涵楼东入',
  '西门停车场入口': '西门停车场入口',
  '西门停车场出口2': '西门停车场出口2',
  '综合体双入': '综合体双入',
};

const formatLocationName = (name: string) => {
  if (!name) return '';
  let cleanName = name.trim();

  // 1. 尝试完全匹配映射表
  if (LOCATION_NAME_MAPPING[cleanName]) {
    return LOCATION_NAME_MAPPING[cleanName];
  }

  // 2. 通用后缀清理 (正则替换)
  // 移除 "_视频通道_X", "-屏", "雷视", "侧" 等后缀
  cleanName = cleanName
    .replace(/_视频通道_\d+/g, '')
    .replace(/-屏/g, '')
    .replace(/雷视/g, '')
    .replace(/侧/g, '')
    .replace(/路口/g, '');

  // 3. 再次尝试匹配映射表 (清理后的名称可能在映射表中)
  if (LOCATION_NAME_MAPPING[cleanName]) {
    return LOCATION_NAME_MAPPING[cleanName];
  }

  // 4. 尝试部分匹配映射表
  const sortedKeys = Object.keys(LOCATION_NAME_MAPPING).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (cleanName.includes(key)) {
      return LOCATION_NAME_MAPPING[key];
    }
  }

  return cleanName;
};

export default function VehiclesPage() {
  const { profile } = useAuth();
  
  // 权限检查函数
  const canViewDetails = (module: 'vehicle' | 'fireSafety' | 'personnel' | 'security' | 'dormitory') => {
    if (!profile || !profile.permissions) {
      return false;
    }
    
    // 根据模块检查对应的权限
    switch (module) {
      case 'vehicle':
        return profile.permissions.canViewVehicleDetails || profile.role === 'admin';
      case 'fireSafety':
        return profile.permissions.canViewFireSafetyDetails || profile.role === 'admin';
      case 'personnel':
        return profile.permissions.canViewPersonnelDetails || profile.role === 'admin';
      case 'security':
        return profile.permissions.canViewSecurityDetails || profile.role === 'admin';
      case 'dormitory':
        return profile.permissions.canViewDormitoryDetails || profile.role === 'admin';
      default:
        return false;
    }
  };
  const [loading, setLoading] = useState(true);
  // 新增细分 loading 状态，使各个模块可以独立加载显示
  const [loadingPassage, setLoadingPassage] = useState(true);
  const [loadingSpeeding, setLoadingSpeeding] = useState(true);
  const [loadingRegistration, setLoadingRegistration] = useState(true);
  const [loadingVisitor, setLoadingVisitor] = useState(true);

  const [loadingDetails, setLoadingDetails] = useState<{[key: string]: boolean}>({});
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [registrations, setRegistrations] = useState<VehicleRegistrationData[]>([]);
  const [statsRegistrations, setStatsRegistrations] = useState<VehicleRegistrationData[]>([]); // 新增：用于统计图表的车辆登记数据
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [passageChartData, setPassageChartData] = useState<{ date: string; count: number }[]>([]);
  const [speedingChartData, setSpeedingChartData] = useState<{ date: string; count: number }[]>([]);
  const [visitorChartData, setVisitorChartData] = useState<{ date: string; count: number }[]>([]);
  const [topLocationsData, setTopLocationsData] = useState<{ name: string; count: number }[]>([]); // 新增：地点车流量数据
  const [speedingData, setSpeedingData] = useState<VehicleData[]>([]);

  // 新增：总数统计状态
  const [totalPassageCount, setTotalPassageCount] = useState(0);
  const [totalVisitorCount, setTotalVisitorCount] = useState(0);
  const [totalRegistrationCount, setTotalRegistrationCount] = useState(0);
  const [totalSpeedingCount, setTotalSpeedingCount] = useState(0);
  const [totalModalCount, setTotalModalCount] = useState(0); // 模态框分页总数

  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setHours(0, 0, 0, 0)), // 今天的开始时间
    to: new Date(new Date().setHours(23, 59, 59, 999)), // 今天的结束时间
  });
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  
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

  // 预设日期范围选项
  const presetDateRanges = [
    { value: 'today', label: '今天', days: 0 },
    { value: 'last3days', label: '最近3天', days: 3 },
    { value: 'last7days', label: '最近7天', days: 7 },
    { value: 'last30days', label: '最近30天', days: 30 },
    { value: 'last90days', label: '最近90天', days: 90 },
  ];
  
  // 计算当前日期范围的显示文本
  const dateRangeDisplay = `${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`;
  const [modalType, setModalType] = useState<ModalType>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // 每页显示10行数据
  const [error, setError] = useState<string | null>(null);
  
  // 添加缓存状态
  const [dataCache, setDataCache] = useState<DataCache>({
    passage: [],
    speeding: [],
    registration: [],
    visitor: []
  });

  useEffect(() => {
    loadVehicleData();

    // 设置定时刷新，每5分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新车辆数据...');
      loadVehicleData();
    }, 300000);

    return () => clearInterval(intervalId);
  }, [dateRange]);
  
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
  
    const loadVehicleData = async () => {
    try {
      setLoading(true);
      // 重置所有细分 loading 状态
      setLoadingPassage(true);
      setLoadingSpeeding(true);
      setLoadingRegistration(true);
      setLoadingVisitor(true);

      setError(null); // 重置错误状态
      
      // 使用精确的时间格式
      const startDate = getPreciseDateString(dateRange.from);
      const endDate = getPreciseDateString(dateRange.to, true);

      // 生成时间段内的完整日期列表，确保图表显示完整的时间轴
      const dateList = [];
      const currentDate = new Date(format(dateRange.from, 'yyyy-MM-dd'));
      const endDateObj = new Date(format(dateRange.to, 'yyyy-MM-dd'));

      while (currentDate <= endDateObj) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        dateList.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 1. 加载通行统计数据
      const loadPassageStats = async () => {
        try {
          console.log('请求车辆通行统计数据...');
          const statsResult = await fetchVehicleStats({ startDate, endDate });
          if (statsResult.success && statsResult.data) {
            const passageDateCounts = statsResult.data.byDate;
            const passageChartDataArray = dateList.map(date => ({
              date: format(new Date(date), 'MM-dd', { locale: zhCN }),
              count: passageDateCounts[date] || 0,
            }));
            setPassageChartData(passageChartDataArray);

            if (statsResult.data.byLocation) {
              const locationCounts = statsResult.data.byLocation;
              const sortedLocations = Object.entries(locationCounts)
                .map(([name, count]) => ({ name: formatLocationName(name), count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
              setTopLocationsData(sortedLocations);
            }
            setTotalPassageCount(statsResult.data.total || 0);
          }
        } catch (e) {
          console.error('加载通行统计失败', e);
        } finally {
          setLoadingPassage(false); // 独立结束 loading
        }
      };

      // 2. 加载超速统计数据
      const loadSpeedingStats = async () => {
        try {
          console.log('请求超速统计数据...');
          // 使用 fetchVehicleStats 获取超速统计数据 (包括地点和最高车速)
          const statsResult = await fetchVehicleStats({
            startDate,
            endDate,
            speedingOnly: true
          });

          if (statsResult.success && statsResult.data) {
            setTotalSpeedingCount(statsResult.data.total || 0);

            // 生成超速地点统计图数据 (前10个地点)
            if (statsResult.data.byLocation) {
              const locationCounts = statsResult.data.byLocation;
              const maxSpeeds = statsResult.data.maxSpeedByLocation || {};

              const sortedLocations = Object.entries(locationCounts)
                .map(([name, count]) => ({
                  name: formatLocationName(name),
                  count,
                  maxSpeed: maxSpeeds[name] || 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

              setSpeedingChartData(sortedLocations);
            } else {
              setSpeedingChartData([]);
            }
          } else {
            setSpeedingChartData([]);
          }
        } catch (e) {
          console.error('加载超速统计失败', e);
        } finally {
          setLoadingSpeeding(false); // 独立结束 loading
        }
      };

      // 3. 加载车辆登记数据
      const loadRegistrationStats = async () => {
        try {
          console.log('请求车辆登记数据...');

          // 车辆登记数据默认显示最近30天
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

          // 确保至少包含最近30天的数据
          const queryStartDate = startDate > thirtyDaysAgoStr ? thirtyDaysAgoStr : startDate;

          // 使用全量接口获取数据，确保统计准确
          const result = await fetchAllVehicleRegistrations({
            startDate: queryStartDate,
            endDate,
          });

          if (result.success && result.data) {
            // 过滤有效数据
            const validData = result.data.filter((item: any) => {
              if (!item.djrq || !isValidDate(item.djrq)) return false;
              const registrationDate = format(new Date(item.djrq), 'yyyy-MM-dd');
              return registrationDate >= queryStartDate && registrationDate <= endDate;
            });

            // 转换数据格式
            const formattedData = validData.map((item: any) => ({
              id: Math.random() * 1000000,
              guid: item.guid,
              gh: item.gh,
              bh: item.bh,
              xm: item.xm,
              lxfs: item.lxfs,
              bm: item.bm,
              cllx: item.cllx,
              cp: item.cp,
              djrq: item.djrq,
              dqrq: item.dqrq,
              dxwb: item.dxwb,
              syjf: item.syjf,
              data_source: 'api',
              raw_data: item,
            }));

            // 更新统计数据
            setTotalRegistrationCount(validData.length);

            // 更新图表数据
            setStatsRegistrations(formattedData);

            // 同时更新列表数据
            setRegistrations(formattedData);
          }
        } catch (e) {
          console.error('加载登记统计失败', e);
        } finally {
          setLoadingRegistration(false); // 独立结束 loading
        }
      };

      // 4. 加载访客统计数据
      const loadVisitorStats = async () => {
        try {
          console.log('请求访客统计数据...');
          const visitorStatsResult = await fetchVisitorStats({ startDate, endDate });

          if (visitorStatsResult.success && visitorStatsResult.data) {
            setTotalVisitorCount(visitorStatsResult.data.total || 0);

            if (visitorStatsResult.data.byDepartment) {
              const deptCounts = visitorStatsResult.data.byDepartment;
              const visitorChartDataArray = Object.entries(deptCounts)
                .map(([name, count]) => ({ name: formatLocationName(name), count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

              const mappedChartData = visitorChartDataArray.map(item => ({
                date: item.name,
                count: item.count
              }));
              setVisitorChartData(mappedChartData);
            }
          }
          // 不在此处加载详细访客列表(fetchVisitorData)，实现懒加载
        } catch (e) {
          console.error('加载访客统计失败', e);
        } finally {
          setLoadingVisitor(false); // 独立结束 loading
        }
      };

      // 并行执行所有加载任务
      await Promise.all([
        loadPassageStats(),
        loadSpeedingStats(),
        loadRegistrationStats(),
        loadVisitorStats()
      ]);

    } catch (error) {
      console.error('加载车辆数据失败:', error);
      setError('加载车辆数据失败，请检查内部代理服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // 使用缓存机制的详细数据加载
  const loadDetailedDataWithCache = useCallback(async (type: ModalType, page: number = 1) => {
    if (!type) return;
    
    // 设置加载状态
    setLoadingDetails(prev => ({ ...prev, [type]: true }));

    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      if (type === 'passage' || type === 'speeding') {
        // 使用全量数据API获取车辆通行数据 (分页)
        const result = await fetchAllVehicleData({
          startDate,
          endDate,
          page,
          pageSize,
          speedingOnly: type === 'speeding'
        });

        if (result.success && result.data) {
          // 根据类型设置数据
          if (type === 'passage') {
            // 通行数据已按时间范围过滤，直接设置
            setVehicles(result.data);
            setTotalModalCount(result.total || 0);
            setTotalPassageCount(result.total || 0);
          }

          if (type === 'speeding') {
            // 后端已根据 speedingOnly 参数过滤超速数据
            setSpeedingData(result.data);
            setTotalSpeedingCount(result.total || 0);
            setTotalModalCount(result.total || 0);
          }
        } else {
          console.error('获取车辆数据失败:', result.error);
          if (type === 'passage') setVehicles([]);
          if (type === 'speeding') setSpeedingData([]);
        }
      } else if (type === 'registration') {
        // 车辆登记数据默认显示最近30天
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');
        const regStartDate = startDate > thirtyDaysAgoStr ? thirtyDaysAgoStr : startDate;

        // 使用全量数据API获取车辆登记数据
        const registrationResult = await fetchAllVehicleRegistrations({
          startDate: regStartDate,
          endDate,
          page,
          pageSize
        });
        
        if (registrationResult.success && registrationResult.data) {
          // 根据时间范围过滤车辆登记数据
          const filteredRegistrationData = registrationResult.data.filter((item: any) => {
            if (!item.djrq || !isValidDate(item.djrq)) return false; // 如果没有登记日期或日期无效，则过滤掉
            const registrationDate = format(new Date(item.djrq), 'yyyy-MM-dd');
            return registrationDate >= regStartDate && registrationDate <= endDate;
          });

          // 转换API数据为内部格式
          const registrationData = filteredRegistrationData.map((item: any) => ({
            id: Math.random() * 1000000, // 生成临时ID
            guid: item.guid,
            gh: item.gh,
            bh: item.bh,
            xm: item.xm,
            lxfs: item.lxfs,
            bm: item.bm,
            cllx: item.cllx,
            cp: item.cp,
            djrq: item.djrq,
            dqrq: item.dqrq,
            dxwb: item.dxwb,
            syjf: item.syjf,
            data_source: 'api',
            raw_data: item,
          }));
          setRegistrations(registrationData);
          // 使用过滤后的数据长度作为总数，确保分页正确
          setTotalModalCount(filteredRegistrationData.length);
          // setTotalRegistrationCount(filteredRegistrationData.length); // Don't update total count here as it might be partial data
        } else {
          console.error('获取车辆登记数据失败:', registrationResult.error);
          setRegistrations([]);
        }
      } else if (type === 'visitor') {
        // 使用分页API获取访客数据
        const visitorResult = await fetchVisitorData({
          startDate,
          endDate,
          page,
          pageSize
        });

        if (visitorResult.success && visitorResult.data) {
          console.log('Modal visitor data received:', visitorResult.data.length);
          // 后端已经根据时间范围过滤了数据，前端不需要再次过滤
          // 这样可以避免因日期格式或时区问题导致数据被错误过滤
          setVisitors(visitorResult.data);

          // 使用API返回的总数
          const total = visitorResult.total || visitorResult.data.length;
          console.log('Modal visitor total:', total);
          setTotalModalCount(total);
          setTotalVisitorCount(total);
        } else {
          console.error('获取访客数据失败:', visitorResult.error);
          setVisitors([]);
        }
      }
    } catch (error) {
      console.error(`加载${type}详细数据失败:`, error);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [type]: false }));
    }
  }, [dateRange, pageSize]);

  const handleExport = (data: any[], type: string) => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }

    let headers: string[] = [];
    let rows: string[][] = [];

    switch (type) {
      case 'passage':
        headers = ['车牌号', '识别状态', '站点', '通过时间', '车速'];
        rows = data.map((v: any) => [
          v.cph || v.plate_number,
          v.qcysmc || v.recognition_name || '-',
          v.sbtdmc || v.station_name || '-',
          v.zpsj || v.pass_time,
          v.cs || v.raw_data?.cs || '-',
        ]);
        break;
      case 'speeding':
        headers = ['车牌号', '车速', '站点', '通过时间'];
        rows = data.map((v: any) => [
          v.cph || v.plate_number,
          v.cs || v.raw_data?.cs || '-',
          v.sbtdmc || v.station_name || '-',
          v.zpsj || v.pass_time,
        ]);
        break;
      case 'registration':
        headers = ['车牌号', '姓名', '部门', '车辆类型', '登记日期', '到期日期'];
        rows = data.map((v: any) => [
          v.cp,
          v.xm || '-',
          v.bm || '-',
          v.cllx || '-',
          v.djrq || '-',
          v.dqrq || '-',
        ]);
        break;
      case 'visitor':
        headers = ['姓名', '车牌号', '来访事由', '受访部门', '审批状态', '到访时间'];
        rows = data.map((v: any) => [
          v.xm || '-',
          v.cp || v.lfcl || '未登记',
          v.lfsy || '-',
          v.bfbm || '-',
          v.system_status || '-',
          v.dfsj || '-',
        ]);
        break;
      default:
        return;
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // 下载
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}_数据_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const handleModalOpen = (type: ModalType) => {
    // 检查 L3 详情权限
    if (!canViewDetails('vehicle')) {
      alert('您没有权限查看详细表单');
      return;
    }

    setModalType(type);
    setCurrentPage(1);
    
    // 如果是车辆通行或超速记录，按需加载详细数据
    if (type === 'passage' || type === 'speeding' || type === 'registration' || type === 'visitor') {
      loadDetailedDataWithCache(type, 1);
    }
  };

  const handleModalClose = () => {
    setModalType(null);
    setCurrentPage(1);
  };

  const getPaginatedData = (data: any[]) => {
    // 所有类型现在都使用服务器端分页
    return {
      data: data,
      currentPage,
      totalPages: Math.ceil(totalModalCount / pageSize) || 1,
      totalCount: totalModalCount,
      pageSize,
    };
  };

  const handlePageChange = (newPage: number) => {
    if (!modalType) return;
    
    // 更新当前页
    setCurrentPage(newPage);
    
    // 加载新页的数据
    loadDetailedDataWithCache(modalType, newPage);
  };

  // 统计数据 - 使用API返回的总数
  const totalCount = totalPassageCount;
  const speedingCount = totalSpeedingCount;
  const registrationCount = totalRegistrationCount;
  const visitorCount = totalVisitorCount;

  const showStats = true;

  // 部门车辆登记统计（用于条形图）- 按部门显示过期和未过期的车辆数量
  const departmentRegistrationData = useMemo(() => {
    // 按部门统计过期和未过期数量
    const departmentCounts: Record<string, { expired: number, valid: number }> = {};
    
    statsRegistrations.forEach((registration) => {
      const department = formatLocationName(registration.bm || '未指定部门');
      const isExpired = registration.dqrq && isValidDate(registration.dqrq) ? new Date(registration.dqrq) < new Date() : false;
      
      if (!departmentCounts[department]) {
        departmentCounts[department] = { expired: 0, valid: 0 };
      }
      
      if (isExpired) {
        departmentCounts[department].expired++;
      } else {
        departmentCounts[department].valid++;
      }
    });
    
    // 转换为数组并按总数排序
    return Object.entries(departmentCounts)
      .map(([name, { expired, valid }]) => ({ name, expired, valid, total: expired + valid }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // 只取前10个
  }, [statsRegistrations]);


  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
              <Car className="h-7 w-7 text-primary" />
              车辆数据
            </h1>
            <p className="text-muted-foreground mt-1">车辆通行记录、超速统计与车辆登记管理</p>
          </div>

          {/* 日期选择 - 只有在能看统计的时候才显示日期选，或者始终显示但无效？通常与统计关联 */}
          {showStats && (
            <div className="flex flex-wrap gap-2">
              <div ref={dateRangePickerRef} className="relative">
                <Button
                  variant="outline"
                  className="w-[220px] justify-between"
                  onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
                >
                  <div className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{dateRangeDisplay}</span>
                  </div>
                </Button>

                {isCustomDateOpen && (
                  <div className="absolute top-full z-50 mt-1 w-[300px] rounded-md border bg-popover p-4 shadow-md">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">开始日期</label>
                        <input
                          type="date"
                          value={format(dateRange.from, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const newFromDate = new Date(e.target.value);
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
                            setDateRange(prev => ({ ...prev, to: newToDate }));
                          }}
                          className="w-full rounded border p-2"
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t">
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
                                // 今天
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

                    <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCustomDateOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsCustomDateOpen(false)}
                      >
                        确认
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              请确保内部代理服务正在运行 (端口 3003)，或联系管理员。
            </p>
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
          {/* 统计卡片 */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <Card
              className={cn("transition-shadow", canViewDetails('vehicle') ? "cursor-pointer hover:shadow-md" : "opacity-90")}
              onClick={() => canViewDetails('vehicle') && handleModalOpen('passage')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  总通行量
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow", canViewDetails('vehicle') ? "cursor-pointer hover:shadow-md" : "opacity-90")}
              onClick={() => canViewDetails('vehicle') && handleModalOpen('visitor')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Car className="h-4 w-4 text-blue-500" />
                  访客车辆
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{visitorCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow", canViewDetails('vehicle') ? "cursor-pointer hover:shadow-md" : "opacity-90")}
              onClick={() => canViewDetails('vehicle') && handleModalOpen('speeding')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  超速统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{speedingCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
              </CardContent>
            </Card>

            <Card
              className={cn("transition-shadow cursor-pointer hover:shadow-md")}
              onClick={() => handleModalOpen('registration')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4 text-primary" />
                  车辆登记
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{registrationCount} <span className="text-sm font-normal text-muted-foreground">辆</span></div>
              </CardContent>
            </Card>
          </div>

          {/* 图表 */}
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
            {/* 修改：将车流量趋势图改为地点车流量柱状图 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  车流量聚集地TOP10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPassage ? (
                  <Skeleton className="h-64 w-full bg-muted" />
                ) : topLocationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={topLocationsData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tickCount={10} // 限制显示的刻度数量
                        label={{ value: '位置', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis className="text-xs" label={{ value: '车流量', angle: -90, position: 'insideLeft' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="车流量"
                        fill="hsl(var(--primary))"
                      />
                    </BarChart>
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
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  超速高发地点TOP10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSpeeding ? (
                  <Skeleton className="h-64 w-full bg-muted" />
                ) : speedingChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={speedingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        label={{ value: '位置', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis yAxisId="left" className="text-xs" label={{ value: '超速数量', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: '最高车速(km/h)', angle: 90, position: 'insideRight' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="count"
                        name="超速车辆数"
                        fill="#f59e0b"
                        barSize={20}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="maxSpeed"
                        name="最高车速"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    无超速记录
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 额外图表 */}
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-blue-500" />
                  受访部门车辆统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingVisitor ? (
                  <Skeleton className="h-64 w-full bg-muted" />
                ) : visitorChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={visitorChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tickCount={10} // 限制显示的刻度数量
                        label={{ value: '部门', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis className="text-xs" label={{ value: '数量', angle: -90, position: 'insideLeft' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" name="访客车辆数" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    暂无访客数据
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-green-500" />
                  部门车辆登记统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRegistration ? (
                  <Skeleton className="h-64 w-full bg-muted" />
                ) : departmentRegistrationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={departmentRegistrationData}
                      layout="vertical"
                      margin={{ top: 20, right: 80, left: 100, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" label={{ value: '数量', position: 'insideBottom', offset: 0 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={80}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="expired" name="过期车辆" fill="#ff4d4f" />
                      <Bar dataKey="valid" name="有效车辆" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    暂无登记数据
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 弹窗模态框 */}
      {modalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 id="modal-title" className="text-xl font-bold">
                {modalType === 'passage' && '通行记录详情'}
                {modalType === 'speeding' && '超速记录详情'}
                {modalType === 'registration' && '车辆登记详情'}
                {modalType === 'visitor' && '访客车辆详情'}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    let dataToExport: any[] = [];
                    switch (modalType) {
                      case 'passage':
                        dataToExport = vehicles;
                        break;
                      case 'speeding':
                        dataToExport = speedingData;
                        break;
                      case 'registration':
                        dataToExport = registrations;
                        break;
                      case 'visitor':
                        dataToExport = visitors;
                        break;
                    }
                    handleExport(dataToExport, modalType || 'passage');
                  }}
                >
                  导出
                </Button>
                <Button variant="ghost" size="icon" onClick={handleModalClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {/* 加载指示器 */}
              {loadingDetails[modalType] && (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
              
              {/* 详细表格 */}
              {!loadingDetails[modalType] && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {modalType === 'passage' && (
                          <>
                            <TableHead>车牌号</TableHead>
                            <TableHead>识别状态</TableHead>
                            <TableHead>站点</TableHead>
                            <TableHead>车速</TableHead>
                            <TableHead>通过时间</TableHead>
                          </>
                        )}
                        {modalType === 'speeding' && (
                          <>
                            <TableHead>车牌号</TableHead>
                            <TableHead>车速</TableHead>
                            <TableHead>站点</TableHead>
                            <TableHead>通过时间</TableHead>
                          </>
                        )}
                        {modalType === 'registration' && (
                          <>
                            <TableHead>车牌号</TableHead>
                            <TableHead>姓名</TableHead>
                            <TableHead>部门</TableHead>
                            <TableHead>车辆类型</TableHead>
                            <TableHead>登记日期</TableHead>
                            <TableHead>到期日期</TableHead>
                            <TableHead>状态</TableHead>
                          </>
                        )}
                        {modalType === 'visitor' && (
                          <>
                            <TableHead>姓名</TableHead>
                            <TableHead>车牌号</TableHead>
                            <TableHead>来访事由</TableHead>
                            <TableHead>受访部门</TableHead>
                            <TableHead>审批状态</TableHead>
                            <TableHead>到访时间</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let dataToDisplay: any[] = [];
                        if (modalType === 'passage') {
                          dataToDisplay = getPaginatedData(vehicles).data;
                        } else if (modalType === 'speeding') {
                          dataToDisplay = getPaginatedData(speedingData).data;
                        } else if (modalType === 'registration') {
                          // 显示所有车辆登记，包括过期和未过期
                          dataToDisplay = getPaginatedData(registrations).data;
                        } else if (modalType === 'visitor') {
                          dataToDisplay = getPaginatedData(visitors).data;
                        }

                        if (dataToDisplay.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={modalType === 'registration' ? 7 : modalType === 'visitor' ? 6 : 5} className="text-center">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return dataToDisplay.map((item: any) => {
                          if (modalType === 'passage') {
                            const speed = item.cs || item.raw_data?.cs;
                            const isSpeeding = speed && parseInt(speed) > 30;
                            
                            return (
                              <TableRow key={item.id || item.cph} className={isSpeeding ? "bg-yellow-50" : ""}>
                                <TableCell className="font-medium">{item.cph || item.plate_number}</TableCell>
                                <TableCell>
                                  <Badge variant={isSpeeding ? "default" : "outline"}>
                                    {item.qcysmc || item.recognition_name || '-'}
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.sbtdmc || item.station_name || '-'}</TableCell>
                                <TableCell>
                                  <span className={isSpeeding ? "text-yellow-600 font-bold" : ""}>
                                    {speed || '-'} km/h
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(item.zpsj || item.pass_time), 'yyyy-MM-dd HH:mm:ss')}
                                </TableCell>
                              </TableRow>
                            );
                          } else if (modalType === 'speeding') {
                            const speed = item.cs || item.raw_data?.cs;
                            
                            return (
                              <TableRow key={item.id || item.cph} className="bg-yellow-50">
                                <TableCell className="font-medium">{item.cph || item.plate_number}</TableCell>
                                <TableCell>
                                  <Badge variant="default" className="bg-yellow-500">
                                    {speed} km/h
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.sbtdmc || item.station_name || '-'}</TableCell>
                                <TableCell>
                                  {format(new Date(item.zpsj || item.pass_time), 'yyyy-MM-dd HH:mm:ss')}
                                </TableCell>
                              </TableRow>
                            );
                          } else if (modalType === 'registration') {
                            
                            // 检查是否过期
                            const isExpired = item.dqrq && isValidDate(item.dqrq) ? new Date(item.dqrq) < new Date() : false;
                            
                            return (
                              <TableRow key={item.id || item.cp}>
                                <TableCell className="font-medium">{item.cp}</TableCell>
                                <TableCell>{item.xm || '-'}</TableCell>
                                <TableCell>{item.bm || '-'}</TableCell>
                                <TableCell>{item.cllx || '-'}</TableCell>
                                <TableCell>{item.djrq || '-'}</TableCell>
                                <TableCell>{item.dqrq || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={isExpired ? "destructive" : "default"}>
                                    {isExpired ? '已过期' : '有效'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          } else if (modalType === 'visitor') {
                            return (
                              <TableRow key={item.guid || Math.random().toString()}>
                                <TableCell className="font-medium">{item.xm || '-'}</TableCell>
                                <TableCell>{item.cp || item.lfcl || '未登记'}</TableCell>
                                <TableCell>{item.lfsy || '-'}</TableCell>
                                <TableCell>{item.bfbm || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={item.system_status === 'approved' ? "default" : "secondary"}>
                                    {item.system_status === 'approved' ? '已批准' : item.system_status === 'pending' ? '待审批' : '未批准'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.dfsj ? format(new Date(item.dfsj), 'yyyy-MM-dd HH:mm:ss') : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          return null;
                        })
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 分页 */}
              {!loadingDetails[modalType] && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    共 {totalModalCount} 条记录
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 py-1 text-sm border rounded">
                      {currentPage} / {Math.ceil(totalModalCount / pageSize) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalModalCount / pageSize)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


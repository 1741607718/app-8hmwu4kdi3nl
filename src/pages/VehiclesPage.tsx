import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Car, TrendingUp, AlertTriangle, Users, X, ChevronLeft, ChevronRight, BarChart2, Search, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { fetchVehicleStats, fetchVisitorStats, fetchAllVehicleRegistrations, fetchAllVehicleData, fetchCampusVehicleDetail, fetchVisitorData } from '@/services/externalApi';
import { maskName, maskPhone, maskIdCard } from '@/lib/sensitiveDataMasker';

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
  djrq?: string;
  dqrq?: string;
  dxwb?: string;
  syjf?: string;
  data_source: string;
  raw_data: any;
}

interface VisitorData {
  guid: string;
  xm?: string;
  lfsy?: string;
  bfbm?: string;
  bfr?: string;
  system_status?: string;
  lfsj?: string;
  dfsj?: string;
  cp?: string;
  sfzh?: string;
  lxdh?: string;
  raw_data: any;
}

type ModalType = 'gate' | 'traffic-speeding' | 'registration' | 'visitor' | null;

const isValidDate = (dateStr: string | undefined) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

const LOCATION_NAME_MAPPING: Record<string, string> = {
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
  '区西门雷视': '南校区西门',
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
  if (LOCATION_NAME_MAPPING[cleanName]) return LOCATION_NAME_MAPPING[cleanName];
  cleanName = cleanName
    .replace(/_视频通道_\d+/g, '')
    .replace(/-屏/g, '')
    .replace(/雷视/g, '')
    .replace(/侧/g, '')
    .replace(/路口/g, '');
  if (LOCATION_NAME_MAPPING[cleanName]) return LOCATION_NAME_MAPPING[cleanName];
  const sortedKeys = Object.keys(LOCATION_NAME_MAPPING).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (cleanName.includes(key)) return LOCATION_NAME_MAPPING[key];
  }
  return cleanName;
};

const VEHICLE_CHART_COLORS = {
  southGate: '#10B981',
  northGate: '#3B82F6',
  traffic: '#1D4ED8',
  speeding: '#F59E0B',
  visitor: '#8B5CF6',
  valid: '#10B981',
  expired: '#EF4444',
} as const;

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];

export default function VehiclesPage() {
  const { profile } = useAuth();

  const canViewDetails = (module: 'vehicle' | 'fireSafety' | 'personnel' | 'security' | 'dormitory') => {
    if (!profile || !profile.permissions) return false;
    switch (module) {
      case 'vehicle': return profile.permissions.canViewVehicleDetails || profile.role === 'admin';
      default: return false;
    }
  };

  const [loading, setLoading] = useState(true);
  const [loadingGate, setLoadingGate] = useState(true);
  const [loadingTrafficSpeeding, setLoadingTrafficSpeeding] = useState(true);
  const [loadingRegistration, setLoadingRegistration] = useState(true);
  const [loadingVisitor, setLoadingVisitor] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState<{[key: string]: boolean}>({});

  const [gateDetailData, setGateDetailData] = useState<any[]>([]);
  const [activeCampus, setActiveCampus] = useState<'south' | 'north'>('south');
  const [southGateDetailData, setSouthGateDetailData] = useState<any[]>([]);
  const [northGateDetailData, setNorthGateDetailData] = useState<any[]>([]);
  const [southGateTotal, setSouthGateTotal] = useState(0);
  const [northGateTotal, setNorthGateTotal] = useState(0);
  const [southGateInCount, setSouthGateInCount] = useState(0);
  const [southGateOutCount, setSouthGateOutCount] = useState(0);
  const [northGateInCount, setNorthGateInCount] = useState(0);
  const [northGateOutCount, setNorthGateOutCount] = useState(0);
  const [southGatePage, setSouthGatePage] = useState(1);
  const [northGatePage, setNorthGatePage] = useState(1);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [speedingOnlyData, setSpeedingOnlyData] = useState<any[]>([]);
  const [speedingOnlyTotal, setSpeedingOnlyTotal] = useState(0);
  const [speedingOnlyPage, setSpeedingOnlyPage] = useState(1);
  const [activeTrafficTab, setActiveTrafficTab] = useState<'traffic' | 'speeding'>('traffic');
  const [registrations, setRegistrations] = useState<VehicleRegistrationData[]>([]);
  const [statsRegistrations, setStatsRegistrations] = useState<VehicleRegistrationData[]>([]);
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [visitorChartData, setVisitorChartData] = useState<{ date: string; count: number }[]>([]);
  const [trafficSpeedingChartData, setTrafficSpeedingChartData] = useState<{ name: string; count: number; speedingCount: number }[]>([]);
  const [gateBreakdown, setGateBreakdown] = useState<{ gate: string; campus: string; in: number; out: number }[]>([]);
  const [totalGateCount, setTotalGateCount] = useState(0);
  const [southIn, setSouthIn] = useState(0);
  const [southOut, setSouthOut] = useState(0);
  const [northIn, setNorthIn] = useState(0);
  const [northOut, setNorthOut] = useState(0);
  const [totalTrafficSpeedingCount, setTotalTrafficSpeedingCount] = useState(0);
  const [totalSpeedingCount, setTotalSpeedingCount] = useState(0);
  const [totalVisitorCount, setTotalVisitorCount] = useState(0);
  const [totalRegistrationCount, setTotalRegistrationCount] = useState(0);
  const [totalModalCount, setTotalModalCount] = useState(0);

  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  const getPreciseDateString = (date: Date, isEndDate: boolean = false) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday && isEndDate) return format(now, 'yyyy-MM-dd HH:mm:ss');
    else if (isEndDate) return format(date, 'yyyy-MM-dd 23:59:59');
    else return format(date, 'yyyy-MM-dd 00:00:00');
  };

  const presetDateRanges = [
    { value: 'today', label: '今天', days: 0 },
    { value: 'last3days', label: '最近3天', days: 3 },
    { value: 'last7days', label: '最近7天', days: 7 },
    { value: 'last30days', label: '最近30天', days: 30 },
  ];

  const dateRangeDisplay = `${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`;
  const [modalType, setModalType] = useState<ModalType>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [campusPageSize] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [modalSearchText, setModalSearchText] = useState('');

  const filterData = (data: any[], fields: string[]) => {
    if (!modalSearchText.trim()) return data;
    const kw = modalSearchText.toLowerCase();
    return data.filter((item) => fields.some((f) => { const v = item[f]; return v != null && String(v).toLowerCase().includes(kw); }));
  };

  useEffect(() => {
    loadVehicleData();
    const intervalId = setInterval(() => loadVehicleData(), 300000);
    return () => clearInterval(intervalId);
  }, [dateRange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateRangePickerRef.current && !dateRangePickerRef.current.contains(event.target as Node)) {
        setIsCustomDateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadVehicleData = async () => {
    try {
      setLoading(true);
      setLoadingGate(true);
      setLoadingTrafficSpeeding(true);
      setLoadingRegistration(true);
      setLoadingVisitor(true);
      setError(null);

      const startDate = getPreciseDateString(dateRange.from);
      const endDate = getPreciseDateString(dateRange.to, true);

      const loadStats = async () => {
        try {
          const statsResult = await fetchVehicleStats({ startDate, endDate });
          if (statsResult.success && statsResult.data) {
            const sd = statsResult.data;

            setTotalGateCount(sd.gateTotal || 0);

            if (sd.gateBreakdown) {
              const gbArray = Array.isArray(sd.gateBreakdown)
                ? sd.gateBreakdown
                : Object.entries(sd.gateBreakdown).map(([gate, info]: [string, any]) => ({
                    gate, campus: info.campus, in: info.in, out: info.out
                  }));
              setGateBreakdown(gbArray);
              let sIn = 0, sOut = 0, nIn = 0, nOut = 0;
              gbArray.forEach(g => {
                if (g.campus === 'south') { sIn += g.in; sOut += g.out; }
                else { nIn += g.in; nOut += g.out; }
              });
              setSouthIn(sIn);
              setSouthOut(sOut);
              setNorthIn(nIn);
              setNorthOut(nOut);
            }

            setTotalTrafficSpeedingCount(sd.trafficTotal || 0);
            setTotalSpeedingCount(sd.speedingCount || 0);

            const trafficLocations = sd.trafficByLocation || {};
            const speedingLocations = sd.speedingByLocation || {};

            const allLocations = new Set([
              ...Object.keys(trafficLocations),
              ...Object.keys(speedingLocations),
            ]);

            const combinedLocationData = Array.from(allLocations)
              .map(name => ({
                name: formatLocationName(name),
                count: trafficLocations[name] || 0,
                speedingCount: speedingLocations[name] || 0,
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);
            setTrafficSpeedingChartData(combinedLocationData);
          }
        } catch (e) {
          console.error('加载车辆统计失败', e);
        } finally {
          setLoadingGate(false);
          setLoadingTrafficSpeeding(false);
        }
      };

      const loadRegistrationStats = async () => {
        try {
          const result = await fetchAllVehicleRegistrations();

          if (result.success && result.data) {
            const formattedData = result.data.map((item: any) => ({
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

            setTotalRegistrationCount(formattedData.length);
            setStatsRegistrations(formattedData);
            setRegistrations(formattedData);
          }
        } catch (e) {
          console.error('加载登记统计失败', e);
        } finally {
          setLoadingRegistration(false);
        }
      };

      const loadVisitorStats = async () => {
        try {
          const visitorStatsResult = await fetchVisitorStats({ startDate, endDate });
          if (visitorStatsResult.success && visitorStatsResult.data) {
            setTotalVisitorCount(visitorStatsResult.data.total || 0);
            if (visitorStatsResult.data.byDepartment) {
              const deptCounts = visitorStatsResult.data.byDepartment;
              const visitorChartDataArray = Object.entries(deptCounts)
                .map(([name, count]) => ({ name: formatLocationName(name), count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
              setVisitorChartData(visitorChartDataArray.map(item => ({ date: item.name, count: item.count })));
            }
          }
        } catch (e) {
          console.error('加载访客统计失败', e);
        } finally {
          setLoadingVisitor(false);
        }
      };

      await Promise.all([loadStats(), loadRegistrationStats(), loadVisitorStats()]);
    } catch (error) {
      console.error('加载车辆数据失败:', error);
      setError('加载车辆数据失败，请检查内部代理服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedDataWithCache = useCallback(async (type: ModalType, page: number = 1) => {
    if (!type) return;
    setLoadingDetails(prev => ({ ...prev, [type]: true }));

    const startDate = getPreciseDateString(dateRange.from);
    const endDate = getPreciseDateString(dateRange.to, true);

    try {
      if (type === 'gate') {
        const [southResult, northResult] = await Promise.all([
          fetchCampusVehicleDetail({ startDate, endDate, page: southGatePage, pageSize: campusPageSize, campus: 'south' }),
          fetchCampusVehicleDetail({ startDate, endDate, page: northGatePage, pageSize: campusPageSize, campus: 'north' }),
        ]);
        if (southResult.success && southResult.data) {
          setSouthGateDetailData(southResult.data);
          setSouthGateTotal(southResult.total || 0);
          setSouthGateInCount(southResult.inCount || 0);
          setSouthGateOutCount(southResult.outCount || 0);
        }
        if (northResult.success && northResult.data) {
          setNorthGateDetailData(northResult.data);
          setNorthGateTotal(northResult.total || 0);
          setNorthGateInCount(northResult.inCount || 0);
          setNorthGateOutCount(northResult.outCount || 0);
        }
        const allResult = await fetchCampusVehicleDetail({ startDate, endDate, page, pageSize });
        if (allResult.success && allResult.data) {
          setGateDetailData(allResult.data);
          setTotalModalCount(allResult.total || 0);
        }
      } else if (type === 'traffic-speeding') {
        const result = await fetchAllVehicleData({
          startDate,
          endDate,
          page,
          pageSize
        });
        if (result.success && result.data) {
          setVehicles(result.data);
          setTotalModalCount(result.total || 0);
        } else {
          setVehicles([]);
        }
        const speedingResult = await fetchAllVehicleData({
            startDate,
            endDate,
            page: speedingOnlyPage,
            pageSize,
            speedingOnly: true,
          });
          if (speedingResult.success && speedingResult.data) {
            setSpeedingOnlyData(speedingResult.data);
            setSpeedingOnlyTotal(speedingResult.total || 0);
          }
      } else if (type === 'registration') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');
        const regStartDate = startDate > thirtyDaysAgoStr ? thirtyDaysAgoStr : startDate;

        const registrationResult = await fetchAllVehicleRegistrations({
          startDate: regStartDate,
          endDate,
          page,
          pageSize
        });

        if (registrationResult.success && registrationResult.data) {
          const filteredRegistrationData = registrationResult.data.filter((item: any) => {
            if (!item.djrq || !isValidDate(item.djrq)) return false;
            const registrationDate = format(new Date(item.djrq), 'yyyy-MM-dd');
            return registrationDate >= regStartDate && registrationDate <= endDate;
          });
          const registrationData = filteredRegistrationData.map((item: any) => ({
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
          setRegistrations(registrationData);
          setTotalModalCount(filteredRegistrationData.length);
        } else {
          setRegistrations([]);
        }
      } else if (type === 'visitor') {
        const visitorResult = await fetchVisitorData({
          startDate,
          endDate,
          page,
          pageSize
        });
        if (visitorResult.success && visitorResult.data) {
          setVisitors(visitorResult.data);
          setTotalModalCount(visitorResult.total || 0);
        } else {
          setVisitors([]);
        }
      }
    } catch (error) {
      console.error(`加载${type}详细数据失败:`, error);
    } finally {
      setLoadingDetails(prev => ({ ...prev, [type]: false }));
    }
  }, [dateRange, pageSize, campusPageSize, southGatePage, northGatePage, speedingOnlyPage]);

  const handleExport = (data: any[], type: string) => {
    if (!profile?.permissions?.canExport && profile?.role !== 'admin') {
      alert('您没有导出权限');
      return;
    }
    const isMasked = profile?.role !== 'admin';
    let headers: string[] = [];
    let rows: string[][] = [];
    switch (type) {
      case 'gate':
        headers = ['车牌号', '车主姓名', '部门', '出入状态', '通道名称', '入校时间'];
        rows = data.map((v: any) => [
          v.car_no || '-',
          isMasked ? maskName(v.owner_name || '-') : (v.owner_name || '-'),
          v.department || '-',
          v.status || '-',
          v.snap_channel_name || '-',
          v.snap_time || '-',
        ]);
        break;
      case 'traffic-speeding':
        headers = ['车牌号', '车主姓名', '部门', '站点', '车速', '通过时间'];
        rows = data.map((v: any) => [
          v.cph || '-',
          isMasked ? maskName(v.ownerName || '-') : (v.ownerName || '-'),
          v.unit || '-',
          v.sbtdmc || '-',
          v.cs || '-',
          v.zpsj || '-',
        ]);
        break;
      case 'registration':
        headers = ['车牌号', '姓名', '部门', '车辆类型', '登记日期', '到期日期'];
        rows = data.map((v: any) => [
          v.cp || '-',
          isMasked ? maskName(v.xm || '-') : (v.xm || '-'),
          v.bm || '-',
          v.cllx || '-',
          v.djrq || '-',
          v.dqrq || '-',
        ]);
        break;
      case 'visitor':
        headers = ['车牌号', '访客姓名', '来访事由', '受访部门', '联系电话', '审批状态'];
        rows = data.map((v: any) => [
          v.cp || '-',
          isMasked ? maskName(v.xm || '-') : (v.xm || '-'),
          v.lfsy || '-',
          v.bfbm || '-',
          isMasked ? maskPhone(v.lxdh || '-') : (v.lxdh || '-'),
          v.system_status || '-',
        ]);
        break;
      default:
        return;
    }
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}_数据_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const handleModalOpen = (type: ModalType) => {
    if (!canViewDetails('vehicle')) {
      alert('您没有权限查看详细表单');
      return;
    }
    setModalType(type);
    setCurrentPage(1);
    setModalSearchText('');
    setSouthGatePage(1);
    setNorthGatePage(1);
    setSpeedingOnlyPage(1);
    setActiveTrafficTab('traffic');
    if (type === 'gate' || type === 'traffic-speeding' || type === 'registration' || type === 'visitor') {
      loadDetailedDataWithCache(type, 1);
    }
  };

  const handleModalClose = () => {
    setModalType(null);
    setCurrentPage(1);
    setModalSearchText('');
  };

  const handlePageChange = (newPage: number) => {
    if (!modalType) return;
    setCurrentPage(newPage);
    loadDetailedDataWithCache(modalType, newPage);
  };

  const handleSouthGatePageChange = (newPage: number) => {
    setSouthGatePage(newPage);
    if (modalType === 'gate') loadDetailedDataWithCache('gate', 1);
  };

  const handleNorthGatePageChange = (newPage: number) => {
    setNorthGatePage(newPage);
    if (modalType === 'gate') loadDetailedDataWithCache('gate', 1);
  };

  const handleSpeedingOnlyPageChange = (newPage: number) => {
    setSpeedingOnlyPage(newPage);
    if (modalType === 'traffic-speeding') loadDetailedDataWithCache('traffic-speeding', currentPage);
  };

  const departmentRegistrationData = useMemo(() => {
    const departmentCounts: Record<string, { expired: number, valid: number, owners: { xm: string; cp: string; isExpired: boolean }[] }> = {};
    statsRegistrations.forEach((registration) => {
      const department = formatLocationName(registration.bm || '未指定部门');
      const isExpired = registration.dqrq && isValidDate(registration.dqrq) ? new Date(registration.dqrq) < new Date() : false;
      if (!departmentCounts[department]) departmentCounts[department] = { expired: 0, valid: 0, owners: [] };
      if (isExpired) departmentCounts[department].expired++;
      else departmentCounts[department].valid++;
      if (departmentCounts[department].owners.length < 3) {
        departmentCounts[department].owners.push({ xm: registration.xm || '-', cp: registration.cp, isExpired });
      }
    });
    return Object.entries(departmentCounts)
      .map(([name, { expired, valid, owners }]) => ({ name, expired, valid, total: expired + valid, owners }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [statsRegistrations]);

  const vehicleDistributionData = useMemo(() =>
    gateBreakdown.length > 0 ? gateBreakdown.map(g => ({
      gate: g.gate,
      campus: g.campus,
      southIn: g.campus === 'south' ? g.in : 0,
      southOut: g.campus === 'south' ? g.out : 0,
      northIn: g.campus === 'north' ? g.in : 0,
      northOut: g.campus === 'north' ? g.out : 0,
    })) : [
      { gate: '南门', campus: 'south', southIn: southIn, southOut: southOut, northIn: 0, northOut: 0 },
      { gate: '西门', campus: 'south', southIn: 0, southOut: 0, northIn: 0, northOut: 0 },
      { gate: '罗山门', campus: 'south', southIn: 0, southOut: 0, northIn: 0, northOut: 0 },
      { gate: '北门', campus: 'north', southIn: 0, southOut: 0, northIn: northIn, northOut: northOut },
    ],
    [gateBreakdown, southIn, southOut, northIn, northOut]
  );

  const visitorPieData = useMemo(() =>
    visitorChartData.map(item => ({ name: item.date, value: item.count })),
    [visitorChartData]
  );

  const gateCount = totalGateCount;
  const trafficSpeedingCount = totalTrafficSpeedingCount;
  const speedingCount = totalSpeedingCount;
  const registrationCount = totalRegistrationCount;
  const visitorCount = totalVisitorCount;

  const maskField = (value: string | undefined, type: 'name' | 'phone' | 'idCard'): string => {
    if (!value || value === '-') return '-';
    if (profile?.role === 'admin') return value;
    switch (type) {
      case 'name': return maskName(value);
      case 'phone': return maskPhone(value);
      case 'idCard': return maskIdCard(value);
      default: return value;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 shadow-md text-xs">
        {label && <p className="font-medium mb-1.5 text-foreground">{label}</p>}
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-muted-foreground">{item.name}:</span>
            <span className="font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    const percent = totalVisitorCount > 0 ? ((data?.value || 0) / totalVisitorCount * 100).toFixed(1) : '0';
    return (
      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 shadow-md text-xs">
        <p className="font-medium mb-1 text-foreground">{data?.name}</p>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: payload[0]?.color }} />
          <span className="text-muted-foreground">车辆数:</span>
          <span className="font-semibold text-foreground">{data?.value}</span>
        </div>
        <p className="text-muted-foreground mt-0.5">占比 {percent}%</p>
      </div>
    );
  };

  return (
    <div className="p-4 xl:p-6 space-y-6">
      <div>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
              <Car className="h-7 w-7 text-primary" />
              车辆数据
            </h1>
            <p className="text-muted-foreground mt-1">车辆出入数据、通行超速与车辆登记管理</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div ref={dateRangePickerRef} className="relative">
              <Button variant="outline" className="w-[220px] justify-between" onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}>
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
                      <input type="date" value={format(dateRange.from, 'yyyy-MM-dd')} onChange={(e) => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))} className="w-full rounded border p-2" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">结束日期</label>
                      <input type="date" value={format(dateRange.to, 'yyyy-MM-dd')} onChange={(e) => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))} className="w-full rounded border p-2" />
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">预设范围:</p>
                    <div className="flex flex-wrap gap-2">
                      {presetDateRanges.map((range) => (
                        <Button key={range.value} variant="outline" size="sm" onClick={() => {
                          const endDate = new Date();
                          const startDate = new Date();
                          if (range.days > 0) startDate.setDate(endDate.getDate() - range.days);
                          else { startDate.setHours(0, 0, 0, 0); endDate.setHours(23, 59, 59, 999); }
                          setDateRange({ from: startDate, to: endDate });
                          setIsCustomDateOpen(false);
                        }}>
                          {range.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsCustomDateOpen(false)}>取消</Button>
                    <Button size="sm" onClick={() => setIsCustomDateOpen(false)}>确认</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* 统计卡片 - 人员数据风格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className={cn("border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm transition-all hover:shadow-md", canViewDetails('vehicle') ? "cursor-pointer" : "")}
          onClick={() => canViewDetails('vehicle') && handleModalOpen('gate')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">出入车辆（闸机）</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gateCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              南入 {southIn} / 南离 {southOut} / 北入 {northIn} / 北离 {northOut}
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn("border-border/60 bg-gradient-to-br from-background via-background to-blue-500/8 shadow-sm transition-all hover:shadow-md", canViewDetails('vehicle') ? "cursor-pointer" : "")}
          onClick={() => canViewDetails('vehicle') && handleModalOpen('traffic-speeding')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">车辆通行与超速</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trafficSpeedingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              超速 {speedingCount} 辆 · 超速率 {trafficSpeedingCount > 0 ? (speedingCount / trafficSpeedingCount * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn("border-border/60 bg-gradient-to-br from-background via-background to-purple-500/8 shadow-sm transition-all hover:shadow-md", canViewDetails('vehicle') ? "cursor-pointer" : "")}
          onClick={() => canViewDetails('vehicle') && handleModalOpen('visitor')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">访客车辆</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitorCount}</div>
            <p className="text-xs text-muted-foreground">当前筛选区间</p>
          </CardContent>
        </Card>

        <Card
          className="border-border/60 bg-gradient-to-br from-background via-background to-green-500/8 shadow-sm transition-all hover:shadow-md cursor-pointer"
          onClick={() => handleModalOpen('registration')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">车辆登记</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrationCount}</div>
            <p className="text-xs text-muted-foreground">当前筛选区间</p>
          </CardContent>
        </Card>
      </div>

      {/* 图表 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[color:#3B82F6] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
              出入车辆分布图
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loadingGate ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : gateCount > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={vehicleDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="gate" tickLine={false} axisLine={false} tickMargin={12} fontSize={14} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} formatter={(value) => {
                    if (value === 'southIn') return '南入';
                    if (value === 'southOut') return '南离';
                    if (value === 'northIn') return '北入';
                    if (value === 'northOut') return '北离';
                    return value;
                  }} />
                  <Bar dataKey="southIn" name="南入" radius={[8, 8, 0, 0]} barSize={16} fill="#10B981" />
                  <Bar dataKey="southOut" name="南离" radius={[8, 8, 0, 0]} barSize={16} fill="#34D399" />
                  <Bar dataKey="northIn" name="北入" radius={[8, 8, 0, 0]} barSize={16} fill="#3B82F6" />
                  <Bar dataKey="northOut" name="北离" radius={[8, 8, 0, 0]} barSize={16} fill="#60A5FA" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-yellow-500/5 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[color:#F59E0B] shadow-[0_0_0_6px_rgba(245,158,11,0.12)]" />
              车辆通行与超速地点TOP10
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loadingTrafficSpeeding ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : trafficSpeedingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={trafficSpeedingChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={100} interval={0} fontSize={12} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar yAxisId="left" dataKey="count" name="车流量" fill={VEHICLE_CHART_COLORS.traffic} radius={[8, 8, 0, 0]} barSize={24} />
                  <Bar yAxisId="right" dataKey="speedingCount" name="超速数" fill={VEHICLE_CHART_COLORS.speeding} radius={[8, 8, 0, 0]} barSize={24} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 额外图表 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-1/8 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[color:#8B5CF6] shadow-[0_0_0_6px_rgba(139,92,246,0.12)]" />
              受访部门车辆统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVisitor ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : visitorPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={visitorPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    strokeWidth={1}
                    stroke="hsl(var(--background))"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  >
                    {visitorPieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground">
                    <tspan fontSize={24} fontWeight="bold">{totalVisitorCount}</tspan>
                    <tspan x="50%" dy={18} fontSize={12} className="fill-muted-foreground">访客车辆</tspan>
                  </text>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">暂无访客数据</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[color:#10B981] shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
              部门车辆登记统计
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loadingRegistration ? (
              <Skeleton className="h-64 w-full bg-muted" />
            ) : departmentRegistrationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={departmentRegistrationData} layout="vertical" margin={{ top: 20, right: 40, left: 100, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="4 6" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 shadow-md text-xs max-w-[200px]">
                        <p className="font-medium mb-1.5 text-foreground">{data?.name}</p>
                        {payload.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-muted-foreground">{item.name}:</span>
                            <span className="font-semibold text-foreground">{item.value}</span>
                          </div>
                        ))}
                        {data?.owners?.length > 0 && (
                          <div className="mt-2 pt-1.5 border-t border-border/30">
                            <p className="text-muted-foreground mb-1">主要车主:</p>
                            {data.owners.map((o: any, i: number) => (
                              <div key={i} className="flex items-center gap-1 text-muted-foreground">
                                <span>{maskField(o.xm, 'name')}</span>
                                <span className="text-[10px]">{o.cp || '-'}</span>
                                <Badge variant={o.isExpired ? "destructive" : "default"} className="text-[9px] px-1 py-0">
                                  {o.isExpired ? '过期' : '有效'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="valid" name="有效车辆" fill={VEHICLE_CHART_COLORS.valid} radius={[0, 8, 8, 0]} barSize={16} stackId="a" />
                  <Bar dataKey="expired" name="过期车辆" fill={VEHICLE_CHART_COLORS.expired} radius={[0, 8, 8, 0]} barSize={16} stackId="a" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">暂无登记数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 弹窗模态框 */}
      {modalType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className={cn("bg-card rounded-lg w-full max-h-[90vh] overflow-hidden flex flex-col border shadow-lg", modalType === 'gate' ? "max-w-6xl" : "max-w-4xl")}>
            <div className="flex justify-between items-center p-4 border-b border-border/40">
              <h2 className="text-xl font-bold">
                {modalType === 'gate' && '出入数据详情'}
                {modalType === 'traffic-speeding' && '车辆通行与超速详情'}
                {modalType === 'registration' && '车辆登记详情'}
                {modalType === 'visitor' && '访客车辆详情'}
              </h2>
              <div className="flex gap-2">
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="检索..." value={modalSearchText} onChange={(e) => { setModalSearchText(e.target.value); setCurrentPage(1); }} className="pl-8 pr-8 w-48" />
                  {modalSearchText && (
                    <button onClick={() => { setModalSearchText(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  let dataToExport: any[] = [];
                  switch (modalType) {
                    case 'gate': dataToExport = gateDetailData; break;
                    case 'traffic-speeding': dataToExport = vehicles; break;
                    case 'registration': dataToExport = registrations; break;
                    case 'visitor': dataToExport = visitors; break;
                  }
                  handleExport(dataToExport, modalType || 'gate');
                }}>
                  导出
                </Button>
                <Button variant="ghost" size="icon" onClick={handleModalClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loadingDetails[modalType] && (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {!loadingDetails[modalType] && modalType === 'gate' && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <Button variant={activeCampus === 'south' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveCampus('south')}>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#10B981] mr-1.5" />
                      南校区 (入 {southGateInCount} / 离 {southGateOutCount})
                    </Button>
                    <Button variant={activeCampus === 'north' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveCampus('north')}>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6] mr-1.5" />
                      北校区 (入 {northGateInCount} / 离 {northGateOutCount})
                    </Button>
                  </div>

                  {activeCampus === 'south' && (
                    <div className="border rounded-lg p-3">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">车牌号</TableHead>
                              <TableHead className="text-xs">车主</TableHead>
                              <TableHead className="text-xs">部门</TableHead>
                              <TableHead className="text-xs">状态</TableHead>
                              <TableHead className="text-xs">卡口</TableHead>
                              <TableHead className="text-xs">时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const data = modalSearchText ? filterData(southGateDetailData, ['car_no', 'owner_name', 'department', 'snap_channel_name']) : southGateDetailData;
                              if (data.length === 0) return <TableRow><TableCell colSpan={6} className="text-center h-16 text-muted-foreground text-xs">暂无数据</TableCell></TableRow>;
                              return data.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium text-xs">{item.car_no || '-'}</TableCell>
                                  <TableCell className="text-xs">{maskField(item.owner_name, 'name')}</TableCell>
                                  <TableCell className="text-xs">{item.department || '-'}</TableCell>
                                  <TableCell className="text-xs"><Badge variant={item.status === '已入校' ? "default" : "secondary"} className="text-[10px] px-1">{item.status}</Badge></TableCell>
                                  <TableCell className="text-xs">{item.snap_channel_name || '-'}</TableCell>
                                  <TableCell className="text-xs">{item.snap_time || '-'}</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">{southGateTotal} 条</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleSouthGatePageChange(southGatePage - 1)} disabled={southGatePage === 1}><ChevronLeft className="h-3 w-3" /></Button>
                          <span className="px-2 py-0.5 text-xs border rounded">{southGatePage} / {Math.ceil(southGateTotal / campusPageSize) || 1}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleSouthGatePageChange(southGatePage + 1)} disabled={southGatePage >= Math.ceil(southGateTotal / campusPageSize)}><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeCampus === 'north' && (
                    <div className="border rounded-lg p-3">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">车牌号</TableHead>
                              <TableHead className="text-xs">车主</TableHead>
                              <TableHead className="text-xs">部门</TableHead>
                              <TableHead className="text-xs">状态</TableHead>
                              <TableHead className="text-xs">卡口</TableHead>
                              <TableHead className="text-xs">时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const data = modalSearchText ? filterData(northGateDetailData, ['car_no', 'owner_name', 'department', 'snap_channel_name']) : northGateDetailData;
                              if (data.length === 0) return <TableRow><TableCell colSpan={6} className="text-center h-16 text-muted-foreground text-xs">暂无数据</TableCell></TableRow>;
                              return data.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium text-xs">{item.car_no || '-'}</TableCell>
                                  <TableCell className="text-xs">{maskField(item.owner_name, 'name')}</TableCell>
                                  <TableCell className="text-xs">{item.department || '-'}</TableCell>
                                  <TableCell className="text-xs"><Badge variant={item.status === '已入校' ? "default" : "secondary"} className="text-[10px] px-1">{item.status}</Badge></TableCell>
                                  <TableCell className="text-xs">{item.snap_channel_name || '-'}</TableCell>
                                  <TableCell className="text-xs">{item.snap_time || '-'}</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">{northGateTotal} 条</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleNorthGatePageChange(northGatePage - 1)} disabled={northGatePage === 1}><ChevronLeft className="h-3 w-3" /></Button>
                          <span className="px-2 py-0.5 text-xs border rounded">{northGatePage} / {Math.ceil(northGateTotal / campusPageSize) || 1}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleNorthGatePageChange(northGatePage + 1)} disabled={northGatePage >= Math.ceil(northGateTotal / campusPageSize)}><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!loadingDetails[modalType] && modalType === 'traffic-speeding' && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <Button variant={activeTrafficTab === 'traffic' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveTrafficTab('traffic')}>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#1D4ED8] mr-1.5" />
                      车流量 ({totalModalCount} 条)
                    </Button>
                    <Button variant={activeTrafficTab === 'speeding' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveTrafficTab('speeding')}>
                      <div className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] mr-1.5" />
                      超速记录 ({speedingOnlyTotal} 条)
                    </Button>
                  </div>

                  {activeTrafficTab === 'traffic' && (
                    <div className="border rounded-lg p-3">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">车牌号</TableHead>
                              <TableHead className="text-xs">车主</TableHead>
                              <TableHead className="text-xs">站点</TableHead>
                              <TableHead className="text-xs">车速</TableHead>
                              <TableHead className="text-xs">时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const data = modalSearchText ? filterData(vehicles, ['cph', 'ownerName', 'sbtdmc']) : vehicles;
                              if (data.length === 0) return <TableRow><TableCell colSpan={5} className="text-center h-16 text-muted-foreground text-xs">暂无数据</TableCell></TableRow>;
                              return data.map((item: any) => (
                                <TableRow key={item.cph || Math.random().toString()}>
                                  <TableCell className="font-medium text-xs">{item.cph || '-'}</TableCell>
                                  <TableCell className="text-xs">{maskField(item.ownerName, 'name')}</TableCell>
                                  <TableCell className="text-xs">{item.sbtdmc || '-'}</TableCell>
                                  <TableCell className="text-xs">{item.cs || '-'} km/h</TableCell>
                                  <TableCell className="text-xs">{item.zpsj || '-'}</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">{totalModalCount} 条</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-3 w-3" /></Button>
                          <span className="px-2 py-0.5 text-xs border rounded">{currentPage} / {Math.ceil(totalModalCount / pageSize) || 1}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= Math.ceil(totalModalCount / pageSize)}><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTrafficTab === 'speeding' && (
                    <div className="border rounded-lg p-3">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">车牌号</TableHead>
                              <TableHead className="text-xs">车主</TableHead>
                              <TableHead className="text-xs">站点</TableHead>
                              <TableHead className="text-xs">车速</TableHead>
                              <TableHead className="text-xs">时间</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const data = modalSearchText ? filterData(speedingOnlyData, ['cph', 'ownerName', 'sbtdmc']) : speedingOnlyData;
                              if (data.length === 0) return <TableRow><TableCell colSpan={5} className="text-center h-16 text-muted-foreground text-xs">暂无超速记录</TableCell></TableRow>;
                              return data.map((item: any) => (
                                <TableRow key={item.cph || Math.random().toString()} className="bg-yellow-50 dark:bg-yellow-900/10">
                                  <TableCell className="font-medium text-xs">{item.cph || '-'}</TableCell>
                                  <TableCell className="text-xs">{maskField(item.ownerName, 'name')}</TableCell>
                                  <TableCell className="text-xs">{item.sbtdmc || '-'}</TableCell>
                                  <TableCell className="text-xs text-yellow-600 font-bold">{item.cs || '-'} km/h</TableCell>
                                  <TableCell className="text-xs">{item.zpsj || '-'}</TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">{speedingOnlyTotal} 条</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleSpeedingOnlyPageChange(speedingOnlyPage - 1)} disabled={speedingOnlyPage === 1}><ChevronLeft className="h-3 w-3" /></Button>
                          <span className="px-2 py-0.5 text-xs border rounded">{speedingOnlyPage} / {Math.ceil(speedingOnlyTotal / pageSize) || 1}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleSpeedingOnlyPageChange(speedingOnlyPage + 1)} disabled={speedingOnlyPage >= Math.ceil(speedingOnlyTotal / pageSize)}><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!loadingDetails[modalType] && modalType !== 'gate' && modalType !== 'traffic-speeding' && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                            <TableHead>车牌号</TableHead>
                            <TableHead>访客姓名</TableHead>
                            <TableHead>来访事由</TableHead>
                            <TableHead>受访部门</TableHead>
                            <TableHead>联系电话</TableHead>
                            <TableHead>审批状态</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let dataToDisplay: any[] = [];
                        if (modalType === 'registration') dataToDisplay = modalSearchText ? filterData(registrations, ['cp', 'xm', 'bm', 'cllx', 'djrq', 'dqrq']) : registrations;
                        else if (modalType === 'visitor') dataToDisplay = modalSearchText ? filterData(visitors, ['cp', 'xm', 'lfsy', 'bfbm', 'lxdh']) : visitors;

                        if (dataToDisplay.length === 0) {
                          return <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">{modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}</TableCell></TableRow>;
                        }

                        return dataToDisplay.map((item: any) => {
                          if (modalType === 'registration') {
                            const isExpired = item.dqrq && isValidDate(item.dqrq) ? new Date(item.dqrq) < new Date() : false;
                            return (
                              <TableRow key={item.cp}>
                                <TableCell className="font-medium">{item.cp || '-'}</TableCell>
                                <TableCell>{maskField(item.xm, 'name')}</TableCell>
                                <TableCell>{item.bm || '-'}</TableCell>
                                <TableCell>{item.cllx || '-'}</TableCell>
                                <TableCell>{item.djrq || '-'}</TableCell>
                                <TableCell>{item.dqrq || '-'}</TableCell>
                                <TableCell><Badge variant={isExpired ? "destructive" : "default"}>{isExpired ? '已过期' : '有效'}</Badge></TableCell>
                              </TableRow>
                            );
                          } else if (modalType === 'visitor') {
                            return (
                              <TableRow key={item.guid || item.cp || Math.random().toString()}>
                                <TableCell className="font-medium">{item.cp || '-'}</TableCell>
                                <TableCell>{maskField(item.xm, 'name')}</TableCell>
                                <TableCell>{item.lfsy || '-'}</TableCell>
                                <TableCell>{item.bfbm || '-'}</TableCell>
                                <TableCell>{maskField(item.lxdh, 'phone')}</TableCell>
                                <TableCell>{item.system_status || '-'}</TableCell>
                              </TableRow>
                            );
                          }
                          return null;
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loadingDetails[modalType] && modalType !== 'gate' && modalType !== 'traffic-speeding' && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    共 {totalModalCount} 条记录
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 py-1 text-sm border rounded">
                      {currentPage} / {Math.ceil(totalModalCount / pageSize) || 1}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= Math.ceil(totalModalCount / pageSize)}>
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
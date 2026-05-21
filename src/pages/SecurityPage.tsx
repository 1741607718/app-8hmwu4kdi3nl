import { format } from 'date-fns';
import { AlertTriangle, BarChart2, Calendar, Camera, ChevronLeft, ChevronRight, Eye, Search, Shield, Siren, UserCheck, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCameraDevices, getCameraStats } from '@/db/api';
import { maskSensitiveDataArray } from '@/lib/sensitiveDataMasker';
import { cn } from '@/lib/utils';
import { 
  fetchCampusPoliceIncidentData,
  fetchCampusPoliceIncidentStats,
  fetchMonitorQueryRecordData,
  fetchMonitorQueryRecordStats,
  fetchSafetyVisitReservationData,
  fetchSafetyVisitReservationStats,
  MonitorQueryRecord, 
  MonitorQueryRecordStats,
  SafetyVisitReservation,
  SafetyVisitReservationStats
} from '@/services/externalApi';
import { CameraStats, PoliceIncidentRecord, PoliceIncidentStats, DEFAULT_POLICE_INCIDENT_TYPES } from '@/types/types';

interface DateRange {
  from: Date;
  to: Date;
}

type ModalType = 'safety-reservation' | 'camera-status' | 'camera-online' | 'camera-face-recognition' | 'barrier-gate' | 'safety-total' | 'safety-today' | 'safety-department' | 'safety-effective' | 'monitor-query-record' | 'police-incident' | 'police-incident-total' | 'police-incident-today' | 'police-incident-type' | null;

export default function SecurityPage() {
  const { profile } = useAuth();

  // 权限控制
  // 优先级: 显式设置权限 > 管理员默认权限(3) > 普通用户默认权限(1)
  const permissionLevel = profile?.permissions?.security ?? (profile?.role === 'admin' ? 3 : 1);
  const checkPermission = (minLevel: number) => permissionLevel >= minLevel;

  if (permissionLevel < 1) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">您没有权限访问安保监控模块</h2>
          <p className="text-sm text-muted-foreground mt-2">请联系管理员申请权限</p>
        </div>
      </div>
    );
  }

  const showStats = true;
  
  // 添加安全馆预约统计相关状态
  const [loading, setLoading] = useState(false);
  const [reservationStats, setReservationStats] = useState<SafetyVisitReservationStats | null>(null);
  const [cameraStats, setCameraStats] = useState<CameraStats | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  // 安全馆预约详细数据状态
  const [reservationData, setReservationData] = useState<SafetyVisitReservation[]>([]);
  const [reservationTotal, setReservationTotal] = useState(0);
  const [reservationCurrentPage, setReservationCurrentPage] = useState(1);
  const [reservationPageSize] = useState(10);
  
  // 摄像头状态详细数据状态
  const [cameraData, setCameraData] = useState<any[]>([]);
  const [cameraTotal, setCameraTotal] = useState(0);
  const [cameraCurrentPage, setCameraCurrentPage] = useState(1);
  const [cameraPageSize] = useState(10);
  
  // 特定类型的摄像头数据状态
  const [cameraOnlineData, setCameraOnlineData] = useState<any[]>([]);
  const [cameraOnlineTotal, setCameraOnlineTotal] = useState(0);
  const [cameraOnlineCurrentPage, setCameraOnlineCurrentPage] = useState(1);
  const [cameraFaceRecognitionData, setCameraFaceRecognitionData] = useState<any[]>([]);
  const [cameraFaceRecognitionTotal, setCameraFaceRecognitionTotal] = useState(0);
  const [cameraFaceRecognitionCurrentPage, setCameraFaceRecognitionCurrentPage] = useState(1);
  // 闸机设备数据状态
  const [barrierGateData, setBarrierGateData] = useState<any[]>([]);
  const [barrierGateTotal, setBarrierGateTotal] = useState(0);
  const [barrierGateCurrentPage, setBarrierGateCurrentPage] = useState(1);
  
  // 安全预约特定类型数据状态
  const [safetyTotalData, setSafetyTotalData] = useState<SafetyVisitReservation[]>([]);
  const [safetyTotalTotal, setSafetyTotalTotal] = useState(0);
  const [safetyTotalCurrentPage, setSafetyTotalCurrentPage] = useState(1);
  const [safetyTodayData, setSafetyTodayData] = useState<SafetyVisitReservation[]>([]);
  const [safetyTodayTotal, setSafetyTodayTotal] = useState(0);
  const [safetyTodayCurrentPage, setSafetyTodayCurrentPage] = useState(1);
  const [safetyDepartmentData, setSafetyDepartmentData] = useState<SafetyVisitReservation[]>([]);
  const [safetyDepartmentTotal, setSafetyDepartmentTotal] = useState(0);
  const [safetyDepartmentCurrentPage, setSafetyDepartmentCurrentPage] = useState(1);
  const [safetyEffectiveData, setSafetyEffectiveData] = useState<SafetyVisitReservation[]>([]);
  const [safetyEffectiveTotal, setSafetyEffectiveTotal] = useState(0);
  const [safetyEffectiveCurrentPage, setSafetyEffectiveCurrentPage] = useState(1);
  
  // 监控查询记录统计相关状态
  const [monitorQueryRecordStats, setMonitorQueryRecordStats] = useState<MonitorQueryRecordStats | null>(null);
  const [monitorQueryRecordLoading, setMonitorQueryRecordLoading] = useState(false);
  const [monitorQueryRecordError, setMonitorQueryRecordError] = useState<string | null>(null);
  
  // 监控查询记录数据状态
  const [monitorQueryRecordData, setMonitorQueryRecordData] = useState<MonitorQueryRecord[]>([]);
  const [monitorQueryRecordTotal, setMonitorQueryRecordTotal] = useState(0);
  const [monitorQueryRecordCurrentPage, setMonitorQueryRecordCurrentPage] = useState(1);
  
  // 校园警情统计相关状态
  const [policeIncidentStats, setPoliceIncidentStats] = useState<PoliceIncidentStats | null>(null);
  const [policeIncidentLoading, setPoliceIncidentLoading] = useState(false);
  const [policeIncidentError, setPoliceIncidentError] = useState<string | null>(null);
  
  // 校园警情详细数据状态
  const [policeIncidentData, setPoliceIncidentData] = useState<PoliceIncidentRecord[]>([]);
  const [policeIncidentTotal, setPoliceIncidentTotal] = useState(0);
  const [policeIncidentCurrentPage, setPoliceIncidentCurrentPage] = useState(1);
  const [policeIncidentPageSize] = useState(10);
  
  // 辅助函数：解析部门JSON
  const parseDepartmentName = (val: string | undefined | null): string => {
    if (!val) return '-';
    try {
        if (val.trim().startsWith('[')) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name) {
                return parsed[0].name;
            }
        }
    } catch (e) {
        // ignore error
    }
    return val;
  };

  // 辅助函数：格式化日期时间
  const formatDateTime = (val: string | undefined | null): string => {
    if (!val) return '-';
    try {
      // 尝试解析日期
      const date = new Date(val);
      // 检查日期是否有效
      if (isNaN(date.getTime())) return val;
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return val;
    }
  };

  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalSearchText, setModalSearchText] = useState('');
  const [allModalDataCache, setAllModalDataCache] = useState<{
    reservation?: SafetyVisitReservation[];
    camera?: any[];
    cameraOnline?: any[];
    cameraFaceRecognition?: any[];
    barrierGate?: any[];
    safetyTotal?: SafetyVisitReservation[];
    safetyToday?: SafetyVisitReservation[];
    safetyDepartment?: SafetyVisitReservation[];
    safetyEffective?: SafetyVisitReservation[];
    monitorQueryRecord?: MonitorQueryRecord[];
    policeIncident?: PoliceIncidentRecord[];
  }>({});

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
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  // 日期选择相关状态
  const dateRangePickerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const dateRangeDisplay = `${format(dateRange.from, 'yyyy-MM-dd')} - ${format(dateRange.to, 'yyyy-MM-dd')}`;

  const presetDateRanges = [
    { value: 'today', label: '今天', days: 0 },
    { value: 'last3days', label: '最近3天', days: 3 },
    { value: 'last7days', label: '最近7天', days: 7 },
    { value: 'last30days', label: '最近30天', days: 30 },
    { value: 'last180days', label: '最近半年', days: 180 },
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

  // 加载安全馆预约统计数据
  useEffect(() => {
    loadReservationStats();
    loadCameraStats();
    loadMonitorQueryRecordStats();
    loadPoliceIncidentStats();

    // 设置定时刷新，每5分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新安全数据...');
      loadReservationStats();
      loadCameraStats();
      loadMonitorQueryRecordStats();
      loadPoliceIncidentStats();
    }, 300000); // 300000ms = 5分钟

    return () => clearInterval(intervalId);
  }, [dateRange]);

  // 加载监控统计数据
  const loadCameraStats = async () => {
    setCameraLoading(true);
    try {
      const stats = await getCameraStats();
      setCameraStats(stats);
    } catch (err) {
      console.error('加载监控统计数据失败:', err);
      setDetailsError('加载监控统计数据失败');
    } finally {
      setCameraLoading(false);
    }
  };

  const loadReservationStats = async () => {
    setLoading(true);
    setReservationError(null);

    try {
      const result = await fetchSafetyVisitReservationStats({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });

      if (result.success && result.data) {
        setReservationStats(result.data);
      } else {
        setReservationError(result.error || '获取安全馆预约数据失败');
      }
    } catch (err) {
      console.error('加载安全馆预约数据失败:', err);
      setReservationError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
    // 加载安全馆预约详细数据
    const loadReservationDetails = async (page: number) => {
      setLoadingDetails(true);
      try {
        const result = await fetchSafetyVisitReservationData({
          startDate: format(dateRange.from, 'yyyy-MM-dd'),
          endDate: format(dateRange.to, 'yyyy-MM-dd'),
          page,
          pageSize: reservationPageSize,
        });

        if (result.success && result.data) {
          setReservationData(result.data);
          setReservationTotal(result.total || result.data.length);
        } else {
          setReservationData([]);
          setReservationTotal(0);
          setDetailsError(result.error || '获取安全馆预约详细数据失败');
        }
      } catch (err) {
        console.error('加载安全馆预约详细数据失败:', err);
        setReservationData([]);
        setReservationTotal(0);
        setDetailsError('加载安全馆预约详细数据失败');
      } finally {
        setLoadingDetails(false);
      }
    };

    // 加载摄像头状态详细数据
    const loadCameraDetails = async (page: number) => {
      setLoadingDetails(true);
      try {
        const result = await fetchCameraDevices({
          page,
          pageSize: cameraPageSize,
          type: 'all',
        });

        if (result.success && result.data) {
          setCameraData(result.data);
          setCameraTotal(result.total || result.data.length);
        } else {
          setCameraData([]);
          setCameraTotal(0);
          setDetailsError(result.error || '加载摄像头状态详细数据失败');
        }
      } catch (err) {
        console.error('加载摄像头状态详细数据失败:', err);
        setCameraData([]);
        setCameraTotal(0);
        setDetailsError('加载摄像头状态详细数据失败');
      } finally {
        setLoadingDetails(false);
      }
    };

    // 加载在线摄像头详细数据
    const loadCameraOnlineDetails = async (page: number) => {
      setLoadingDetails(true);
      try {
        const result = await fetchCameraDevices({
          page,
          pageSize: cameraPageSize,
          type: 'online',
        });
        
        if (result.success && result.data) {
          setCameraOnlineData(result.data);
          setCameraOnlineTotal(result.total || result.data.length);
        } else {
          setCameraOnlineData([]);
          setCameraOnlineTotal(0);
          setDetailsError(result.error || '加载在线摄像头详细数据失败');
        }
      } catch (err) {
        console.error('加载在线摄像头详细数据失败:', err);
        setCameraOnlineData([]);
        setCameraOnlineTotal(0);
        setDetailsError('加载在线摄像头详细数据失败');
      } finally {
        setLoadingDetails(false);
      }
    };

    // 加载人脸识别摄像头详细数据
    const loadCameraFaceRecognitionDetails = async (page: number) => {
      setLoadingDetails(true);
      try {
        const result = await fetchCameraDevices({
          page,
          pageSize: cameraPageSize,
          type: 'face-recognition',
        });

        if (result.success && result.data) {
          setCameraFaceRecognitionData(result.data);
          setCameraFaceRecognitionTotal(result.total || result.data.length);
        } else {
          setCameraFaceRecognitionData([]);
          setCameraFaceRecognitionTotal(0);
          setDetailsError(result.error || '加载人脸识别摄像头详细数据失败');
        }
      } catch (err) {
        console.error('加载人脸识别摄像头详细数据失败:', err);
        setCameraFaceRecognitionData([]);
        setCameraFaceRecognitionTotal(0);
        setDetailsError('加载人脸识别摄像头详细数据失败');
      } finally {
        setLoadingDetails(false);
      }
    };

    // 加载闸机设备数据
    const loadBarrierGateDetails = async (page: number) => {
      setLoadingDetails(true);
      try {
        const result = await fetchCameraDevices({
          page,
          pageSize: cameraPageSize,
          type: 'barrier-gate',
        });

        if (result.success && result.data) {
          setBarrierGateData(result.data);
          setBarrierGateTotal(result.total || result.data.length);
        } else {
          setBarrierGateData([]);
          setBarrierGateTotal(0);
          setDetailsError(result.error || '加载闸机设备详细数据失败');
        }
      } catch (err) {
        console.error('加载闸机设备详细数据失败:', err);
        setBarrierGateData([]);
        setBarrierGateTotal(0);
        setDetailsError('加载闸机设备详细数据失败');
      } finally {
        setLoadingDetails(false);
      }
    };

    // 根据类型加载安全预约详细数据
    const loadSafetySpecificDetails = async (type: 'total' | 'today' | 'department' | 'effective', page: number) => {
      setLoadingDetails(true);
      try {
        let reqStartDate = format(dateRange.from, 'yyyy-MM-dd');
        let reqEndDate = format(dateRange.to, 'yyyy-MM-dd');

        if (type === 'today') {
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          reqStartDate = todayStr;
          reqEndDate = todayStr;
        }

        const result = await fetchSafetyVisitReservationData({
          startDate: reqStartDate,
          endDate: reqEndDate,
          page,
          pageSize: reservationPageSize,
        });

        if (result.success && result.data) {
          let filteredData = result.data;
          let totalCount = result.total || result.data.length;

          // Note: 'today' is already filtered by API params

          if (type === 'effective') {
            // 过滤有效预约数据（已完成或已批准）
            // 注意：这里是对分页后的数据进行过滤，可能会导致每页显示数量不一致
            // 理想情况下应该后端支持状态过滤
            filteredData = result.data.filter(item =>
              item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准'
            );
            // 这里无法获知准确的总数，暂时使用当前过滤后的数量
             if (filteredData.length !== result.data.length) {
                 // 简单的估算，或者就不显示准确的总页数了
             }
          }

          // 更新对应状态
          switch (type) {
            case 'total':
              setSafetyTotalData(filteredData);
              setSafetyTotalTotal(totalCount);
              break;
            case 'department':
              setSafetyDepartmentData(filteredData);
              setSafetyDepartmentTotal(totalCount);
              break;
            case 'today':
              setSafetyTodayData(filteredData);
              setSafetyTodayTotal(totalCount);
              break;
            case 'effective':
              setSafetyEffectiveData(filteredData);
              // 对于前端过滤的情况，总数也无法准确获知，只能显示 fetch 的总数或者...
              // 如果严重依赖分页，建议后端增加状态过滤参数。这里保持原样逻辑但注意限制。
              setSafetyEffectiveTotal(totalCount);
              break;
          }
        } else {
          // 设置空数组和总计数
          switch (type) {
            case 'total':
              setSafetyTotalData([]);
              setSafetyTotalTotal(0);
              break;
            case 'department':
              setSafetyDepartmentData([]);
              setSafetyDepartmentTotal(0);
              break;
            case 'today':
              setSafetyTodayData([]);
              setSafetyTodayTotal(0);
              break;
            case 'effective':
              setSafetyEffectiveData([]);
              setSafetyEffectiveTotal(0);
              break;
          }
          setDetailsError(result.error || `获取${type}安全馆预约详细数据失败`);
        }
      } catch (err) {
        console.error(`加载${type}安全馆预约详细数据失败:`, err);
        // 设置空数组和总计数
        switch (type) {
          case 'total':
            setSafetyTotalData([]);
            setSafetyTotalTotal(0);
            break;
          case 'department':
            setSafetyDepartmentData([]);
            setSafetyDepartmentTotal(0);
            break;
          case 'today':
            setSafetyTodayData([]);
            setSafetyTodayTotal(0);
            break;
          case 'effective':
            setSafetyEffectiveData([]);
            setSafetyEffectiveTotal(0);
            break;
        }
        setDetailsError(`加载${type}安全馆预约详细数据失败`);
      } finally {
        setLoadingDetails(false);
      }
    };

  // 加载监控查询记录统计数据
  const loadMonitorQueryRecordStats = async () => {
    setMonitorQueryRecordLoading(true);
    setMonitorQueryRecordError(null);

    try {
      const result = await fetchMonitorQueryRecordStats({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });

      if (result.success && result.data) {
        setMonitorQueryRecordStats(result.data);
      } else {
        setMonitorQueryRecordError(result.error || '获取监控查询记录数据失败');
      }
    } catch (err) {
      console.error('加载监控查询记录数据失败:', err);
      setMonitorQueryRecordError('加载数据失败，请稍后重试');
    } finally {
      setMonitorQueryRecordLoading(false);
    }
  };

  // 加载监控查询记录详细数据
  const loadMonitorQueryRecordDetails = async (page: number) => {
    setLoadingDetails(true);
    try {
      const result = await fetchMonitorQueryRecordData({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        page,
        pageSize: reservationPageSize,
      });

      if (result.success && result.data) {
        setMonitorQueryRecordData(result.data);
        setMonitorQueryRecordTotal(result.total || result.data.length);
      } else {
        setMonitorQueryRecordData([]);
        setMonitorQueryRecordTotal(0);
        setDetailsError(result.error || '获取监控查询记录详细数据失败');
      }
    } catch (err) {
      console.error('加载监控查询记录详细数据失败:', err);
      setMonitorQueryRecordData([]);
      setMonitorQueryRecordTotal(0);
      setDetailsError('加载监控查询记录详细数据失败');
    } finally {
      setLoadingDetails(false);
    }
  };

  // 加载校园警情统计数据
  const loadPoliceIncidentStats = async () => {
    setPoliceIncidentLoading(true);
    setPoliceIncidentError(null);

    try {
      const result = await fetchCampusPoliceIncidentStats({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd')
      });

      if (result.success && result.data) {
        setPoliceIncidentStats(result.data);
      } else {
        setPoliceIncidentError(result.error || '获取校园警情数据失败');
      }
    } catch (err) {
      console.error('加载校园警情数据失败:', err);
      setPoliceIncidentError('加载数据失败，请稍后重试');
    } finally {
      setPoliceIncidentLoading(false);
    }
  };

  // 加载校园警情详细数据
  const loadPoliceIncidentDetails = async (page: number, incidentType?: string) => {
    setLoadingDetails(true);
    try {
      const result = await fetchCampusPoliceIncidentData({
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        page,
        pageSize: policeIncidentPageSize,
        incidentType,
      });

      if (result.success && result.data) {
        setPoliceIncidentData(result.data);
        setPoliceIncidentTotal(result.total || result.data.length);
      } else {
        setPoliceIncidentData([]);
        setPoliceIncidentTotal(0);
        setDetailsError(result.error || '获取校园警情详细数据失败');
      }
    } catch (err) {
      console.error('加载校园警情详细数据失败:', err);
      setPoliceIncidentData([]);
      setPoliceIncidentTotal(0);
      setDetailsError('加载校园警情详细数据失败');
    } finally {
      setLoadingDetails(false);
    }
  };

  // 更新handleModalOpen函数以支持监控查询记录和警情
  const handleModalOpen = (type: ModalType) => {
    // 检查权限
    if (!checkPermission(2)) {
      alert('您没有权限查看详细表单');
      return;
    }
    setModalType(type);
    setModalSearchText('');

    if (type === 'safety-reservation') {
      setReservationCurrentPage(1);
      loadReservationDetails(1);
    } else if (type === 'camera-status') {
      setCameraCurrentPage(1);
      loadCameraDetails(1);
    } else if (type === 'camera-online') {
      setCameraOnlineCurrentPage(1);
      loadCameraOnlineDetails(1);
    } else if (type === 'camera-face-recognition') {
      setCameraFaceRecognitionCurrentPage(1);
      loadCameraFaceRecognitionDetails(1);
    } else if (type === 'barrier-gate') {
      setBarrierGateCurrentPage(1);
      loadBarrierGateDetails(1);
    } else if (type === 'safety-total') {
      setSafetyTotalCurrentPage(1);
      loadSafetySpecificDetails('total', 1);
    } else if (type === 'safety-effective') {
      setSafetyEffectiveCurrentPage(1);
      loadSafetySpecificDetails('effective', 1);
    } else if (type === 'monitor-query-record') {
      setMonitorQueryRecordCurrentPage(1);
      loadMonitorQueryRecordDetails(1);
    } else if (type === 'police-incident-total') {
      setPoliceIncidentCurrentPage(1);
      loadPoliceIncidentDetails(1);
    } else if (type === 'police-incident-today') {
      setPoliceIncidentCurrentPage(1);
      loadPoliceIncidentDetails(1);
    }
  };

  // 模态框关闭处理
  const handleModalClose = () => {
    setModalType(null);
    setModalSearchText('');
  };
    
  // 监控查询记录模态框打开处理
  const handleMonitorQueryRecordModalOpen = () => {
    // 检查权限
    if (!checkPermission(2)) {
      alert('您没有权限查看详细表单');
      return;
    }
    setModalType('monitor-query-record');
    setMonitorQueryRecordCurrentPage(1);
    loadMonitorQueryRecordDetails(1);
  };
    
  // 监控查询记录分页处理
  const handleMonitorQueryRecordPageChange = (newPage: number) => {
    setMonitorQueryRecordCurrentPage(newPage);
    loadMonitorQueryRecordDetails(newPage);
  };

  // 更新handlePageChange函数以支持监控查询记录
  const handlePageChange = (newPage: number) => {
    if (modalType === 'safety-reservation') {
      setReservationCurrentPage(newPage);
      loadReservationDetails(newPage);
    } else if (modalType === 'camera-status') {
      setCameraCurrentPage(newPage);
      loadCameraDetails(newPage);
    } else if (modalType === 'camera-online') {
      setCameraOnlineCurrentPage(newPage);
      loadCameraOnlineDetails(newPage);
    } else if (modalType === 'camera-face-recognition') {
      setCameraFaceRecognitionCurrentPage(newPage);
      loadCameraFaceRecognitionDetails(newPage);
    } else if (modalType === 'barrier-gate') {
      setBarrierGateCurrentPage(newPage);
      loadBarrierGateDetails(newPage);
    } else if (modalType === 'safety-total') {
      setSafetyTotalCurrentPage(newPage);
      loadSafetySpecificDetails('total', newPage);
    } else if (modalType === 'safety-today') {
      setSafetyTodayCurrentPage(newPage);
      loadSafetySpecificDetails('today', newPage);
    } else if (modalType === 'safety-effective') {
      setSafetyEffectiveCurrentPage(newPage);
      loadSafetySpecificDetails('effective', newPage);
    } else if (modalType === 'safety-department') {
      setSafetyDepartmentCurrentPage(newPage);
      loadSafetySpecificDetails('department', newPage);
    } else if (modalType === 'monitor-query-record') {
      setMonitorQueryRecordCurrentPage(newPage);
      loadMonitorQueryRecordDetails(newPage);
    } else if (modalType === 'police-incident-total' || modalType === 'police-incident-today') {
      setPoliceIncidentCurrentPage(newPage);
      loadPoliceIncidentDetails(newPage);
    }
  };

  // 导出功能
  const handleExport = () => {
    if (modalType === 'safety-reservation') {
      if (!reservationData.length) return;
        
      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(reservationData, ['SQR', 'LXDH']);
        
      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '参观时间段', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.SQRQ || '-',
        parseDepartmentName(item.BMXY),
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.SQCGSJDKS || ''} 至 ${item.SQCGSJJS || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);
        
      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');
        
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `安全馆预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'camera-status') {
      if (!cameraData.length) return;
        
      const headers = ['设备编号', '设备名称', '设备分类', '设备类型', '在线状态', '功能描述', '所属部门', 'IP地址', '更新时间'];
      const rows = cameraData.map(item => [
        item.deviceCode || '-',
        item.deviceName || '-',
        item.deviceCategory || '-',
        item.type || '-',
        item.isOnline ? '在线' : '离线',
        item.capabilityCollection || '-',
        item.ownerCode || '-',
        item.deviceIp || '-',
        item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'
      ]);
        
      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');
        
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `摄像头状态数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'camera-online') {
      if (!cameraOnlineData.length) return;
        
      const headers = ['设备编号', '设备名称', '设备分类', '设备类型', '在线状态', '功能描述', '所属部门', 'IP地址', '更新时间'];
      const rows = cameraOnlineData.map(item => [
        item.deviceCode || '-',
        item.deviceName || '-',
        item.deviceCategory || '-',
        item.type || '-',
        item.isOnline ? '在线' : '离线',
        item.capabilityCollection || '-',
        item.ownerCode || '-',
        item.deviceIp || '-',
        item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `在线摄像头数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'camera-face-recognition') {
      if (!cameraFaceRecognitionData.length) return;

      const headers = ['设备编号', '设备名称', '设备分类', '设备类型', '在线状态', '功能描述', '所属部门', 'IP地址', '更新时间'];
      const rows = cameraFaceRecognitionData.map(item => [
        item.deviceCode || '-',
        item.deviceName || '-',
        item.deviceCategory || '-',
        item.type || '-',
        item.isOnline ? '在线' : '离线',
        item.capabilityCollection || '-',
        item.ownerCode || '-',
        item.deviceIp || '-',
        item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `人脸识别摄像头数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'barrier-gate') {
      if (!barrierGateData.length) return;

      const headers = ['设备编号', '设备名称', '设备分类', '设备类型', '在线状态', '功能描述', '所属部门', 'IP地址', '更新时间'];
      const rows = barrierGateData.map(item => [
        item.deviceCode || '-',
        item.deviceName || '-',
        item.deviceCategory || '-',
        item.type || '-',
        item.isOnline ? '在线' : '离线',
        item.capabilityCollection || '-',
        item.ownerCode || '-',
        item.deviceIp || '-',
        item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `闸机设备数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'safety-total') {
      if (!safetyTotalData.length) return;

      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(safetyTotalData, ['SQR', 'LXDH']);

      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '参观时间段', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.SQRQ || '-',
        parseDepartmentName(item.BMXY) || item.BMXY || '-',
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.SQCGSJDKS || ''} 至 ${item.SQCGSJJS || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `安全馆总预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'safety-department') {
      if (!safetyDepartmentData.length) return;

      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(safetyDepartmentData, ['SQR', 'LXDH']);

      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '参观时间段', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.SQRQ || '-',
        parseDepartmentName(item.BMXY) || item.BMXY || '-',
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.SQCGSJDKS || ''} 至 ${item.SQCGSJJS || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `安全馆部门预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'safety-today') {
      if (!safetyTodayData.length) return;

      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(safetyTodayData, ['SQR', 'LXDH']);

      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '参观时间段', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.SQRQ || '-',
        parseDepartmentName(item.BMXY) || item.BMXY || '-',
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.SQCGSJDKS || ''} 至 ${item.SQCGSJJS || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `安全馆今日预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'safety-effective') {
      if (!safetyEffectiveData.length) return;
        
      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(safetyEffectiveData, ['SQR', 'LXDH']);
        
      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '参观时间段', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.SQRQ || '-',
        parseDepartmentName(item.BMXY) || item.BMXY || '-',
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.SQCGSJDKS || ''} 至 ${item.SQCGSJJS || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `安全馆有效预约数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
    } else if (modalType === 'monitor-query-record') {
      if (!monitorQueryRecordData.length) return;
        
      // 对敏感数据进行脱敏处理
      const maskedData = maskSensitiveDataArray(monitorQueryRecordData, ['SQR', 'LXDH']);
        
      const headers = ['申请人', '申请日期', '部门学院', '联系电话', '申请事由', '申请类别', '调取录像时间', '系统状态'];
      const rows = maskedData.map(item => [
        item.SQR || '-',
        item.RQ || '-',
        item.BMXY || '-',
        item.LXDH || '-',
        item.SQSY || '-',
        item.SFLB || '-',
        `${item.DQLXKSSJ || ''} 至 ${item.DQLXJSSJ || ''}`,
        item.SYSTEM_STATUS || '-'
      ]);
        
      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');
        
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `监控查询记录数据_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
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
                  {[
                    { label: '今天', value: 'today', days: 0 },
                    { label: '最近3天', value: '3days', days: 3 },
                    { label: '最近7天', value: '7days', days: 7 },
                    { label: '最近30天', value: '30days', days: 30 },
                  ].map((range) => (
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
          {/* 监控统计主卡片 */}
          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/6 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]" />
                <Camera className="h-5 w-5" />
                监控设备统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/60 p-4 rounded-lg transition-all">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-muted-foreground">监控在线</span>
                  </div>
                  {cameraLoading ? (
                    <div className="h-10 flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : cameraStats ? (
                    <>
                      <div className="text-xl font-bold text-blue-700 mt-1">{cameraStats.onlineCount}/{cameraStats.totalCount}</div>
                      <p className="text-xs text-blue-600 mt-1">
                        在线率: {cameraStats.totalCount > 0 ? ((cameraStats.onlineCount / cameraStats.totalCount) * 100).toFixed(1) : '0'}%
                      </p>
                    </>
                  ) : (
                    <div className="text-xl font-bold text-muted-foreground mt-1">-</div>
                  )}
                </div>

                <div className="border border-cyan-200/60 bg-gradient-to-br from-cyan-50 to-cyan-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleMonitorQueryRecordModalOpen()}>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-muted-foreground">监控申请查询</span>
                  </div>
                  {monitorQueryRecordLoading ? (
                    <div className="h-10 flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : monitorQueryRecordError ? (
                    <div className="text-xl font-bold text-red-500 mt-1">-</div>
                  ) : monitorQueryRecordStats ? (
                    <div className="text-xl font-bold text-blue-700 mt-1">{monitorQueryRecordStats.total}</div>
                  ) : (
                    <div className="text-xl font-bold text-muted-foreground mt-1">-</div>
                  )}
                </div>

                <div className="border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-4 rounded-lg transition-all">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-muted-foreground">闸机设备</span>
                  </div>
                  {cameraLoading ? (
                    <div className="h-10 flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : cameraStats ? (
                    <div className="text-xl font-bold text-purple-700 mt-1">{cameraStats.barrierGateCount || 0} <span className="text-sm font-normal text-muted-foreground">台</span></div>
                  ) : (
                    <div className="text-xl font-bold text-muted-foreground mt-1">-</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 安全馆预约统计卡片 */}
          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[color:#10B981] shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
                <Shield className="h-5 w-5" />
                安全馆预约统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : reservationError ? (
                <div className="text-center text-red-500 py-8">{reservationError}</div>
              ) : reservationStats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleModalOpen('safety-total')}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-muted-foreground">总预约人数</span>
                    </div>
                    <div className="text-xl font-bold text-blue-700 mt-1">{reservationStats.total}</div>
                  </div>

                  <div className="border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleModalOpen('safety-today')}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-muted-foreground">今日预约</span>
                    </div>
                    <div className="text-xl font-bold text-green-700 mt-1">{reservationStats.byDate[format(new Date(), 'yyyy-MM-dd')] || 0}</div>
                  </div>

                  <div className="border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleModalOpen('safety-effective')}>
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

          {/* 校园警情统计卡片 */}
          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-red-500/8 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[color:#EF4444] shadow-[0_0_0_6px_rgba(239,68,68,0.12)]" />
                <Siren className="h-5 w-5" />
                校园警情统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              {policeIncidentLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : policeIncidentError ? (
                <div className="text-center text-red-500 py-8">{policeIncidentError}</div>
              ) : policeIncidentStats ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border border-red-200/60 bg-gradient-to-br from-red-50 to-red-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleModalOpen('police-incident-total')}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-muted-foreground">总警情数</span>
                    </div>
                    <div className="text-xl font-bold text-red-700 mt-1">{policeIncidentStats.total}</div>
                  </div>

                  <div className="border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 rounded-lg cursor-pointer hover:shadow-sm transition-all" onClick={() => checkPermission(2) && handleModalOpen('police-incident-today')}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-muted-foreground">今日警情</span>
                    </div>
                    <div className="text-xl font-bold text-orange-700 mt-1">{policeIncidentStats.today}</div>
                  </div>

                  <div className="border border-yellow-200/60 bg-gradient-to-br from-yellow-50 to-yellow-100/60 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-muted-foreground">本月警情</span>
                    </div>
                    <div className="text-xl font-bold text-yellow-700 mt-1">{policeIncidentStats.thisMonth}</div>
                  </div>

                  <div className="border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/60 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-muted-foreground">本年警情</span>
                    </div>
                    <div className="text-xl font-bold text-blue-700 mt-1">{policeIncidentStats.thisYear}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">暂无数据</div>
              )}

              {/* 警情分类统计图表 */}
              {policeIncidentStats && Object.keys(policeIncidentStats.byType).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">警情分类统计</h4>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(policeIncidentStats.byType).map(([type, count]) => ({
                          type,
                          count,
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="4 6" stroke="hsl(var(--border) / 0.5)" />
                        <XAxis dataKey="type" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.12)' }} />
                        <Bar dataKey="count" name="警情数量" fill="#EF4444" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          

        </>
      )}
      
      {/* 安全馆预约详细数据模态框 */}
      {modalType === 'safety-reservation' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-reservation-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-reservation-modal-title" className="text-lg font-semibold">
                安全馆预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={reservationData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(reservationData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);
                          
                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQRQ)}</TableCell>
                                <TableCell>{parseDepartmentName(item.BMXY)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {reservationTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, reservationCurrentPage - 1))}
                        disabled={reservationCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {reservationCurrentPage} / {Math.ceil(reservationTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(reservationCurrentPage + 1)}
                        disabled={reservationCurrentPage >= Math.ceil(reservationTotal / reservationPageSize) || loadingDetails}
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
      
      {/* 摄像头状态详细数据模态框 */}
      {modalType === 'camera-status' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="camera-status-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="camera-status-modal-title" className="text-lg font-semibold">
                摄像头状态详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={cameraData.length === 0}
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
                          <TableHead>设备编号</TableHead>
                          <TableHead>设备名称</TableHead>
                          <TableHead>设备分类</TableHead>
                          <TableHead>设备类型</TableHead>
                          <TableHead>在线状态</TableHead>
                          <TableHead>功能描述</TableHead>
                          <TableHead>所属部门</TableHead>
                          <TableHead>IP地址</TableHead>
                          <TableHead>更新时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(cameraData, ['deviceCode', 'deviceName', 'deviceCategory', 'type', 'ownerCode', 'deviceIp']);
                          return filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((item, index) => (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium">{item.deviceCode || '-'}</TableCell>
                              <TableCell>{item.deviceName || '-'}</TableCell>
                              <TableCell>{item.deviceCategory || '-'}</TableCell>
                              <TableCell>{item.type || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={item.isOnline ? 'default' : 'destructive'}>
                                  {item.isOnline ? '在线' : '离线'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.capabilityCollection || '-'}</TableCell>
                              <TableCell>{item.ownerCode || '-'}</TableCell>
                              <TableCell>{item.deviceIp || '-'}</TableCell>
                              <TableCell>{item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                            </TableRow>
                          ))
                        )})()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {cameraTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, cameraCurrentPage - 1))}
                        disabled={cameraCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {cameraCurrentPage} / {Math.ceil(cameraTotal / cameraPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(cameraCurrentPage + 1)}
                        disabled={cameraCurrentPage >= Math.ceil(cameraTotal / cameraPageSize) || loadingDetails}
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

      {/* 在线摄像头详细数据模态框 */}
      {modalType === 'camera-online' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="camera-online-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="camera-online-modal-title" className="text-lg font-semibold">
                在线摄像头详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={cameraOnlineData.length === 0}
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
                          <TableHead>设备编号</TableHead>
                          <TableHead>设备名称</TableHead>
                          <TableHead>设备分类</TableHead>
                          <TableHead>设备类型</TableHead>
                          <TableHead>在线状态</TableHead>
                          <TableHead>功能描述</TableHead>
                          <TableHead>所属部门</TableHead>
                          <TableHead>IP地址</TableHead>
                          <TableHead>更新时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(cameraOnlineData, ['deviceCode', 'deviceName', 'deviceCategory', 'type', 'ownerCode', 'deviceIp']);
                          return filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((item, index) => (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium">{item.deviceCode || '-'}</TableCell>
                              <TableCell>{item.deviceName || '-'}</TableCell>
                              <TableCell>{item.deviceCategory || '-'}</TableCell>
                              <TableCell>{item.type || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={item.isOnline ? 'default' : 'destructive'}>
                                  {item.isOnline ? '在线' : '离线'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.capabilityCollection || '-'}</TableCell>
                              <TableCell>{item.ownerCode || '-'}</TableCell>
                              <TableCell>{item.deviceIp || '-'}</TableCell>
                              <TableCell>{item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                            </TableRow>
                          ))
                        )})()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {cameraOnlineTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, cameraOnlineCurrentPage - 1))}
                        disabled={cameraOnlineCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {cameraOnlineCurrentPage} / {Math.ceil(cameraOnlineTotal / cameraPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(cameraOnlineCurrentPage + 1)}
                        disabled={cameraOnlineCurrentPage >= Math.ceil(cameraOnlineTotal / cameraPageSize) || loadingDetails}
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
      
      {/* 人脸识别摄像头详细数据模态框 */}
      {modalType === 'camera-face-recognition' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="camera-face-recognition-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="camera-face-recognition-modal-title" className="text-lg font-semibold">
                人脸识别摄像头详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={cameraFaceRecognitionData.length === 0}
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
                          <TableHead>设备编号</TableHead>
                          <TableHead>设备名称</TableHead>
                          <TableHead>设备分类</TableHead>
                          <TableHead>设备类型</TableHead>
                          <TableHead>在线状态</TableHead>
                          <TableHead>功能描述</TableHead>
                          <TableHead>所属部门</TableHead>
                          <TableHead>IP地址</TableHead>
                          <TableHead>更新时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(cameraFaceRecognitionData, ['deviceCode', 'deviceName', 'deviceCategory', 'type', 'ownerCode', 'deviceIp']);
                          return filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((item, index) => (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium">{item.deviceCode || '-'}</TableCell>
                              <TableCell>{item.deviceName || '-'}</TableCell>
                              <TableCell>{item.deviceCategory || '-'}</TableCell>
                              <TableCell>{item.type || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={item.isOnline ? 'default' : 'destructive'}>
                                  {item.isOnline ? '在线' : '离线'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.capabilityCollection || '-'}</TableCell>
                              <TableCell>{item.ownerCode || '-'}</TableCell>
                              <TableCell>{item.deviceIp || '-'}</TableCell>
                              <TableCell>{item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                            </TableRow>
                          ))
                        )})()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {cameraFaceRecognitionTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, cameraFaceRecognitionCurrentPage - 1))}
                        disabled={cameraFaceRecognitionCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {cameraFaceRecognitionCurrentPage} / {Math.ceil(cameraFaceRecognitionTotal / cameraPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(cameraFaceRecognitionCurrentPage + 1)}
                        disabled={cameraFaceRecognitionCurrentPage >= Math.ceil(cameraFaceRecognitionTotal / cameraPageSize) || loadingDetails}
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
      
      {/* 闸机设备详细数据模态框 */}
      {modalType === 'barrier-gate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="barrier-gate-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="barrier-gate-modal-title" className="text-lg font-semibold">
                闸机设备详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={barrierGateData.length === 0}
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
                          <TableHead>设备编号</TableHead>
                          <TableHead>设备名称</TableHead>
                          <TableHead>设备分类</TableHead>
                          <TableHead>设备类型</TableHead>
                          <TableHead>在线状态</TableHead>
                          <TableHead>功能描述</TableHead>
                          <TableHead>所属部门</TableHead>
                          <TableHead>IP地址</TableHead>
                          <TableHead>更新时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(barrierGateData, ['deviceCode', 'deviceName', 'deviceCategory', 'type', 'ownerCode', 'deviceIp']);
                          return filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.map((item, index) => (
                            <TableRow key={item.id || index}>
                              <TableCell className="font-medium">{item.deviceCode || '-'}</TableCell>
                              <TableCell>{item.deviceName || '-'}</TableCell>
                              <TableCell>{item.deviceCategory || '-'}</TableCell>
                              <TableCell>{item.type || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={item.isOnline ? 'default' : 'destructive'}>
                                  {item.isOnline ? '在线' : '离线'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.capabilityCollection || '-'}</TableCell>
                              <TableCell>{item.ownerCode || '-'}</TableCell>
                              <TableCell>{item.deviceIp || '-'}</TableCell>
                              <TableCell>{item.updateTime ? format(new Date(item.updateTime), 'yyyy-MM-dd HH:mm:ss') : '-'}</TableCell>
                            </TableRow>
                          ))
                        )})()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {barrierGateTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, barrierGateCurrentPage - 1))}
                        disabled={barrierGateCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {barrierGateCurrentPage} / {Math.ceil(barrierGateTotal / cameraPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(barrierGateCurrentPage + 1)}
                        disabled={barrierGateCurrentPage >= Math.ceil(barrierGateTotal / cameraPageSize) || loadingDetails}
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
      
      {/* 总预约详细数据模态框 */}
      {modalType === 'safety-total' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-total-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-total-modal-title" className="text-lg font-semibold">
                安全馆总预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={safetyTotalData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(safetyTotalData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQRQ)}</TableCell>
                                <TableCell>{parseDepartmentName(item.BMXY)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {safetyTotalTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, safetyTotalCurrentPage - 1))}
                        disabled={safetyTotalCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {safetyTotalCurrentPage} / {Math.ceil(safetyTotalTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(safetyTotalCurrentPage + 1)}
                        disabled={safetyTotalCurrentPage >= Math.ceil(safetyTotalTotal / reservationPageSize) || loadingDetails}
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

      {/* 部门预约详细数据模态框 */}
      {modalType === 'safety-department' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-department-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-department-modal-title" className="text-lg font-semibold">
                安全馆部门预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={safetyDepartmentData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(safetyDepartmentData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQRQ)}</TableCell>
                                <TableCell>{parseDepartmentName(item.BMXY)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {safetyDepartmentTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, safetyDepartmentCurrentPage - 1))}
                        disabled={safetyDepartmentCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {safetyDepartmentCurrentPage} / {Math.ceil(safetyDepartmentTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(safetyDepartmentCurrentPage + 1)}
                        disabled={safetyDepartmentCurrentPage >= Math.ceil(safetyDepartmentTotal / reservationPageSize) || loadingDetails}
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

      {/* 今日预约详细数据模态框 */}
      {modalType === 'safety-today' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-today-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-today-modal-title" className="text-lg font-semibold">
                安全馆今日预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={safetyTodayData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
<TableBody>
                        {(() => {
                          const filteredData = filterBySearch(safetyTodayData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQRQ)}</TableCell>
                                <TableCell>{parseDepartmentName(item.BMXY)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {safetyTodayTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, safetyTodayCurrentPage - 1))}
                        disabled={safetyTodayCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {safetyTodayCurrentPage} / {Math.ceil(safetyTodayTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(safetyTodayCurrentPage + 1)}
                        disabled={safetyTodayCurrentPage >= Math.ceil(safetyTodayTotal / reservationPageSize) || loadingDetails}
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

      {/* 有效预约详细数据模态框 */}
      {modalType === 'safety-effective' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-effective-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-effective-modal-title" className="text-lg font-semibold">
                安全馆有效预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={safetyEffectiveData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
<TableBody>
                        {(() => {
                          const filteredData = filterBySearch(safetyEffectiveData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQRQ)}</TableCell>
                                <TableCell>{parseDepartmentName(item.BMXY)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {safetyEffectiveTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, safetyEffectiveCurrentPage - 1))}
                        disabled={safetyEffectiveCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {safetyEffectiveCurrentPage} / {Math.ceil(safetyEffectiveTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(safetyEffectiveCurrentPage + 1)}
                        disabled={safetyEffectiveCurrentPage >= Math.ceil(safetyEffectiveTotal / reservationPageSize) || loadingDetails}
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

      {/* 监控查询记录详细数据模态框 */}
      {modalType === 'monitor-query-record' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="monitor-query-record-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="monitor-query-record-modal-title" className="text-lg font-semibold">
                监控查询记录详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={monitorQueryRecordData.length === 0}
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
              ) : detailsError ? (
                <div className="flex flex-col items-center justify-center h-32 text-red-500">
                  <p className="font-medium">加载失败</p>
                  <p className="text-sm">{detailsError}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>调取录像时间</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
<TableBody>
                        {(() => {
                          const filteredData = filterBySearch(monitorQueryRecordData, ['SQR', 'BMXY', 'SFLB', 'LXDH', 'SQSY', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.RQ)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{item.BMXY || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.DQLXKSSJ)} 至 {formatDateTime(item.DQLXJSSJ)}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {monitorQueryRecordTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMonitorQueryRecordPageChange(Math.max(1, monitorQueryRecordCurrentPage - 1))}
                        disabled={monitorQueryRecordCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {monitorQueryRecordCurrentPage} / {Math.ceil(monitorQueryRecordTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMonitorQueryRecordPageChange(monitorQueryRecordCurrentPage + 1)}
                        disabled={monitorQueryRecordCurrentPage >= Math.ceil(monitorQueryRecordTotal / reservationPageSize) || loadingDetails}
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

      {/* 校园警情详细数据模态框 */}
      {(modalType === 'police-incident-total' || modalType === 'police-incident-today') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="police-incident-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="police-incident-modal-title" className="text-lg font-semibold">
                {modalType === 'police-incident-today' ? '今日警情详细记录' : '校园警情详细记录'}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
              ) : detailsError ? (
                <div className="flex flex-col items-center justify-center h-32 text-red-500">
                  <p className="font-medium">加载失败</p>
                  <p className="text-sm">{detailsError}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>类别</TableHead>
                          <TableHead>警情分类</TableHead>
                          <TableHead>时间</TableHead>
                          <TableHead>管理单位</TableHead>
                          <TableHead>区域</TableHead>
                          <TableHead>情况说明</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const filteredData = filterBySearch(policeIncidentData, ['JQFL', 'GLDW', 'LCQY', 'QKSM']);
                          return filteredData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredData.map((item, index) => (
                            <TableRow key={item.GUID || index}>
                              <TableCell>{item.LB || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{item.JQFL || '-'}</Badge>
                              </TableCell>
                              <TableCell>{item.SJ || '-'}</TableCell>
                              <TableCell>{parseDepartmentName(item.GLDW)}</TableCell>
                              <TableCell>{item.LCQY || '-'}</TableCell>
                              <TableCell className="max-w-xs truncate" dangerouslySetInnerHTML={{ __html: item.QKSM || '-' }} />
                            </TableRow>
                          ))
                        )})()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页控件 */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-muted-foreground">
                      共 {policeIncidentTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, policeIncidentCurrentPage - 1))}
                        disabled={policeIncidentCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {policeIncidentCurrentPage} / {Math.ceil(policeIncidentTotal / policeIncidentPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(policeIncidentCurrentPage + 1)}
                        disabled={policeIncidentCurrentPage >= Math.ceil(policeIncidentTotal / policeIncidentPageSize) || loadingDetails}
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

      {/* 安全馆预约详细数据模态框 */}
      {modalType === 'safety-reservation' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="safety-reservation-modal-title">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="safety-reservation-modal-title" className="text-lg font-semibold">
                安全馆预约详细记录
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="检索..."
                    value={modalSearchText}
                    onChange={(e) => { setModalSearchText(e.target.value); }}
                    className="pl-8 pr-8 w-48"
                  />
                  {modalSearchText && (
                    <button onClick={() => setModalSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={safetyReservationData.length === 0}
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
                          <TableHead>申请人</TableHead>
                          <TableHead>申请日期</TableHead>
                          <TableHead>联系电话</TableHead>
                          <TableHead>申请类别</TableHead>
                          <TableHead>部门学院</TableHead>
                          <TableHead>参观时间段</TableHead>
                          <TableHead>申请事由</TableHead>
                          <TableHead>系统状态</TableHead>
                        </TableRow>
                      </TableHeader>
<TableBody>
                        {(() => {
                          const filteredData = filterBySearch(safetyReservationData, ['SQR', 'BMXY', 'SQSY', 'SFLB', 'SYSTEM_STATUS']);
                          const maskedData = maskSensitiveDataArray(filteredData, ['SQR', 'LXDH']);

                          return maskedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                {modalSearchText ? `未找到匹配 "${modalSearchText}" 的记录` : '暂无数据'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedData.map((item, index) => (
                              <TableRow key={item.GUID || index}>
                                <TableCell className="font-medium">{item.SQR || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.RQ)}</TableCell>
                                <TableCell>{item.LXDH || '-'}</TableCell>
                                <TableCell>{item.SFLB || '-'}</TableCell>
                                <TableCell>{item.BMXY || '-'}</TableCell>
                                <TableCell>{formatDateTime(item.SQCGSJDKS)} 至 {formatDateTime(item.SQCGSJJS)}</TableCell>
                                <TableCell>{item.SQSY || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant={item.SYSTEM_STATUS === '已完成' || item.SYSTEM_STATUS === '已批准' ? 'default' : 'secondary'}>
                                    {item.SYSTEM_STATUS || '未知'}
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
                      共 {safetyReservationTotal} 条记录
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSafetyReservationPageChange(Math.max(1, safetyReservationCurrentPage - 1))}
                        disabled={safetyReservationCurrentPage === 1 || loadingDetails}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-3 py-1 text-sm border rounded">
                        {safetyReservationCurrentPage} / {Math.ceil(safetyReservationTotal / reservationPageSize) || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSafetyReservationPageChange(safetyReservationCurrentPage + 1)}
                        disabled={safetyReservationCurrentPage >= Math.ceil(safetyReservationTotal / reservationPageSize) || loadingDetails}
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

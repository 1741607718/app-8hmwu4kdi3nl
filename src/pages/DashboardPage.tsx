import { format } from 'date-fns';
import { BarChart2, Building2, Car, Flame, Footprints, Shield, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fetchDormitoryStats, 
  fetchHumanTrafficStats,
  fetchVehicleStats,
  fetchVisitorEntryStats,
  fetchVisitorStats,
  fetchCameraStats,
  fetchSafetyVisitReservationStats,
  fetchMonitorQueryRecordStats
} from '@/services/externalApi';

interface DashboardStats {
  vehicles: {
    gateCount: number;
    trafficCount: number;
    speedingCount: number;
    speedingRate: number;
    southIn: number;
    southOut: number;
    northIn: number;
    northOut: number;
  };
  personnel: {
    visitorCount: number;
    visitorEntryCount: number;
    humanTrafficTotal: number;
    libraryTraffic: number;
    skybridgeTraffic: number;
  };
  fireSafety: {
    totalDevices: number;
    normalDevices: number;
    abnormalDevices: number;
    normalRate: number;
  };
  security: {
    onlineCameras: number;
    totalCameras: number;
    offlineCameras: number;
    faceRecognitionDevices: number;
    barrierGateDevices: number;
    safetyVisitReservations: number;
    monitorQueries: number;
  };
  dormitory: {
    totalResidents: number;
    lateReturnCount: number;
    noReturnCount: number;
    normalReturnCount: number;
    leaveCount: number;
    qjCount: number;
    notInSchoolCount: number;
    noRecordCount: number;
  };
}

// 数据项组件
function DataItem({ label, value, unit, color = '' }: { label: string; value: number | string; unit: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={cn("text-lg font-bold", color)}>{value}</span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

// 组合统计卡片组件
function CombinedStatCard({ 
  title, 
  icon, 
  children, 
  onClick,
  accentColor = "primary"
}: { 
  title: string; 
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  accentColor?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "from-primary/5",
    blue: "from-blue-500/5",
    green: "from-green-500/5",
    purple: "from-purple-500/5",
    orange: "from-orange-500/5",
  };

  return (
    <Card 
      className={cn(
        "border-border/60 bg-gradient-to-br via-background to-transparent shadow-sm backdrop-blur-sm transition-all duration-200",
        colorMap[accentColor] || colorMap.primary,
        onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg" : ""
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/40">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getPreciseDateString = (date: Date, isEndDate: boolean = false) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday && isEndDate) {
      return format(now, 'yyyy-MM-dd HH:mm:ss');
    } else if (isEndDate) {
      return format(date, 'yyyy-MM-dd 23:59:59');
    } else {
      return format(date, 'yyyy-MM-dd 00:00:00');
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const startDate = getPreciseDateString(today);
      const endDate = getPreciseDateString(today, true);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dormitoryStartDate = getPreciseDateString(yesterday);
      const dormitoryEndDate = getPreciseDateString(yesterday, true);

      const [
        vehicleStats,
        visitorStats,
        visitorEntryStats,
        humanTrafficStats,
        dormitoryStats,
        cameraStats,
        safetyVisitStats,
        monitorQueryStats
      ] = await Promise.all([
        fetchVehicleStats({ startDate, endDate }),
        fetchVisitorStats({ startDate, endDate, personnelMode: true }),
        fetchVisitorEntryStats({ startDate, endDate }),
        fetchHumanTrafficStats({ startDate, endDate }),
        fetchDormitoryStats({ startDate: dormitoryStartDate, endDate: dormitoryEndDate }),
        fetchCameraStats(),
        fetchSafetyVisitReservationStats({ startDate, endDate }),
        fetchMonitorQueryRecordStats({ startDate, endDate })
      ]);

      const vData = vehicleStats.success && vehicleStats.data ? vehicleStats.data : null;
      const dData = dormitoryStats.success && dormitoryStats.data ? dormitoryStats.data : null;
      const cData = cameraStats.success && cameraStats.data ? cameraStats.data : null;

      setStats({
        vehicles: {
          gateCount: vData?.gateTotal || 0,
          trafficCount: vData?.trafficTotal || 0,
          speedingCount: vData?.speedingCount || 0,
          speedingRate: vData?.speedingRate || 0,
          southIn: vData?.southIn || 0,
          southOut: vData?.southOut || 0,
          northIn: vData?.northIn || 0,
          northOut: vData?.northOut || 0,
        },
        personnel: {
          visitorCount: visitorStats.success && visitorStats.data ? visitorStats.data.total : 0,
          visitorEntryCount: visitorEntryStats.success && visitorEntryStats.data ? visitorEntryStats.data.total : 0,
          humanTrafficTotal: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.total : 0,
          libraryTraffic: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.library : 0,
          skybridgeTraffic: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.skybridge : 0,
        },
        fireSafety: {
          totalDevices: 0,
          normalDevices: 0,
          abnormalDevices: 0,
          normalRate: 0,
        },
        security: {
          onlineCameras: cData?.onlineCount || 0,
          totalCameras: cData?.totalCount || 0,
          offlineCameras: (cData?.totalCount || 0) - (cData?.onlineCount || 0),
          faceRecognitionDevices: cData?.faceRecognitionCount || 0,
          barrierGateDevices: cData?.barrierGateCount || 0,
          safetyVisitReservations: safetyVisitStats.success && safetyVisitStats.data ? safetyVisitStats.data.total : 0,
          monitorQueries: monitorQueryStats.success && monitorQueryStats.data ? monitorQueryStats.data.total : 0,
        },
        dormitory: {
          totalResidents: dData?.total || 0,
          lateReturnCount: dData?.wg_count || 0,
          noReturnCount: dData?.bg_count || 0,
          normalReturnCount: dData?.zc_count || 0,
          leaveCount: dData?.tx_count || 0,
          qjCount: dData?.qj_count || 0,
          notInSchoolCount: dData?.not_in_school_count || 0,
          noRecordCount: dData?.no_record_count || 0,
        },
      });

    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 xl:p-6 space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-8 w-48 mb-2 bg-muted" />
          <Skeleton className="h-4 w-96 bg-muted" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48 bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 xl:p-6">
        <div className="text-center text-muted-foreground">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold flex items-center gap-2">
          <BarChart2 className="h-7 w-7 text-primary" />
          数据总览
        </h1>
        <p className="text-muted-foreground mt-1">校园安全数据实时监控，统一查看关键指标。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
        {/* 车辆通行数据 */}
        <CombinedStatCard 
          title="车辆通行数据" 
          icon={<Car className="h-4 w-4 text-primary" />}
          onClick={() => navigate('/vehicles')}
          accentColor="primary"
        >
          <div className="space-y-3">
            {/* 主要指标 */}
            <div className="grid grid-cols-3 gap-2">
              <DataItem label="出入车辆" value={stats.vehicles.gateCount.toLocaleString()} unit="辆" color="text-primary" />
              <DataItem label="车流量" value={stats.vehicles.trafficCount.toLocaleString()} unit="辆" color="text-blue-500" />
              <DataItem label="超速车辆" value={stats.vehicles.speedingCount.toLocaleString()} unit="辆" color="text-yellow-500" />
            </div>
            {/* 南校区 */}
            <div className="border-t border-border/40 pt-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">南校区</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="入校" value={stats.vehicles.southIn.toLocaleString()} unit="辆" color="text-green-600" />
                <DataItem label="离校" value={stats.vehicles.southOut.toLocaleString()} unit="辆" color="text-red-500" />
              </div>
            </div>
            {/* 北校区 */}
            <div className="border-t border-border/40 pt-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">北校区</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="入校" value={stats.vehicles.northIn.toLocaleString()} unit="辆" color="text-green-600" />
                <DataItem label="离校" value={stats.vehicles.northOut.toLocaleString()} unit="辆" color="text-red-500" />
              </div>
            </div>
            {/* 超速率 */}
            <div className="border-t border-border/40 pt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">超速率</span>
              <span className="text-lg font-bold text-red-500">{stats.vehicles.speedingRate.toFixed(1)}%</span>
            </div>
          </div>
        </CombinedStatCard>
        
        {/* 人员数据 */}
        <CombinedStatCard 
          title="人员数据" 
          icon={<Users className="h-4 w-4 text-blue-500" />}
          onClick={() => navigate('/personnel')}
          accentColor="blue"
        >
          <div className="space-y-3">
            {/* 访客数据 */}
            <div className="border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">访客数据</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="访客预约" value={stats.personnel.visitorCount.toLocaleString()} unit="人" color="text-blue-500" />
                <DataItem label="入校人数" value={stats.personnel.visitorEntryCount.toLocaleString()} unit="人" color="text-green-500" />
              </div>
            </div>
            {/* 人流量 */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">人流量统计</div>
              <div className="grid grid-cols-3 gap-2">
                <DataItem label="总计" value={stats.personnel.humanTrafficTotal.toLocaleString()} unit="人次" color="text-purple-500" />
                <DataItem label="天桥" value={stats.personnel.skybridgeTraffic.toLocaleString()} unit="人次" color="text-indigo-500" />
                <DataItem label="图书馆" value={stats.personnel.libraryTraffic.toLocaleString()} unit="人次" color="text-violet-500" />
              </div>
            </div>
          </div>
        </CombinedStatCard>
        
        {/* 安保监控数据 */}
        <CombinedStatCard 
          title="安保监控数据" 
          icon={<Shield className="h-4 w-4 text-green-500" />}
          onClick={() => navigate('/security')}
          accentColor="green"
        >
          <div className="space-y-3">
            {/* 摄像头 */}
            <div className="border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">监控设备</div>
              <div className="grid grid-cols-3 gap-2">
                <DataItem label="在线" value={stats.security.onlineCameras.toLocaleString()} unit="台" color="text-green-500" />
                <DataItem label="离线" value={stats.security.offlineCameras.toLocaleString()} unit="台" color="text-red-500" />
                <DataItem label="总数" value={stats.security.totalCameras.toLocaleString()} unit="台" color="text-blue-500" />
              </div>
            </div>
            {/* 其他设备 */}
            <div className="border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">其他设备</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="人脸识别" value={stats.security.faceRecognitionDevices.toLocaleString()} unit="台" color="text-purple-500" />
                <DataItem label="闸机设备" value={stats.security.barrierGateDevices.toLocaleString()} unit="台" color="text-orange-500" />
              </div>
            </div>
            {/* 业务数据 */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">业务统计</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="安全馆预约" value={stats.security.safetyVisitReservations.toLocaleString()} unit="次" color="text-cyan-500" />
                <DataItem label="监控查询" value={stats.security.monitorQueries.toLocaleString()} unit="次" color="text-pink-500" />
              </div>
            </div>
          </div>
        </CombinedStatCard>
        
        {/* 宿舍数据 */}
        <CombinedStatCard 
          title="宿舍数据 (昨日)" 
          icon={<Building2 className="h-4 w-4 text-orange-500" />}
          onClick={() => navigate('/dormitory')}
          accentColor="orange"
        >
          <div className="space-y-3">
            {/* 总体情况 */}
            <div className="border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">总体情况</div>
              <div className="grid grid-cols-2 gap-2">
                <DataItem label="住宿总数" value={stats.dormitory.totalResidents.toLocaleString()} unit="人" color="text-primary" />
                <DataItem label="正常归宿" value={stats.dormitory.normalReturnCount.toLocaleString()} unit="人" color="text-green-500" />
              </div>
            </div>
            {/* 异常情况 */}
            <div className="border-b border-border/40 pb-3">
              <div className="text-xs text-muted-foreground mb-2 font-medium">异常情况</div>
              <div className="grid grid-cols-3 gap-2">
                <DataItem label="晚归" value={stats.dormitory.lateReturnCount.toLocaleString()} unit="人" color="text-orange-500" />
                <DataItem label="未归" value={stats.dormitory.noReturnCount.toLocaleString()} unit="人" color="text-red-500" />
                <DataItem label="通宵" value={stats.dormitory.leaveCount.toLocaleString()} unit="人" color="text-red-600" />
              </div>
            </div>
            {/* 其他 */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">其他</div>
              <div className="grid grid-cols-3 gap-2">
                <DataItem label="请假" value={stats.dormitory.qjCount.toLocaleString()} unit="人" color="text-yellow-500" />
                <DataItem label="校外住宿" value={stats.dormitory.notInSchoolCount.toLocaleString()} unit="人" color="text-gray-500" />
                <DataItem label="无记录" value={stats.dormitory.noRecordCount.toLocaleString()} unit="人" color="text-muted-foreground" />
              </div>
            </div>
          </div>
        </CombinedStatCard>
      </div>

      {/* 快速访问 */}
      <div className="border-t border-border/40 pt-6">
        <h2 className="text-lg font-semibold mb-4">快速访问</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/6 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/vehicles')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                车辆数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看车辆通行记录、车流量统计及超速监控
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-1/8 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/personnel')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                人员数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看访客预约、入校记录及人流量统计
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-chart-4/8 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/dormitory')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                宿管数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看宿舍住宿人数及楼栋分布情况
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-orange-500/10 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/fire-safety')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                消防数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看消防设备状态、报警记录等信息
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-red-500/10 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/security')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                安全数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看监控状态、案事件统计等信息
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                权限数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                权限管理功能开发中
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

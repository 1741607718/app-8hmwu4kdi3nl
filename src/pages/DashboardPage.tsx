import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Users, Flame, Shield, Building2, TrendingUp, TrendingDown, AlertTriangle, Footprints, UserCheck } from 'lucide-react';
import {
  fetchVehicleStats,
  fetchVisitorStats,
  fetchVisitorEntryStats,
  fetchHumanTrafficStats,
  fetchDormitoryStats
} from '@/services/externalApi';
import type { StatCardData } from '@/types/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardStats {
  vehicles: {
    passageCount: number;
    speedingCount: number;
  };
  personnel: {
    visitorCount: number;
    visitorEntryCount: number;
    humanTrafficTotal: number;
    libraryTraffic: number;
    skybridgeTraffic: number;
  };
  dormitory: {
    totalResidents: number;
    lateReturnCount: number;
    noReturnCount: number;
  };
}

// 组合统计卡片组件
function CombinedStatCard({ 
  title, 
  icon, 
  dataItems, 
  onClick 
}: { 
  title: string; 
  icon: React.ReactNode;
  dataItems: { label: string; value: number | string; unit: string; color?: string }[];
  onClick?: () => void;
}) {
  return (
    <Card 
      className={cn("transition-shadow", onClick ? "cursor-pointer hover:shadow-md" : "")}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {dataItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-semibold ${item.color || ''}`}>{item.value}</span>
                <span className="text-xs text-muted-foreground">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const startDate = getPreciseDateString(today);
      const endDate = getPreciseDateString(today, true);

      // 并行获取所有统计数据
      const [
        vehicleStats,
        speedingStats,
        visitorStats,
        visitorEntryStats,
        humanTrafficStats,
        dormitoryStats
      ] = await Promise.all([
        fetchVehicleStats({ startDate, endDate }),
        fetchVehicleStats({ startDate, endDate, speedingOnly: true }),
        fetchVisitorStats({ startDate, endDate, personnelMode: true }),
        fetchVisitorEntryStats({ startDate, endDate }),
        fetchHumanTrafficStats({ startDate, endDate }),
        fetchDormitoryStats({ startDate, endDate })
      ]);

      setStats({
        vehicles: {
          passageCount: vehicleStats.success && vehicleStats.data ? vehicleStats.data.total : 0,
          speedingCount: speedingStats.success && speedingStats.data ? speedingStats.data.total : 0,
        },
        personnel: {
          visitorCount: visitorStats.success && visitorStats.data ? visitorStats.data.total : 0,
          visitorEntryCount: visitorEntryStats.success && visitorEntryStats.data ? visitorEntryStats.data.total : 0,
          humanTrafficTotal: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.total : 0,
          libraryTraffic: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.library : 0,
          skybridgeTraffic: humanTrafficStats.success && humanTrafficStats.data ? humanTrafficStats.data.skybridge : 0,
        },
        dormitory: {
          totalResidents: dormitoryStats.success && dormitoryStats.data ? dormitoryStats.data.total : 0,
          lateReturnCount: dormitoryStats.success && dormitoryStats.data ? dormitoryStats.data.wg_count : 0,
          noReturnCount: dormitoryStats.success && dormitoryStats.data ? dormitoryStats.data.bg_count : 0,
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
      <div className="p-4 xl:p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2 bg-muted" />
          <Skeleton className="h-4 w-96 bg-muted" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 bg-muted" />
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
        <h1 className="text-2xl xl:text-3xl font-bold">数据总览</h1>
        <p className="text-muted-foreground mt-1">校园安全数据实时监控</p>
      </div>

      {/* 统计卡片 - 按要求组合显示 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
        {/* 当日车流量/超速车辆 */}
        <CombinedStatCard 
          title="车辆通行数据" 
          icon={<Car className="h-4 w-4 text-muted-foreground" />}
          onClick={() => navigate('/vehicles')}
          dataItems={[
            { label: '当日车流量', value: stats.vehicles.passageCount.toLocaleString(), unit: '辆', color: 'text-primary' },
            { label: '超速车辆', value: stats.vehicles.speedingCount.toLocaleString(), unit: '辆', color: 'text-yellow-500' }
          ]}
        />
        
        {/* 访客预约数/访客入校人数 */}
        <CombinedStatCard 
          title="访客数据" 
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          onClick={() => navigate('/personnel')}
          dataItems={[
            { label: '访客预约数', value: stats.personnel.visitorCount.toLocaleString(), unit: '人', color: 'text-blue-500' },
            { label: '访客入校人数', value: stats.personnel.visitorEntryCount.toLocaleString(), unit: '人', color: 'text-green-500' }
          ]}
        />
        
        {/* 天桥人流量/图书馆人流量 */}
        <CombinedStatCard 
          title="人流量数据" 
          icon={<Footprints className="h-4 w-4 text-muted-foreground" />}
          onClick={() => navigate('/personnel')}
          dataItems={[
            { label: '天桥人流量', value: stats.personnel.skybridgeTraffic.toLocaleString(), unit: '人次', color: 'text-purple-500' },
            { label: '图书馆人流量', value: stats.personnel.libraryTraffic.toLocaleString(), unit: '人次', color: 'text-indigo-500' }
          ]}
        />
        
        {/* 晚归人数/未归人数 */}
        <CombinedStatCard 
          title="宿舍数据" 
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          onClick={() => navigate('/dormitory')}
          dataItems={[
            { label: '晚归人数', value: stats.dormitory.lateReturnCount.toLocaleString(), unit: '人', color: 'text-orange-500' },
            { label: '未归人数', value: stats.dormitory.noReturnCount.toLocaleString(), unit: '人', color: 'text-red-500' }
          ]}
        />
      </div>

      {/* 快速访问 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/vehicles')}>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/personnel')}>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/dormitory')}>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/fire-safety')}>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/security')}>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
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
  );
}
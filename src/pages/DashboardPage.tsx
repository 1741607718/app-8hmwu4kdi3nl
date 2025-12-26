import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Users, Flame, Shield, Building2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { getVehicleStats, getFireEquipmentStats, getPersonnelStats, getSecurityStats, getDormitoryStats } from '@/db/api';
import { generateMockVehicleData, generateMockFireEquipmentData } from '@/services/externalApi';
import { supabase } from '@/db/supabase';
import type { StatCardData } from '@/types/types';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  vehicles: {
    total: number;
    today: number;
    change: number;
  };
  personnel: {
    total: number;
    visitors: number;
    change: number;
  };
  fireEquipment: {
    total: number;
    normal: number;
    abnormal: number;
  };
  security: {
    monitorsOnline: number;
    monitorsTotal: number;
    incidents: number;
  };
  dormitory: {
    totalResidents: number;
    checkedIn: number;
    checkedOut: number;
  };
}

function StatCard({ data }: { data: StatCardData }) {
  const getIcon = () => {
    switch (data.icon) {
      case 'car':
        return <Car className="h-5 w-5" />;
      case 'users':
        return <Users className="h-5 w-5" />;
      case 'flame':
        return <Flame className="h-5 w-5" />;
      case 'shield':
        return <Shield className="h-5 w-5" />;
      case 'building':
        return <Building2 className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getChangeIcon = () => {
    if (!data.change) return null;
    if (data.changeType === 'increase') {
      return <TrendingUp className="h-4 w-4 text-chart-4" />;
    }
    if (data.changeType === 'decrease') {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {data.title}
        </CardTitle>
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          {getIcon()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">
            {data.value}
            {data.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{data.unit}</span>}
          </div>
          {data.change !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              {getChangeIcon()}
              <span className={data.changeType === 'increase' ? 'text-chart-4' : 'text-destructive'}>
                {data.change > 0 ? '+' : ''}{data.change}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 检查数据库中是否有数据
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // 获取车辆数据
      const vehicleStats = await getVehicleStats({
        startDate: yesterday,
        endDate: today,
      });

      // 如果数据库为空，生成模拟数据并插入
      if (vehicleStats.total === 0) {
        await initializeMockData();
        // 重新获取数据
        const newVehicleStats = await getVehicleStats({
          startDate: yesterday,
          endDate: today,
        });
        const fireStats = await getFireEquipmentStats();
        
        setStats({
          vehicles: {
            total: newVehicleStats.total,
            today: newVehicleStats.byDate[today] || 0,
            change: 5.2,
          },
          personnel: {
            total: 15234,
            visitors: 342,
            change: 2.1,
          },
          fireEquipment: {
            total: fireStats.total,
            normal: fireStats.normal,
            abnormal: fireStats.abnormal,
          },
          security: {
            monitorsOnline: 156,
            monitorsTotal: 160,
            incidents: 3,
          },
          dormitory: {
            totalResidents: 8500,
            checkedIn: 8234,
            checkedOut: 266,
          },
        });
      } else {
        const fireStats = await getFireEquipmentStats();
        
        setStats({
          vehicles: {
            total: vehicleStats.total,
            today: vehicleStats.byDate[today] || 0,
            change: 5.2,
          },
          personnel: {
            total: 15234,
            visitors: 342,
            change: 2.1,
          },
          fireEquipment: {
            total: fireStats.total,
            normal: fireStats.normal,
            abnormal: fireStats.abnormal,
          },
          security: {
            monitorsOnline: 156,
            monitorsTotal: 160,
            incidents: 3,
          },
          dormitory: {
            totalResidents: 8500,
            checkedIn: 8234,
            checkedOut: 266,
          },
        });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMockData = async () => {
    try {
      // 生成模拟车辆数据
      const mockVehicles = generateMockVehicleData(7);
      const vehicleInserts = mockVehicles.map(v => ({
        plate_number: v.cph,
        recognition_code: v.qcysdm || null,
        recognition_name: v.qcysmc || null,
        station_code: v.sbtdbm || null,
        station_name: v.sbtdmc || null,
        pass_time: v.zpsj,
        data_source: 'mock',
        raw_data: v,
      }));

      await supabase.from('vehicle_data').insert(vehicleInserts);

      // 生成模拟消防设备数据
      const mockFireEquipment = generateMockFireEquipmentData(7);
      const fireInserts = mockFireEquipment.map(f => ({
        equipment_number: f.bh,
        check_date: f.dqrq,
        status: f.syjf || null,
        location_code: f.dxwb || null,
        location_name: f.bm || null,
        data_source: 'mock',
        raw_data: f,
      }));

      await supabase.from('fire_equipment_data').insert(fireInserts);

      console.log('模拟数据初始化完成');
    } catch (error) {
      console.error('初始化模拟数据失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 xl:p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2 bg-muted" />
          <Skeleton className="h-4 w-96 bg-muted" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
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

  const statCards: StatCardData[] = [
    {
      title: '今日车辆通行',
      value: stats.vehicles.today,
      unit: '辆',
      change: stats.vehicles.change,
      changeType: 'increase',
      icon: 'car',
    },
    {
      title: '在校人数',
      value: stats.personnel.total.toLocaleString(),
      unit: '人',
      change: stats.personnel.change,
      changeType: 'increase',
      icon: 'users',
    },
    {
      title: '访客人数',
      value: stats.personnel.visitors,
      unit: '人',
      icon: 'users',
    },
    {
      title: '消防设备正常',
      value: `${stats.fireEquipment.normal}/${stats.fireEquipment.total}`,
      icon: 'flame',
    },
    {
      title: '监控在线率',
      value: `${((stats.security.monitorsOnline / stats.security.monitorsTotal) * 100).toFixed(1)}%`,
      icon: 'shield',
    },
    {
      title: '宿舍入住率',
      value: `${((stats.dormitory.checkedIn / stats.dormitory.totalResidents) * 100).toFixed(1)}%`,
      icon: 'building',
    },
  ];

  return (
    <div className="p-4 xl:p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl xl:text-3xl font-bold">数据总览</h1>
        <p className="text-muted-foreground mt-1">校园安全数据实时监控</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card, index) => (
          <StatCard key={index} data={card} />
        ))}
      </div>

      {/* 快速访问 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/vehicles'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              车辆管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              查看车辆通行记录、车流量统计等详细信息
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/fire-safety'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              消防安全
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              查看消防设备状态、报警记录等信息
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/security'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              安保监控
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              查看监控状态、案事件统计等信息
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

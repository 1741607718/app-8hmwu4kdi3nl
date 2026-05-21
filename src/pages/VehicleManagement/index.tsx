// ...existing code...
import { Bar } from '@ant-design/charts';
import { fetchAllVisitorData, fetchAllVehicleRegistrations, fetchVehicleRegistrationData } from '../../services/externalApi';
// ...existing code...
const VehicleManagement: React.FC = () => {
  // ...existing code...
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [speedingData, setSpeedingData] = useState<any[]>([]);
  const [registrationData, setRegistrationData] = useState<any[]>([]);
  const [visitorData, setVisitorData] = useState<any[]>([]);

  // 分页状态，用于大数据量的通行记录
  const [trafficPagination, setTrafficPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [loadingTraffic, setLoadingTraffic] = useState(false);

  // ...existing code...

  const fetchTrafficData = async (page = 1, pageSize = 50) => {
    setLoadingTraffic(true);
    try {
      // 模拟大数据量接口，支持分页
      const response = await fetch(`/api/vehicle/traffic?page=${page}&pageSize=${pageSize}`);
      const data = await response.json();
      // 假设接口返回 { list: [], total: 1000000 }
      // 这里如果是部分加载，可以选择追加数据或者替换当前页数据
      setTrafficData(data.list);
      setTrafficPagination(prev => ({ ...prev, current: page, total: data.total }));

      // 超速记录通常是通行记录的子集或同一张表的过滤，同样建议分页或按需加载
      // 这里简化处理，假设超速记录也是单独的分页接口
      const speedingRes = await fetch(`/api/vehicle/speeding?page=${page}&pageSize=${pageSize}`);
      const speedingJson = await speedingRes.json();
      setSpeedingData(speedingJson.list);

    } catch (error) {
      console.error("Failed to load traffic data", error);
    } finally {
      setLoadingTraffic(false);
    }
  };

  const fetchOtherData = async () => {
    // 检查缓存
    if (dataCache.registration && dataCache.visitor) {
      console.log("Using cached registration and visitor data");
      setRegistrationData(dataCache.registration);
      setVisitorData(dataCache.visitor);
      return;
    }

    try {
      // 登记记录 - 全量加载（从数据库）
      // 使用分页API获取数据，但获取所有数据
      const regResult = await fetchAllVehicleRegistrations({});
      if (regResult.success && regResult.data) {
        // 存入缓存
        dataCache.registration = regResult.data;
        setRegistrationData(regResult.data);
      }

      // 访客车辆 - 全量加载（从数据库）
      const visitorResult = await fetchAllVisitorData({pageSize: 1000});
      if (visitorResult.success && visitorResult.data) {
        // 存入缓存
        dataCache.visitor = visitorResult.data;
        setVisitorData(visitorResult.data);
      }
    } catch (error) {
      console.error("Failed to load other data", error);
    }
  };

  useEffect(() => {
    fetchTrafficData(1, 50); // 初始加载第一页
    fetchOtherData();

    // 设置定时刷新，每5分钟刷新一次
    const intervalId = setInterval(() => {
      console.log('自动刷新车辆管理数据...');
      fetchTrafficData(1, 50);
      fetchOtherData();
    }, 300000); // 300000ms = 5分钟

    return () => clearInterval(intervalId);
  }, []);

  // ...existing code...

  // 处理访客数据，获取前十个受访部门
  const getTop10VisitorDepartments = () => {
    const deptMap = new Map<string, number>();
    visitorData.forEach((record: any) => {
      const dept = record.visitedDepartment || '未知部门';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    const sortedDepts = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([department, count]) => ({ department, count }));

    return sortedDepts;
  };

  const visitorChartConfig = {
    data: getTop10VisitorDepartments(),
    xField: 'count',
    yField: 'department',
    seriesField: 'department',
    color: ['#1D4ED8', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E', '#6366F1', '#3B82F6', '#059669', '#0F766E'],
    legend: { position: 'top-left' },
    barWidthRatio: 0.8,
    label: {
        position: 'right',
        style: {
            fill: '#334155',
            fontSize: 12,
        },
    },
  };

  // ...existing code...

  return (
    <div className={styles.container}>
      {/* ...existing code... */}

      {/* 访客车辆统计图表区域 */}
      <div className={styles.chartSection}>
        <h3>前十受访部门车辆统计</h3>
        <Bar {...(visitorChartConfig as any)} />
      </div>

      {/* ...existing code... */}

      {/* 通行记录表格，添加分页控制 */}
      <Table
        dataSource={trafficData}
        columns={trafficColumns}
        loading={loadingTraffic}
        pagination={{
          ...trafficPagination,
          onChange: (page, pageSize) => fetchTrafficData(page, pageSize)
        }}
      />

      {/* ...existing code... */}
    </div>
  );
};

export default VehicleManagement;


// 外部API配置
const VEHICLE_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

const FIRE_SAFETY_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

// API响应类型
interface ExternalApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 车辆API数据类型
export interface VehicleApiData {
  cph: string; // 车牌号
  qcysdm?: string; // 识别状态代码
  qcysmc?: string; // 识别状态名称
  sbtdbm?: string; // 站点代码
  sbtdmc?: string; // 站点名称
  zpsj: string; // 通过时间
}

// 消防设备API数据类型
export interface FireEquipmentApiData {
  dqrq: string; // 检测日期
  bh: string; // 设备编号
  syjf?: string; // 设备状态
  dxwb?: string; // 位置代码
  bm?: string; // 位置名称
}

/**
 * 调用车辆管理API
 */
export async function fetchVehicleData(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  try {
    const queryParams = new URLSearchParams({
      applyId: VEHICLE_API_CONFIG.applyId,
      secretKey: VEHICLE_API_CONFIG.secretKey,
      ...(params?.startDate && { startDate: params.startDate }),
      ...(params?.endDate && { endDate: params.endDate }),
    });

    const response = await fetch(`${VEHICLE_API_CONFIG.baseUrl}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data.data || data,
    };
  } catch (error) {
    console.error('车辆API调用失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 调用消防安全API
 */
export async function fetchFireSafetyData(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<FireEquipmentApiData[]>> {
  try {
    const queryParams = new URLSearchParams({
      applyId: FIRE_SAFETY_API_CONFIG.applyId,
      secretKey: FIRE_SAFETY_API_CONFIG.secretKey,
      ...(params?.startDate && { startDate: params.startDate }),
      ...(params?.endDate && { endDate: params.endDate }),
    });

    const response = await fetch(`${FIRE_SAFETY_API_CONFIG.baseUrl}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data.data || data,
    };
  } catch (error) {
    console.error('消防API调用失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 生成模拟数据 - 用于演示
 */
export function generateMockVehicleData(days: number = 7): VehicleApiData[] {
  const data: VehicleApiData[] = [];
  const plates = ['浙A12345', '浙B67890', '浙C11111', '浙D22222', '浙E33333'];
  const stations = [
    { code: 'ST001', name: '东门' },
    { code: 'ST002', name: '西门' },
    { code: 'ST003', name: '南门' },
    { code: 'ST004', name: '北门' },
  ];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const count = Math.floor(Math.random() * 50) + 20;
    for (let j = 0; j < count; j++) {
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      const station = stations[Math.floor(Math.random() * stations.length)];
      
      data.push({
        cph: plates[Math.floor(Math.random() * plates.length)],
        qcysdm: '1',
        qcysmc: '正常通行',
        sbtdbm: station.code,
        sbtdmc: station.name,
        zpsj: `${date.toISOString().split('T')[0]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      });
    }
  }

  return data;
}

export function generateMockFireEquipmentData(days: number = 7): FireEquipmentApiData[] {
  const data: FireEquipmentApiData[] = [];
  const locations = [
    { code: 'LOC001', name: '教学楼A栋' },
    { code: 'LOC002', name: '教学楼B栋' },
    { code: 'LOC003', name: '宿舍楼1号' },
    { code: 'LOC004', name: '宿舍楼2号' },
    { code: 'LOC005', name: '图书馆' },
  ];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    locations.forEach((location, idx) => {
      const equipmentCount = Math.floor(Math.random() * 5) + 3;
      for (let j = 0; j < equipmentCount; j++) {
        const isNormal = Math.random() > 0.1; // 90%正常
        data.push({
          dqrq: date.toISOString().split('T')[0],
          bh: `EQ${String(idx * 10 + j).padStart(4, '0')}`,
          syjf: isNormal ? '正常' : '异常',
          dxwb: location.code,
          bm: location.name,
        });
      }
    });
  }

  return data;
}

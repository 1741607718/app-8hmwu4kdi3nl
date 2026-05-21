const INTERNAL_PROXY_CONFIG = {
  // 使用环境变量配置，否则使用相对路径走 Vite 代理
  baseUrl: import.meta.env.VITE_INTERNAL_PROXY_URL || '',
};

// 构建完整API URL的辅助函数
const buildApiUrl = (endpoint: string) => {
  return `${INTERNAL_PROXY_CONFIG.baseUrl}${endpoint}`;
};

// API响应类型
interface ExternalApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  inCount?: number;
  outCount?: number;
}

// 车辆API数据类型
export interface VehicleApiData {
  cph: string; // 车牌号
  qcysdm?: string; // 识别状态代码
  qcysmc?: string; // 识别状态名称
  sbtdbm?: string; // 站点代码
  sbtdmc?: string; // 站点名称
  zpsj: string; // 通过时间
  cs?: number; // 车速
  cjsj?: string; // 创建时间
  cllx?: string; // 车辆类型
}

// 车辆统计API数据类型
export interface VehicleStatsData {
  total: number;
  speedingCount: number;
  speedingRate: number;
  byDate: Record<string, number>;
  speedingByDate: Record<string, number>;
  byLocation: Record<string, number>;
  speedingByLocation: Record<string, number>;
  maxSpeedByLocation: Record<string, number>;
  // 校区分类数据（闸机数据）
  byCampus?: {
    south: {
      total: number;
      byDate: Record<string, number>;
      byLocation: Record<string, number>;
    };
    north: {
      total: number;
      byDate: Record<string, number>;
      byLocation: Record<string, number>;
    };
  };
  // 闸机数据（出入车辆）
  gateTotal?: number;
  gateByDate?: Record<string, number>;
  gateByLocation?: Record<string, number>;
  // 测速设备数据（车流量+超速）
  trafficTotal?: number;
  trafficByDate?: Record<string, number>;
  trafficByLocation?: Record<string, number>;
  // 卡口出入明细（南/西/罗山/北 × 入/出）
  gateBreakdown?: {
    gateName: string;
    campus: 'south' | 'north';
    in: number;
    out: number;
  }[];
}

// 车辆登记API数据类型
export interface VehicleRegistrationApiData {
  guid: string; // GUID
  gh?: string; // 工号
  bh?: string; // 编号
  xm?: string; // 姓名
  lxfs?: string; // 联系方式
  bm?: string; // 部门
  cllx?: string; // 车辆类型
  cp: string; // 车牌
  djrq?: string; // 登记日期
  dqrq?: string; // 到期日期
  dxwb?: string; // DXWB
  syjf?: string; // 剩余积分
}

// 访客API数据类型
export interface VisitorApiData {
  guid: string;
  xm?: string; // 姓名
  lfsy?: string; // 来访事由
  bfbm?: string; // 受访部门
  bfr?: string; // 被拜访人
  system_status?: string; // 审批状态
  lfsj?: string; // 离校时间
  dfsj?: string; // 到访时间
  cp?: string; // 车牌号
  sfzh?: string; // 身份证号
  lxdh?: string; // 联系电话
  raw_data: any;
}

// 访客统计API数据类型
export interface VisitorStatsData {
  total: number;
  byDate: Record<string, number>;
  byDepartment?: Record<string, number>;
}

// 访客入校API数据类型
export interface VisitorEntryApiData {
  guid: string;
  xm?: string; // 访客姓名 (LFRXM)
  smsj?: string; // 入校时间 (SMSJ)
  lxdh?: string; // 联系电话 (LFRSJHM)
  sfzh?: string; // 身份证号 (LFRSFZH)
  smrxm?: string; // 扫码人姓名 (SMRXM)
  raw_data: any;
}

// 访客入校统计API数据类型
export interface VisitorEntryStatsData {
  total: number;
  byDate: Record<string, number>;
}

// 被访数据统计API数据类型
export interface VisitedStatsData {
  byDate: Record<string, { visitCount: number; visitedPersonCount: number }>;
}

// 人流量统计API数据类型
export interface HumanTrafficStatsData {
  library: number;
  skybridge: number;
  total: number;
  byDate: Record<string, { library: number; skybridge: number }>;
}

// 宿管住宿统计API数据类型
export interface DormitoryStatsData {
  total: number;
  byBuilding: Record<string, number>;
}

/**
 * 调用车辆统计API
 */
export async function fetchVehicleStats(params?: {
  startDate?: string;
  endDate?: string;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<VehicleStatsData>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.speedingOnly) {
      queryParams.append('speedingOnly', 'true');
    }

    const url = buildApiUrl('/api/vehicle-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求车辆统计数据URL:', url);
    console.log('[Frontend] 发起车辆统计API请求到:', url);
    console.log('[Frontend] 请求Headers:', {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Frontend] 车辆统计API响应状态:', response.status, 'URL:', url);
    console.log('[Frontend] 车辆统计响应Headers:', Object.fromEntries(response.headers.entries()));
    const contentType = response.headers.get('content-type');
    console.log('[Debug] 响应 Content-Type:', contentType);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (!responseText) {
      throw new Error('API返回空响应');
    }

    // 检查是否是 HTML (通常意味着 404/500 错误页或代理失败)
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      throw new Error('API返回了HTML页面，可能是代理配置错误或路径不存在');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[Debug] JSON解析失败. 原始内容:', responseText);
      throw e;
    }

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('车辆统计API调用失败:', error);
    // 如果连接失败，返回一个错误响应而不是抛出异常
    return {
      success: false,
      error: error.message || '无法连接到车辆统计API服务',
    };
  }
}

/**
 * 调用访客统计API
 */
export async function fetchVisitorStats(params?: {
  startDate?: string;
  endDate?: string;
  personnelMode?: boolean;
}): Promise<ExternalApiResponse<VisitorStatsData>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    // 使用数据库API端点而不是外部API
    // 如果是人员管理模式，使用专门的API端点
    const endpoint = params?.personnelMode ? '/api/personnel/visitor-stats-db' : '/api/visitor-stats-db';
    const url = buildApiUrl(endpoint) + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求访客统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Debug] 访客统计数据库API响应状态:', response.status);
    console.log('[Debug] 响应 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      throw new Error('API返回了HTML页面，可能是代理配置错误或路径不存在');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[Debug] JSON解析失败:', responseText.substring(0, 100));
      throw e;
    }

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('访客统计数据库API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到访客统计数据库API服务',
    };
  }
}

/**
 * 调用车辆管理API
 */
export async function fetchVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    
    const url = buildApiUrl('/api/vehicle') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求车辆数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('车辆API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('车辆API调用失败:', error);
    // 如果连接失败，返回一个错误响应而不是抛出异常
    return {
      success: false,
      error: error.message || '无法连接到车辆API服务',
    };
  }
}

/**
 * 调用闸机车辆数据API
 */
export async function fetchGateVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    const url = buildApiUrl('/api/gate-vehicle') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求闸机车辆数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('闸机车辆API响应状态:', response.status);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[Debug] JSON解析失败:', responseText.substring(0, 100));
      throw e;
    }

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('闸机车辆API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到闸机车辆API服务',
    };
  }
}

/**
 * 获取闸机车辆明细数据 (分校区 + 出入状态)
 */
export async function fetchCampusVehicleDetail(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  campus?: 'south' | 'north';
}): Promise<ExternalApiResponse<any[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.campus) queryParams.append('campus', params.campus);

    const url = buildApiUrl('/api/vehicle/campus-detail') + `?${queryParams.toString()}&_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data.data || [],
      total: data.total || 0,
      inCount: data.inCount || 0,
      outCount: data.outCount || 0,
    };
  } catch (error: any) {
    console.error('[闸机明细] API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到闸机明细API服务',
    };
  }
}

/**
 * 调用车辆登记API
 */
export async function fetchVehicleRegistrationData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VehicleRegistrationApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    
    // 使用数据库端点而不是外部API
    const url = buildApiUrl('/api/vehicle-registration-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求车辆登记数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('车辆登记数据库API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('车辆登记数据库API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记数据库API服务',
    };
  }
}

/**
 * 调用访客API
 */
export async function fetchVisitorData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  personnelMode?: boolean;
}): Promise<ExternalApiResponse<VisitorApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    
    // 使用数据库API端点而不是外部API
    // 如果是人员管理模式，使用专门的API端点
    const endpoint = params?.personnelMode ? '/api/personnel/visitor-db' : '/api/visitor-db';
    const url = buildApiUrl(endpoint) + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求访客数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('访客数据库API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('访客数据库API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到访客数据库API服务',
    };
  }
}

/**
 * 调用访客入校API
 */
export async function fetchVisitorEntryData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VisitorEntryApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    const url = buildApiUrl('/api/personnel/visitor-entry-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求访客入校数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('访客入校API响应状态:', response.status);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('访客入校API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到访客入校API服务',
    };
  }
}

/**
 * 调用访客入校统计API
 */
export async function fetchVisitorEntryStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<VisitorEntryStatsData>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const url = buildApiUrl('/api/personnel/visitor-entry-stats-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求访客入校统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Debug] 访客入校统计API响应状态:', response.status);
    console.log('[Debug] 响应 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      throw new Error('API返回了HTML页面');
    }

    const data = JSON.parse(responseText);

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('访客入校统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到访客入校统计API服务',
    };
  }
}

/**
 * 调用被访数据统计API
 */
export async function fetchVisitedStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<VisitedStatsData>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const url = buildApiUrl('/api/personnel/visited-stats-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求被访数据统计URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('被访数据统计API响应状态:', response.status);

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('被访数据统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到被访数据统计API服务',
    };
  }
}

/**
 * 调用人流量统计API
 */
export async function fetchHumanTrafficStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<HumanTrafficStatsData>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const url = buildApiUrl('/api/personnel/human-traffic-stats-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求人流量统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Debug] 人流量统计API响应状态:', response.status);
    console.log('[Debug] 响应 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      throw new Error('API返回了HTML页面');
    }

    const data = JSON.parse(responseText);

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('人流量统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到人流量统计API服务',
    };
  }
}

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

/**
 * 调用宿管住宿统计API
 */
export async function fetchDormitoryStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{
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
}>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    
    const url = buildApiUrl('/api/dormitory/stats-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求宿管住宿统计数据URL:', url);
    console.log('[Frontend] 发起宿管统计API请求到:', url);
    console.log('[Frontend] 宿管统计请求Headers:', {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Frontend] 宿管住宿统计API响应状态:', response.status, 'URL:', url);
    console.log('[Frontend] 宿管统计响应Headers:', Object.fromEntries(response.headers.entries()));
    console.log('[Debug] 响应 Content-Type:', response.headers.get('content-type'));
    console.log('[Debug] 响应 URL:', response.url); // Log the actual resolved URL

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      console.error('[Debug] Full response text length:', responseText.length);
      throw new Error('API返回了HTML页面');
    }

    const data = JSON.parse(responseText);

    // 宿舍统计数据API直接返回数据对象，没有success和data包装
    // 需要直接返回数据对象作为data字段
    return {
      success: true,
      data: data,  // 直接返回API响应数据
      total: data.total
    };
  } catch (error: any) {
    console.error('宿管住宿统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到宿管住宿统计API服务',
    };
  }
}

/**
 * 获取所有车辆登记数据（支持分页）
 */
export async function fetchAllVehicleRegistrations(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VehicleRegistrationApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    // 使用数据库端点来获取所有车辆登记数据
    const url = buildApiUrl('/api/vehicle-registration-all-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求所有车辆登记数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('所有车辆登记数据库API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('所有车辆登记数据库API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记数据库API服务',
    };
  }
}

/**
 * 获取所有车辆数据（全量数据，支持分页）
 */
export async function fetchAllVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params?.speedingOnly) {
      queryParams.append('speedingOnly', 'true');
    }

    const url = buildApiUrl('/api/vehicle-all') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求全量车辆数据URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('全量车辆API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('全量车辆API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到全量车辆API服务',
    };
  }
}

/**
 * 获取所有访客数据（全量数据）
 */
export async function fetchAllVisitorData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VisitorApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    // 使用数据库API端点而不是外部API
    const url = buildApiUrl('/api/visitor-all-db') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求全量访客数据URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('全量访客数据库API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('全量访客数据库API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到全量访客数据库API服务',
    };
  }
}

// 安全馆预约API数据类型
export interface SafetyVisitReservation {
  GUID: string;
  SQRQ: string; // 申请日期
  SQR: string; // 申请人
  BMXY: string; // 部门学院
  LXDH: string; // 联系电话
  SFLB: string; // 申请类别
  SQCGSJDKS: string; // 申请参观时间段开始
  SQCGSJJS: string; // 申请参观时间段结束
  SQSY: string; // 申请事由
  SYS_USERNAME: string; // 系统用户名
  SYS_DEPARTMENTNAME: string; // 系统部门名称
  SYSTEM_STATUS: string; // 系统状态
  SYSTEM_INCIDENT: string; // 系统事件
  SYSTEM_ENDTIME: string; // 系统结束时间
}

// 安全馆预约统计API数据类型
export interface SafetyVisitReservationStats {
  total: number;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * 获取安全馆预约数据
 */
export async function fetchSafetyVisitReservationData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<SafetyVisitReservation[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    const url = buildApiUrl('/api/security/safety-visit-reservations') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求安全馆预约数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('安全馆预约API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('安全馆预约API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到安全馆预约API服务',
    };
  }
}

/**
 * 获取安全馆预约统计数据
 */
export async function fetchSafetyVisitReservationStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<SafetyVisitReservationStats>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const url = buildApiUrl('/api/security/safety-visit-reservation-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求安全馆预约统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('安全馆预约统计API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('安全馆预约统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到安全馆预约统计API服务',
    };
  }
}

// 宿舍数据类型定义
export interface DormitoryData {
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

/**
 * 获取宿舍详细数据（支持分页和筛选）
 */
export async function fetchDormitoryData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  filterType?: 'wg' | 'bg' | 'qj' | 'xwzs' | 'no_record' | 'all' | 'zc';
}): Promise<ExternalApiResponse<DormitoryData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params?.filterType) {
      queryParams.append('filterType', params.filterType);
    }

    const url = buildApiUrl('/api/dormitory/data') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求宿舍详细数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('[Debug] 宿舍详细数据API响应状态:', response.status);
    console.log('[Debug] 响应 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (responseText.trim().startsWith('<')) {
      console.error('[Debug] API返回了HTML而不是JSON. 预览:', responseText.substring(0, 200));
      throw new Error('API返回了HTML页面');
    }

    const data = JSON.parse(responseText);

    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('宿舍详细数据API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到宿舍详细数据API服务',
    };
  }
}

// 用于扩展车辆数据的车辆登记信息类型
export interface VehicleRegistrationInfo {
  xm?: string; // 姓名
  bm?: string; // 部门/单位
  cllx?: string; // 车辆类型
}

// 扩展车辆数据类型，增加姓名和单位信息
export interface ExtendedVehicleData extends VehicleApiData {
  xm?: string; // 关联车辆登记表得到的姓名
  bm?: string; // 关联车辆登记表得到的部门/单位
}

// 获取车辆登记信息的函数（按车牌号）
export async function fetchVehicleRegistrationByPlate(plateNumber: string): Promise<ExternalApiResponse<VehicleRegistrationInfo | null>> {
  try {
    const result = await fetchVehicleRegistrationsByPlates([plateNumber]);
    if (!result.success) {
      return { success: false, error: result.error || '批量查询失败' };
    }

    const info = result.data?.[plateNumber] || null;
    return { success: true, data: info };
  } catch (error: any) {
    console.error('车辆登记信息API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记API服务',
    };
  }
}

// 批量获取车辆登记信息
export async function fetchVehicleRegistrationsByPlates(plateNumbers: string[]): Promise<ExternalApiResponse<Record<string, VehicleRegistrationInfo>>> {
  try {
    const uniquePlates = Array.from(new Set(plateNumbers.map(p => (p || '').trim()).filter(Boolean)));
    if (uniquePlates.length === 0) {
      return { success: true, data: {} };
    }

    const url = buildApiUrl('/api/vehicle-registration/by-plates') + `?_t=${Date.now()}`;

    console.log('批量请求车辆登记(按车牌)URL:', url, 'plates:', uniquePlates.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ plates: uniquePlates }),
    });
    
    console.log('批量车辆登记API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();

    if (data?.success === false) {
      return { success: false, error: data.error || data.message || 'Unknown error' };
    }

    return { success: true, data: (data?.data || data || {}) as Record<string, VehicleRegistrationInfo> };
  } catch (error: any) {
    console.error('批量车辆登记信息API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记API服务',
    };
  }
}

// 在线用户数据类型
export interface OnlineUserData {
  fldUserId: string;
  fldUserName: string;
  fldUserRealName: string;
  fldLoginDate: string;
  department?: string;
  gender?: string;
  userType?: string;
}

// 在线用户统计数据类型
export interface OnlineUserStatsData {
  total: number;
  students: number;
  staff: number;
  others: number;
  byTime: Record<string, number>;
  byDeviceType: Record<string, number>;
  byLocation: Record<string, number>;
}

/**
 * 获取在线用户数据
 */
export async function fetchOnlineUsersData(params?: {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  userType?: string;
}): Promise<ExternalApiResponse<OnlineUserData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.userType) {
      queryParams.append('userType', params.userType);
    }

    const url = buildApiUrl('/api/personnel-online') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求在线用户数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('在线用户API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('在线用户API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到在线用户API服务',
    };
  }
}

/**
 * 获取在线用户统计数据
 */
export async function fetchOnlineUsersStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<OnlineUserStatsData>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    const url = buildApiUrl('/api/personnel-online-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求在线用户统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('在线用户统计API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('在线用户统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到在线用户统计API服务',
    };
  }
}

// 人脸识别监控查询API数据类型
export interface FaceRecognitionMonitorQuery {
  GUID: string;
  RQ: string; // 日期
  SQR: string; // 申请人
  LXDH: string; // 联系电话
  SFLB: string; // 申请类别
  BMXY: string; // 部门学院
  DQLXKSSJ: string; // 调取录像开始时间
  DQLXJSSJ: string; // 调取录像结束时间
  SJFSD: string; // 数据发送方式
  DQFS: string; // 调取方式
  SQSY: string; // 申请事由
  BZ: string; // 备注
  XXBMYJ: string; // 信息部门意见
  BWCYJ: string; // 保卫处意见
  SYS_USERID: string; // 系统用户ID
  SYS_USERNAME: string; // 系统用户名
  SYS_USERACCOUNT: string; // 系统用户账号
  SYS_COMPANYID: string; // 系统公司ID
  SYS_COMPANYNAME: string; // 系统公司名称
  SYS_DEPARTMENTID: string; // 系统部门ID
  SYS_DEPARTMENTNAME: string; // 系统部门名称
  SYS_USEREMAIL: string; // 系统用户邮箱
  SYS_USERPHONE: string; // 系统用户电话
  SYS_JOBID: string; // 系统职务ID
  SYS_JOBNAME: string; // 系统职务名称
  SYS_APPLYDATE: string; // 系统申请日期
  SYS_ORGPATH: string; // 系统组织路径
  SYS_APPLYNO: string; // 系统申请编号
  SYSTEM_PROCESSNAME: string; // 系统流程名称
  SYSTEM_INCIDENT: string; // 系统事件
  SYSTEM_STATUS: string; // 系统状态
  SYSTEM_ENDTIME: string; // 系统结束时间
}

// 人脸识别监控查询统计API数据类型
export interface FaceRecognitionMonitorQueryStats {
  total: number;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
  byStatus: Record<string, number>;
}

// 监控设备统计API数据类型
export interface CameraStatsData {
  onlineCount: number;
  faceRecognitionCount: number;
  totalCount: number;
  barrierGateCount: number;
}

// 摄像头设备API数据类型
export interface CameraDeviceApiData {
  id: number;
  deviceCode: string;
  deviceName: string;
  deviceCategory: string;
  type: string;
  isOnline: boolean;
  capabilityCollection: string;
  ownerCode: string;
  deviceIp: string;
  updateTime: string;
}

// 监控查询记录数据类型
export interface MonitorQueryRecord {
  GUID: string;
  RQ: string;
  SQR: string;
  LXDH: string;
  SFLB: string;
  BMXY: string;
  DQLXKSSJ: string;
  DQLXJSSJ: string;
  SJFSD: string;
  DQFS: string;
  SQSY: string;
  BZ: string;
  XXBMYJ: string;
  BWCYJ: string;
  SYS_USERID: string;
  SYS_USERNAME: string;
  SYS_USERACCOUNT: string;
  SYS_COMPANYID: string;
  SYS_COMPANYNAME: string;
  SYS_DEPARTMENTID: string;
  SYS_DEPARTMENTNAME: string;
  SYS_USEREMAIL: string;
  SYS_USERPHONE: string;
  SYS_JOBID: string;
  SYS_JOBNAME: string;
  SYS_APPLYDATE: string;
  SYS_ORGPATH: string;
  SYS_APPLYNO: string;
  SYSTEM_PROCESSNAME: string;
  SYSTEM_INCIDENT: string;
  SYSTEM_STATUS: string;
  SYSTEM_ENDTIME: string;
}

// 监控查询记录统计数据类型
export interface MonitorQueryRecordStats {
  total: number;
}

/**
 * 获取监控设备统计数据
 */
export async function fetchCameraStats(): Promise<ExternalApiResponse<CameraStatsData>> {
  try {
    // 并行获取摄像头统计和闸机设备统计
    const [cameraStatsResponse, barrierGateStatsResponse] = await Promise.all([
      fetch(buildApiUrl('/api/camera/stats') + `?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      }),
      fetch(buildApiUrl('/api/barrier-gate/stats') + `?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      })
    ]);

    // 处理摄像头统计响应
    console.log('[Frontend] 监控统计API响应状态:', cameraStatsResponse.status);
    let cameraData = null;
    if (cameraStatsResponse.ok) {
      const cameraResponseText = await cameraStatsResponse.text();
      if (cameraResponseText.trim() && !cameraResponseText.trim().startsWith('<')) {
        try {
          const parsed = JSON.parse(cameraResponseText);
          cameraData = parsed.data || parsed;
        } catch (e) {
          console.error('[Debug] 摄像头统计JSON解析失败:', cameraResponseText);
        }
      }
    }

    // 处理闸机设备统计响应
    console.log('[Frontend] 闸机设备统计API响应状态:', barrierGateStatsResponse.status);
    let barrierGateData = null;
    if (barrierGateStatsResponse.ok) {
      const barrierGateResponseText = await barrierGateStatsResponse.text();
      if (barrierGateResponseText.trim() && !barrierGateResponseText.trim().startsWith('<')) {
        try {
          const parsed = JSON.parse(barrierGateResponseText);
          barrierGateData = parsed.data || parsed;
        } catch (e) {
          console.error('[Debug] 闸机设备统计JSON解析失败:', barrierGateResponseText);
        }
      }
    }

    // 合并数据
    const combinedData = {
      onlineCount: cameraData?.online || 0,
      faceRecognitionCount: cameraData?.byCategory?.['人脸识别'] || 0,
      totalCount: cameraData?.total || 0,
      barrierGateCount: barrierGateData?.total || 0
    };

    return {
      success: true,
      data: combinedData
    };
  } catch (error: any) {
    console.error('监控统计API调用失败:', error);
    // 如果连接失败，返回一个错误响应而不是抛出异常
    return {
      success: false,
      error: error.message || '无法连接到监控统计API服务',
    };
  }
}

/**
 * 获取摄像头设备详情
 */
// 获取监控查询记录数据
export async function fetchMonitorQueryRecordData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<MonitorQueryRecord[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    const url = buildApiUrl('/api/security/monitor-query-record') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求监控查询记录数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('监控查询记录API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('监控查询记录API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到监控查询记录API服务',
    };
  }
}

// 获取监控查询记录统计数据
export async function fetchMonitorQueryRecordStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<MonitorQueryRecordStats>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const url = buildApiUrl('/api/security/monitor-query-record-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求监控查询记录统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('监控查询记录统计API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      return {
        success: true,
        data: data.data || data,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('监控查询记录统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到监控查询记录统计API服务',
    };
  }
}

export async function fetchCameraDevices(params?: {
  page?: number;
  pageSize?: number;
  type?: 'all' | 'online' | 'offline' | 'face-recognition' | 'barrier-gate';
}): Promise<ExternalApiResponse<CameraDeviceApiData[]>> {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params?.type) {
      queryParams.append('type', params.type);
    }
    
    // 如果是闸机设备，使用专门的API端点
    const apiEndpoint = params?.type === 'barrier-gate' ? '/api/barrier-gate/devices' : '/api/camera/devices';
    const url = buildApiUrl(apiEndpoint) + `?${queryParams.toString()}&_t=${Date.now()}`;
    
    console.log('请求设备数据URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });
    
    console.log('设备API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success !== undefined ? data.success : true) {
      const rawData = data.data || data;
      const transformedData = rawData.map((item: any) => ({
        id: item.ID,
        deviceCode: item.DEVICE_CODE,
        deviceName: item.DEVICE_NAME,
        deviceCategory: item.DEVICE_CATEGORY,
        type: item.TYPE,
        isOnline: item.IS_ONLINE === 1,
        capabilityCollection: item.CAPABILITY_COLLECTION,
        ownerCode: item.OWNER_CODE,
        deviceIp: item.DEVICE_IP,
        updateTime: item.UPDATE_TIME,
      }));
      return {
        success: true,
        data: transformedData,
        total: data.total
      };
    } else {
      return {
        success: false,
        error: data.error || data.message || 'Unknown error'
      };
    }
  } catch (error: any) {
    console.error('设备API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到设备API服务',
    };
  }
}

// ==================== 校园警情数据 ====================

import type { CampusPoliceIncident, CampusPoliceIncidentStats, PoliceIncidentRecord, PoliceIncidentStats } from '@/types/types';
import { DEFAULT_POLICE_INCIDENT_TYPES } from '@/types/types';

/**
 * 获取校园警情统计数据 (从 biz_jqsb 表)
 */
export async function fetchCampusPoliceIncidentStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<CampusPoliceIncidentStats>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = buildApiUrl('/api/security/police-incident-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[警情统计] 请求URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        total: data.total || 0,
        today: data.today || 0,
        thisWeek: data.thisWeek || 0,
        thisMonth: data.thisMonth || 0,
        thisYear: data.thisYear || 0,
        byType: data.byType || {},
        byDate: data.byDate || {},
        byStatus: data.byStatus || {},
      },
    };
  } catch (error: any) {
    console.error('[警情统计] API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到警情统计API服务',
    };
  }
}

/**
 * 获取校园警情详细数据 (从 biz_jqsb 表)
 */
export async function fetchCampusPoliceIncidentData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  incidentType?: string;
}): Promise<ExternalApiResponse<PoliceIncidentRecord[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.incidentType) queryParams.append('incidentType', params.incidentType);

    const url = buildApiUrl('/api/security/police-incident-data') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[警情数据] 请求URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data.data || [],
      total: data.total || 0,
    };
  } catch (error: any) {
    console.error('[警情数据] API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到警情数据API服务',
    };
  }
}

/**
 * 获取警情统计数据 (新接口，返回 PoliceIncidentStats)
 */
export async function fetchPoliceIncidentStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<PoliceIncidentStats>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = buildApiUrl('/api/security/police-incident-stats') + `?${queryParams.toString()}&_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        total: data.total || 0,
        today: data.today || 0,
        thisWeek: data.thisWeek || 0,
        thisMonth: data.thisMonth || 0,
        thisYear: data.thisYear || 0,
        byType: data.byType || {},
        byDate: data.byDate || {},
        byDepartment: data.byDepartment || {},
      },
    };
  } catch (error: any) {
    console.error('[警情统计] API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到警情统计API服务',
    };
  }
}

/**
 * 获取警情详细数据 (新接口，返回 PoliceIncidentRecord)
 */
export async function fetchPoliceIncidentData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  incidentType?: string;
}): Promise<ExternalApiResponse<PoliceIncidentRecord[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.incidentType) queryParams.append('incidentType', params.incidentType);

    const url = buildApiUrl('/api/security/police-incident-data') + `?${queryParams.toString()}&_t=${Date.now()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: data.data || [],
      total: data.total || 0,
    };
  } catch (error: any) {
    console.error('[警情数据] API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到警情数据API服务',
    };
  }
}

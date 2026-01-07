// 检查是否在生产环境使用Supabase函数
// const isProduction = import.meta.env.MODE === 'production';
// const isSupabaseEnv = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.includes('supabase.co');

// 使用Supabase函数作为API代理
const INTERNAL_PROXY_CONFIG = {
  // 使用环境变量配置，否则使用相对路径走Vite代理
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
  byDate: Record<string, number>;
  byLocation?: Record<string, number>;
  maxSpeedByLocation?: Record<string, number>;
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
    
    const url = buildApiUrl('/api/vehicle-registration') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('[Debug] 请求车辆登记数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('车辆登记API响应状态:', response.status);
    
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
    console.error('车辆登记API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记API服务',
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

    // 使用专门的端点来获取所有车辆登记数据
    const url = buildApiUrl('/api/vehicle-registration-all') + `?${queryParams.toString()}&_t=${Date.now()}`;

    console.log('请求所有车辆登记数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('所有车辆登记API响应状态:', response.status);
    
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
    console.error('所有车辆登记API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到车辆登记API服务',
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

// 安全观预约API数据类型
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

// 安全观预约统计API数据类型
export interface SafetyVisitReservationStats {
  total: number;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * 获取安全观预约数据
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

    console.log('请求安全观预约数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('安全观预约API响应状态:', response.status);
    
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
    console.error('安全观预约API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到安全观预约API服务',
    };
  }
}

/**
 * 获取安全观预约统计数据
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

    console.log('请求安全观预约统计数据URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
    });

    console.log('安全观预约统计API响应状态:', response.status);
    
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
    console.error('安全观预约统计API调用失败:', error);
    return {
      success: false,
      error: error.message || '无法连接到安全观预约统计API服务',
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
  filterType?: 'wg' | 'bg'; // wg=晚归, bg=未归
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

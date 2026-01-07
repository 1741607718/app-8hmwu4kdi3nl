import { supabase } from '@/db/supabase';
import type {
  Profile,
  VehicleData,
  FireEquipmentData,
  PersonnelStats,
  SecurityStats,
  DormitoryStats,
  VisitorData,
} from '@/types/types';
import { fetchVehicleData, fetchVisitorData, type VehicleApiData } from '@/services/externalApi';

// ==================== 用户相关 ====================

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('更新用户信息失败:', error);
    return false;
  }
  return true;
}

// ==================== 车辆数据 ====================

// 将外部API数据转换为VehicleData格式
function convertApiToVehicleData(apiData: VehicleApiData[]): VehicleData[] {
  return apiData.map(item => ({
    id: Math.random() * 1000000, // 生成临时ID
    plate_number: item.cph,
    recognition_code: item.qcysdm,
    recognition_name: item.qcysmc,
    station_code: item.sbtdbm,
    station_name: item.sbtdmc,
    pass_time: item.zpsj,
    data_source: 'api',
    raw_data: item,
    created_at: new Date().toISOString(),
  }));
}

export async function getVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<VehicleData[]> {
  try {
    // 从外部API获取数据
    const result = await fetchVehicleData({
      startDate: params?.startDate,
      endDate: params?.endDate,
    });

    if (!result.success || !result.data) {
      console.error('获取车辆API数据失败:', result.error);
      return [];
    }

    // 转换API数据为内部格式
    const convertedData = convertApiToVehicleData(result.data);
    
    // 应用限制
    if (params?.limit) {
      return convertedData.slice(0, params.limit);
    }
    
    return convertedData;
  } catch (error) {
    console.error('获取车辆数据失败:', error);
    return [];
  }
}

export async function getVehicleStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; byDate: Record<string, number> }> {
  const data = await getVehicleData(params);
  
  const byDate: Record<string, number> = {};
  data.forEach(item => {
    const date = item.pass_time.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return {
    total: data.length,
    byDate,
  };
}


export async function getFireEquipmentData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<FireEquipmentData[]> {
  try {
    // 目前没有消防设备API，返回空数组
    console.warn('fetchFireSafetyData函数未实现，返回空数组');
    return [];
  } catch (error) {
    console.error('获取消防设备数据失败:', error);
    return [];
  }
}

export async function getFireEquipmentStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; normal: number; abnormal: number }> {
  const data = await getFireEquipmentData(params);
  
  const normal = data.filter(item => item.status === '正常' || item.status === '0').length;
  const abnormal = data.length - normal;

  return {
    total: data.length,
    normal,
    abnormal,
  };
}

// ==================== 人员统计 ====================

export async function getPersonnelStats(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<PersonnelStats[]> {
  let query = supabase
    .from('personnel_stats')
    .select('*')
    .order('stat_date', { ascending: false });

  if (params?.startDate) {
    query = query.gte('stat_date', params.startDate);
  }
  if (params?.endDate) {
    query = query.lte('stat_date', params.endDate);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取人员统计失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ==================== 安保统计 ====================

export async function getSecurityStats(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<SecurityStats[]> {
  let query = supabase
    .from('security_stats')
    .select('*')
    .order('stat_date', { ascending: false });

  if (params?.startDate) {
    query = query.gte('stat_date', params.startDate);
  }
  if (params?.endDate) {
    query = query.lte('stat_date', params.endDate);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取安保统计失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ==================== 宿管统计 ====================

export async function getDormitoryStats(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<DormitoryStats[]> {
  let query = supabase
    .from('dormitory_stats')
    .select('*')
    .order('stat_date', { ascending: false });

  if (params?.startDate) {
    query = query.gte('stat_date', params.startDate);
  }
  if (params?.endDate) {
    query = query.lte('stat_date', params.endDate);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取宿管统计失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ==================== 访客数据 ====================

// 将数据库记录转换为VisitorData格式
function convertDbToVisitorData(dbRecords: any[]): VisitorData[] {
  return dbRecords.map(item => ({
    id: Math.random() * 1000000, // 生成临时ID
    guid: item.GUID,
    xm: item.XM,
    lxfs: item.LXDH,
    sfzh: item.SFZH,
    dwmc: item.DWMC,
    rlsc: item.RLSC,
    lflx: item.LFLX,
    lfsy: item.LFSY,
    dfsj: item.DFSJ,
    lfsj: item.LFSJ,
    bfbm: item.BFBM,
    bfrs: item.BFRY,
    cp: item.LFCL, // 使用来访车辆字段作为车牌号
    sys_userid: item.SYS_USERID,
    sys_username: item.SYS_USERNAME,
    sys_useraccount: item.SYS_USERACCOUNT,
    sys_companyid: item.SYS_COMPANYID,
    sys_companyname: item.SYS_COMPANYNAME,
    sys_departmentid: item.SYS_DEPARTMENTID,
    sys_departmentname: item.SYS_DEPARTMENTNAME,
    sys_useremail: item.SYS_USEREMAIL,
    sys_userphone: item.SYS_USERPHONE,
    sys_jobid: item.SYS_JOBID,
    sys_jobname: item.SYS_JOBNAME,
    sys_applydate: item.SYS_APPLYDATE,
    sys_orgpath: item.SYS_ORGPATH,
    sys_applyno: item.SYS_APPLYNO,
    system_processname: item.SYSTEM_PROCESSNAME,
    system_incident: item.SYSTEM_INCIDENT,
    system_status: item.SYSTEM_STATUS,
    system_endtime: item.SYSTEM_ENDTIME,
    bfbmid: item.BFBMID,
    bfrysjh: item.BFRYSJH,
    fkth: item.FKTH,
    data_source: 'database',
    raw_data: item,
    created_at: new Date().toISOString(),
  }));
}

export async function getVisitorData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<VisitorData[]> {
  try {
    // 从外部API获取访客数据（现在通过内部代理访问数据库）
    const result = await fetchVisitorData({
      startDate: params?.startDate,
      endDate: params?.endDate,
      pageSize: params?.limit || 1000,
    });

    if (!result.success || !result.data) {
      console.error('获取访客API数据失败:', result.error);
      return [];
    }

    // 转换API数据为内部格式
    return convertDbToVisitorData(result.data);
  } catch (error) {
    console.error('获取访客数据失败:', error);
    return [];
  }
}

export async function getVisitorStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ total: number; byDate: Record<string, number> }> {
  const data = await getVisitorData(params);
  
  const byDate: Record<string, number> = {};
  data.forEach(item => {
    const date = item.dfsj ? item.dfsj.split('T')[0] : 'unknown';
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return {
    total: data.length,
    byDate,
  };
}

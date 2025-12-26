import { supabase } from '@/db/supabase';
import type {
  Profile,
  VehicleData,
  FireEquipmentData,
  PersonnelStats,
  SecurityStats,
  DormitoryStats,
} from '@/types/types';

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

export async function getVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<VehicleData[]> {
  let query = supabase
    .from('vehicle_data')
    .select('*')
    .order('pass_time', { ascending: false });

  if (params?.startDate) {
    query = query.gte('pass_time', params.startDate);
  }
  if (params?.endDate) {
    query = query.lte('pass_time', params.endDate);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取车辆数据失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
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

// ==================== 消防设备数据 ====================

export async function getFireEquipmentData(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<FireEquipmentData[]> {
  let query = supabase
    .from('fire_equipment_data')
    .select('*')
    .order('check_date', { ascending: false });

  if (params?.startDate) {
    query = query.gte('check_date', params.startDate);
  }
  if (params?.endDate) {
    query = query.lte('check_date', params.endDate);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取消防设备数据失败:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
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

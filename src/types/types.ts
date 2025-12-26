// 用户角色类型
export type UserRole = 'user' | 'admin';

// 用户配置类型
export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  role: UserRole;
  department: string | null;
  permissions: {
    canExport: boolean;
    dataScope: string[];
  };
  created_at: string;
  updated_at: string;
}

// 车辆数据类型
export interface VehicleData {
  id: number;
  plate_number: string;
  recognition_code: string | null;
  recognition_name: string | null;
  station_code: string | null;
  station_name: string | null;
  pass_time: string;
  data_source: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

// 消防设备数据类型
export interface FireEquipmentData {
  id: number;
  equipment_number: string;
  check_date: string;
  status: string | null;
  location_code: string | null;
  location_name: string | null;
  data_source: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

// 人员统计数据类型
export interface PersonnelStats {
  id: number;
  stat_date: string;
  total_count: number;
  visitor_count: number;
  flow_count: number;
  data_type: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

// 安保统计数据类型
export interface SecurityStats {
  id: number;
  stat_date: string;
  monitor_online: number;
  monitor_total: number;
  incident_count: number;
  fraud_prevention_count: number;
  data_type: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

// 宿管统计数据类型
export interface DormitoryStats {
  id: number;
  stat_date: string;
  total_residents: number;
  checked_in: number;
  checked_out: number;
  data_type: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 时间范围类型
export interface DateRange {
  from: Date;
  to: Date;
}

// 统计卡片数据类型
export interface StatCardData {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
  unit?: string;
}

// 图表数据点类型
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

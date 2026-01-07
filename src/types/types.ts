// 用户角色类型
export type UserRole = 'user' | 'admin';

// 用户配置类型
export interface Profile {
  id: string;
  username: string | null;
  name: string | null; // 真实姓名
  email: string | null;
  role: UserRole;
  department: string | null;
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

// 访客数据类型
export interface VisitorData {
  id: number;
  guid: string;
  xm?: string; // 姓名
  lxfs?: string; // 联系方式
  sfzh?: string; // 身份证号
  dwmc?: string; // 单位名称
  rlsc?: string; // 人员场所
  lflx?: string; // 来访类型
  lfsy?: string; // 来访事由
  dfsj?: string; // 到访时间
  lfsj?: string; // 离开时间
  bfbm?: string; // 受访部门
  bfrs?: string; // 受访人
  lfcl?: string; // 来访车辆
  sys_userid?: string; // 系统用户ID
  sys_username?: string; // 系统用户名
  sys_useraccount?: string; // 系统用户账号
  sys_companyid?: string; // 系统公司ID
  sys_companyname?: string; // 系统公司名称
  sys_departmentid?: string; // 系统部门ID
  sys_departmentname?: string; // 系统部门名称
  sys_useremail?: string; // 系统用户邮箱
  sys_userphone?: string; // 系统用户电话
  sys_jobid?: string; // 系统职务ID
  sys_jobname?: string; // 系统职务名称
  sys_applydate?: string; // 系统申请日期
  sys_orgpath?: string; // 系统组织路径
  sys_applyno?: string; // 系统申请编号
  system_processname?: string; // 系统流程名称
  system_incident?: string; // 系统事件
  system_status?: string; // 系统状态
  system_endtime?: string; // 系统结束时间
  bfbmid?: string; // 受访部门ID
  bfrysjh?: string; // 受访人手机号
  fkth?: string; // 访客通道
  data_source: string;
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

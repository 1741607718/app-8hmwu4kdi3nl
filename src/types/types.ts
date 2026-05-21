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
  // 模块权限
  // 0: 无权限, 1: 查看统计, 2: 查看详情, 3: 全部导出
  permissions?: {
    vehicle?: number;
    personnel?: number;
    dormitory?: number;
    fireSafety?: number;
    security?: number;
    [key: string]: number | undefined;
  };
  created_at: string;
  updated_at: string;
  last_login?: string | null;
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

// 监控设备数据类型
export interface CameraDevice {
  ID: number;
  DEVICE_CODE: string;
  DEVICE_NAME: string;
  DEVICE_CATEGORY: number;
  TYPE: string;
  IS_ONLINE: number;
  CAPABILITY_COLLECTION: string;
  OWNER_CODE: string;
  DEVICE_IP: string;
  UPDATE_TIME: string;
  raw_data: Record<string, unknown>;
}

// 监控统计数据类型
export interface CameraStats {
  onlineCount: number;
  faceRecognitionCount: number;
  totalCount: number;
  barrierGateCount: number;
}

// 校园警情数据类型
export interface CampusPoliceIncident {
  id: string;
  incident_date: string; // 警情发生日期
  incident_type: string; // 警情类型（如：治安、求助、刑事等）
  location: string; // 发生地点
  description: string; // 描述
  handler: string; // 处理人
  status: string; // 状态（待处理、处理中、已完成）
  created_at: string;
  updated_at: string;
}

// 校园警情统计数据类型
export interface CampusPoliceIncidentStats {
  total: number; // 总数
  today: number; // 今日
  thisWeek: number; // 本周
  thisMonth: number; // 本月
  thisYear: number; // 本年
  byType: Record<string, number>; // 按类型统计
  byDate: Record<string, number>; // 按日期统计
  byStatus: Record<string, number>; // 按状态统计
}

// 默认警情类型
export const DEFAULT_POLICE_INCIDENT_TYPES = [
  '治安',
  '求助',
  '刑事',
  '交通',
  '消防',
  '纠纷',
  '其他'
];

// 警情记录数据类型 (biz_jqsb)
export interface PoliceIncidentRecord {
  GUID: string;
  LB: string | null;        // 类别 (如: 校园治安情况, 交通安全巡查, 夜间巡查)
  RQ: string | null;        // 日期
  GLDW: string | null;      // 管理单位 (JSON数组)
  JQFL: string | null;      // 警情分类 (如: 交通, 刑事, 治安, 求助, 其他)
  SJ: string | null;        // 时间
  LCQY: string | null;      // 区域
  FJHCP: string | null;     // 车牌号
  FJMCCLSYR: string | null; // 当事人 (JSON数组)
  QKSM: string | null;      // 情况说明 (HTML)
  JLXZQ: string | null;     // 记录行政区
}

// 警情统计数据类型
export interface PoliceIncidentStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  byType: Record<string, number>;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
}

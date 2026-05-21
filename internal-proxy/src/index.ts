import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as https from 'https';
import mysql from 'mysql2/promise';
import * as oracledb from 'oracledb';

const app = express();
const PORT = process.env.PORT || 3003;

// 配置Oracle客户端
try {
  (oracledb as any).initOracleClient();
  console.log('Oracle客户端初始化完成 (Thick Mode)');
} catch (err) {
  console.log('Oracle客户端配置提示:', (err as Error).message);
}

// MySQL数据库连接配置
const dbConfig = {
  host: '10.145.251.29',
  port: 3306,
  user: 'dtw',
  password: 'root',
  database: 'datacenter',
  connectTimeout: 60000,
};

// 监控设备数据库连接配置 (10.14.0.102)
const cameraDbConfig = {
  host: '10.14.0.102',
  port: 3306,
  user: 'wzsxy',
  password: 'wzsxypwd',
  database: 'evo_brm',
  connectTimeout: 60000,
};

// 闸机设备数据库连接配置 (10.151.160.32)
const barrierDbConfig = {
  host: '10.151.160.32',
  port: 3306,
  user: 'wzsxy',
  password: 'wzsxy',
  database: 'evo_brm',
  connectTimeout: 60000,
};

// Oracle数据库连接配置 (主库)
const oracleConfig = {
  user: 'drcom',
  password: 'DrZJc0M',
  connectString: '172.31.6.253:1521/drcom',
};

// Oracle数据库连接配置 (第二库 - 在线用户数据补充)
const oracleConfig2 = {
  user: 'wzbc',
  password: 'wzbc',
  connectString: '10.145.251.30:1521/drcom',
};

// iduo_business 数据库连接配置 (警情统计数据)
const iduoBusinessDbConfig = {
  host: '10.151.160.149',
  port: 3306,
  user: 'iduo_data',
  password: 'Iduo@data2024',
  database: 'iduo_business',
  connectTimeout: 60000,
};

let oraclePool: oracledb.Pool | null = null;
let oraclePool2: oracledb.Pool | null = null;

async function initOraclePool() {
  try {
    oraclePool = await oracledb.createPool(oracleConfig);
    console.log('Oracle数据库连接池初始化成功 (主库)');
  } catch (error) {
    console.error('Oracle数据库连接池初始化失败 (主库):', error);
  }
  try {
    oraclePool2 = await oracledb.createPool(oracleConfig2);
    console.log('Oracle数据库连接池初始化成功 (第二库)');
  } catch (error) {
    console.error('Oracle数据库连接池初始化失败 (第二库):', error);
  }
}

initOraclePool();

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 监控设备数据库连接池
const cameraPool = mysql.createPool(cameraDbConfig);

// 闸机设备数据库连接池
const barrierPool = mysql.createPool(barrierDbConfig);

// iduo_business数据库连接池 (警情统计)
const iduoBusinessPool = mysql.createPool(iduoBusinessDbConfig);

// 教职工工号缓存（从MySQL人事表加载，用于判断在线用户类型）
let staffIdSet = new Set<string>();
let staffIdCacheLoaded = false;

async function loadStaffIdCache() {
  try {
    const [rows] = await pool.execute("SELECT bh FROM t_rs_grzhxx");
    staffIdSet = new Set((rows as any[]).map((r: any) => r.bh));
    staffIdCacheLoaded = true;
    console.log(`[教职工工号缓存] 加载成功，共 ${staffIdSet.size} 个工号`);
  } catch (err) {
    console.error('[教职工工号缓存] 加载失败:', err);
    staffIdCacheLoaded = false;
  }
}

// 启动时加载，每10分钟刷新一次
loadStaffIdCache();
setInterval(loadStaffIdCache, 10 * 60 * 1000);

// 中间件
app.use(express.json());
app.use(cors());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[Proxy] ${new Date().toISOString()} ${req.method} ${req.url} - Request received`);
  // 记录请求头信息，特别是可能影响路由的头信息
  console.log(`[Proxy] Headers: ${JSON.stringify(req.headers, null, 2)}`);
  next();
});

// API配置 - 从Python测试脚本获取的配置
const API_CONFIGS = {
  traffic_flow_speed: {
    url: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
    applyId: '40664926031250432',
    secretKey: '6bbfe313481a41d7882e7db89a467b7d'
  },
  vehicle_registration: {
    url: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz',
    applyId: '40664926031250432',
    secretKey: '6bbfe313481a41d7882e7db89a467b7d'
  }
  // Note: visitor_data is now handled directly from database, not external API
};

// ==================== 车辆登记信息缓存（按车牌批量查询加速） ====================
type VisitorCacheEntry = {
  timestamp: number;
  byPlate: Record<string, { xm?: string; lxdh?: string; sfzh?: string }>;
};

let visitorCache: VisitorCacheEntry | null = null;
let visitorCacheUpdating = false;

async function ensureVisitorCacheFresh() {
  const now = Date.now();
  const ttlMs = 10 * 60 * 1000; // 10分钟

  if (visitorCache && now - visitorCache.timestamp < ttlMs) {
    return;
  }

  if (visitorCacheUpdating) {
    return; // 不阻塞请求，直接返回旧缓存或空
  }

  visitorCacheUpdating = true;
  try {
    console.log('[VisitorCache] Refreshing from database...');
    // 优化：减少查询字段，只缓存需要的信息
    const result = await fetchVisitorDataFromDatabase({ filterVehicle: true, pageSize: 5000 });
    const rows = result.success && Array.isArray(result.data) ? result.data : [];

    const byPlate: Record<string, { xm?: string; lxdh?: string; sfzh?: string }> = {};
    for (const r of rows) {
      const plate = (r?.cp || r?.CP || r?.lfcl || r?.LFCL || '').toString().trim();
      if (!plate) continue;
      byPlate[plate] = {
        xm: r?.xm ?? r?.XM,
        lxdh: r?.lxdh ?? r?.LXDH,
        sfzh: r?.sfzh ?? r?.SFZH,
      };
    }

    visitorCache = { timestamp: Date.now(), byPlate };
    console.log(`[VisitorCache] Ready: ${Object.keys(byPlate).length} plates`);
  } catch (e) {
    console.error('[VisitorCache] Refresh failed:', e);
  } finally {
    visitorCacheUpdating = false;
  }
}

type VehicleRegistrationCacheEntry = {
  timestamp: number;
  byPlate: Record<string, { xm?: string; bm?: string; cllx?: string }>;
};

let vehicleRegistrationCache: VehicleRegistrationCacheEntry | null = null;
let vehicleRegistrationCacheUpdating = false;

async function ensureVehicleRegistrationCacheFresh() {
  const now = Date.now();
  const ttlMs = 10 * 60 * 1000; // 10分钟

  if (vehicleRegistrationCache && now - vehicleRegistrationCache.timestamp < ttlMs) {
    return;
  }

  if (vehicleRegistrationCacheUpdating) {
    return; // 不阻塞请求，直接返回旧缓存
  }

  vehicleRegistrationCacheUpdating = true;
  try {
    console.log('[VehicleRegistrationCache] Refreshing from external API...');
    const result = await fetchAllApiData('vehicle_registration', { maxPages: 200 });
    const rows = result.success && Array.isArray(result.data) ? result.data : [];

    const byPlate: Record<string, { xm?: string; bm?: string; cllx?: string }> = {};
    for (const r of rows) {
      const plate = (r?.cp || r?.CP || '').toString().trim();
      if (!plate) continue;
      byPlate[plate] = {
        xm: r?.xm ?? r?.XM,
        bm: r?.bm ?? r?.BM,
        cllx: r?.cllx ?? r?.CLLX,
      };
    }

    vehicleRegistrationCache = { timestamp: Date.now(), byPlate };
    console.log(`[VehicleRegistrationCache] Ready: ${Object.keys(byPlate).length} plates`);
  } catch (e) {
    console.error('[VehicleRegistrationCache] Refresh failed:', e);
  } finally {
    vehicleRegistrationCacheUpdating = false;
  }
}

// 车辆API数据类型
interface VehicleApiData {
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

// 车辆登记API数据类型
interface VehicleRegistrationApiData {
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
interface VisitorApiData {
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

// 访客入校API数据类型
interface VisitorEntryApiData {
  guid: string;
  xm?: string; // 访客姓名 (LFRXM)
  smsj?: string; // 入校时间 (SMSJ)
  lxdh?: string; // 联系电话 (LFRSJHM)
  sfzh?: string; // 身份证号 (LFRSFZH)
  smrxm?: string; // 扫码人姓名 (SMRXM)
  raw_data: any;
}

// API响应类型
interface ExternalApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  hasMore?: boolean;
  page?: number;
  pageSize?: number;
  inCount?: number;
  outCount?: number;
}

// 分页相关常量
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const FAST_PREVIEW_SIZE = 20;

// 辅助函数：格式化日期为 yyyy-MM-dd
function formatDate(dateString: string): string {
  if (!dateString) return '';
  // 假设输入是 "2025-12-21T00:00:00" 或类似格式
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 辅助函数：将日期字符串转换为时间范围
function convertDateToRange(dateStr: string): { start: string, end: string } {
  // 如果日期字符串包含时间部分，则直接使用
  if (dateStr.includes(' ')) {
    return { start: dateStr, end: dateStr };
  }
  
  // 如果只有日期部分 (YYYY-MM-DD)，转换为当日00:00:00到23:59:59
  return { 
    start: `${dateStr} 00:00:00`, 
    end: `${dateStr} 23:59:59` 
  };
}

/**
 * 调用API通用函数
 */
async function fetchApiData(apiName: keyof typeof API_CONFIGS, params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  previewOnly?: boolean;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    const config = API_CONFIGS[apiName];
    const requestedSize = params?.previewOnly ? FAST_PREVIEW_SIZE : (params?.pageSize || DEFAULT_PAGE_SIZE);
    const safePageSize = Math.min(Math.max(requestedSize, 1), MAX_PAGE_SIZE);

    const queryObj: any = {
      page: params?.page || 1,
      pagesize: safePageSize
    };

    let dateField = 'zpsj';
    if (apiName === 'vehicle_registration') dateField = 'djrq';

    if (params?.startDate && params?.endDate) {
      queryObj.params = {
        field: [
          { relation: 'and', logic: '>=', value: params.startDate, format: "to_char(field,'yyyy-mm-dd')", resetField: `to_char(${dateField},'yyyy-mm-dd')` },
          { relation: 'and', logic: '<=', value: params.endDate, format: "to_char(field,'yyyy-mm-dd')", resetField: `to_char(${dateField},'yyyy-mm-dd')` },
        ]
      };
    } else if (apiName !== 'vehicle_registration') {
      // 车辆登记API不需要默认日期筛选，其他API默认查最近3天
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const startDateStr = threeDaysAgo.toISOString().split('T')[0];
      const endDateStr = new Date().toISOString().split('T')[0];
      queryObj.params = {
        field: [
          { relation: 'and', logic: '>=', value: startDateStr, format: "to_char(field,'yyyy-mm-dd')", resetField: `to_char(${dateField},'yyyy-mm-dd')` },
          { relation: 'and', logic: '<=', value: endDateStr, format: "to_char(field,'yyyy-mm-dd')", resetField: `to_char(${dateField},'yyyy-mm-dd')` },
        ]
      };
    }

    // 创建HTTPS agent以处理SSL证书问题
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await axios.post(`${config.url}`, queryObj, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        applyId: config.applyId,
        secretKey: config.secretKey,
        'User-Agent': 'Mozilla/5.0 (compatible; InternalProxy/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
      httpsAgent,
    });

    if (response.status === 200 && response.data?.status === 200) {
      const pageData = response.data?.data?.Rows || [];
      const totalCount = response.data?.total || response.data?.data?.Total || 0;
      const hasMore = queryObj.page * queryObj.pagesize < totalCount;

        return { success: true, data: pageData, total: totalCount, hasMore, page: queryObj.page, pageSize: queryObj.pagesize };
    }

    return { success: false, error: response.data?.msg || 'API调用失败' };
  } catch (error: any) {
    console.error('API调用错误:', error);
    return { success: false, error: error.message || 'API调用失败' };
  }
}

/**
 * 获取车辆数据统计信息
 */
async function fetchVehicleStats(params?: {
  startDate?: string;
  endDate?: string;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<{ total: number; byDate: Record<string, number>; byLocation?: Record<string, number>; maxSpeedByLocation?: Record<string, number> }>> {
  return await fetchVehicleStatsFromDatabase(params);
}

/**
 * 获取访客数据统计信息（从数据库获取）
 */
async function fetchVisitorStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{ total: number; byDate: Record<string, number> }>> {
  return await fetchVisitorStatsFromDatabase(params);
}

/*
 * 获取所有指定类型的数据（支持分页获取全部数据）
 */
async function fetchAllApiData(apiName: keyof typeof API_CONFIGS, params?: {
  startDate?: string;
  endDate?: string;
  maxPages?: number; // 最大页数限制，默认为20
}): Promise<ExternalApiResponse<any[]>> {
  try {
    const config = API_CONFIGS[apiName];
    
    // 构建查询参数
    let queryObj: any = {
      page: 1,
      pagesize: 100 // 使用较小的页面大小以避免单次请求过大
    };

    // 如果有日期范围参数，添加到查询中
    if (params?.startDate && params?.endDate) {
      // 根据API类型确定正确的日期字段
      let dateField = "zpsj"; // 默认为车流量API的日期字段
      if (apiName === 'vehicle_registration') {
        dateField = "djrq"; // 车辆登记API的日期字段
      }
      
      queryObj.params = {
        field: [
          {
            relation: "and",
            logic: ">=",
            value: params.startDate, // 保持原始日期格式 (YYYY-MM-DD)
            format: "to_char(field,'yyyy-mm-dd')",
            resetField: `to_char(${dateField},'yyyy-mm-dd')` // 使用正确的日期字段，提取日期部分进行比较
          },
          {
            relation: "and",
            logic: "<=",
            value: params.endDate, // 保持原始日期格式 (YYYY-MM-DD)
            format: "to_char(field,'yyyy-mm-dd')",
            resetField: `to_char(${dateField},'yyyy-mm-dd')` // 使用正确的日期字段，提取日期部分进行比较
          }
        ]
      };
    }

    console.log(`${apiName} 全量API查询参数:`, queryObj);

    // 创建HTTPS agent以处理SSL证书问题
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // 获取所有相关数据
    let allData: any[] = [];
    let currentPage = 1;
    let hasMoreData = true;
    
    // 为防止无限翻页，设置最大页数限制
    const maxPages = params?.maxPages || 20; // 默认最大页数限制

    // 循环获取数据
    while (hasMoreData && currentPage <= maxPages) {
      const pageQueryObj = { ...queryObj, page: currentPage, pagesize: queryObj.pagesize };
      
      const response = await axios.post(`${config.url}`, pageQueryObj, {
        timeout: 30000, // 增加超时时间到30秒
        headers: {
          'Content-Type': 'application/json',
          'applyId': config.applyId,
          'secretKey': config.secretKey,
          'User-Agent': 'Mozilla/5.0 (compatible; InternalProxy/1.0)',
          'Accept': 'application/json, text/plain, */*',
        },
        httpsAgent: httpsAgent
      });

      console.log(`${apiName} 全量API查询响应数据量 (第${currentPage}页):`, response.data?.data?.Rows?.length || 0);
      console.log(`${apiName} 全量API查询响应状态:`, response.status);

      if (response.status === 200 && response.data?.status === 200) {
        const pageData = response.data?.data?.Rows || [];
        console.log(`${apiName} 全量API第${currentPage}页实际返回数据量:`, pageData.length);
        
        if (pageData.length > 0) {
          // 调试日志：打印第一条数据和日期范围
          if (currentPage === 1) {
            console.log(`${apiName} 第一条数据示例:`, JSON.stringify(pageData[0]));
            const dates = pageData.map((d: any) => d.djrq || d.zpsj).filter(Boolean).sort();
            if (dates.length > 0) {
              console.log(`${apiName} 第1页日期范围: ${dates[0]} ~ ${dates[dates.length - 1]}`);
            }
          }

          allData = allData.concat(pageData);
          
          // 如果返回的数据量小于页面大小，说明没有更多数据了
          if (pageData.length < queryObj.pagesize) {
            hasMoreData = false;
            console.log(`${apiName} 全量API在第${currentPage}页检测到数据结束`);
          } else {
            // 继续获取下一页
            currentPage++;
          }
        } else {
          // 如果当前页没有数据，停止翻页
          hasMoreData = false;
          console.log(`${apiName} 全量API在第${currentPage}页没有更多数据`);
        }
      } else {
        console.log(`${apiName} 全量API返回错误, 状态:`, response.status, '消息:', response.data?.msg || '无消息');
        break; // 遇到错误时停止
      }
      
      // 防止请求过于频繁，短暂延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (currentPage > maxPages) {
      console.log(`${apiName} 全量API达到最大页数限制(${maxPages}页)，停止翻页`);
      console.log(`⚠️ 警告: ${apiName} 数据可能不完整，达到最大页数限制`);
    }

    return {
      success: true,
      data: allData,
      total: allData.length,
    };
  } catch (error: any) {
    console.error(`${apiName} 全量API调用失败:`, error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
      console.error('响应状态:', error.response.status);
      console.error('响应头:', error.response.headers);
    } else if (error.request) {
      console.error('请求数据:', error.request);
    } else {
      console.error('错误信息:', error.message);
    }
    return {
      success: false,
      error: error.message || 'API调用失败',
    };
  }
}

/*
 * 调用车辆管理API - 车速和车流量数据
 */
async function fetchVehicleData(params?: { startDate?: string; endDate?: string; page?: number; pageSize?: number; previewOnly?: boolean; }): Promise<ExternalApiResponse<VehicleApiData[]>> {
  return await fetchVehicleDataFromDatabase(params);
}

/*
 * 调用车辆登记API - 车辆登记信息
 */
async function fetchVehicleRegistrationData(params?: { startDate?: string; endDate?: string; page?: number; pageSize?: number; previewOnly?: boolean; }): Promise<ExternalApiResponse<VehicleRegistrationApiData[]>> {
  return await fetchApiData('vehicle_registration', params);
}

/**
 * 调用访客API - 访客数据（从数据库获取）
 */
async function fetchVisitorData(params?: { startDate?: string; endDate?: string; page?: number; pageSize?: number; previewOnly?: boolean; }): Promise<ExternalApiResponse<VisitorApiData[]>> {
  return await fetchVisitorDataFromDatabase(params);
}

async function fetchAllVehicleData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  // 直接调用数据库查询，支持分页参数
  return await fetchVehicleDataFromDatabase({
    ...params,
    // 如果没有指定pageSize，默认给一个较小的值用于分页
    pageSize: params?.pageSize || 100,
    speedingOnly: params?.speedingOnly
  });
}

async function fetchAllVehicleRegistrationData(params?: {
  startDate?: string;
  endDate?: string;
  maxPages?: number;
}): Promise<ExternalApiResponse<VehicleRegistrationApiData[]>> {
  return await fetchAllApiData('vehicle_registration', params);
}

async function fetchAllVisitorData(params?: {
  startDate?: string;
  endDate?: string;
  maxPages?: number;
}): Promise<ExternalApiResponse<VisitorApiData[]>> {
  return await fetchAllVisitorDataFromDatabase(params);
}

// 内存缓存类
class VehicleCache {
  private static instance: VehicleCache;
  private data: VehicleApiData[] = [];
  private lastUpdated: Date | null = null;
  private isUpdating: boolean = false;

  private constructor() {}

  public static getInstance(): VehicleCache {
    if (!VehicleCache.instance) {
      VehicleCache.instance = new VehicleCache();
    }
    return VehicleCache.instance;
  }

  public getData(): VehicleApiData[] {
    return this.data;
  }

  public getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  public async updateData(startDate?: string, endDate?: string) {
    if (this.isUpdating) {
      console.log('车辆数据同步正在进行中，跳过本次请求');
      return;
    }
    this.isUpdating = true;
    console.log('开始同步车辆数据...');

    try {
      // 获取最近3天的数据作为默认
      if (!startDate || !endDate) {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        startDate = threeDaysAgo.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
      }

      // 使用较大的maxPages以获取更多数据
      const result = await fetchAllApiData('traffic_flow_speed', { startDate, endDate, maxPages: 100 });

      if (result.success && result.data) {
        this.data = result.data;
        this.lastUpdated = new Date();
        console.log(`车辆数据缓存已更新。总记录数: ${this.data.length}`);
      }
    } catch (error) {
      console.error('更新车辆缓存失败:', error);
    } finally {
      this.isUpdating = false;
    }
  }
}

// 初始化缓存并开始后台同步
const vehicleCache = VehicleCache.getInstance();
// 启动时立即同步一次
// vehicleCache.updateData();
// 每10分钟同步一次
// setInterval(() => {
//   vehicleCache.updateData();
// }, 10 * 60 * 1000);

// API路由
app.get('/api/vehicle', async (req: Request, res: Response) => {
  console.log(`[API] /api/vehicle route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.query;
    const result = await fetchVehicleData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      previewOnly: previewOnly === 'true',
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.body;
    const result = await fetchVehicleData({
      startDate,
      endDate,
      page: page || 1,
      pageSize,
      previewOnly: !!previewOnly,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增车辆统计API路由（合并南北校区数据）
app.get('/api/vehicle-stats', async (req: Request, res: Response) => {
  console.log(`[API] /api/vehicle-stats route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, speedingOnly } = req.query;
    const isSpeedingOnly = speedingOnly === 'true';

    // 获取测速设备统计数据（已包含车流量+超速组合数据）
    const statsResult = await fetchVehicleStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      speedingOnly: isSpeedingOnly,
    });

    if (!statsResult.success) {
      console.error('获取车辆统计失败:', statsResult.error);
      res.status(500).json({ error: statsResult.error });
      return;
    }

    // 向后兼容：如果请求超速-only，返回旧格式
    if (isSpeedingOnly) {
      const sd = statsResult.data!;
      res.json({
        total: sd.speedingCount,
        byDate: sd.speedingByDate,
        byLocation: sd.speedingByLocation,
        maxSpeedByLocation: sd.maxSpeedByLocation,
      });
      return;
    }

    // 普通统计：合并闸机数据（park_camerasnap）用于出入车辆统计
    const gateResult = await fetchGateVehicleDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      includeAggregates: true,
    });

    const gateData = gateResult.success ? gateResult.data! : { total: 0, byDate: {}, byLocation: {}, data: [] };

    // 定义北校区闸机通道
    const northGateLocations = ['北入口'];

    // 按地点分类
    let southGateTotal = 0;
    let northGateTotal = 0;
    const southGateByLocation: Record<string, number> = {};
    const northGateByLocation: Record<string, number> = {};

    Object.entries(gateData.byLocation).forEach(([location, count]) => {
      const countNum = Number(count) || 0;
      if (northGateLocations.some(northLoc => location.includes(northLoc))) {
        northGateByLocation[location] = countNum;
        northGateTotal += countNum;
      } else {
        southGateByLocation[location] = countNum;
        southGateTotal += countNum;
      }
    });

    // 直接查询 park_camerasnap 按校区+日期聚合（替代从明细数据提取）
    let snapBaseQuery = 'FROM park_camerasnap WHERE 1=1';
    const snapParams: any[] = [];
    if (typeof startDate === 'string' && typeof endDate === 'string') {
      const startDateRange = convertDateToRange(startDate);
      const endDateRange = convertDateToRange(endDate);
      snapBaseQuery += ' AND snap_time BETWEEN ? AND ?';
      snapParams.push(startDateRange.start, endDateRange.end);
    }

    const campusDateQuery = `
      SELECT 
        DATE(snap_time) as date,
        snap_channel_name as channel,
        COUNT(*) as cnt
      ${snapBaseQuery}
      GROUP BY DATE(snap_time), snap_channel_name
    `;
    const [campusDateRows] = await pool.execute(campusDateQuery, snapParams);

    const southGateByDate: Record<string, number> = {};
    const northGateByDate: Record<string, number> = {};

    (campusDateRows as any[]).forEach((row: any) => {
      const channel = row.channel || '';
      const dateRaw = row.date;
      let dateStr: string;
      if (dateRaw instanceof Date) {
        dateStr = `${dateRaw.getFullYear()}-${String(dateRaw.getMonth() + 1).padStart(2, '0')}-${String(dateRaw.getDate()).padStart(2, '0')}`;
      } else {
        dateStr = dateRaw ? dateRaw.toString().substring(0, 10) : 'unknown';
      }
      const cnt = parseInt(row.cnt) || 0;
      if (northGateLocations.some(nl => channel.includes(nl))) {
        northGateByDate[dateStr] = (northGateByDate[dateStr] || 0) + cnt;
      } else {
        southGateByDate[dateStr] = (southGateByDate[dateStr] || 0) + cnt;
      }
    });

    // 查询出入数据（park_car_in 入校 + park_car_out 出校）按校区拆分
    let inBaseQuery = 'FROM park_car_in WHERE 1=1';
    const inParams: any[] = [];
    if (typeof startDate === 'string' && typeof endDate === 'string') {
      const startDateRange = convertDateToRange(startDate);
      const endDateRange = convertDateToRange(endDate);
      inBaseQuery += ' AND in_time BETWEEN ? AND ?';
      inParams.push(startDateRange.start, endDateRange.end);
    }

    const inByCampusQuery = `
      SELECT 
        SUM(CASE WHEN snap_channel_name IN (${northGateLocations.map(() => '?').join(',')}) THEN 1 ELSE 0 END) as north_in,
        SUM(CASE WHEN snap_channel_name NOT IN (${northGateLocations.map(() => '?').join(',')}) THEN 1 ELSE 0 END) as south_in
      FROM park_car_in i
      LEFT JOIN park_camerasnap c ON i.car_no = c.car_no 
        AND c.snap_time >= DATE(i.in_time) 
        AND c.snap_time < DATE_ADD(DATE(i.in_time), INTERVAL 1 DAY)
      ${inBaseQuery.replace('FROM park_car_in WHERE 1=1', 'WHERE 1=1')}
    `;
    const inQueryParams = [...northGateLocations, ...northGateLocations, ...inParams];
    const [inRows] = await pool.execute(inByCampusQuery, inQueryParams);
    const inData = (inRows as any[])[0] || {};
    const southIn = parseInt(inData.south_in) || 0;
    const northIn = parseInt(inData.north_in) || 0;

    let outBaseQuery = 'FROM park_car_out WHERE 1=1';
    const outParams: any[] = [];
    if (typeof startDate === 'string' && typeof endDate === 'string') {
      const startDateRange = convertDateToRange(startDate);
      const endDateRange = convertDateToRange(endDate);
      outBaseQuery += ' AND out_time BETWEEN ? AND ?';
      outParams.push(startDateRange.start, endDateRange.end);
    }

    const outByCampusQuery = `
      SELECT 
        SUM(CASE WHEN snap_channel_name IN (${northGateLocations.map(() => '?').join(',')}) THEN 1 ELSE 0 END) as north_out,
        SUM(CASE WHEN snap_channel_name NOT IN (${northGateLocations.map(() => '?').join(',')}) THEN 1 ELSE 0 END) as south_out
      FROM park_car_out o
      LEFT JOIN park_camerasnap c ON o.out_car_no = c.car_no 
        AND c.snap_time >= DATE(o.out_time) 
        AND c.snap_time < DATE_ADD(DATE(o.out_time), INTERVAL 1 DAY)
      ${outBaseQuery.replace('FROM park_car_out WHERE 1=1', 'WHERE 1=1')}
    `;
    const outQueryParams = [...northGateLocations, ...northGateLocations, ...outParams];
    const [outRows] = await pool.execute(outByCampusQuery, outQueryParams);
    const outData = (outRows as any[])[0] || {};
    const southOut = parseInt(outData.south_out) || 0;
    const northOut = parseInt(outData.north_out) || 0;

    // 合并按日期统计
    const mergedByDate: Record<string, number> = {};
    Object.entries(southGateByDate).forEach(([date, count]) => {
      mergedByDate[date] = (mergedByDate[date] || 0) + count;
    });
    Object.entries(northGateByDate).forEach(([date, count]) => {
      mergedByDate[date] = (mergedByDate[date] || 0) + count;
    });

    // 合并按地点统计
    const mergedByLocation: Record<string, number> = {};
    Object.entries(southGateByLocation).forEach(([location, count]) => {
      mergedByLocation[`[南校区] ${location}`] = count;
    });
    Object.entries(northGateByLocation).forEach(([location, count]) => {
      mergedByLocation[`[北校区] ${location}`] = count;
    });

    // 按卡口统计出入数据
    const gateBreakdown = await fetchGateBreakdownFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    // 从 gateBreakdown 计算 southIn/southOut/northIn/northOut
    let southIn2 = 0, southOut2 = 0, northIn2 = 0, northOut2 = 0;
    if (gateBreakdown) {
      for (const [gateName, data] of Object.entries(gateBreakdown)) {
        if (data.campus === 'south') {
          southIn2 += data.in;
          southOut2 += data.out;
        } else {
          northIn2 += data.in;
          northOut2 += data.out;
        }
      }
    }

    // 返回合并后的数据（包含测速设备的车流量+超速组合数据）
    const sd = statsResult.data!;
    res.json({
      // 闸机数据（出入车辆）
      gateTotal: southGateTotal + northGateTotal,
      gateByDate: mergedByDate,
      gateByLocation: mergedByLocation,
      // 校区出入明细（从卡口数据汇总）
      southIn: southIn2,
      southOut: southOut2,
      northIn: northIn2,
      northOut: northOut2,
      // 卡口出入明细
      gateBreakdown,
      byCampus: {
        south: {
          total: southGateTotal,
          byDate: southGateByDate,
          byLocation: southGateByLocation,
        },
        north: {
          total: northGateTotal,
          byDate: northGateByDate,
          byLocation: northGateByLocation,
        }
      },
      // 测速设备数据（车流量+超速）
      trafficTotal: sd.total,
      speedingCount: sd.speedingCount,
      speedingRate: sd.speedingRate,
      trafficByDate: sd.byDate,
      speedingByDate: sd.speedingByDate,
      trafficByLocation: sd.byLocation,
      speedingByLocation: sd.speedingByLocation,
      maxSpeedByLocation: sd.maxSpeedByLocation,
    });
  } catch (error: any) {
    console.error('获取车辆统计失败:', error);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增闸机车辆数据API路由
app.get('/api/gate-vehicle', async (req: Request, res: Response) => {
  console.log(`[API] /api/gate-vehicle route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchGateVehicleDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) res.json(result.data); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    console.error('获取闸机车辆数据失败:', error);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增访客统计API路由
app.get('/api/visitor-stats', async (req: Request, res: Response) => {
  console.log(`[API] /api/visitor-stats route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate } = req.query;

    const result = await fetchVisitorStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    if (result.success) {
      res.json(result.data);
    } else {
      console.error('获取访客统计失败:', result.error);
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('获取访客统计失败:', error);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增车辆登记信息API路由
app.get('/api/vehicle-registration', async (req: Request, res: Response) => {
  console.log(`[API] /api/vehicle-registration route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.query;
    const result = await fetchVehicleRegistrationData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      previewOnly: previewOnly === 'true',
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-registration', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.body;
    const result = await fetchVehicleRegistrationData({
      startDate,
      endDate,
      page: page || 1,
      pageSize,
      previewOnly: !!previewOnly,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 按车牌批量获取车辆登记信息（用于前端明细表关联，避免每次全量拉取）
app.post('/api/vehicle-registration/by-plates', async (req: Request, res: Response) => {
  try {
    const platesRaw = (req.body?.plates || []) as unknown;
    const plates = Array.isArray(platesRaw)
      ? Array.from(new Set(platesRaw.map((p: any) => (p || '').toString().trim()).filter(Boolean)))
      : [];

    if (plates.length === 0) {
      res.json({ success: true, data: {} });
      return;
    }

    // 简单限制，防止一次性传入过多
    if (plates.length > 500) {
      res.status(400).json({ success: false, error: 'plates 数量过多（最多500）' });
      return;
    }

    await ensureVehicleRegistrationCacheFresh();
    const byPlate = vehicleRegistrationCache?.byPlate || {};

    const result: Record<string, { xm?: string; bm?: string; cllx?: string }> = {};
    for (const plate of plates) {
      if (byPlate[plate]) {
        result[plate] = byPlate[plate];
      }
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('按车牌批量获取车辆登记信息失败:', error);
    res.status(500).json({ success: false, error: error.message || '内部服务器错误' });
  }
});

// 新增访客数据API路由
app.get('/api/visitor', async (req: Request, res: Response) => {
  console.log(`[API] /api/visitor route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.query;
    const result = await fetchVisitorData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      previewOnly: previewOnly === 'true',
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/visitor', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, previewOnly } = req.body;
    const result = await fetchVisitorData({
      startDate,
      endDate,
      page: page || 1,
      pageSize,
      previewOnly: !!previewOnly,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增全量车辆数据API路由
app.get('/api/vehicle-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, speedingOnly } = req.query;
    const result = await fetchAllVehicleData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
      speedingOnly: speedingOnly === 'true',
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, speedingOnly } = req.body;
    const result = await fetchAllVehicleData({
      startDate,
      endDate,
      page: page || 1,
      pageSize: pageSize || 100,
      speedingOnly: !!speedingOnly,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增全量车辆登记数据API路由
app.get('/api/vehicle-registration-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchAllVehicleRegistrationData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      maxPages: 20
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-registration-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.body;
    const result = await fetchAllVehicleRegistrationData({
      startDate,
      endDate,
      maxPages: 20
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 车辆登记数据库API - 返回所有数据（不分页）
app.get('/api/vehicle-registration-all-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchAllVehicleRegistrationData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      maxPages: 100
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-registration-all-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    const result = await fetchAllVehicleRegistrationData({
      startDate,
      endDate,
      maxPages: 100
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 车辆登记数据库API - 支持分页
app.get('/api/vehicle-registration-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchVehicleRegistrationData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 20
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-registration-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.body;
    const result = await fetchVehicleRegistrationData({
      startDate,
      endDate,
      page: page || 1,
      pageSize: pageSize || 20
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增全量访客数据API路由
app.get('/api/visitor-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, maxPages } = req.query;
    const result = await fetchAllVisitorData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      maxPages: maxPages ? parseInt(maxPages as string) : 20,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/visitor-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, maxPages } = req.body;
    const result = await fetchAllVisitorData({
      startDate,
      endDate,
      maxPages: maxPages || 20,
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 从MySQL数据库获取车辆通行数据
async function fetchVehicleDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  speedingOnly?: boolean; // 是否只获取超速数据
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  try {
    console.log('从MySQL数据库获取车辆通行数据，参数:', params);

    let query = 'SELECT * FROM t_zj_cltxjl WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM t_zj_cltxjl WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND zpsj BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND zpsj >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND zpsj <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    // 超速过滤
    if (params?.speedingOnly) {
      const speedCondition = ' AND cs > 30';
      query += speedCondition;
      countQuery += speedCondition;
    }

    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);

    // 明细分页：只 COUNT + LIMIT/OFFSET（按天/按地点聚合请走 fetchVehicleStatsFromDatabase）
    console.log('执行总数查询:', countQuery);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? Number((countRows[0] as any).total) : 0;
    console.log('总记录数:', total);

    query += ` ORDER BY zpsj DESC LIMIT ${pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    const [rows] = await pool.execute(query, queryParams);

    const result = Array.isArray(rows) ? rows : [];

    // 映射字段
    await ensureVehicleRegistrationCacheFresh();
    await ensureVisitorCacheFresh();
    const regCache = vehicleRegistrationCache?.byPlate || {};
    const visCache = visitorCache?.byPlate || {};
    
    const mappedResult = result.map((row: any) => {
      const plate = row.cph || '';
      const regInfo = regCache[plate];
      const visInfo = visCache[plate];
      
      // 优先使用车辆登记信息（校内车），其次使用访客信息（访客车）
      const info = regInfo || visInfo || {};
      
      return {
        cph: row.cph,
        qcysmc: row.qcysmc,
        sbtdmc: row.sbtdmc,
        zpsj: row.zpsj,
        cs: row.cs,
        // 关联信息
        ownerName: info.xm || '-',
        unit: info.bm || '-',
        cllx: regInfo?.cllx || '-',
      };
    });

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize
    };
  } catch (error) {
    console.error('从数据库获取车辆通行数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取车辆统计数据
async function fetchVehicleStatsFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<{
  total: number;
  speedingCount: number;
  speedingRate: number;
  byDate: Record<string, number>;
  speedingByDate: Record<string, number>;
  byLocation: Record<string, number>;
  speedingByLocation: Record<string, number>;
  maxSpeedByLocation?: Record<string, number>;
}>> {
  try {
    console.log('从MySQL数据库获取车辆统计数据，参数:', params);

    let baseQuery = 'FROM t_zj_cltxjl WHERE 1=1';
    const queryParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND zpsj BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      baseQuery += ' AND zpsj >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND zpsj <= ?';
      queryParams.push(endDateRange.end);
    }

    // 超速过滤（向后兼容）
    if (params?.speedingOnly) {
      baseQuery += ' AND cs > 30';
    }

    // 并行执行查询
    const queries: Promise<any>[] = [];

    // 1. 总数查询（所有记录）
    const totalCountQuery = 'SELECT COUNT(*) as total ' + baseQuery;
    queries.push(pool.execute(totalCountQuery, queryParams));

    // 2. 超速总数查询
    const speedingCountQuery = baseQuery.includes('cs > 30')
      ? totalCountQuery
      : 'SELECT COUNT(*) as speeding_count ' + baseQuery + ' AND cs > 30';
    queries.push(pool.execute(speedingCountQuery, queryParams));

    // 3. 按日期统计（同时返回总流量和超速数）
    const dateQuery = `
      SELECT 
        DATE(zpsj) as date,
        COUNT(*) as total,
        SUM(CASE WHEN cs > 30 THEN 1 ELSE 0 END) as speeding_count
      ${baseQuery}
      GROUP BY DATE(zpsj)
    `;
    queries.push(pool.execute(dateQuery, queryParams));

    // 4. 按地点统计（同时返回总流量、超速数和最高车速）
    const locationQuery = `
      SELECT 
        sbtdmc as location,
        COUNT(*) as total,
        SUM(CASE WHEN cs > 30 THEN 1 ELSE 0 END) as speeding_count,
        MAX(cs) as max_speed
      ${baseQuery}
      GROUP BY sbtdmc
    `;
    queries.push(pool.execute(locationQuery, queryParams));

    console.log('并行执行统计查询...');
    const results = await Promise.all(queries);

    const [totalCountRows] = results[0] as any;
    const [speedingCountRows] = results[1] as any;
    const [dateRows] = results[2] as any;
    const [locationRows] = results[3] as any;

    const total = Array.isArray(totalCountRows) && totalCountRows.length > 0 ? (totalCountRows[0] as any).total : 0;
    const speedingCount = Array.isArray(speedingCountRows) && speedingCountRows.length > 0
      ? (speedingCountRows[0] as any).speeding_count || (speedingCountRows[0] as any).total
      : 0;
    const speedingRate = total > 0 ? Math.round((speedingCount / total) * 10000) / 100 : 0;

    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    const locationResult = Array.isArray(locationRows) ? locationRows : [];

    const byDate: Record<string, number> = {};
    const speedingByDate: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const speedingByLocation: Record<string, number> = {};
    const maxSpeedByLocation: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      let dateStr = date;
      if (row.date instanceof Date) {
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      byDate[dateStr] = parseInt(row.total) || 0;
      speedingByDate[dateStr] = parseInt(row.speeding_count) || 0;
    });

    locationResult.forEach((row: any) => {
      const location = row.location || '未知地点';
      const totalCount = parseInt(row.total) || 0;
      const speeding = parseInt(row.speeding_count) || 0;
      const maxSpeed = parseInt(row.max_speed) || 0;

      byLocation[location] = totalCount;
      speedingByLocation[location] = speeding;
      maxSpeedByLocation[location] = maxSpeed;
    });

    console.log(`车辆统计数据: 总数=${total}, 超速=${speedingCount}, 超速率=${speedingRate}%, 日期分布=${Object.keys(byDate).length}天, 地点分布=${Object.keys(byLocation).length}个`);

    return {
      success: true,
      data: {
        total: Number(total),
        speedingCount: Number(speedingCount),
        speedingRate,
        byDate,
        speedingByDate,
        byLocation,
        speedingByLocation,
        maxSpeedByLocation
      }
    };
  } catch (error) {
    console.error('从数据库获取车辆统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取闸机车辆数据（北校区）
async function fetchGateVehicleDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  /**
   * 明细分页默认只需要 COUNT + JOIN 明细。
   * 车辆统计页(/api/vehicle-stats)需要 byDate/byLocation 时才打开。
   */
  includeAggregates?: boolean;
  /**
   * includeAggregates=true 时默认不查分页明细（用于 /api/vehicle-stats）。
   * 需要同时返回聚合+明细时，显式传 includeDetail=true（一般不需要）。
   */
  includeDetail?: boolean;
}): Promise<ExternalApiResponse<{
  total: number;
  byDate: Record<string, number>;
  byLocation: Record<string, number>;
  data: any[];
}>> {
  try {
    console.log('从MySQL数据库获取闸机车辆数据，参数:', params);

    // 构建查询语句 - 从park_car_in表获取入场数据
    let baseQuery = 'FROM park_car_in WHERE 1=1';
    const queryParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND in_time BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      baseQuery += ' AND in_time >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND in_time <= ?';
      queryParams.push(endDateRange.end);
    }

    const includeAggregates = params?.includeAggregates === true;
    const includeDetail = params?.includeDetail === true;

    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);
    
    // 优化：去掉 DATE() 函数比较，改为范围查询以提高索引命中率
    // 原始条件: DATE(i.in_time) = DATE(c.snap_time)
    // 优化后: c.snap_time >= DATE(i.in_time) AND c.snap_time < DATE_ADD(DATE(i.in_time), INTERVAL 1 DAY)
    const dataQuery = `
      SELECT i.id, i.car_no, i.emp_name, i.in_time, i.car_no_type, i.small, 
             c.snap_channel_name, c.snap_time
      FROM park_car_in i
      LEFT JOIN park_camerasnap c ON i.car_no = c.car_no 
        AND c.snap_time >= DATE(i.in_time) 
        AND c.snap_time < DATE_ADD(DATE(i.in_time), INTERVAL 1 DAY)
      ${baseQuery.replace('FROM park_car_in WHERE 1=1', 'WHERE 1=1')}
      ORDER BY i.in_time DESC 
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    if (!includeAggregates) {
      const countQuery = 'SELECT COUNT(*) as total ' + baseQuery;
      const [[countRows], [dataRows]] = await Promise.all([
        pool.execute(countQuery, queryParams),
        pool.execute(dataQuery, queryParams),
      ]) as any;

      const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
      const dataResult = Array.isArray(dataRows) ? dataRows : [];

      return {
        success: true,
        data: {
          total: Number(total),
          byDate: {},
          byLocation: {},
          data: dataResult,
        },
      };
    }

    const queries: Promise<any>[] = [];
    const countQuery = 'SELECT COUNT(*) as total ' + baseQuery;
    queries.push(pool.execute(countQuery, queryParams));

    const dateQuery = 'SELECT COUNT(*) as total, DATE(in_time) as date ' + baseQuery + ' GROUP BY DATE(in_time)';
    queries.push(pool.execute(dateQuery, queryParams));

    let snapBaseQuery = 'FROM park_camerasnap WHERE 1=1';
    const snapParams: any[] = [];
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      snapBaseQuery += ' AND snap_time BETWEEN ? AND ?';
      snapParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      snapBaseQuery += ' AND snap_time >= ?';
      snapParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      snapBaseQuery += ' AND snap_time <= ?';
      snapParams.push(endDateRange.end);
    }
    const locationQuery = 'SELECT COUNT(*) as total, snap_channel_name as location ' + snapBaseQuery + ' GROUP BY snap_channel_name';
    queries.push(pool.execute(locationQuery, snapParams));
    // 统计场景默认不拉明细；只有显式 includeDetail=true 才额外跑 JOIN 明细
    if (includeDetail) {
      queries.push(pool.execute(dataQuery, queryParams));
    }

    console.log('并行执行闸机车辆统计查询...');
    const results = await Promise.all(queries);

    const [countRows] = results[0] as any;
    const [dateRows] = results[1] as any;
    const [locationRows] = results[2] as any;
    const [dataRows] = includeDetail ? (results[3] as any) : [[]];

    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    const locationResult = Array.isArray(locationRows) ? locationRows : [];
    const dataResult = Array.isArray(dataRows) ? dataRows : [];

    const byDate: Record<string, number> = {};
    const byLocation: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      let dateStr = date;
      if (row.date instanceof Date) {
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      const count = parseInt(row.total) || 0;
      byDate[dateStr] = count;
    });

    locationResult.forEach((row: any) => {
      const location = row.location || '未知通道';
      const count = parseInt(row.total) || 0;
      byLocation[location] = count;
    });

    console.log(`闸机车辆统计数据: 总数=${total}, 日期分布=${Object.keys(byDate).length}天, 地点分布=${Object.keys(byLocation).length}个`);

    return {
      success: true,
      data: {
        total: Number(total),
        byDate,
        byLocation,
        data: dataResult
      }
    };
  } catch (error) {
    console.error('从数据库获取闸机车辆统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ==================== 闸机车辆详细数据 (分校区 + 出入状态) ====================

const NORTH_CAMPUS_CHANNELS = ['北入口'];

const GATE_CHANNEL_MAP: Record<string, { gate: string; campus: string }> = {
  '南入口1': { gate: '南门', campus: 'south' },
  '南入口': { gate: '南门', campus: 'south' },
  '西门入口': { gate: '西门', campus: 'south' },
  '西门停车场入口_视频通道_1': { gate: '西门', campus: 'south' },
  '西门停车场出口2_视频通道_1': { gate: '西门', campus: 'south' },
  '罗山入口': { gate: '罗山门', campus: 'south' },
  '北入口': { gate: '北门', campus: 'north' },
};

const GATE_CHANNELS = Object.keys(GATE_CHANNEL_MAP);

async function fetchGateBreakdownFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<Record<string, { in: number; out: number; campus: string }> | null> {
  try {
    const startParam = params?.startDate || new Date().toISOString().split('T')[0];
    const endParam = params?.endDate || new Date().toISOString().split('T')[0];
    const startStr = startParam.includes(' ') ? startParam : `${startParam} 00:00:00`;
    const endStr = endParam.includes(' ') ? endParam : `${endParam} 23:59:59`;

    const machNos = Object.keys(MACH_NO_GATE_MAP).map(Number);
    const machPlaceholders = machNos.map(() => '?').join(',');

    const inQuery = `
      SELECT i.mach_no, COUNT(*) as cnt
      FROM park_car_in i
      WHERE i.in_time BETWEEN ? AND ?
        AND i.mach_no IN (${machPlaceholders})
        AND NOT EXISTS (
          SELECT 1 FROM park_car_out o
          WHERE o.out_car_no = i.car_no AND o.out_time >= i.in_time
        )
      GROUP BY i.mach_no
    `;

    const outQuery = `
      SELECT o.in_mach_no as mach_no, COUNT(*) as cnt
      FROM park_car_out o
      WHERE o.out_time BETWEEN ? AND ?
        AND o.in_mach_no IN (${machPlaceholders})
      GROUP BY o.in_mach_no
    `;

    const [inResult, outResult] = await Promise.all([
      pool.execute(inQuery, [startStr, endStr, ...machNos]),
      pool.execute(outQuery, [startStr, endStr, ...machNos]),
    ]);

    const [inRows] = inResult as any;
    const [outRows] = outResult as any;

    const machInMap: Record<number, number> = {};
    (inRows as any[]).forEach((row: any) => {
      machInMap[row.mach_no] = parseInt(row.cnt) || 0;
    });

    const machOutMap: Record<number, number> = {};
    (outRows as any[]).forEach((row: any) => {
      machOutMap[row.mach_no] = parseInt(row.cnt) || 0;
    });

    const result: Record<string, { in: number; out: number; campus: string }> = {};
    const gateNames = new Set<string>();
    Object.entries(MACH_NO_GATE_MAP).forEach(([mach, info]) => gateNames.add(info.gate));

    for (const gateName of gateNames) {
      let totalIn = 0;
      let totalOut = 0;
      let campus = '';
      Object.entries(MACH_NO_GATE_MAP).forEach(([mach, info]) => {
        if (info.gate === gateName) {
          const machNo = Number(mach);
          totalIn += machInMap[machNo] || 0;
          totalOut += machOutMap[machNo] || 0;
          campus = info.campus;
        }
      });
      result[gateName] = { in: totalIn, out: totalOut, campus };
    }

    console.log('[GateBreakdown] result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[GateBreakdown] 查询失败:', error);
    return null;
  }
}

function isNorthCampus(channelName: string): boolean {
  return NORTH_CAMPUS_CHANNELS.some(nc => channelName.includes(nc));
}

const MACH_NO_GATE_MAP: Record<number, { gate: string; campus: string }> = {
  20: { gate: '西门', campus: 'south' },
  19: { gate: '北门', campus: 'north' },
  18: { gate: '罗山门', campus: 'south' },
  17: { gate: '南门', campus: 'south' },
};

const SOUTH_MACH_NOS = Object.entries(MACH_NO_GATE_MAP).filter(([_, v]) => v.campus === 'south').map(([k]) => Number(k));
const NORTH_MACH_NOS = Object.entries(MACH_NO_GATE_MAP).filter(([_, v]) => v.campus === 'north').map(([k]) => Number(k));

async function fetchCampusVehicleDetailData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  campus?: 'south' | 'north';
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('[闸机明细] 请求参数:', params);

    await ensureVehicleRegistrationCacheFresh();
    const regCache = vehicleRegistrationCache?.byPlate || {};

    const startParam = params?.startDate || new Date().toISOString().split('T')[0];
    const endParam = params?.endDate || new Date().toISOString().split('T')[0];
    const startStr = startParam.includes(' ') ? startParam : `${startParam} 00:00:00`;
    const endStr = endParam.includes(' ') ? endParam : `${endParam} 23:59:59`;

    let machNos: number[];
    if (params?.campus === 'north') {
      machNos = NORTH_MACH_NOS;
    } else if (params?.campus === 'south') {
      machNos = SOUTH_MACH_NOS;
    } else {
      machNos = [...SOUTH_MACH_NOS, ...NORTH_MACH_NOS];
    }

    const machPlaceholders = machNos.map(() => '?').join(',');

    const inStillQuery = `
      SELECT i.id, i.car_no, i.emp_name, i.in_time, i.mach_no
      FROM park_car_in i
      WHERE i.in_time BETWEEN ? AND ?
        AND i.mach_no IN (${machPlaceholders})
        AND NOT EXISTS (
          SELECT 1 FROM park_car_out o
          WHERE o.out_car_no = i.car_no AND o.out_time >= i.in_time
        )
    `;

    const outQuery = `
      SELECT o.id, o.out_car_no as car_no, o.out_time, o.in_mach_no as mach_no
      FROM park_car_out o
      WHERE o.out_time BETWEEN ? AND ?
        AND o.in_mach_no IN (${machPlaceholders})
    `;

    const [inResult, outResult] = await Promise.all([
      pool.execute(inStillQuery, [startStr, endStr, ...machNos]),
      pool.execute(outQuery, [startStr, endStr, ...machNos]),
    ]);

    const [inRows] = inResult as any;
    const [outRows] = outResult as any;
    const inData = Array.isArray(inRows) ? inRows : [];
    const outData = Array.isArray(outRows) ? outRows : [];

    const mappedIn = inData.map((row: any) => {
      const plate = row.car_no || '';
      const regInfo = regCache[plate] || {};
      const gateInfo = MACH_NO_GATE_MAP[row.mach_no];
      const rawTime = row.in_time;
      return {
        id: `in-${row.id}`,
        car_no: plate || '-',
        owner_name: row.emp_name || regInfo.xm || '-',
        department: regInfo.bm || '-',
        status: '已入校',
        snap_channel_name: gateInfo ? gateInfo.gate : '-',
        snap_time: rawTime ? formatDateTime(rawTime) : '-',
        _sortTime: rawTime instanceof Date ? rawTime.getTime() : (rawTime ? new Date(rawTime).getTime() : 0),
        campus: gateInfo ? gateInfo.campus : (params?.campus || 'unknown'),
      };
    });

    const mappedOut = outData.map((row: any) => {
      const plate = row.car_no || '';
      const regInfo = regCache[plate] || {};
      const gateInfo = MACH_NO_GATE_MAP[row.mach_no];
      const rawTime = row.out_time;
      return {
        id: `out-${row.id}`,
        car_no: plate || '-',
        owner_name: regInfo.xm || '-',
        department: regInfo.bm || '-',
        status: '已离校',
        snap_channel_name: gateInfo ? gateInfo.gate : '-',
        snap_time: rawTime ? formatDateTime(rawTime) : '-',
        _sortTime: rawTime instanceof Date ? rawTime.getTime() : (rawTime ? new Date(rawTime).getTime() : 0),
        campus: gateInfo ? gateInfo.campus : (params?.campus || 'unknown'),
      };
    });

    const combined = [...mappedIn, ...mappedOut]
      .sort((a, b) => b._sortTime - a._sortTime)
      .map(item => { const { _sortTime, ...rest } = item; return rest; });

    const total = combined.length;
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 10)));
    const offset = Math.max(0, (page - 1) * pageSize);
    const paginated = combined.slice(offset, offset + pageSize);

    console.log(`[闸机明细] campus=${params?.campus}, in=${inData.length}, out=${outData.length}, total=${total}, page=${page}`);

    return {
      success: true,
      data: paginated,
      total: Number(total),
      page,
      pageSize,
      inCount: inData.length,
      outCount: outData.length,
    };
  } catch (error) {
    console.error('[闸机明细] 查询失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 闸机车辆明细 API 路由
app.get('/api/vehicle/campus-detail', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, campus } = req.query;
    const result = await fetchCampusVehicleDetailData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      campus: (campus === 'south' || campus === 'north') ? campus : undefined,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 从MySQL数据库获取访客数据的函数
async function fetchVisitorDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  filterVehicle?: boolean;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从MySQL数据库获取访客数据，参数:', params);

    // 构建查询语句
    let query = 'SELECT * FROM pro_fkrxsq WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM pro_fkrxsq WHERE 1=1';

    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      // 将日期转换为时间范围
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);

      const dateCondition = ' AND DFSJ BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;

      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);

      const dateCondition = ' AND DFSJ >= ?';
      query += dateCondition;
      countQuery += dateCondition;

      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);

      const dateCondition = ' AND DFSJ <= ?';
      query += dateCondition;
      countQuery += dateCondition;

      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    // 筛选有车牌号的访客数据 (默认筛选，除非明确指定不筛选)
    if (params?.filterVehicle !== false) {
      const carCondition = " AND (LFCL IS NOT NULL AND TRIM(LFCL) != '' AND TRIM(LFCL) != '未登记')";
      query += carCondition;
      countQuery += carCondition;
    }

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
    console.log('总记录数:', total);

    // 添加分页逻辑
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const _pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * _pageSize);

    query += ` ORDER BY DFSJ DESC LIMIT ${_pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    console.log('查询参数:', queryParams);

    // 执行查询
    console.log('准备执行数据库查询，参数:', { query, queryParams });
    const [rows] = await pool.execute(query, queryParams);
    console.log('数据库查询执行成功，返回行数:', Array.isArray(rows) ? rows.length : 0);

    // 确保结果是数组格式
    const result = Array.isArray(rows) ? rows : [];

    if (result.length > 0) {
      console.log('第一条访客数据示例:', JSON.stringify(result[0]));
    }

    // 映射数据库字段到API接口定义
    const mappedResult = result.map((row: any) => ({
      guid: row.GUID || row.guid,
      xm: row.XM || row.xm,
      lfsy: row.LFSY || row.lfsy || row.SY || row.sy, // 兼容不同字段名
      bfbm: row.BFBM || row.bfbm,
      bfr: row.BFRY || row.bfry, // 映射被拜访人 (BFRY)
      system_status: row.SYSTEM_STATUS || row.system_status,
      lfsj: row.LFSJ || row.lfsj,
      dfsj: row.DFSJ || row.dfsj,
      cp: row.CP || row.cp || row.LFCL || row.lfcl, // 映射 LFCL 到 cp
      lfcl: row.LFCL || row.lfcl, // 保留 lfcl 字段
      sfzh: row.SFZH || row.sfzh,
      lxdh: row.LXDH || row.lxdh,
      raw_data: row
    }));

    console.log(`从数据库获取访客数据: ${mappedResult.length} 条记录`);

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize: _pageSize
    };
  } catch (error) {
    console.error('从数据库获取访客数据失败:', error);
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      query: 'SELECT * FROM pro_fkrxsq WHERE 1=1 ...', // 由于作用域问题，无法直接访问query变量
      queryParams: 'Redacted for scope' // 由于作用域问题，无法直接访问queryParams变量
    });
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取访客入校数据的函数
async function fetchVisitorEntryDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<VisitorEntryApiData[]>> {
  try {
    console.log('从MySQL数据库获取访客入校数据，参数:', params);

    let query = 'SELECT * FROM t_fkrxsmxx WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM t_fkrxsmxx WHERE 1=1';

    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 添加日期范围过滤条件 (基于 SMSJ 字段)
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);

      const dateCondition = ' AND SMSJ BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;

      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND SMSJ >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND SMSJ <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    // 执行总数查询
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    // 添加分页逻辑
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const _pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * _pageSize);

    query += ` ORDER BY SMSJ DESC LIMIT ${_pageSize} OFFSET ${offset}`;

    // 执行查询
    const [rows] = await pool.execute(query, queryParams);
    const result = Array.isArray(rows) ? rows : [];

    // 映射数据库字段
    const mappedResult = result.map((row: any) => ({
      guid: row.GUID,
      xm: row.LFRXM, // 访客姓名
      smsj: row.SMSJ, // 入校时间
      lxdh: row.LFRSJHM, // 联系电话
      sfzh: row.LFRSFZH, // 身份证号
      smrxm: row.SMRXM, // 扫码人姓名
      raw_data: row
    }));

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize: _pageSize
    };
  } catch (error) {
    console.error('从数据库获取访客入校数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取访客入校统计数据的函数
async function fetchVisitorEntryStatsFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{ total: number; byDate: Record<string, number> }>> {
  try {
    console.log('从MySQL数据库获取访客入校统计数据，参数:', params);

    let query = 'SELECT COUNT(*) as total, DATE(SMSJ) as date FROM t_fkrxsmxx WHERE 1=1';
    const queryParams: any[] = [];

    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND SMSJ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      query += ' AND SMSJ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND SMSJ <= ?';
      queryParams.push(endDateRange.end);
    }

    const dateQuery = query + ' GROUP BY DATE(SMSJ)';
    const [dateRows] = await pool.execute(dateQuery, queryParams);
    const dateResult = Array.isArray(dateRows) ? dateRows : [];

    let total = 0;
    const byDate: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      let dateStr = date;
      if (row.date instanceof Date) {
        dateStr = row.date.toISOString().split('T')[0];
      }
      const count = parseInt(row.total) || 0;
      byDate[dateStr] = count;
      total += count;
    });

    return {
      success: true,
      data: {
        total,
        byDate
      }
    };
  } catch (error) {
    console.error('从数据库获取访客入校统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取所有访客数据的函数
async function fetchAllVisitorDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  maxPages?: number;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从MySQL数据库获取所有访客数据，参数:', params);

    // 构建查询语句
    let query = 'SELECT * FROM pro_fkrxsq WHERE 1=1';
    const queryParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      // 将日期转换为时间范围
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND DFSJ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      query += ' AND DFSJ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND DFSJ <= ?';
      queryParams.push(endDateRange.end);
    }

    // 筛选有车牌号的访客数据
    query += " AND (LFCL IS NOT NULL AND TRIM(LFCL) != '' AND TRIM(LFCL) != '未登记')";

    console.log('执行查询:', query);
    console.log('查询参数:', queryParams);

    // 执行查询
    console.log('准备执行所有访客数据查询，参数:', { query, queryParams });
    const [rows] = await pool.execute(query, queryParams);
    console.log('所有访客数据查询执行成功，返回行数:', Array.isArray(rows) ? rows.length : 0);

    // 确保结果是数组格式
    const result = Array.isArray(rows) ? rows : [];

    if (result.length > 0) {
      console.log('第一条访客数据示例:', JSON.stringify(result[0]));
    }

    // 映射数据库字段到API接口定义
    const mappedResult = result.map((row: any) => ({
      guid: row.GUID || row.guid,
      xm: row.XM || row.xm,
      lfsy: row.LFSY || row.lfsy || row.SY || row.sy, // 兼容不同字段名
      bfbm: row.BFBM || row.bfbm,
      bfr: row.BFRY || row.bfry, // 映射被拜访人 (BFRY)
      system_status: row.SYSTEM_STATUS || row.system_status,
      lfsj: row.LFSJ || row.lfsj,
      dfsj: row.DFSJ || row.dfsj,
      cp: row.CP || row.cp || row.LFCL || row.lfcl, // 映射 LFCL 到 cp
      lfcl: row.LFCL || row.lfcl, // 保留 lfcl 字段
      sfzh: row.SFZH || row.sfzh,
      lxdh: row.LXDH || row.lxdh,
      raw_data: row
    }));

    console.log(`从数据库获取所有访客数据: ${mappedResult.length} 条记录`);

    return {
      success: true,
      data: mappedResult,
    };
  } catch (error) {
    console.error('从数据库获取所有访客数据失败:', error);
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      query: 'SELECT * FROM pro_fkrxsq WHERE 1=1 ...', // 由于作用域问题，无法直接访问query变量
      queryParams: 'Redacted for scope' // 由于作用域问题，无法直接访问queryParams变量
    });
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取访客统计数据的函数
async function fetchVisitorStatsFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  filterVehicle?: boolean;
}): Promise<ExternalApiResponse<{ total: number; byDate: Record<string, number>; byDepartment: Record<string, number> }>> {
  try {
    console.log('从MySQL数据库获取访客统计数据，参数:', params);

    // 构建查询语句
    let query = 'SELECT COUNT(*) as total, DATE(DFSJ) as date FROM pro_fkrxsq WHERE 1=1';
    const queryParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      // 将日期转换为时间范围
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND DFSJ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);

      query += ' AND DFSJ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);

      query += ' AND DFSJ <= ?';
      queryParams.push(endDateRange.end);
    }

    // 筛选有车牌号的访客数据 (默认筛选，除非明确指定不筛选)
    if (params?.filterVehicle !== false) {
      query += " AND (LFCL IS NOT NULL AND TRIM(LFCL) != '' AND LFCL != '未登记')";
    }

    // 构建按日期统计查询
    const dateQuery = query + ' GROUP BY DATE(DFSJ)';

    console.log('执行日期统计查询:', dateQuery);
    console.log('查询参数:', queryParams);

    // 执行日期统计查询
    const [dateRows] = await pool.execute(dateQuery, queryParams);

    // 构建按部门统计查询
    // 注意：这里需要修改SELECT部分，因为原来的SELECT只包含DATE(DFSJ)
    let deptQueryBase = 'SELECT COUNT(*) as total, BFBM as department FROM pro_fkrxsq WHERE 1=1';

    // 重新构建部门查询的条件部分
    if (params?.startDate && params?.endDate) {
      deptQueryBase += ' AND DFSJ BETWEEN ? AND ?';
    } else if (params?.startDate) {
      deptQueryBase += ' AND DFSJ >= ?';
    } else if (params?.endDate) {
      deptQueryBase += ' AND DFSJ <= ?';
    }

    if (params?.filterVehicle !== false) {
      deptQueryBase += " AND (LFCL IS NOT NULL AND TRIM(LFCL) != '' AND LFCL != '未登记')";
    }
    const deptQuery = deptQueryBase + ' GROUP BY BFBM';

    console.log('执行部门统计查询:', deptQuery);

    // 执行部门统计查询
    const [deptRows] = await pool.execute(deptQuery, queryParams);

    // 确保结果是数组格式
    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    const deptResult = Array.isArray(deptRows) ? deptRows : [];

    // 计算总数和按日期分布
    let total = 0;
    const byDate: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      const count = parseInt(row.total) || 0;
      byDate[date] = count;
      total += count;
    });

    // 计算按部门分布
    const byDepartment: Record<string, number> = {};
    deptResult.forEach((row: any) => {
      const dept = row.department || '未知部门';
      const count = parseInt(row.total) || 0;
      byDepartment[dept] = count;
    });

    console.log(`访客统计数据: 总数=${total}, 日期分布=${Object.keys(byDate).length}天, 部门分布=${Object.keys(byDepartment).length}个`);

    return {
      success: true,
      data: {
        total,
        byDate,
        byDepartment
      }
    };
  } catch (error) {
    console.error('从数据库获取访客统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取被访数据统计（人数和人次）
async function fetchVisitedStatsFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{ byDate: Record<string, { visitCount: number; visitedPersonCount: number }> }>> {
  try {
    console.log('从MySQL数据库获取被访数据统计，参数:', params);

    let query = 'SELECT DATE(DFSJ) as date, COUNT(*) as visit_count, COUNT(DISTINCT BFRY) as visited_person_count FROM pro_fkrxsq WHERE 1=1';
    const queryParams: any[] = [];

    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND DFSJ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      query += ' AND DFSJ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND DFSJ <= ?';
      queryParams.push(endDateRange.end);
    }

    // 排除被访人为空的记录
    query += " AND (BFRY IS NOT NULL AND TRIM(BFRY) != '')";

    const dateQuery = query + ' GROUP BY DATE(DFSJ) ORDER BY date';

    console.log('执行被访统计查询:', dateQuery);
    const [rows] = await pool.execute(dateQuery, queryParams);
    const result = Array.isArray(rows) ? rows : [];

    const byDate: Record<string, { visitCount: number; visitedPersonCount: number }> = {};

    result.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      let dateStr = date;
      if (row.date instanceof Date) {
        // 使用本地时间格式化，避免时区问题导致日期偏差
        const year = row.date.getFullYear();
        const month = row.date.getMonth() + 1;
        const day = row.date.getDate();
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      byDate[dateStr] = {
        visitCount: parseInt(row.visit_count) || 0,
        visitedPersonCount: parseInt(row.visited_person_count) || 0
      };
    });

    return {
      success: true,
      data: {
        byDate
      }
    };
  } catch (error) {
    console.error('从数据库获取被访数据统计失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取人流量统计数据
async function fetchHumanTrafficStatsFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{
  library: number;
  skybridge: number;
  total: number;
  byDate: Record<string, { library: number; skybridge: number }>;
}>> {
  try {
    console.log('=== 开始获取人流量统计数据 ===');
    console.log('请求参数:', JSON.stringify(params));

    let query = 'SELECT qybh, bgsj, jrrs, cqrs, jgrs FROM t_zj_qybqb_all WHERE 1=1';
    const queryParams: any[] = [];

    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND bgsj BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
      console.log(`日期范围过滤: ${startDateRange.start} - ${endDateRange.end}`);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      query += ' AND bgsj >= ?';
      queryParams.push(startDateRange.start);
      console.log(`开始日期过滤: >= ${startDateRange.start}`);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND bgsj <= ?';
      queryParams.push(endDateRange.end);
      console.log(`结束日期过滤: <= ${endDateRange.end}`);
    }

    console.log('执行SQL查询:', query);
    console.log('SQL参数:', queryParams);

    const [rows] = await pool.execute(query, queryParams);
    const result = Array.isArray(rows) ? rows : [];

    console.log(`查询结果: 找到 ${result.length} 条记录`);

    if (result.length > 0) {
      const sample = result.slice(0, 3);
      console.log('前3条记录样本:', JSON.stringify(sample));
      const firstRow = result[0] as any;
      console.log('第一条记录字段类型检查:');
      console.log('- qybh:', typeof firstRow.qybh, firstRow.qybh);
      console.log('- bgsj:', typeof firstRow.bgsj, firstRow.bgsj);
      console.log('- jrrs:', typeof firstRow.jrrs, firstRow.jrrs);
      console.log('- cqrs:', typeof firstRow.cqrs, firstRow.cqrs);
      console.log('- jgrs:', typeof firstRow.jgrs, firstRow.jgrs);
    } else {
      console.warn('警告: 未查询到任何符合条件的人流量数据');
    }

    let library = 0;
    let skybridge = 0;
    const byDate: Record<string, { library: number; skybridge: number }> = {};

    let matchCount = 0;
    let unmatchCount = 0;

    result.forEach((row: any) => {
      // 确保 qybh 是字符串并去除空格
      const qybhRaw = row.qybh;
      const qybh = qybhRaw ? String(qybhRaw).trim() : '';

      const jrrs = parseInt(row.jrrs) || 0;
      const cqrs = parseInt(row.cqrs) || 0;
      const jgrs = parseInt(row.jgrs) || 0;

      // 优化人流量计算逻辑：
      // 优先使用进出人数之和 (jrrs + cqrs)
      // 如果进出人数都为0，则使用经过人数 (jgrs)
      // 避免直接相加导致的潜在重复计算
      const totalFlow = (jrrs + cqrs) > 0 ? (jrrs + cqrs) : jgrs;

      let dateStr = 'unknown';
      if (row.bgsj instanceof Date) {
        const year = row.bgsj.getFullYear();
        const month = row.bgsj.getMonth() + 1;
        const day = row.bgsj.getDate();
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (typeof row.bgsj === 'string') {
        // 处理字符串格式的日期
        dateStr = row.bgsj.substring(0, 10);
      }

      if (!byDate[dateStr]) {
        byDate[dateStr] = { library: 0, skybridge: 0 };
      }

      if (qybh.length === 4) {
        // 天桥 (4位)
        skybridge += totalFlow;
        byDate[dateStr].skybridge += totalFlow;
        matchCount++;
      } else if (qybh.length === 8) {
        // 图书馆 (8位)
        library += totalFlow;
        byDate[dateStr].library += totalFlow;
        matchCount++;
      } else {
        unmatchCount++;
        if (unmatchCount <= 5) {
          console.log(`未匹配的记录: qybh='${qybh}' (原始值: ${qybhRaw}, 长度: ${qybh.length}), jrrs=${jrrs}, cqrs=${cqrs}, jgrs=${jgrs}`);
        }
      }
    });

    console.log('统计结果汇总:');
    console.log(`- 图书馆总流量: ${library}`);
    console.log(`- 天桥总流量: ${skybridge}`);
    console.log(`- 成功匹配记录数: ${matchCount}`);
    console.log(`- 未匹配记录数: ${unmatchCount}`);
    console.log('=== 人流量统计结束 ===');

    const total = library + skybridge;

    return {
      success: true,
      data: {
        library,
        skybridge,
        total,
        byDate
      }
    };
  } catch (error) {
    console.error('从数据库获取人流量统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

// 从MySQL数据库获取宿管住宿统计数据
async function fetchDormitoryStatsFromDatabase(params?: {
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
    console.log('=== 开始获取宿管住宿统计数据 ===');
    console.log('请求参数:', JSON.stringify(params));

    // 使用您提供的SQL查询，支持时间区间
    let query = `
      SELECT
        kqrq,
        COUNT(*) AS total,
        SUM(CASE WHEN kqzt_wg = '正常回寝' AND xwzs = 0 AND qjbj = 0 THEN 1 ELSE 0 END) AS zc_count,
        SUM(CASE WHEN kqzt_tx = '正常回寝' OR xwzs = 1 OR qjbj = 1 THEN 0 ELSE 1 END) AS tx_count,
        SUM(CASE WHEN kqzt_bg = '晚归回寝' AND xwzs = 0 AND qjbj = 0 THEN 1 ELSE 0 END) AS wg_count,
        SUM(CASE WHEN kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND xwzs = 0 AND qjbj = 0 THEN 1 ELSE 0 END) AS bg_count,
        SUM(qjbj) AS qj_count,
        SUM(xwzs) AS not_in_school_count,
        SUM(CASE WHEN kqzt_bg IS NULL AND xwzs = 0 AND qjbj = 0 THEN 1 ELSE 0 END) AS no_record_count
      FROM mod_xskq_kqjl
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND kqrq BETWEEN ? AND ?';
      queryParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
      console.log(`日期范围过滤: ${startDateRange.start.split(' ')[0]} - ${endDateRange.start.split(' ')[0]}`);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      query += ' AND kqrq >= ?';
      queryParams.push(startDateRange.start.split(' ')[0]);
      console.log(`开始日期过滤: >= ${startDateRange.start.split(' ')[0]}`);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      query += ' AND kqrq <= ?';
      queryParams.push(endDateRange.start.split(' ')[0]);
      console.log(`结束日期过滤: <= ${endDateRange.start.split(' ')[0]}`);
    } else {
      // 如果没有指定日期范围，默认使用昨天的数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      query += ' AND kqrq = ?';
      queryParams.push(yesterdayStr);
      console.log(`默认使用昨天数据: ${yesterdayStr}`);
    }

    query += ' GROUP BY kqrq ORDER BY kqrq DESC LIMIT 1'; // 获取最新的日期数据

    console.log('执行SQL查询:', query);
    console.log('SQL参数:', queryParams);

    const [rows] = await pool.execute(query, queryParams);
    
    // 确保rows是RowDataPacket数组类型
    const rowData = Array.isArray(rows) ? rows : [];
    const result = rowData.length > 0 ? rowData[0] : null;

    if (!result) {
      console.log('未查询到符合条件的宿舍考勤数据');
      return {
        success: true,
        data: {
          kqrq: params?.startDate || 'N/A',
          total: 0,
          zc_count: 0,
          tx_count: 0,
          wg_count: 0,
          bg_count: 0,
          qj_count: 0,
          not_in_school_count: 0,
          no_record_count: 0
        }
      };
    }

    // 确保result是期望的类型并访问字段
    const row = result as any;
    
    console.log('宿舍考勤数据查询成功，返回结果');
    console.log('查询结果样本:', JSON.stringify({
      kqrq: row.kqrq,
      total: row.total,
      zc_count: row.zc_count,
      wg_count: row.wg_count,
      bg_count: row.bg_count
    }));

    // 获取所有楼栋名称 - 从床位信息表获取
    const buildingQuery = `SELECT DISTINCT jzwh FROM t_xgxt_zszl_view WHERE jzwh IS NOT NULL AND jzwh != ''`;
    console.log('执行楼栋列表SQL查询:', buildingQuery);
    const [buildingRows] = await pool.execute(buildingQuery);
    const allBuildingsRaw = Array.isArray(buildingRows) ? buildingRows.map((row: any) => row.jzwh) : [];
    
    // 楼栋名称映射
    const buildingNameMap: Record<string, string> = {
      'CH1': '超豪1', 'CH2': '超豪2', 'CH3': '超豪3', 'CH4': '超豪4',
      'DH1': '德涵1', 'DH2': '德涵2', 'DH3': '德涵3',
      'WB1': '文博1', 'WB2': '文博2', 'WB3': '文博3',
      'LS1': '罗山1', 'LS2': '罗山2', 'LS3': '罗山3',
      'SX1': '水心1', 'SX2': '水心2', 'SX3': '水心3',
    };
    
    // 过滤掉教师公寓 (CH3JSGY, CHJSGY)
    const allBuildings = allBuildingsRaw
      .filter((b: string) => !b.includes('JSGY'))
      .map((b: string) => buildingNameMap[b] || b);
    
    // 初始化所有楼栋的统计数据为0
    const byBuilding: Record<string, BuildingStats> = {};
    allBuildings.forEach(building => {
      byBuilding[building] = {
        total: 0,
        zc_count: 0,
        tx_count: 0,
        wg_count: 0,
        bg_count: 0,
        qj_count: 0,
        not_in_school_count: 0,
        no_record_count: 0
      };
    });
    
    // 获取按楼栋和考勤状态分布的详细统计数据 - 关联床位信息表获取楼栋
    let byBuildingDetailQuery = `
      SELECT
        COALESCE(ANY_VALUE(s.jzwh), '未知') as building,
        COUNT(*) AS total,
        SUM(CASE WHEN k.kqzt_wg = '正常回寝' AND k.xwzs = 0 AND k.qjbj = 0 THEN 1 ELSE 0 END) AS zc_count,
        SUM(CASE WHEN k.kqzt_tx = '正常回寝' OR k.xwzs = 1 OR k.qjbj = 1 THEN 0 ELSE 1 END) AS tx_count,
        SUM(CASE WHEN k.kqzt_bg = '晚归回寝' AND k.xwzs = 0 AND k.qjbj = 0 THEN 1 ELSE 0 END) AS wg_count,
        SUM(CASE WHEN k.kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND k.xwzs = 0 AND k.qjbj = 0 THEN 1 ELSE 0 END) AS bg_count,
        SUM(k.qjbj) AS qj_count,
        SUM(k.xwzs) AS not_in_school_count,
        SUM(CASE WHEN k.kqzt_bg IS NULL AND k.xwzs = 0 AND k.qjbj = 0 THEN 1 ELSE 0 END) AS no_record_count
      FROM mod_xskq_kqjl k
      LEFT JOIN t_xgxt_zszl_view s ON k.xh = s.xh
      WHERE 1=1
    `;
    
    const byBuildingDetailParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      byBuildingDetailQuery += ' AND k.kqrq BETWEEN ? AND ?';
      byBuildingDetailParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      byBuildingDetailQuery += ' AND k.kqrq >= ?';
      byBuildingDetailParams.push(startDateRange.start.split(' ')[0]);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      byBuildingDetailQuery += ' AND k.kqrq <= ?';
      byBuildingDetailParams.push(endDateRange.start.split(' ')[0]);
    } else {
      // 如果没有指定日期范围，默认使用昨天的数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      byBuildingDetailQuery += ' AND k.kqrq = ?';
      byBuildingDetailParams.push(yesterdayStr);
    }

    byBuildingDetailQuery += ' GROUP BY building';

    const [buildingDetailRows] = await pool.execute(byBuildingDetailQuery, byBuildingDetailParams);
    
    // 确保buildingDetailRows是RowDataPacket数组类型
    const buildingDetailData = Array.isArray(buildingDetailRows) ? buildingDetailRows : [];
    
    buildingDetailData.forEach((buildingRow: any) => {
      const buildingRaw = buildingRow.building ? buildingRow.building.toString() : '未知楼栋';
      // 过滤掉教师公寓
      if (buildingRaw.includes('JSGY')) return;
      const building = buildingNameMap[buildingRaw] || buildingRaw;
      byBuilding[building] = {
        total: parseInt(buildingRow.total) || 0,
        zc_count: parseInt(buildingRow.zc_count) || 0,
        tx_count: parseInt(buildingRow.tx_count) || 0,
        wg_count: parseInt(buildingRow.wg_count) || 0,
        bg_count: parseInt(buildingRow.bg_count) || 0,
        qj_count: parseInt(buildingRow.qj_count) || 0,
        not_in_school_count: parseInt(buildingRow.not_in_school_count) || 0,
      no_record_count: parseInt(buildingRow.no_record_count) || 0
      };
    });

    // 移除未知楼栋
    delete byBuilding['未知'];

    return {
      success: true,
      data: {
        kqrq: row.kqrq ? row.kqrq.toString() : 'N/A',
        total: parseInt(row.total) || 0,
        zc_count: parseInt(row.zc_count) || 0,
        tx_count: parseInt(row.tx_count) || 0,
        wg_count: parseInt(row.wg_count) || 0,
        bg_count: parseInt(row.bg_count) || 0,
        qj_count: parseInt(row.qj_count) || 0,
        not_in_school_count: parseInt(row.not_in_school_count) || 0,
        no_record_count: parseInt(row.no_record_count) || 0,
        byBuilding
      }
    };
  } catch (error) {
    console.error('从数据库获取宿管住宿统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 新增从数据库获取访客数据的API路由 (用于车辆管理，默认筛选有车牌的访客)
app.get('/api/visitor-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchVisitorDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
      filterVehicle: true // 明确筛选有车牌的访客
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 新增从数据库获取访客统计数据的API路由 (用于车辆管理)
app.get('/api/visitor-stats-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchVisitorStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      filterVehicle: true // 明确筛选有车牌的访客
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 访客列表
app.get('/api/personnel/visitor-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchVisitorDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
      filterVehicle: false // 不筛选车牌
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 访客统计
app.get('/api/personnel/visitor-stats-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchVisitorStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      filterVehicle: false // 不筛选车牌
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 访客入校列表
app.get('/api/personnel/visitor-entry-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchVisitorEntryDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 访客入校统计
app.get('/api/personnel/visitor-entry-stats-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchVisitorEntryStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 被访数据统计
app.get('/api/personnel/visited-stats-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchVisitedStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员管理 - 人流量统计
app.get('/api/personnel/human-traffic-stats-db', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchHumanTrafficStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 宿管数据 - 住宿统计 (兼容旧路由)
app.get('/api/dormitory/stats', async (req: Request, res: Response) => {
  console.log(`[Backend] 收到宿管统计请求: ${req.url}`);
  console.log(`[API] /api/dormitory/stats route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const result = await fetchDormitoryStatsFromDatabase();

    if (result.success) {
      console.log(`[Backend] 宿管统计获取成功，返回数据`);
      res.json(result.data);
    } else {
      console.error(`[Backend] 宿管统计获取失败: ${result.error}`);
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error(`[Backend] 宿管统计未捕获异常: ${error.message}`);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 宿管数据 - 住宿统计
app.get('/api/dormitory/stats-db', async (req: Request, res: Response) => {
  console.log(`[Backend] 收到宿管统计请求 (DB路由): ${req.url}`);
  console.log(`[API] /api/dormitory/stats-db route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchDormitoryStatsFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });

    if (result.success) {
      console.log(`[Backend] 宿管统计获取成功，返回数据`);
      res.json(result.data);
    } else {
      console.error(`[Backend] 宿管统计获取失败: ${result.error}`);
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error(`[Backend] 宿管统计未捕获异常: ${error.message}`);
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 从MySQL数据库获取宿舍详细数据
async function fetchDormitoryDataFromDatabase(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  filterType?: 'wg' | 'bg' | 'qj' | 'xwzs' | 'no_record' | 'all' | 'zc';
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从MySQL数据库获取宿舍详细数据，参数:', params);

    // 关联床位信息表获取楼栋和房间号，关联学生信息表获取学院、专业、班级
    // 使用CAST转换字符集以避免排序规则冲突
    let query = `
      SELECT k.*, 
             COALESCE(s.jzwh, cw.楼栋代码) as ldmc,
             COALESCE(k.bmmc, st.jgmc) as bmmc,
             COALESCE(k.zymc, st.zymc) as zymc,
             COALESCE(k.bjmc, st.bj) as bjmc,
             COALESCE(k.qsh, cw.寝室号) as qsh
      FROM mod_xskq_kqjl k
      LEFT JOIN t_xgxt_zszl_view s ON k.xh = s.xh
      LEFT JOIN t_jw_xsjbxx st ON CAST(k.xh AS CHAR) = CAST(st.xh AS CHAR)
      LEFT JOIN t_xg_cwxxb cw ON CAST(k.xh AS CHAR) = CAST(cw.现住学生学号 AS CHAR)
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM mod_xskq_kqjl k WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND k.kqrq BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
      countParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND k.kqrq >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start.split(' ')[0]);
      countParams.push(startDateRange.start.split(' ')[0]);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND k.kqrq <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.start.split(' ')[0]);
      countParams.push(endDateRange.start.split(' ')[0]);
    }

    // 筛选类型过滤 (晚归或未归)
    if (params?.filterType === 'wg') {
      // 晚归: 根据统计SQL，晚归是kqzt_bg = '晚归回寝' 且 xwzs=0 且 qjbj=0
      query += " AND k.kqzt_bg = '晚归回寝' AND k.xwzs = 0 AND k.qjbj = 0";
      countQuery += " AND k.kqzt_bg = '晚归回寝' AND k.xwzs = 0 AND k.qjbj = 0";
    } else if (params?.filterType === 'bg') {
      // 未归: kqzt_bg IN ('出寝未归', '返校未归', '出校未归') 且 xwzs=0 且 qjbj=0
      query += " AND k.kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND k.xwzs = 0 AND k.qjbj = 0";
      countQuery += " AND k.kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND k.xwzs = 0 AND k.qjbj = 0";
    } else if (params?.filterType === 'qj') {
      // 请假: qjbj = 1
      query += " AND k.qjbj = 1";
      countQuery += " AND k.qjbj = 1";
    } else if (params?.filterType === 'xwzs') {
      // 校外住宿: xwzs = 1
      query += " AND k.xwzs = 1";
      countQuery += " AND k.xwzs = 1";
    } else if (params?.filterType === 'no_record') {
      // 无记录: kqzt_bg IS NULL 且 xwzs=0 且 qjbj=0
      query += " AND k.kqzt_bg IS NULL AND k.xwzs = 0 AND k.qjbj = 0";
      countQuery += " AND k.kqzt_bg IS NULL AND k.xwzs = 0 AND k.qjbj = 0";
    } else if (params?.filterType === 'zc') {
      // 正常回寝: kqzt_wg = '正常回寝' 且 xwzs=0 且 qjbj=0
      query += " AND k.kqzt_wg = '正常回寝' AND k.xwzs = 0 AND k.qjbj = 0";
      countQuery += " AND k.kqzt_wg = '正常回寝' AND k.xwzs = 0 AND k.qjbj = 0";
    }
    // 'all' 不需要额外过滤条件，获取所有数据

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
    console.log('countParams:', countParams);
    console.log('filterType:', params?.filterType);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
    console.log('总记录数:', total);

    // 分页
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const _pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 10)));
    const offset = Math.max(0, (page - 1) * _pageSize);

    query += ` ORDER BY kqrq DESC LIMIT ${_pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    const [rows] = await pool.execute(query, queryParams);

    const result = Array.isArray(rows) ? rows : [];

    // 添加调试日志，查看第一行数据的结构
    if (result.length > 0) {
      console.log('数据库查询结果第一行:', JSON.stringify(result[0], null, 2));
      console.log('数据库字段映射前的键:', Object.keys(result[0]));
    }

    // 映射字段
    const buildingNameMap: Record<string, string> = {
      'CH1': '超豪1', 'CH2': '超豪2', 'CH3': '超豪3', 'CH4': '超豪4',
      'DH1': '德涵1', 'DH2': '德涵2', 'DH3': '德涵3',
      'WB1': '文博1', 'WB2': '文博2', 'WB3': '文博3',
      'LS1': '罗山1', 'LS2': '罗山2', 'LS3': '罗山3',
      'SX1': '水心1', 'SX2': '水心2', 'SX3': '水心3',
    };
    
    const mappedResult = result.map((row: any) => {
      // 获取楼栋代码并转换为中文名
      const ldmcRaw = row.ldmc || row.LDMC || row.building || row.buildingName || row.BUILDING || row.BUILDINGNAME || row.loudong || row.楼栋 || '';
      const ldmc = buildingNameMap[ldmcRaw] || ldmcRaw;
      
      // 根据调试信息，数据库字段名是小写的，如xh, xm, ldmc等
      return {
        id: Math.floor(Math.random() * 1000000), // 生成临时ID
        xh: row.xh || row.XH || row.student_id || row.studentId || row.STUDENT_ID || row.STUDENTID || '', // 学号
        xm: row.xm || row.XM || row.name || row.userName || row.NAME || row.USERNAME || row.xingming || row.姓名 || '', // 姓名
        xy: row.bmmc || row.xueyuan || row.学院 || row.XY || row.xy || row.college || row.collegeName || row.COLLEGE || row.COLLEGENAME || '', // 学院 (从调试信息看，可能是bmmc字段)
        zy: row.zymc || row.zhuanye || row.专业 || row.ZY || row.zy || row.major || row.majorName || row.MAJOR || row.MAJORNAME || '', // 专业 (从调试信息看，可能是zymc字段)
        bj: row.bjmc || row.banji || row.班级 || row.BJ || row.bj || row.class || row.className || row.CLASS || row.CLASSNAME || '', // 班级 (从调试信息看，可能是bjmc字段)
        ldmc: ldmc, // 楼栋名称
        fjh: row.qsh || row.fjh || row.FJH || row.room || row.roomNumber || row.ROOM || row.ROOMNUMBER || row.fangjian || row.房间 || row.fangjianhao || row.房间号 || '', // 房间号 (从调试信息看，可能是qsh字段)
        kqzt_wg: row.kqzt_wg || row.KQZT_WG || row.attendanceStatusWg || row.ATTENDANCESTATUSWG || row.kaoqinzt_wg || row.考勤状态晚归 || '', // 考勤状态-晚归
        kqzt_tx: row.kqzt_tx || row.KQZT_TX || row.attendanceStatusTx || row.ATTENDANCESTATUSTX || row.kaoqinzt_tx || row.考勤状态通宵 || '', // 考勤状态-通宵
        kqzt_bg: row.kqzt_bg || row.KQZT_BG || row.attendanceStatusBg || row.ATTENDANCESTATUSBG || row.kaoqinzt_bg || row.考勤状态未归 || '', // 考勤状态-未归
        kqrq: row.kqrq || row.KQRQ || row.attendanceDate || row.ATTENDANCEDATE || row.kaoqinrq || row.考勤日期 || '', // 考勤日期
        xwzs: row.xwzs || row.XWZS || row.offCampusStatus || row.OFFCAMPUSSTATUS || row.waixiao || row.校外住宿 || 0, // 校外住宿状态
        qjbj: row.qjbj || row.QJBJ || row.leaveMark || row.LEAVEMARK || row.qingjia || row.请假标记 || 0, // 请假标记
      };
    });

    // 添加调试日志，查看映射后的数据
    if (mappedResult.length > 0) {
      console.log('映射后的第一行数据:', JSON.stringify(mappedResult[0], null, 2));
    }

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize: _pageSize
    };
  } catch (error) {
    console.error('从数据库获取宿舍详细数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 宿管数据 - 详细数据
app.get('/api/dormitory/data', async (req: Request, res: Response) => {
  console.log(`[Backend] 收到宿舍详细数据请求: ${req.url}`);
  console.log(`[API] /api/dormitory/data route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, page, pageSize, filterType } = req.query;
    const validFilterTypes = ['wg', 'bg', 'qj', 'xwzs', 'no_record', 'all', 'zc'];
    const result = await fetchDormitoryDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      filterType: typeof filterType === 'string' && validFilterTypes.includes(filterType) 
        ? filterType as 'wg' | 'bg' | 'qj' | 'xwzs' | 'no_record' | 'all' | 'zc' 
        : undefined
    });

    if (result.success) {
      console.log(`[Backend] 宿舍详细数据获取成功，返回数据，共 ${result.data?.length || 0} 条`);
      // 确保返回的数据结构正确，前端期望的是 { success: true, data: [...], total: N }
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      });
    } else {
      console.error(`[Backend] 宿舍详细数据获取失败: ${result.error}`);
      res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
  } catch (error: any) {
    console.error(`[Backend] 宿舍详细数据未捕获异常: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: error.message || '内部服务器错误' 
    });
  }
});

// 健康检查端点
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});



// 安全馆预约API数据类型
interface SafetyVisitReservation {
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
interface SafetyVisitReservationStats {
  total: number;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
  byStatus: Record<string, number>;
}

// 从MySQL数据库获取安全馆预约数据
async function fetchSafetyVisitReservationData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<SafetyVisitReservation[]>> {
  try {
    console.log('从MySQL数据库获取安全馆预约数据，参数:', params);

    let query = 'SELECT * FROM pro_aqjygyysp WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM pro_aqjygyysp WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 日期范围过滤 - 使用申请日期SQRQ
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND SQRQ BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND SQRQ >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND SQRQ <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
    console.log('总记录数:', total);

    // 分页
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);

    query += ` ORDER BY SQRQ DESC LIMIT ${pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    const [rows] = await pool.execute(query, queryParams);

    const result = Array.isArray(rows) ? rows : [];

    // 映射字段
    const mappedResult = result.map((row: any) => ({
      GUID: row.GUID,
      SQRQ: row.SQRQ,
      SQR: row.SQR,
      BMXY: row.BMXY,
      LXDH: row.LXDH,
      SFLB: row.SFLB,
      SQCGSJDKS: row.SQCGSJDKS,
      SQCGSJJS: row.SQCGSJJS,
      SQSY: row.SQSY,
      SYS_USERNAME: row.SYS_USERNAME,
      SYS_DEPARTMENTNAME: row.SYS_DEPARTMENTNAME,
      SYSTEM_STATUS: row.SYSTEM_STATUS,
      SYSTEM_INCIDENT: row.SYSTEM_INCIDENT,
      SYSTEM_ENDTIME: row.SYSTEM_ENDTIME,
    }));

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize
    };
  } catch (error) {
    console.error('从数据库获取安全馆预约数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取安全馆预约统计数据
async function fetchSafetyVisitReservationStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<SafetyVisitReservationStats>> {
  try {
    console.log('从MySQL数据库获取安全馆预约统计数据，参数:', params);

    let baseQuery = 'FROM pro_aqjygyysp WHERE 1=1';
    const queryParams: any[] = [];

    // 日期范围过滤 - 使用申请日期SQRQ
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND SQRQ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      baseQuery += ' AND SQRQ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND SQRQ <= ?';
      queryParams.push(endDateRange.end);
    }

    // 并行执行查询
    const queries = [];

    // 1. 总数查询
    const countQuery = 'SELECT COUNT(*) as total ' + baseQuery;
    queries.push(pool.execute(countQuery, queryParams));

    // 2. 按日期统计
    const dateQuery = 'SELECT COUNT(*) as total, DATE(SQRQ) as date ' + baseQuery + ' GROUP BY DATE(SQRQ)';
    queries.push(pool.execute(dateQuery, queryParams));

    // 3. 按部门统计
    const deptQuery = 'SELECT COUNT(*) as total, SYS_DEPARTMENTNAME as department ' + baseQuery + ' GROUP BY SYS_DEPARTMENTNAME';
    queries.push(pool.execute(deptQuery, queryParams));

    // 4. 按状态统计
    const statusQuery = 'SELECT COUNT(*) as total, SYSTEM_STATUS as status ' + baseQuery + ' GROUP BY SYSTEM_STATUS';
    queries.push(pool.execute(statusQuery, queryParams));

    console.log('并行执行安全馆预约统计查询...');
    const results = await Promise.all(queries);

    const [countRows] = results[0] as any;
    const [dateRows] = results[1] as any;
    const [deptRows] = results[2] as any;
    const [statusRows] = results[3] as any;

    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    const deptResult = Array.isArray(deptRows) ? deptRows : [];
    const statusResult = Array.isArray(statusRows) ? statusRows : [];

    const byDate: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      const count = parseInt(row.total) || 0;
      byDate[date] = count;
    });

    deptResult.forEach((row: any) => {
      const department = row.department || '未知部门';
      const count = parseInt(row.total) || 0;
      byDepartment[department] = count;
    });

    statusResult.forEach((row: any) => {
      const status = row.status || '未知状态';
      const count = parseInt(row.total) || 0;
      byStatus[status] = count;
    });

    console.log(`安全馆预约统计数据: 总数=${total}, 日期分布=${Object.keys(byDate).length}天, 部门分布=${Object.keys(byDepartment).length}个, 状态分布=${Object.keys(byStatus).length}种`);

    return {
      success: true,
      data: {
        total: Number(total),
        byDate,
        byDepartment,
        byStatus
      }
    };
  } catch (error) {
    console.error('从数据库获取安全馆预约统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 安全馆预约数据API路由
app.get('/api/security/safety-visit-reservations', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchSafetyVisitReservationData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 安全馆预约统计API路由
app.get('/api/security/safety-visit-reservation-stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchSafetyVisitReservationStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 监控查询申请数据类型
interface JkcxsqData {
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
  SYS_USERNAME: string;
  SYS_COMPANYNAME: string;
  SYS_DEPARTMENTNAME: string;
  SYSTEM_PROCESSNAME: string;
  SYSTEM_STATUS: string;
  SYSTEM_ENDTIME: string;
}

// 从MySQL数据库获取监控查询申请数据
async function fetchJkcxsqData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从MySQL数据库获取监控查询申请数据，参数:', params);

    let query = 'SELECT * FROM pro_jkcxsq WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM pro_jkcxsq WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 日期范围过滤 - 使用RQ字段
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND RQ BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND RQ >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND RQ <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
    console.log('总记录数:', total);

    // 分页
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);

    query += ` ORDER BY RQ DESC LIMIT ${pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    const [rows] = await pool.execute(query, queryParams);

    const result = Array.isArray(rows) ? rows : [];

    console.log(`从数据库获取监控查询申请数据: ${result.length} 条记录`);

    return {
      success: true,
      data: result,
      total: total,
      page: page,
      pageSize: pageSize,
    };
  } catch (error: any) {
    console.error('从数据库获取监控查询申请数据失败:', error);
    return {
      success: false,
      error: error.message || '获取监控查询申请数据失败',
    };
  }
}

// 监控查询申请统计数据的函数
async function fetchJkcxsqStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<{ total: number; byStatus: Record<string, number>; byCategory: Record<string, number> }>> {
  try {
    console.log('从MySQL数据库获取监控查询申请统计数据，参数:', params);

    let baseQuery = 'FROM pro_jkcxsq WHERE 1=1';
    const queryParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND RQ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    }

    // 总数
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    // 按审批状态统计
    const [statusRows] = await pool.execute(`SELECT SYSTEM_STATUS, COUNT(*) as count ${baseQuery} GROUP BY SYSTEM_STATUS`, queryParams);
    const byStatus: Record<string, number> = {};
    if (Array.isArray(statusRows)) {
      (statusRows as any[]).forEach(row => {
        byStatus[row.SYSTEM_STATUS || '未知'] = row.count;
      });
    }

    // 按身份类别统计
    const [categoryRows] = await pool.execute(`SELECT SFLB, COUNT(*) as count ${baseQuery} GROUP BY SFLB`, queryParams);
    const byCategory: Record<string, number> = {};
    if (Array.isArray(categoryRows)) {
      (categoryRows as any[]).forEach(row => {
        byCategory[row.SFLB || '未知'] = row.count;
      });
    }

    return {
      success: true,
      data: { total, byStatus, byCategory }
    };
  } catch (error: any) {
    console.error('获取监控查询申请统计数据失败:', error);
    return {
      success: false,
      error: error.message || '获取统计数据失败'
    };
  }
}

// 监控查询申请数据API路由
app.get('/api/security/jkcxsq', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchJkcxsqData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 监控查询记录数据API路由 (前端调用)
app.get('/api/security/monitor-query-record', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize } = req.query;
    const result = await fetchJkcxsqData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 监控查询记录统计数据API路由 (前端调用)
app.get('/api/security/monitor-query-record-stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchJkcxsqStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 监控查询申请统计数据API路由
app.get('/api/security/jkcxsq-stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchJkcxsqStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// ==================== 警情统计 (biz_jqsb) ====================

interface PoliceIncidentRecord {
  GUID: string;
  LB: string | null;
  RQ: string | null;
  GLDW: string | null;
  JQFL: string | null;
  SJ: string | null;
  LCQY: string | null;
  FJHCP: string | null;
  FJMCCLSYR: string | null;
  QKSM: string | null;
  JLXZQ: string | null;
}

interface PoliceIncidentStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  byType: Record<string, number>;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
}

async function fetchPoliceIncidentData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  incidentType?: string;
}): Promise<ExternalApiResponse<PoliceIncidentRecord[]>> {
  try {
    console.log('[警情数据] 请求参数:', params);

    let query = 'SELECT * FROM biz_jqsb WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM biz_jqsb WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND SJ BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start, endDateRange.end);
      countParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND SJ >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start);
      countParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND SJ <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.end);
      countParams.push(endDateRange.end);
    }

    if (params?.incidentType) {
      const typeCondition = ' AND JQFL = ?';
      query += typeCondition;
      countQuery += typeCondition;
      queryParams.push(params.incidentType);
      countParams.push(params.incidentType);
    }

    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 10)));
    const offset = Math.max(0, (page - 1) * pageSize);

    const [countRows] = await iduoBusinessPool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? Number((countRows[0] as any).total) : 0;

    query += ` ORDER BY SJ DESC LIMIT ${pageSize} OFFSET ${offset}`;

    const [rows] = await iduoBusinessPool.execute(query, queryParams);
    const result = Array.isArray(rows) ? rows : [];

    const mappedResult = result.map((row: any) => ({
      GUID: row.GUID || row.guid,
      LB: row.LB || row.lb,
      RQ: row.RQ ? formatDateTime(row.RQ) : null,
      GLDW: row.GLDW || row.gldw,
      JQFL: row.JQFL || row.jqfl,
      SJ: row.SJ ? formatDateTime(row.SJ) : null,
      LCQY: row.LCQY || row.lcqy,
      FJHCP: row.FJHCP || row.fjhcp,
      FJMCCLSYR: row.FJMCCLSYR || row.fjmcclsyr,
      QKSM: row.QKSM || row.qksm,
      JLXZQ: row.JLXZQ || row.jlxzq,
    }));

    return {
      success: true,
      data: mappedResult,
      total: Number(total),
      page,
      pageSize,
    };
  } catch (error) {
    console.error('[警情数据] 查询失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function fetchPoliceIncidentStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<PoliceIncidentStats>> {
  try {
    console.log('[警情统计] 请求参数:', params);

    let baseQuery = 'FROM biz_jqsb WHERE 1=1';
    const queryParams: any[] = [];

    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND SJ BETWEEN ? AND ?';
      queryParams.push(startDateRange.start, endDateRange.end);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      baseQuery += ' AND SJ >= ?';
      queryParams.push(startDateRange.start);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      baseQuery += ' AND SJ <= ?';
      queryParams.push(endDateRange.end);
    }

    const [countRows] = await iduoBusinessPool.execute('SELECT COUNT(*) as total ' + baseQuery, queryParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? Number((countRows[0] as any).total) : 0;

    const [typeRows] = await iduoBusinessPool.execute(
      'SELECT JQFL as type, COUNT(*) as count ' + baseQuery + ' GROUP BY JQFL',
      queryParams
    );

    const [dateRows] = await iduoBusinessPool.execute(
      'SELECT COUNT(*) as count, DATE(SJ) as date ' + baseQuery + ' GROUP BY DATE(SJ)',
      queryParams
    );

    const [deptRows] = await iduoBusinessPool.execute(
      'SELECT GLDW as department, COUNT(*) as count ' + baseQuery + ' GROUP BY GLDW',
      queryParams
    );

    const byType: Record<string, number> = {};
    const typeResult = Array.isArray(typeRows) ? typeRows : [];
    typeResult.forEach((row: any) => {
      const type = row.type || '未知类型';
      byType[type] = Number(row.count) || 0;
    });

    const byDate: Record<string, number> = {};
    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    dateResult.forEach((row: any) => {
      let dateStr = 'unknown';
      if (row.date instanceof Date) {
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (row.date) {
        dateStr = row.date.toString().substring(0, 10);
      }
      byDate[dateStr] = Number(row.count) || 0;
    });

    const byDepartment: Record<string, number> = {};
    const deptResult = Array.isArray(deptRows) ? deptRows : [];
    deptResult.forEach((row: any) => {
      const dept = parseDepartmentName(row.department);
      byDepartment[dept] = Number(row.count) || 0;
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStartStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;

    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const yearStartStr = `${now.getFullYear()}-01-01`;

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;

    for (const [dateStr, count] of Object.entries(byDate)) {
      if (dateStr >= todayStr) today += count;
      if (dateStr >= weekStartStr) thisWeek += count;
      if (dateStr >= monthStartStr) thisMonth += count;
      if (dateStr >= yearStartStr) thisYear += count;
    }

    return {
      success: true,
      data: {
        total,
        today,
        thisWeek,
        thisMonth,
        thisYear,
        byType,
        byDate,
        byDepartment,
      },
    };
  } catch (error) {
    console.error('[警情统计] 查询失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function formatDateTime(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    const hours = String(val.getHours()).padStart(2, '0');
    const minutes = String(val.getMinutes()).padStart(2, '0');
    const seconds = String(val.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  return val.toString();
}

function parseDepartmentName(val: string | undefined | null): string {
  if (!val) return '-';
  try {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name) {
        return parsed[0].name;
      }
    }
  } catch (e) {
    // ignore
  }
  return val;
}

// 警情数据 API 路由
app.get('/api/security/police-incident-data', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page, pageSize, incidentType } = req.query;
    const result = await fetchPoliceIncidentData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      incidentType: typeof incidentType === 'string' ? incidentType : undefined,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 警情统计 API 路由
app.get('/api/security/police-incident-stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fetchPoliceIncidentStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    });
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 在线用户数据缓存类
// 说明：该缓存刷新会触发 Oracle 全表扫描 + MySQL 大批量 IN 查询，频率过高会拖慢同进程内其它接口（例如车辆分页 COUNT）。
class OnlineUserCache {
  private statsData: any = null;
  private listData: Map<string, any> = new Map();
  private lastUpdated: Date | null = null;
  private isUpdating: boolean = false;

  /**
   * 仅刷新统计（轻量）：不拉全量在线用户列表，不做 MySQL 人员关联。
   */
  async refreshStatsOnly() {
    if (this.isUpdating) {
      console.log('[在线用户缓存] 正在刷新中，跳过(统计)');
      return;
    }
    this.isUpdating = true;
    console.log('[在线用户缓存] 开始刷新统计(轻量)...');

    try {
      if (!oraclePool && !oraclePool2) {
        console.log('[在线用户缓存] 无可用Oracle连接');
        return;
      }

      const promises: Promise<any>[] = [];
      if (oraclePool) {
        promises.push(queryOnlineUserStatsFromPool(oraclePool, 'DRCOM.ZAIXIANBIAO'));
      }
      if (oraclePool2) {
        promises.push(queryOnlineUserStatsFromPool(oraclePool2, 'DRCOM.ZAIXIANBIAO1'));
      }

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`在线用户统计(库${i+1}): 总=${r.total}, 总行数=${r.totalRows}, 学生=${r.students}, 教职工=${r.staff}, 其他=${r.others}`);
      }

      let totalStudents = 0;
      let totalStaff = 0;
      let totalOthers = 0;
      const mergedHourlyCount: Record<string, number> = {};

      for (const r of results) {
        totalStudents += r.students;
        totalStaff += r.staff;
        totalOthers += r.others;
        for (const [hour, count] of Object.entries(r.hourlyCount)) {
          mergedHourlyCount[hour] = (mergedHourlyCount[hour] || 0) + Number(count);
        }
      }

      const byTime: Record<string, number> = {};
      Object.keys(mergedHourlyCount)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach((hour) => {
          byTime[hour] = mergedHourlyCount[hour];
        });

      const total = totalStudents + totalStaff + totalOthers;
      const rawTotal = results.reduce((sum, r) => sum + r.total, 0);
      console.log(
        `[在线用户缓存] 合并(统计): 各库原始合计=${rawTotal}, 总=${total}, 学生=${totalStudents}, 教职工=${totalStaff}, 其他=${totalOthers}`,
      );

      this.statsData = {
        success: true,
        data: {
          total,
          students: totalStudents,
          staff: totalStaff,
          others: totalOthers,
          byTime,
          byDeviceType: {},
          byLocation: {},
        },
      };

      this.lastUpdated = new Date();
      console.log(`[在线用户缓存] 统计刷新完成，共 ${total} 人`);
    } catch (error) {
      console.error('[在线用户缓存] 统计刷新失败:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 全量刷新（重）：统计 + 在线用户列表 + MySQL 人员关联。
   */
  async refreshFull() {
    if (this.isUpdating) {
      console.log('[在线用户缓存] 正在刷新中，跳过(全量)');
      return;
    }
    this.isUpdating = true;
    console.log('[在线用户缓存] 开始全量刷新...');

    try {
      if (!oraclePool && !oraclePool2) {
        console.log('[在线用户缓存] 无可用Oracle连接');
        return;
      }

      const promises: Promise<any>[] = [];
      if (oraclePool) {
        promises.push(queryOnlineUserStatsFromPool(oraclePool, 'DRCOM.ZAIXIANBIAO'));
      }
      if (oraclePool2) {
        promises.push(queryOnlineUserStatsFromPool(oraclePool2, 'DRCOM.ZAIXIANBIAO1'));
      }

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        console.log(`在线用户统计(库${i+1}): 总=${r.total}, 总行数=${r.totalRows}, 学生=${r.students}, 教职工=${r.staff}, 其他=${r.others}`);
      }

      // 直接合并各库统计结果（不去重）
      let totalStudents = 0;
      let totalStaff = 0;
      let totalOthers = 0;
      const mergedHourlyCount: Record<string, number> = {};

      for (const r of results) {
        totalStudents += r.students;
        totalStaff += r.staff;
        totalOthers += r.others;
        for (const [hour, count] of Object.entries(r.hourlyCount)) {
          mergedHourlyCount[hour] = (mergedHourlyCount[hour] || 0) + Number(count);
        }
      }

      const byTime: Record<string, number> = {};
      Object.keys(mergedHourlyCount).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
        byTime[hour] = mergedHourlyCount[hour];
      });

      const total = totalStudents + totalStaff + totalOthers;
      const rawTotal = results.reduce((sum, r) => sum + r.total, 0);
      console.log(`[在线用户缓存] 合并: 各库原始合计=${rawTotal}, 总=${total}, 学生=${totalStudents}, 教职工=${totalStaff}, 其他=${totalOthers}`);

      this.statsData = {
        success: true,
        data: { total, students: totalStudents, staff: totalStaff, others: totalOthers, byTime, byDeviceType: {}, byLocation: {} }
      };

      // 同时刷新列表数据
      await this.refreshListData();

      this.lastUpdated = new Date();
      console.log(`[在线用户缓存] 全量刷新完成，共 ${total} 人`);
    } catch (error) {
      console.error('[在线用户缓存] 全量刷新失败:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  // 兼容旧调用：默认走全量（启动时可用一次）
  async refresh() {
    return await this.refreshFull();
  }

  // 刷新列表数据（从两个库拉取并合并，不去重）
  private async refreshListData() {
    const allUsers: any[] = [];
    const seenIds = new Set<string>();

    async function queryFromPool(pool: oracledb.Pool | null, tableName: string) {
      if (!pool) return;
      const connection = await pool.getConnection();
      try {
        const dataSql = `SELECT FLDUSERID, FLDUSERNAME, FLDUSERREALNAME, FLDLOGINDATE, FLDUSERMAC, FLDUSERIP, FLDBINDACCOUNT
          FROM ${tableName}
          ORDER BY FLDLOGINDATE DESC, FLDUSERID DESC`;
        const result = await connection.execute(dataSql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const rows = (result.rows as any[] || []);
        for (const row of rows) {
          const username = row.FLDUSERNAME;
          const uniqueKey = `${username}-${row.FLDUSERID}`;
          if (username && !seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            allUsers.push({
              fldUserId: row.FLDUSERID,
              fldUserName: row.FLDUSERNAME,
              fldUserRealName: row.FLDUSERREALNAME,
              fldLoginDate: row.FLDLOGINDATE,
              fldUserMac: row.FLDUSERMAC,
              fldUserIp: row.FLDUSERIP,
              fldBindAccount: row.FLDBINDACCOUNT,
              department: '-',
              gender: '-',
              userType: getUserType(row.FLDUSERNAME)
            });
          }
        }
      } finally {
        await connection.close();
      }
    }

    await Promise.all([
      queryFromPool(oraclePool, 'DRCOM.ZAIXIANBIAO'),
      queryFromPool(oraclePool2, 'DRCOM.ZAIXIANBIAO1'),
    ]);

    // 关联MySQL人员表
    try {
      const allUsersArray = Array.from(allUsers.values());
      const usernames = allUsersArray.map((u: any) => {
        const name = u.fldUserName;
        if (name && /(yd|dx)$/i.test(name)) {
          return name.substring(0, name.length - 2);
        }
        return name;
      });
      const uniqueUsernames = [...new Set(usernames)];

      if (uniqueUsernames.length > 0) {
        // 分批查询，避免IN参数过多
        const batchSize = 500;
        const staffMap = new Map();
        const studentMap = new Map();

        for (let i = 0; i < uniqueUsernames.length; i += batchSize) {
          const batch = uniqueUsernames.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');

          const [staffRows] = await pool.execute(
            `SELECT bh, dwmc, xbm FROM t_rs_grzhxx WHERE bh IN (${placeholders})`,
            batch
          );
          const [studentRows] = await pool.execute(
            `SELECT xh, jgmc, xbm FROM t_jw_xsjbxx WHERE xh IN (${placeholders})`,
            batch
          );

          const staffArr = Array.isArray(staffRows) ? staffRows as any[] : [];
          const studentArr = Array.isArray(studentRows) ? studentRows as any[] : [];

          staffArr.forEach((r: any) => staffMap.set(r.bh, r));
          studentArr.forEach((r: any) => studentMap.set(r.xh, r));
        }

        allUsersArray.forEach((user: any) => {
          const nameWithoutSuffix = (user.fldUserName && /(yd|dx)$/i.test(user.fldUserName))
            ? user.fldUserName.substring(0, user.fldUserName.length - 2)
            : user.fldUserName;

          const staffInfo = staffMap.get(nameWithoutSuffix) || staffMap.get(user.fldUserName);
          const studentInfo = studentMap.get(nameWithoutSuffix) || studentMap.get(user.fldUserName);

          if (staffInfo) {
            user.department = staffInfo.dwmc || '-';
            user.gender = staffInfo.xbm === '1' ? '男' : staffInfo.xbm === '2' ? '女' : '-';
          } else if (studentInfo) {
            user.department = studentInfo.jgmc || '-';
            user.gender = studentInfo.xbm === '1' ? '男' : studentInfo.xbm === '2' ? '女' : '-';
          }
        });
      }
    } catch (err) {
      console.error('[在线用户缓存] 关联人员信息失败:', err);
    }

    this.listData = new Map(allUsers.map((u, i) => [String(i), u]));
  }

  getStats() {
    return this.statsData || {
      success: true,
      data: { total: 0, students: 0, staff: 0, others: 0, byTime: {}, byDeviceType: {}, byLocation: {} }
    };
  }

  getList(page: number, pageSize: number, userType?: string) {
    let users = Array.from(this.listData.values());

    // 按用户类型过滤
    if (userType && userType !== 'all') {
      const typeMap: Record<string, string> = { '学生': '学生', 'student': '学生', '教职工': '教职工', 'staff': '教职工', '其他': '其他', 'other': '其他' };
      const filterType = typeMap[userType] || userType;
      users = users.filter((u: any) => u.userType === filterType);
    }

    const total = users.length;
    const offset = (page - 1) * pageSize;
    const pagedUsers = users.slice(offset, offset + pageSize);

    return { success: true, data: pagedUsers, total };
  }

  getLastUpdated() {
    return this.lastUpdated;
  }
}

const onlineUserCache = new OnlineUserCache();

function parsePositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 在线用户缓存刷新策略（默认：统计 15 分钟；全量列表 60 分钟）
// - ONLINE_USER_STATS_REFRESH_MS: 轻量统计刷新间隔
// - ONLINE_USER_FULL_REFRESH_MS: 全量列表+关联刷新间隔
// - ONLINE_USER_CACHE_DISABLED=true: 完全关闭定时刷新（仍保留手动触发/首次启动行为）
const ONLINE_USER_STATS_REFRESH_MS = parsePositiveIntEnv('ONLINE_USER_STATS_REFRESH_MS', 15 * 60 * 1000);
const ONLINE_USER_FULL_REFRESH_MS = parsePositiveIntEnv('ONLINE_USER_FULL_REFRESH_MS', 60 * 60 * 1000);
const ONLINE_USER_CACHE_DISABLED = String(process.env.ONLINE_USER_CACHE_DISABLED || '').toLowerCase() === 'true';

// 启动时：先做一次全量（保证列表可用），随后进入低频刷新
setTimeout(() => {
  if (ONLINE_USER_CACHE_DISABLED) {
    console.log('[在线用户缓存] 已禁用定时刷新 (ONLINE_USER_CACHE_DISABLED=true)');
    return;
  }
  onlineUserCache.refreshFull();
}, 2000);

// 定时：统计更频繁，但避免每分钟做最重的全量列表刷新
setInterval(() => {
  if (ONLINE_USER_CACHE_DISABLED) return;
  onlineUserCache.refreshStatsOnly();
}, ONLINE_USER_STATS_REFRESH_MS);

setInterval(() => {
  if (ONLINE_USER_CACHE_DISABLED) return;
  onlineUserCache.refreshFull();
}, ONLINE_USER_FULL_REFRESH_MS);

// 判断是否为学生用户名（正则规则）
function isStudentUsername(username: string): boolean {
  if (!username) return false;
  const len = username.length;
  if (len >= 8 && len <= 12 && /^[0-9]+$/.test(username) && (username.startsWith('20') || username.startsWith('19'))) {
    return true;
  }
  if (len >= 8 && /^[0-9]+(yd|dx)$/i.test(username)) {
    return true;
  }
  return false;
}

// 用户类型判断（内部使用，返回英文标识）
function getUserTypeKey(username: string): 'student' | 'staff' | 'other' {
  if (!username) return 'other';
  // 优先使用教职工工号缓存匹配
  if (staffIdCacheLoaded && staffIdSet.has(username)) {
    return 'staff';
  }
  if (isStudentUsername(username)) {
    return 'student';
  }
  return 'other';
}

// 从单个Oracle库查询在线用户统计
async function queryOnlineUserStatsFromPool(pool: oracledb.Pool, tableName: string) {
  const connection = await pool.getConnection();
  try {
    const [totalResult, totalRowsResult, byTimeResult] = await Promise.all([
      connection.execute(`
        SELECT COUNT(FLDUSERNAME) as cnt FROM ${tableName}
      `, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute(`
        SELECT COUNT(*) as cnt FROM ${tableName}
      `, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute(`
        SELECT FLDUSERNAME, TO_CHAR(FLDLOGINDATE, 'YYYY-MM-DD HH24:MI:SS') as logintime
        FROM ${tableName}
        WHERE FLDLOGINDATE >= SYSDATE - 1
      `, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
    ]);

    const total = Number((totalResult.rows as any[])?.[0]?.CNT) || 0;
    const totalRows = Number((totalRowsResult.rows as any[])?.[0]?.CNT) || 0;

    // 收集所有在线用户名（不去重，保留原始记录）
    const usernames: string[] = [];
    const hourlyCount: Record<string, number> = {};
    const now = new Date();
    const todayBeijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayDateStr = todayBeijing.toISOString().split('T')[0];

    (byTimeResult.rows as any[] || []).forEach(row => {
      const username = row.FLDUSERNAME;
      const loginTime = row.LOGINTIME;
      if (username) usernames.push(username);
      if (loginTime) {
        const utcDate = new Date(loginTime);
        const beijingDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
        const beijingDateStr = beijingDate.toISOString().split('T')[0];
        const hour = beijingDate.toISOString().split('T')[1].substring(0, 2);
        if (beijingDateStr === todayDateStr) {
          hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        }
      }
    });

    // 基于教职工工号缓存进行分类（不去重，逐条计数）
    let students = 0;
    let staff = 0;
    let others = 0;

    for (const username of usernames) {
      if (staffIdCacheLoaded && staffIdSet.has(username)) {
        staff++;
      } else if (isStudentUsername(username)) {
        students++;
      } else {
        others++;
      }
    }

    return { students, staff, total, totalRows, others, hourlyCount };
  } finally {
    await connection.close();
  }
}

// 获取在线用户统计数据（合并两个Oracle库）
async function fetchOnlineUserStats() {
  if (!oraclePool && !oraclePool2) {
    return {
      success: true,
      data: { total: 0, students: 0, staff: 0, others: 0, byTime: {}, byDeviceType: {}, byLocation: {} }
    };
  }

  try {
    const promises: Promise<any>[] = [];
    if (oraclePool) {
      promises.push(queryOnlineUserStatsFromPool(oraclePool, 'DRCOM.ZAIXIANBIAO'));
    }
    if (oraclePool2) {
      promises.push(queryOnlineUserStatsFromPool(oraclePool2, 'DRCOM.ZAIXIANBIAO1'));
    }

    const results = await Promise.all(promises);

    // 打印各库独立数据
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`在线用户统计(库${i+1}): 总=${r.total}, 总行数=${r.totalRows}, 学生=${r.students}, 教职工=${r.staff}, 其他=${r.others}`);
    }

    // 直接合并各库统计结果（不去重）
    let totalStudents = 0;
    let totalStaff = 0;
    let totalOthers = 0;
    const mergedHourlyCount: Record<string, number> = {};

    for (const r of results) {
      totalStudents += r.students;
      totalStaff += r.staff;
      totalOthers += r.others;
      for (const [hour, count] of Object.entries(r.hourlyCount)) {
        mergedHourlyCount[hour] = (mergedHourlyCount[hour] || 0) + Number(count);
      }
    }

    const byTime: Record<string, number> = {};
    Object.keys(mergedHourlyCount).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
      byTime[hour] = mergedHourlyCount[hour];
    });

    const total = totalStudents + totalStaff + totalOthers;
    const rawTotal = results.reduce((sum, r) => sum + r.total, 0);
    console.log(`在线用户统计(合并): 各库原始合计=${rawTotal}, 总=${total}, 学生=${totalStudents}, 教职工=${totalStaff}, 其他=${totalOthers}`);

    return {
      success: true,
      data: { total, students: totalStudents, staff: totalStaff, others: totalOthers, byTime, byDeviceType: {}, byLocation: {} }
    };
  } catch (error) {
    console.error('获取在线用户统计失败:', error);
    return { success: false, error: (error as Error).message };
  }
}

// 人员在线统计API - 返回缓存数据
app.get('/api/personnel-online-stats', async (req: Request, res: Response) => {
  try {
    const result = onlineUserCache.getStats();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 人员在线数据API - 返回缓存数据
app.get('/api/personnel-online', async (req: Request, res: Response) => {
  try {
    const { page, pageSize, userType } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const size = parseInt(pageSize as string) || 100;
    
    const result = onlineUserCache.getList(pageNum, size, typeof userType === 'string' ? userType : undefined);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 辅助函数：判断用户类型（中文显示）
function getUserType(username: string): string {
  if (!username) return '其他';
  // 优先使用教职工工号缓存匹配
  if (staffIdCacheLoaded && staffIdSet.has(username)) {
    return '教职工';
  }
  if (isStudentUsername(username)) {
    return '学生';
  }
  return '其他';
}

// 404处理中间件 - 移到最后，在所有路由之后
// app.use('*', (req: Request, res: Response) => {
//   console.log('[404] 未找到路径: ' + req.path);
//   res.status(404).json({ 
//     success: false,
//     error: 'API端点不存在', 
//     path: req.path,
//     message: '请检查API路径是否正确'
//   });
// });

// 错误处理中间件
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('未处理的错误:', err);
  res.status(500).json({ error: '内部服务器错误' });
});

// 错误处理中间件 - 确保在所有路由之后添加
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('未捕获的错误:', err);
  console.error('错误堆栈:', err.stack);
  
  // 确保返回JSON格式的错误响应
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message || '未知错误',
    timestamp: new Date().toISOString()
  });
});

// 设备数据类型
interface DeviceData {
  ID: number;
  DEVICE_CODE: string;
  DEVICE_NAME: string;
  DEVICE_SN: string;
  DEVICE_CATEGORY: number;
  DEVICE_TYPE: number;
  TYPE: string;
  DEVICE_MANUFACTURER: string;
  DEVICE_IP: string;
  DEVICE_PORT: number;
  OWNER_CODE: string;
  IS_ONLINE: number;
  SUB_SYSTEM: string;
  UPDATE_TIME: string;
}

// 从evo_brm获取设备数据
async function fetchDeviceData(params?: {
  type?: 'all' | 'barrier-gate' | 'camera';
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从evo_brm获取设备数据，参数:', params);

    // 根据类型选择数据库连接池
    const pool = params?.type === 'barrier-gate' ? barrierPool : cameraPool;
    const dbName = params?.type === 'barrier-gate' ? '闸机设备库(10.151.160.32)' : '监控设备库(10.14.0.102)';

    // 设备种类: 1-摄像头/闸机, 2-门禁设备等
    let categoryFilter = '';
    if (params?.type === 'barrier-gate') {
      // 闸机：在 10.151.160.32 库中，闸机主要在 DEVICE_CATEGORY = 8
      categoryFilter = " AND DEVICE_CATEGORY = 8";
    } else if (params?.type === 'camera') {
      // 摄像头
      categoryFilter = " AND DEVICE_CATEGORY = 1";
    }

    let query = `SELECT * FROM device WHERE 1=1${categoryFilter}`;
    let countQuery = `SELECT COUNT(*) as total FROM device WHERE 1=1${categoryFilter}`;

    // 执行总数查询
    const [countRows] = await pool.execute(countQuery);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    // 分页
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);

    query += ` ORDER BY ID DESC LIMIT ${pageSize} OFFSET ${offset}`;

    console.log(`执行设备查询 [${dbName}]:`, query);
    const [rows] = await pool.execute(query);

    const result = Array.isArray(rows) ? rows : [];

    console.log(`从${dbName}获取设备数据: ${result.length} 条记录`);

    return {
      success: true,
      data: result,
      total: total,
      page: page,
      pageSize: pageSize,
    };
  } catch (error: any) {
    console.error('从evo_brm获取设备数据失败:', error);
    return {
      success: false,
      error: error.message || '获取设备数据失败',
    };
  }
}

// 获取设备统计数据
async function fetchDeviceStats(): Promise<ExternalApiResponse<{ total: number; online: number; offline: number; byCategory: Record<string, number>; barrierGateCount: number }>> {
  try {
    // 使用监控设备数据库进行统计
    // 总数
    const [totalRows] = await cameraPool.execute('SELECT COUNT(*) as total FROM device');
    const total = Array.isArray(totalRows) && totalRows.length > 0 ? (totalRows[0] as any).total : 0;

    // 在线数
    const [onlineRows] = await cameraPool.execute('SELECT COUNT(*) as total FROM device WHERE IS_ONLINE = 1');
    const online = Array.isArray(onlineRows) && onlineRows.length > 0 ? (onlineRows[0] as any).total : 0;

    // 离线数
    const [offlineRows] = await cameraPool.execute('SELECT COUNT(*) as total FROM device WHERE IS_ONLINE = 0');
    const offline = Array.isArray(offlineRows) && offlineRows.length > 0 ? (offlineRows[0] as any).total : 0;

    // 按类别统计
    const [categoryRows] = await cameraPool.execute('SELECT DEVICE_CATEGORY, COUNT(*) as count FROM device GROUP BY DEVICE_CATEGORY');
    const byCategory: Record<string, number> = {};
    if (Array.isArray(categoryRows)) {
      (categoryRows as any[]).forEach(row => {
        const cat = row.DEVICE_CATEGORY;
        let categoryName = '其他';
        if (cat === 1) {
          categoryName = '摄像头/闸机';
        } else if (cat === 2) {
          categoryName = '门禁';
        }
        byCategory[categoryName] = row.count;
      });
    }

    // 获取闸机数量（从闸机数据库）
    const barrierFilter = " AND DEVICE_CATEGORY = 1 AND (DEVICE_NAME LIKE '%闸%' OR DEVICE_NAME LIKE '%门禁%' OR DEVICE_NAME LIKE '%道闸%' OR DEVICE_NAME LIKE '%门岗%' OR DEVICE_NAME LIKE '%岗亭%' OR DEVICE_NAME LIKE '%出入口%')";
    const [barrierRows] = await barrierPool.execute('SELECT COUNT(*) as total FROM device WHERE 1=1' + barrierFilter);
    const barrierGateCount = Array.isArray(barrierRows) && barrierRows.length > 0 ? (barrierRows[0] as any).total : 0;

    return {
      success: true,
      data: { total, online, offline, byCategory, barrierGateCount }
    };
  } catch (error: any) {
    console.error('获取设备统计数据失败:', error);
    return {
      success: false,
      error: error.message || '获取设备统计数据失败'
    };
  }
}

// 摄像头设备API路由
app.get('/api/camera/devices', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = req.query;
    const result = await fetchDeviceData({
      type: 'camera',
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 摄像头设备统计API路由
app.get('/api/camera/stats', async (req: Request, res: Response) => {
  try {
    const result = await fetchDeviceStats();
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 闸机设备API路由
app.get('/api/barrier-gate/devices', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = req.query;
    const result = await fetchDeviceData({
      type: 'barrier-gate',
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 100,
    });
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 获取闸机设备统计数据
async function fetchBarrierGateStats(): Promise<ExternalApiResponse<{ total: number; online: number; offline: number; byCategory: Record<string, number> }>> {
  try {
    // 闸机筛选条件 (在 10.151.160.32 库中，闸机主要在 DEVICE_CATEGORY = 8)
    const barrierFilter = " AND DEVICE_CATEGORY = 8";
    
    // 总数
    const [totalRows] = await barrierPool.execute('SELECT COUNT(*) as total FROM device WHERE 1=1' + barrierFilter);
    const total = Array.isArray(totalRows) && totalRows.length > 0 ? (totalRows[0] as any).total : 0;

    // 在线数
    const [onlineRows] = await barrierPool.execute('SELECT COUNT(*) as total FROM device WHERE IS_ONLINE = 1' + barrierFilter);
    const online = Array.isArray(onlineRows) && onlineRows.length > 0 ? (onlineRows[0] as any).total : 0;

    // 离线数
    const [offlineRows] = await barrierPool.execute('SELECT COUNT(*) as total FROM device WHERE IS_ONLINE = 0' + barrierFilter);
    const offline = Array.isArray(offlineRows) && offlineRows.length > 0 ? (offlineRows[0] as any).total : 0;

    return {
      success: true,
      data: { total, online, offline, byCategory: { '闸机': total } }
    };
  } catch (error: any) {
    console.error('获取闸机设备统计数据失败:', error);
    return {
      success: false,
      error: error.message || '获取闸机设备统计数据失败'
    };
  }
}

// 闸机设备统计API路由
app.get('/api/barrier-gate/stats', async (req: Request, res: Response) => {
  try {
    const result = await fetchBarrierGateStats();
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

// 404处理中间件 - 放在所有路由之后
app.use((req: Request, res: Response) => {
  console.log('[404] 未找到路径: ' + req.path);
  res.status(404).json({ 
    success: false,
    error: 'API端点不存在', 
    path: req.path,
    message: '请检查API路径是否正确'
  });
});

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`内网API代理服务运行在端口 ${Number(PORT)}`);
  console.log(`车辆API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle`);
  console.log(`车辆统计API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-stats`);
  console.log(`车辆登记API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-registration`);
  console.log(`访客API端点: http://0.0.0.0:${Number(PORT)}/api/visitor`);
  console.log(`所有车辆登记数据端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-registration-all`);
  console.log(`安全馆预约API端点: http://0.0.0.0:${Number(PORT)}/api/security/safety-visit-reservations`);
  console.log(`安全馆预约统计API端点: http://0.0.0.0:${Number(PORT)}/api/security/safety-visit-reservation-stats`);
  console.log(`请使用服务器实际IP地址替换0.0.0.0以供局域网访问`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
  });
});




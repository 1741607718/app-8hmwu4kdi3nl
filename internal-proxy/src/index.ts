import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as https from 'https';
import mysql from 'mysql2/promise';

const app = express();
const PORT = process.env.PORT || 3003;

// MySQL数据库连接配置
const dbConfig = {
  host: '10.145.251.29',
  port: 3306,
  user: 'dtw',
  password: 'root',
  database: 'datacenter',
  connectTimeout: 60000, // 60秒连接超时
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

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
    } else {
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
      const totalCount = response.data?.data?.Total || 0;
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
  maxPages?: number;
  pageSize?: number;
  speedingOnly?: boolean;
}): Promise<ExternalApiResponse<VehicleApiData[]>> {
  // 直接调用数据库查询，支持分页参数
  return await fetchVehicleDataFromDatabase({
    ...params,
    // 如果没有指定pageSize，默认给一个较大的值
    pageSize: params?.pageSize || 1000,
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

// 新增车辆统计API路由
app.get('/api/vehicle-stats', async (req: Request, res: Response) => {
  console.log(`[API] /api/vehicle-stats route hit - Query: ${JSON.stringify(req.query)}`);
  try {
    const { startDate, endDate, speedingOnly } = req.query;

    // 直接从数据库获取统计数据
    const result = await fetchVehicleStats({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      speedingOnly: speedingOnly === 'true',
    });

    if (result.success) {
      res.json(result.data);
    } else {
      console.error('获取车辆统计失败:', result.error);
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('获取车辆统计失败:', error);
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
    const { startDate, endDate, maxPages, pageSize, speedingOnly } = req.query;
    const result = await fetchAllVehicleData({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      maxPages: maxPages ? parseInt(maxPages as string) : 20,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      speedingOnly: speedingOnly === 'true',
    });
    if (result.success) res.json(result); else res.status(500).json({ error: result.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '内部服务器错误' });
  }
});

app.post('/api/vehicle-all', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, maxPages, pageSize, speedingOnly } = req.body;
    const result = await fetchAllVehicleData({
      startDate,
      endDate,
      maxPages: maxPages || 20,
      pageSize,
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

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;
    console.log('总记录数:', total);

    // 分页
    const page = Math.max(1, Math.floor(Number(params?.page || 1)));
    const pageSize = Math.max(1, Math.floor(Number(params?.pageSize || 100)));
    const offset = Math.max(0, (page - 1) * pageSize);

    query += ` ORDER BY zpsj DESC LIMIT ${pageSize} OFFSET ${offset}`;

    console.log('执行查询:', query);
    const [rows] = await pool.execute(query, queryParams);

    const result = Array.isArray(rows) ? rows : [];

    // 映射字段
    const mappedResult = result.map((row: any) => ({
      cph: row.cph,
      qcysmc: row.qcysmc,
      sbtdmc: row.sbtdmc,
      zpsj: row.zpsj,
      cs: row.cs,
      // 其他字段根据需要添加
    }));

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
  byDate: Record<string, number>;
  byLocation: Record<string, number>;
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

    // 超速过滤
    if (params?.speedingOnly) {
      baseQuery += ' AND cs > 30';
    }

    // 并行执行查询
    const queries = [];

    // 1. 总数查询
    const countQuery = 'SELECT COUNT(*) as total ' + baseQuery;
    queries.push(pool.execute(countQuery, queryParams));

    // 2. 按日期统计
    const dateQuery = 'SELECT COUNT(*) as total, DATE(zpsj) as date ' + baseQuery + ' GROUP BY DATE(zpsj)';
    queries.push(pool.execute(dateQuery, queryParams));

    // 3. 按地点统计 (如果是超速统计，还需要获取最高车速)
    let locationQuery = '';
    if (params?.speedingOnly) {
      locationQuery = 'SELECT COUNT(*) as total, MAX(cs) as max_speed, sbtdmc as location ' + baseQuery + ' GROUP BY sbtdmc';
    } else {
      locationQuery = 'SELECT COUNT(*) as total, sbtdmc as location ' + baseQuery + ' GROUP BY sbtdmc';
    }
    queries.push(pool.execute(locationQuery, queryParams));

    console.log('并行执行统计查询...');
    const results = await Promise.all(queries);

    const [countRows] = results[0] as any;
    const [dateRows] = results[1] as any;
    const [locationRows] = results[2] as any;

    const total = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any).total : 0;

    const dateResult = Array.isArray(dateRows) ? dateRows : [];
    const locationResult = Array.isArray(locationRows) ? locationRows : [];

    const byDate: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const maxSpeedByLocation: Record<string, number> = {};

    dateResult.forEach((row: any) => {
      const date = row.date ? row.date.toString() : 'unknown';
      // 如果是Date对象，格式化为YYYY-MM-DD
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
      const location = row.location || '未知地点';
      const count = parseInt(row.total) || 0;
      byLocation[location] = count;

      if (params?.speedingOnly && row.max_speed) {
        maxSpeedByLocation[location] = parseInt(row.max_speed) || 0;
      }
    });

    console.log(`车辆统计数据: 总数=${total}, 日期分布=${Object.keys(byDate).length}天, 地点分布=${Object.keys(byLocation).length}个`);

    return {
      success: true,
      data: {
        total: Number(total),
        byDate,
        byLocation,
        maxSpeedByLocation: params?.speedingOnly ? maxSpeedByLocation : undefined
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
    // WHERE 1=1 是一个常用的SQL技巧，用于简化动态查询条件的拼接
    // 它允许后续的所有条件都以 AND 开头，而不需要判断是否是第一个条件
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

    query += ` LIMIT ${_pageSize} OFFSET ${offset}`;

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
        // 天桥 (修正: 4位是天桥)
        skybridge += totalFlow;
        byDate[dateStr].skybridge += totalFlow;
        matchCount++;
      } else if (qybh.length === 8) {
        // 图书馆 (修正: 8位是图书馆)
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

    // 获取所有楼栋名称
    const buildingQuery = 'SELECT DISTINCT ldmc FROM mod_xskq_kqjl WHERE ldmc IS NOT NULL AND ldmc != ""';
    console.log('执行楼栋列表SQL查询:', buildingQuery);
    const [buildingRows] = await pool.execute(buildingQuery);
    const allBuildings = Array.isArray(buildingRows) ? buildingRows.map((row: any) => row.ldmc) : [];
    
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
    
    // 获取按楼栋和考勤状态分布的详细统计数据
    let byBuildingDetailQuery = `
      SELECT
        ldmc as building,
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
    
    const byBuildingDetailParams: any[] = [];

    // 添加日期范围过滤条件
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      byBuildingDetailQuery += ' AND kqrq BETWEEN ? AND ?';
      byBuildingDetailParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      byBuildingDetailQuery += ' AND kqrq >= ?';
      byBuildingDetailParams.push(startDateRange.start.split(' ')[0]);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      byBuildingDetailQuery += ' AND kqrq <= ?';
      byBuildingDetailParams.push(endDateRange.start.split(' ')[0]);
    } else {
      // 如果没有指定日期范围，默认使用昨天的数据
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      byBuildingDetailQuery += ' AND kqrq = ?';
      byBuildingDetailParams.push(yesterdayStr);
    }

    byBuildingDetailQuery += ' GROUP BY ldmc';

    const [buildingDetailRows] = await pool.execute(byBuildingDetailQuery, byBuildingDetailParams);
    
    // 确保buildingDetailRows是RowDataPacket数组类型
    const buildingDetailData = Array.isArray(buildingDetailRows) ? buildingDetailRows : [];
    
    buildingDetailData.forEach((buildingRow: any) => {
      const building = buildingRow.building ? buildingRow.building.toString() : '未知楼栋';
      if (byBuilding[building]) { // 只更新已知楼栋的统计值
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
      }
    });



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
  filterType?: 'wg' | 'bg'; // wg=晚归, bg=未归
}): Promise<ExternalApiResponse<any[]>> {
  try {
    console.log('从MySQL数据库获取宿舍详细数据，参数:', params);

    let query = 'SELECT * FROM mod_xskq_kqjl WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM mod_xskq_kqjl WHERE 1=1';
    const queryParams: any[] = [];
    const countParams: any[] = [];

    // 日期范围过滤
    if (params?.startDate && params?.endDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND kqrq BETWEEN ? AND ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
      countParams.push(startDateRange.start.split(' ')[0], endDateRange.start.split(' ')[0]);
    } else if (params?.startDate) {
      const startDateRange = convertDateToRange(params.startDate);
      const dateCondition = ' AND kqrq >= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(startDateRange.start.split(' ')[0]);
      countParams.push(startDateRange.start.split(' ')[0]);
    } else if (params?.endDate) {
      const endDateRange = convertDateToRange(params.endDate);
      const dateCondition = ' AND kqrq <= ?';
      query += dateCondition;
      countQuery += dateCondition;
      queryParams.push(endDateRange.start.split(' ')[0]);
      countParams.push(endDateRange.start.split(' ')[0]);
    }

    // 筛选类型过滤 (晚归或未归)
    if (params?.filterType === 'wg') {
      // 晚归: 根据统计SQL，晚归是kqzt_bg = '晚归回寝' 且 xwzs=0 且 qjbj=0
      query += " AND kqzt_bg = '晚归回寝' AND xwzs = 0 AND qjbj = 0";
      countQuery += " AND kqzt_bg = '晚归回寝' AND xwzs = 0 AND qjbj = 0";
    } else if (params?.filterType === 'bg') {
      // 未归: kqzt_bg IN ('出寝未归', '返校未归', '出校未归') 且 xwzs=0 且 qjbj=0
      query += " AND kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND xwzs = 0 AND qjbj = 0";
      countQuery += " AND kqzt_bg IN ('出寝未归', '返校未归', '出校未归') AND xwzs = 0 AND qjbj = 0";
    }

    // 执行总数查询
    console.log('执行总数查询:', countQuery);
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
    const mappedResult = result.map((row: any) => {
      // 根据调试信息，数据库字段名是小写的，如xh, xm, ldmc等
      return {
        id: Math.floor(Math.random() * 1000000), // 生成临时ID
        xh: row.xh || row.XH || row.student_id || row.studentId || row.STUDENT_ID || row.STUDENTID || '', // 学号
        xm: row.xm || row.XM || row.name || row.userName || row.NAME || row.USERNAME || row.xingming || row.姓名 || '', // 姓名
        xy: row.bmmc || row.xueyuan || row.学院 || row.XY || row.xy || row.college || row.collegeName || row.COLLEGE || row.COLLEGENAME || '', // 学院 (从调试信息看，可能是bmmc字段)
        zy: row.zymc || row.zhuanye || row.专业 || row.ZY || row.zy || row.major || row.majorName || row.MAJOR || row.MAJORNAME || '', // 专业 (从调试信息看，可能是zymc字段)
        bj: row.bjmc || row.banji || row.班级 || row.BJ || row.bj || row.class || row.className || row.CLASS || row.CLASSNAME || '', // 班级 (从调试信息看，可能是bjmc字段)
        ldmc: row.ldmc || row.LDMC || row.building || row.buildingName || row.BUILDING || row.BUILDINGNAME || row.loudong || row.楼栋 || '', // 楼栋名称
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
    const result = await fetchDormitoryDataFromDatabase({
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      filterType: filterType === 'wg' || filterType === 'bg' ? filterType as 'wg' | 'bg' : undefined
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



// 安全观预约API数据类型
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

// 安全观预约统计API数据类型
interface SafetyVisitReservationStats {
  total: number;
  byDate: Record<string, number>;
  byDepartment: Record<string, number>;
  byStatus: Record<string, number>;
}

// 从MySQL数据库获取安全观预约数据
async function fetchSafetyVisitReservationData(params?: {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExternalApiResponse<SafetyVisitReservation[]>> {
  try {
    console.log('从MySQL数据库获取安全观预约数据，参数:', params);

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
    console.error('从数据库获取安全观预约数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 从MySQL数据库获取安全观预约统计数据
async function fetchSafetyVisitReservationStats(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExternalApiResponse<SafetyVisitReservationStats>> {
  try {
    console.log('从MySQL数据库获取安全观预约统计数据，参数:', params);

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

    console.log('并行执行安全观预约统计查询...');
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

    console.log(`安全观预约统计数据: 总数=${total}, 日期分布=${Object.keys(byDate).length}天, 部门分布=${Object.keys(byDepartment).length}个, 状态分布=${Object.keys(byStatus).length}种`);

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
    console.error('从数据库获取安全观预约统计数据失败:', error);
    return {
      success: false,
      error: `数据库查询失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// 安全观预约数据API路由
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

// 安全观预约统计API路由
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

// 404处理中间件 - 确保返回JSON格式而不是HTML
app.use((req: Request, res: Response) => {
  console.log('[404] 未找到路径: ' + req.path);
  res.status(404).json({ 
    success: false,
    error: 'API端点不存在', 
    path: req.path,
    message: '请检查API路径是否正确'
  });
});

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

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`内网API代理服务运行在端口 ${Number(PORT)}`);
  console.log(`车辆API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle`);
  console.log(`车辆统计API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-stats`);
  console.log(`车辆登记API端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-registration`);
  console.log(`访客API端点: http://0.0.0.0:${Number(PORT)}/api/visitor`);
  console.log(`所有车辆登记数据端点: http://0.0.0.0:${Number(PORT)}/api/vehicle-registration-all`);
  console.log(`安全观预约API端点: http://0.0.0.0:${Number(PORT)}/api/security/safety-visit-reservations`);
  console.log(`安全观预约统计API端点: http://0.0.0.0:${Number(PORT)}/api/security/safety-visit-reservation-stats`);
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


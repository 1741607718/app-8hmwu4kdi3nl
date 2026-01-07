import * as https from 'https';
import { URL } from 'url';

// API配置
const VEHICLE_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

const VEHICLE_REGISTRATION_API_CONFIG = {
  baseUrl: 'https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz',
  applyId: '40664926031250432',
  secretKey: '6bbfe313481a41d7882e7db89a467b7d',
};

function makeApiRequest(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      },
      rejectUnauthorized: false // 忽略SSL证书验证
    };

    const req = https.request(new URL(url), options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ data: parsedData, status: res.statusCode });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

async function testApiParameters() {
  console.log('开始测试API支持的参数格式...\n');
  
  // 测试不同的查询参数格式
  console.log('1. 测试车辆API - 基本查询（无时间筛选）...');
  try {
    const basicQuery = {
      page: 1,
      pagesize: 100,
      order: { "zpsj": "ASC" }
    };
    
    const response = await makeApiRequest(VEHICLE_API_CONFIG.baseUrl, basicQuery, {
      'applyId': VEHICLE_API_CONFIG.applyId,
      'secretKey': VEHICLE_API_CONFIG.secretKey,
    });
    
    console.log('✅ 基本查询成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 基本查询失败:', error.message);
  }
  
  console.log('');
  
  console.log('2. 测试车辆API - 日期范围查询（格式1：to_date）...');
  try {
    const dateRangeQuery1 = {
      page: 1,
      pagesize: 100,
      order: { "zpsj": "ASC" },
      params: {
        field: [
          {
            relation: "and",
            logic: ">=",
            value: "20251201", // yyyymmdd格式
            format: "to_date(field,'yyyymmdd')",
            resetField: "to_date(zpsj,'yyyymmdd')"
          },
          {
            relation: "and",
            logic: "<=",
            value: "20251231",
            format: "to_date(field,'yyyymmdd')",
            resetField: "to_date(zpsj,'yyyymmdd')"
          }
        ]
      }
    };
    
    const response = await makeApiRequest(VEHICLE_API_CONFIG.baseUrl, dateRangeQuery1, {
      'applyId': VEHICLE_API_CONFIG.applyId,
      'secretKey': VEHICLE_API_CONFIG.secretKey,
    });
    
    console.log('✅ 日期范围查询（格式1）成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 日期范围查询（格式1）失败:', error.message);
  }
  
  console.log('');
  
  console.log('3. 测试车辆API - 日期范围查询（格式2：仅开始日期）...');
  try {
    const dateRangeQuery2 = {
      page: 1,
      pagesize: 100,
      order: { "zpsj": "ASC" },
      params: {
        field: [
          {
            relation: "and",
            logic: ">=",
            value: "20251201", // yyyymmdd格式
            format: "to_date(field,'yyyymmdd')",
            resetField: "to_date(zpsj,'yyyymmdd')"
          }
        ]
      }
    };
    
    const response = await makeApiRequest(VEHICLE_API_CONFIG.baseUrl, dateRangeQuery2, {
      'applyId': VEHICLE_API_CONFIG.applyId,
      'secretKey': VEHICLE_API_CONFIG.secretKey,
    });
    
    console.log('✅ 日期范围查询（格式2）成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 日期范围查询（格式2）失败:', error.message);
  }
  
  console.log('');
  
  console.log('4. 测试车辆API - 日期范围查询（格式3：不同字段格式）...');
  try {
    const dateRangeQuery3 = {
      page: 1,
      pagesize: 100,
      order: { "zpsj": "ASC" },
      params: {
        field: [
          {
            relation: "and",
            logic: ">=",
            value: "2025-12-01", // yyyy-mm-dd格式
            format: "to_date(field,'yyyy-mm-dd')",
            resetField: "to_date(zpsj,'yyyy-mm-dd')"
          },
          {
            relation: "and",
            logic: "<=",
            value: "2025-12-31",
            format: "to_date(field,'yyyy-mm-dd')",
            resetField: "to_date(zpsj,'yyyy-mm-dd')"
          }
        ]
      }
    };
    
    const response = await makeApiRequest(VEHICLE_API_CONFIG.baseUrl, dateRangeQuery3, {
      'applyId': VEHICLE_API_CONFIG.applyId,
      'secretKey': VEHICLE_API_CONFIG.secretKey,
    });
    
    console.log('✅ 日期范围查询（格式3）成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 日期范围查询（格式3）失败:', error.message);
  }
  
  console.log('');
  
  console.log('5. 测试车辆登记API - 基本查询...');
  try {
    const basicQuery = {
      page: 1,
      pagesize: 100,
      order: { "djrq": "ASC" }
    };
    
    const response = await makeApiRequest(VEHICLE_REGISTRATION_API_CONFIG.baseUrl, basicQuery, {
      'applyId': VEHICLE_REGISTRATION_API_CONFIG.applyId,
      'secretKey': VEHICLE_REGISTRATION_API_CONFIG.secretKey,
    });
    
    console.log('✅ 车辆登记API基本查询成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 车辆登记API基本查询失败:', error.message);
  }
  
  console.log('');
  
  console.log('6. 测试车辆登记API - 日期范围查询...');
  try {
    const dateRangeQuery = {
      page: 1,
      pagesize: 100,
      order: { "djrq": "ASC" },
      params: {
        field: [
          {
            relation: "and",
            logic: ">=",
            value: "20251201", // yyyymmdd格式
            format: "to_date(field,'yyyymmdd')",
            resetField: "to_date(djrq,'yyyymmdd')"
          },
          {
            relation: "and",
            logic: "<=",
            value: "20251231",
            format: "to_date(field,'yyyymmdd')",
            resetField: "to_date(djrq,'yyyymmdd')"
          }
        ]
      }
    };
    
    const response = await makeApiRequest(VEHICLE_REGISTRATION_API_CONFIG.baseUrl, dateRangeQuery, {
      'applyId': VEHICLE_REGISTRATION_API_CONFIG.applyId,
      'secretKey': VEHICLE_REGISTRATION_API_CONFIG.secretKey,
    });
    
    console.log('✅ 车辆登记API日期范围查询成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
  } catch (error) {
    console.log('❌ 车辆登记API日期范围查询失败:', error.message);
  }
  
  console.log('');
  
  console.log('7. 测试车辆API - 最小查询（仅页码）...');
  try {
    const minimalQuery = {
      page: 1,
      pagesize: 10
    };
    
    const response = await makeApiRequest(VEHICLE_API_CONFIG.baseUrl, minimalQuery, {
      'applyId': VEHICLE_API_CONFIG.applyId,
      'secretKey': VEHICLE_API_CONFIG.secretKey,
    });
    
    console.log('✅ 最小查询成功');
    console.log(`📊 返回数据条数: ${response.data?.data?.Rows?.length || 0}`);
    if (response.data?.data?.Rows && response.data.data.Rows.length > 0) {
      console.log('📋 数据示例:', response.data.data.Rows[0]);
    }
  } catch (error) {
    console.log('❌ 最小查询失败:', error.message);
  }
  
  console.log('\nAPI参数测试完成!');
}

// 运行测试
testApiParameters().catch(console.error);
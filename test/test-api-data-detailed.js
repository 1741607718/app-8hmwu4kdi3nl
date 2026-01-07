const axios = require('axios');

async function testApiData() {
  const baseUrl = 'http://localhost:3003';
  
  console.log('开始测试API数据获取...\n');
  
  try {
    // 测试车辆数据API
    console.log('1. 测试车辆数据API...');
    const vehicleResponse = await axios.get(`${baseUrl}/api/vehicle?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 车辆API调用成功');
    console.log('📋 原始响应数据类型:', typeof vehicleResponse.data);
    console.log('📋 响应数据:', JSON.stringify(vehicleResponse.data, null, 2));
    
    if (Array.isArray(vehicleResponse.data)) {
      console.log(`📊 返回数据条数: ${vehicleResponse.data.length}`);
      if (vehicleResponse.data.length > 0) {
        console.log('📋 车辆数据示例:', vehicleResponse.data[0]);
      } else {
        console.log('⚠️  返回数组为空');
      }
    } else {
      console.log('⚠️  返回的数据不是数组格式');
    }
  } catch (error) {
    console.log('❌ 车辆API调用失败:', error.message);
    if (error.response) {
      console.log('📋 错误响应数据:', error.response.data);
      console.log('📋 错误响应状态:', error.response.status);
    }
  }
  
  console.log('');
  
  try {
    // 测试消防设备数据API
    console.log('2. 测试消防设备数据API...');
    const fireSafetyResponse = await axios.get(`${baseUrl}/api/fire-safety?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 消防设备API调用成功');
    console.log('📋 原始响应数据类型:', typeof fireSafetyResponse.data);
    console.log('📋 响应数据:', JSON.stringify(fireSafetyResponse.data, null, 2));
    
    if (Array.isArray(fireSafetyResponse.data)) {
      console.log(`📊 返回数据条数: ${fireSafetyResponse.data.length}`);
      if (fireSafetyResponse.data.length > 0) {
        console.log('📋 消防设备数据示例:', fireSafetyResponse.data[0]);
      } else {
        console.log('⚠️  返回数组为空');
      }
    } else {
      console.log('⚠️  返回的数据不是数组格式');
    }
  } catch (error) {
    console.log('❌ 消防设备API调用失败:', error.message);
    if (error.response) {
      console.log('📋 错误响应数据:', error.response.data);
      console.log('📋 错误响应状态:', error.response.status);
    }
  }
  
  console.log('');
  
  try {
    // 测试健康检查端点
    console.log('3. 测试健康检查端点...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✅ 健康检查调用成功');
    console.log('📋 健康检查响应:', healthResponse.data);
  } catch (error) {
    console.log('❌ 健康检查调用失败:', error.message);
  }
  
  console.log('\n测试完成!');
}

// 运行测试
testApiData().catch(console.error);
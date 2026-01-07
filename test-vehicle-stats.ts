import axios from 'axios';

async function testVehicleStats() {
  const baseUrl = 'http://localhost:3003';
  
  console.log('开始测试车辆统计API...\n');
  
  try {
    // 测试车辆统计数据API
    console.log('1. 测试车辆统计数据API...');
    const statsResponse = await axios.get(`${baseUrl}/api/vehicle-stats?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 车辆统计API调用成功');
    console.log(`📊 返回统计数据:`, statsResponse.data);
  } catch (error) {
    console.log('❌ 车辆统计API调用失败:', (error as Error).message);
  }
  
  console.log('');
  
  try {
    // 测试车辆数据API（对比）
    console.log('2. 测试车辆数据API...');
    const vehicleResponse = await axios.get(`${baseUrl}/api/vehicle?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 车辆数据API调用成功');
    console.log(`📊 返回数据条数: ${vehicleResponse.data.length}`);
    if (vehicleResponse.data.length > 0) {
      console.log('📋 车辆数据示例:', vehicleResponse.data[0]);
    }
  } catch (error) {
    console.log('❌ 车辆数据API调用失败:', (error as Error).message);
  }
  
  console.log('');
  
  try {
    // 测试健康检查端点
    console.log('3. 测试健康检查端点...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✅ 健康检查API调用成功');
    console.log(`🏥 健康状态:`, healthResponse.data);
  } catch (error) {
    console.log('❌ 健康检查API调用失败:', (error as Error).message);
  }
  
  console.log('\n测试完成!');
}

// 运行测试
testVehicleStats().catch(console.error);
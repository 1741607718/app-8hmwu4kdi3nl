import axios from 'axios';

async function testFullDataApi() {
  const baseUrl = 'http://localhost:3003';
  
  console.log('开始测试全量数据API...\n');
  
  try {
    // 测试全量车辆数据API
    console.log('1. 测试全量车辆数据API...');
    const vehicleAllResponse = await axios.get(`${baseUrl}/api/vehicle-all?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 全量车辆API调用成功');
    console.log(`📊 返回数据条数: ${vehicleAllResponse.data.length}`);
    if (vehicleAllResponse.data.length > 0) {
      console.log('📋 车辆数据示例:', vehicleAllResponse.data[0]);
    }
  } catch (error) {
    console.log('❌ 全量车辆API调用失败:', (error as Error).message);
  }
  
  console.log('');
  
  try {
    // 测试全量车辆登记数据API
    console.log('2. 测试全量车辆登记数据API...');
    const registrationAllResponse = await axios.get(`${baseUrl}/api/vehicle-registration-all?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 全量车辆登记API调用成功');
    console.log(`📊 返回数据条数: ${registrationAllResponse.data.length}`);
    if (registrationAllResponse.data.length > 0) {
      console.log('📋 车辆登记数据示例:', registrationAllResponse.data[0]);
    }
  } catch (error) {
    console.log('❌ 全量车辆登记API调用失败:', (error as Error).message);
  }
  
  console.log('');
  
  try {
    // 测试全量访客数据API
    console.log('3. 测试全量访客数据API...');
    const visitorAllResponse = await axios.get(`${baseUrl}/api/visitor-all?startDate=2025-12-01&endDate=2025-12-31`);
    console.log('✅ 全量访客API调用成功');
    console.log(`📊 返回数据条数: ${visitorAllResponse.data.length}`);
    if (visitorAllResponse.data.length > 0) {
      console.log('📋 访客数据示例:', visitorAllResponse.data[0]);
    }
  } catch (error) {
    console.log('❌ 全量访客API调用失败:', (error as Error).message);
  }
  
  console.log('\n全量数据API测试完成!');
}

// 运行测试
testFullDataApi().catch(console.error);
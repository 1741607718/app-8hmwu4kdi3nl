import axios from 'axios';

async function testApiDataDetailed() {
  // 从环境变量获取API基础URL，如果未设置则使用默认值
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3003';
  
  console.log('开始详细测试API数据获取...\n');
  console.log(`API基础URL: ${baseUrl}\n`);
  
  // 定义不同的日期范围进行测试
  const dateRanges = [
    { name: '最近7天', startDate: '2025-12-21', endDate: '2025-12-27' },
    { name: '最近30天', startDate: '2025-11-27', endDate: '2025-12-27' },
    { name: '本月', startDate: '2025-12-01', endDate: '2025-12-27' },
    { name: '本季度', startDate: '2025-10-01', endDate: '2025-12-27' },
  ];
  
  for (const range of dateRanges) {
    console.log(`\n--- 测试 ${range.name} (${range.startDate} 到 ${range.endDate}) ---`);
    
    try {
      // 测试车辆数据API
      console.log('1. 测试车辆数据API...');
      const vehicleResponse = await axios.get(`${baseUrl}/api/vehicle?startDate=${range.startDate}&endDate=${range.endDate}`);
      console.log('✅ 车辆API调用成功');
      console.log(`📊 返回数据条数: ${vehicleResponse.data.length}`);
      
      // 分析车辆数据
      if (vehicleResponse.data.length > 0) {
        console.log('📋 车辆数据示例:', vehicleResponse.data[0]);
        
        // 统计分析
        const uniquePlates = new Set(vehicleResponse.data.map((item: any) => item.cph));
        console.log(`🚗 唯一车牌数量: ${uniquePlates.size}`);
        
        const passTimeByDate: Record<string, number> = {};
        vehicleResponse.data.forEach((item: any) => {
          const date = item.zpsj.split('T')[0];
          passTimeByDate[date] = (passTimeByDate[date] || 0) + 1;
        });
        
        const sortedDates = Object.keys(passTimeByDate).sort();
        console.log(`📅 数据覆盖日期范围: ${sortedDates[0]} 到 ${sortedDates[sortedDates.length - 1]}`);
        console.log(`📅 数据覆盖天数: ${sortedDates.length}`);
        
        if (sortedDates.length > 0) {
          const avgPerDay = vehicleResponse.data.length / sortedDates.length;
          console.log(`📈 平均每天通行数量: ${avgPerDay.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.log('❌ 车辆API调用失败:', (error as Error).message);
    }
    
    console.log('');
    
    try {
      // 测试消防设备数据API
      console.log('2. 测试消防设备数据API...');
      const fireSafetyResponse = await axios.get(`${baseUrl}/api/fire-safety?startDate=${range.startDate}&endDate=${range.endDate}`);
      console.log('✅ 消防设备API调用成功');
      console.log(`📊 返回数据条数: ${fireSafetyResponse.data.length}`);
      
      // 分析消防设备数据
      if (fireSafetyResponse.data.length > 0) {
        console.log('📋 消防设备数据示例:', fireSafetyResponse.data[0]);
        
        // 统计分析
        const uniqueEquipment = new Set(fireSafetyResponse.data.map((item: any) => item.bh));
        console.log(`🔧 唯一设备数量: ${uniqueEquipment.size}`);
        
        const statusCount: Record<string, number> = {};
        fireSafetyResponse.data.forEach((item: any) => {
          const status = item.syjf || '未知';
          statusCount[status] = (statusCount[status] || 0) + 1;
        });
        console.log(`📊 设备状态统计:`, statusCount);
        
        const locationCount: Record<string, number> = {};
        fireSafetyResponse.data.forEach((item: any) => {
          const location = item.bm || '未知位置';
          locationCount[location] = (locationCount[location] || 0) + 1;
        });
        console.log(`📍 位置分布数量:`, Object.keys(locationCount).length);
      }
    } catch (error) {
      console.log('❌ 消防设备API调用失败:', (error as Error).message);
    }
    
    console.log('--- 测试完成 ---\n');
  }
  
  // 测试错误情况
  console.log('测试错误情况...\n');
  
  try {
    // 测试无效日期范围
    console.log('测试无效日期范围...');
    const invalidResponse = await axios.get(`${baseUrl}/api/vehicle?startDate=invalid&endDate=invalid`);
    console.log('⚠️ 无效日期范围意外成功:', invalidResponse.data);
  } catch (error) {
    console.log('✅ 正确处理无效日期范围:', (error as Error).message);
  }
  
  console.log('\n详细测试完成!');
}

// 运行测试
testApiDataDetailed().catch(console.error);
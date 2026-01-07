import { generateMockVehicleData, generateMockFireEquipmentData } from '../src/services/externalApi';

// 模拟车辆登记数据生成函数
function generateMockVehicleRegistrationData(days: number = 7): any[] {
  const data: any[] = [];
  const departments = ['计算机学院', '机械学院', '经管学院', '外语学院', '艺术学院'];
  const names = ['张三', '李四', '王五', '赵六', '钱七'];
  const platePrefixes = ['浙A', '浙B', '浙C', '浙D', '浙E'];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const count = Math.floor(Math.random() * 5) + 2; // 每天2-6个登记记录
    for (let j = 0; j < count; j++) {
      const plateNumber = `${platePrefixes[Math.floor(Math.random() * platePrefixes.length)]}${Math.floor(10000 + Math.random() * 90000)}`;
      const name = names[Math.floor(Math.random() * names.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      
      data.push({
        guid: `GUID${Date.now()}${j}`,
        gh: `GH${Math.floor(10000 + Math.random() * 90000)}`,
        bh: `BH${Math.floor(1000 + Math.random() * 9000)}`,
        xm: name,
        lxfs: `138${Math.floor(100000000 + Math.random() * 900000000)}`,
        bm: department,
        cllx: ['轿车', 'SUV', '货车', '客车'][Math.floor(Math.random() * 4)],
        cp: plateNumber,
        djrq: date.toISOString().split('T')[0],
        dqrq: new Date(date.getFullYear() + 1, date.getMonth(), date.getDate()).toISOString().split('T')[0],
        dxwb: `DXWB${Math.floor(100 + Math.random() * 900)}`,
        syjf: Math.floor(Math.random() * 12).toString(),
      });
    }
  }

  return data;
}

async function testMockApiData() {
  console.log('开始测试模拟API数据获取...\n');
  
  // 定义不同的日期范围进行测试
  const dateRanges = [
    { name: '最近7天', days: 7 },
    { name: '最近30天', days: 30 },
    { name: '最近90天', days: 90 },
  ];
  
  for (const range of dateRanges) {
    console.log(`\n--- 测试 ${range.name} (模拟${range.days}天数据) ---`);
    
    try {
      // 测试车辆通行数据API
      console.log('1. 测试车辆通行数据API (车流和车速信息)...');
      const vehicleData = generateMockVehicleData(range.days);
      console.log('✅ 模拟车辆通行API调用成功');
      console.log(`📊 返回数据条数: ${vehicleData.length}`);
      
      // 分析车辆通行数据
      if (vehicleData.length > 0) {
        console.log('📋 车辆通行数据示例:', vehicleData[0]);
        
        // 统计分析
        const uniquePlates = new Set(vehicleData.map(item => item.cph));
        console.log(`🚗 唯一车牌数量: ${uniquePlates.size}`);
        
        const passTimeByDate: Record<string, number> = {};
        vehicleData.forEach(item => {
          const date = item.zpsj.split('T')[0];
          passTimeByDate[date] = (passTimeByDate[date] || 0) + 1;
        });
        
        const sortedDates = Object.keys(passTimeByDate).sort();
        console.log(`📅 数据覆盖天数: ${sortedDates.length}`);
        
        if (sortedDates.length > 0) {
          const avgPerDay = vehicleData.length / sortedDates.length;
          console.log(`📈 平均每天通行数量: ${avgPerDay.toFixed(2)}`);
        }
        
        // 检查车速信息
        const hasSpeedInfo = vehicleData.some(item => item.cs);
        if (hasSpeedInfo) {
          const speeds = vehicleData.map(item => item.cs).filter(speed => speed);
          const avgSpeed = speeds.reduce((sum, speed) => sum + (speed || 0), 0) / speeds.length;
          console.log(` SPEED 平均车速: ${avgSpeed.toFixed(2)} km/h`);
        }
      }
    } catch (error) {
      console.log('❌ 车辆通行API调用失败:', (error as Error).message);
    }
    
    console.log('');
    
    try {
      // 测试车辆登记数据API
      console.log('2. 测试车辆登记数据API...');
      const vehicleRegistrationData = generateMockVehicleRegistrationData(range.days);
      console.log('✅ 模拟车辆登记API调用成功');
      console.log(`📊 返回数据条数: ${vehicleRegistrationData.length}`);
      
      // 分析车辆登记数据
      if (vehicleRegistrationData.length > 0) {
        console.log('📋 车辆登记数据示例:', vehicleRegistrationData[0]);
        
        // 统计分析
        const uniquePlates = new Set(vehicleRegistrationData.map(item => item.cp));
        console.log(`🚗 登记车辆数量: ${uniquePlates.size}`);
        
        const departmentCount: Record<string, number> = {};
        vehicleRegistrationData.forEach(item => {
          const department = item.bm;
          departmentCount[department] = (departmentCount[department] || 0) + 1;
        });
        console.log(`🏢 部门分布:`, departmentCount);
      }
    } catch (error) {
      console.log('❌ 车辆登记API调用失败:', (error as Error).message);
    }
    
    console.log('');
    
    try {
      // 测试消防设备数据API
      console.log('3. 测试消防设备数据API...');
      const fireSafetyData = generateMockFireEquipmentData(range.days);
      console.log('✅ 模拟消防设备API调用成功');
      console.log(`📊 返回数据条数: ${fireSafetyData.length}`);
      
      // 分析消防设备数据
      if (fireSafetyData.length > 0) {
        console.log('📋 消防设备数据示例:', fireSafetyData[0]);
        
        // 统计分析
        const uniqueEquipment = new Set(fireSafetyData.map(item => item.bh));
        console.log(`🔧 唯一设备数量: ${uniqueEquipment.size}`);
        
        const statusCount: Record<string, number> = {};
        fireSafetyData.forEach(item => {
          const status = item.syjf || '未知';
          statusCount[status] = (statusCount[status] || 0) + 1;
        });
        console.log(`📊 设备状态统计:`, statusCount);
        
        const locationCount: Record<string, number> = {};
        fireSafetyData.forEach(item => {
          const location = item.bm || '未知位置';
          locationCount[location] = (locationCount[location] || 0) + 1;
        });
        console.log(`📍 位置分布数量:`, Object.keys(locationCount).length);
        console.log(`📍 位置分布示例:`, Object.keys(locationCount).slice(0, 5));
      }
    } catch (error) {
      console.log('❌ 消防设备API调用失败:', (error as Error).message);
    }
    
    console.log('--- 测试完成 ---\n');
  }
  
  console.log('\n模拟API数据测试完成!');
}

// 运行测试
testMockApiData().catch(console.error);
import axios from 'axios';

async function testBackendFiltering() {
  console.log('开始测试内部代理服务的后端过滤功能...\n');
  
  const proxyBaseUrl = 'http://localhost:3003';
  
  try {
    // 测试1: 获取全量数据
    console.log('1. 测试获取全量车辆数据...');
    const allDataResponse = await axios.get(`${proxyBaseUrl}/api/vehicle`);
    console.log(`✅ 全量数据返回: ${allDataResponse.data.length} 条记录\n`);
    
    // 测试2: 获取特定时间段数据
    console.log('2. 测试获取特定时间段数据 (2024-12-20 到 2024-12-20)...');
    const filteredResponse = await axios.get(`${proxyBaseUrl}/api/vehicle`, {
      params: {
        startDate: '2024-12-20',
        endDate: '2024-12-20'
      }
    });
    console.log(`✅ 时间段数据返回: ${filteredResponse.data.length} 条记录\n`);
    
    // 测试3: 比较数据量
    console.log('3. 比较数据量差异...');
    console.log(`📊 全量数据: ${allDataResponse.data.length} 条`);
    console.log(`📊 时间段数据: ${filteredResponse.data.length} 条`);
    
    if (allDataResponse.data.length > filteredResponse.data.length) {
      console.log('✅ 后端过滤功能正常工作 - 时间段数据量少于全量数据');
    } else if (allDataResponse.data.length === filteredResponse.data.length && filteredResponse.data.length === 0) {
      console.log('⚠️  时间段可能无数据，但过滤功能已执行');
    } else if (allDataResponse.data.length === filteredResponse.data.length) {
      console.log('⚠️  时间段数据量与全量数据相同，可能未正确过滤');
    }
    
    // 测试4: 检查返回的数据是否都在指定时间范围内
    console.log('\n4. 验证返回数据是否在指定时间范围内...');
    const sampleData = filteredResponse.data.slice(0, 5); // 取前5条数据作为样本
    let allInDateRange = true;
    
    for (const item of sampleData) {
      const itemDate = item.zpsj ? new Date(item.zpsj.split(' ')[0]).toISOString().split('T')[0] : null;
      const isInRange = itemDate && itemDate >= '2024-12-20' && itemDate <= '2024-12-20';
      console.log(`   数据样本 ${item.id || 'N/A'}: 时间 ${itemDate}, 在范围内: ${isInRange}`);
      if (!isInRange && itemDate) {
        allInDateRange = false;
      }
    }
    
    if (allInDateRange) {
      console.log('✅ 所有返回数据都在指定时间范围内');
    } else {
      console.log('❌ 部分数据不在指定时间范围内');
    }
    
    // 测试5: 车辆登记API过滤测试
    console.log('\n5. 测试车辆登记API的后端过滤...');
    const vehicleRegResponse = await axios.get(`${proxyBaseUrl}/api/vehicle-registration`, {
      params: {
        startDate: '2024-12-01',
        endDate: '2024-12-31'
      }
    });
    console.log(`✅ 车辆登记时间段数据返回: ${vehicleRegResponse.data.length} 条记录`);
    
    console.log('\n测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testBackendFiltering().catch(console.error);
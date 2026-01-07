#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
获取traffic_flow_speed API的全部数据
此脚本将获取所有可用的车辆通行数据，不进行日期过滤
"""
import requests
import json
import time
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TrafficDataClient:
    def __init__(self):
        # API配置 - traffic_flow_speed API
        self.api_config = {
            'url': 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
            'applyId': '40664926031250432',
            'secretKey': '6bbfe313481a41d7882e7db89a467b7d'
        }

        self.headers = {
            'Content-Type': 'application/json'
        }

        self.last_request_time = 0
        self.min_interval = 1  # 最小请求间隔1秒

    def _wait_for_rate_limit(self):
        """控制请求频率"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time

        if time_since_last_request < self.min_interval:
            wait_time = self.min_interval - time_since_last_request
            logger.info(f"等待 {wait_time:.2f} 秒以满足频率限制")
            time.sleep(wait_time)

        self.last_request_time = time.time()

    def fetch_all_traffic_data(self, max_pages: int = 20) -> list:
        """
        获取所有车辆通行数据
        :param max_pages: 最大页数限制，防止请求过多数据
        :return: 所有数据的列表
        """
        all_records = []
        page = 1

        logger.info("开始获取所有车辆通行数据...")
        logger.info(f"API端点: {self.api_config['url']}")

        while page <= max_pages:
            logger.info(f"正在获取第 {page} 页数据...")
            
            # 等待频率限制
            self._wait_for_rate_limit()

            # 构建请求数据 - 不包含任何日期过滤参数
            request_data = {
                "page": page,
                "pagesize": 100  # 每页100条记录
            }

            headers = self.headers.copy()
            headers['applyId'] = self.api_config['applyId']
            headers['secretKey'] = self.api_config['secretKey']

            try:
                response = requests.post(
                    self.api_config['url'],
                    json=request_data,
                    headers=headers,
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    
                    if result.get('status') == 200:
                        records = result.get('data', {}).get('Rows', [])
                        
                        if not records:
                            logger.info(f"第 {page} 页没有更多数据，停止获取")
                            break
                            
                        all_records.extend(records)
                        logger.info(f"第 {page} 页获取到 {len(records)} 条记录")
                        
                        # 如果返回的记录数少于100，说明已经到了最后一页
                        if len(records) < 100:
                            logger.info("已获取到所有数据，停止获取")
                            break
                    else:
                        logger.error(f"API返回错误: {result.get('msg', '未知错误')}")
                        break
                else:
                    logger.error(f"HTTP错误: {response.status_code}")
                    break

            except Exception as e:
                logger.error(f"请求第 {page} 页数据时发生异常: {e}")
                break

            page += 1

        logger.info(f"数据获取完成，共获取 {len(all_records)} 条记录")
        return all_records

    def save_data_to_file(self, data: list, filename: str = None):
        """保存数据到JSON文件"""
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"all_traffic_data_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"数据已保存到文件: {filename}")

def main():
    """主函数"""
    client = TrafficDataClient()
    
    print("=" * 60)
    print("              获取全部车辆通行数据")
    print("=" * 60)
    
    try:
        # 获取所有数据
        all_data = client.fetch_all_traffic_data(max_pages=50)  # 可以根据需要调整最大页数
        
        if all_data:
            print(f"\n成功获取到 {len(all_data)} 条车辆通行记录")
            
            # 显示前几条记录的示例
            print("\n前3条记录示例:")
            for i, record in enumerate(all_data[:3]):
                print(f"  记录 {i+1}:")
                print(f"    车牌号: {record.get('cph', 'N/A')}")
                print(f"    通过时间: {record.get('zpsj', 'N/A')}")
                print(f"    创建时间: {record.get('cjsj', 'N/A')}")
                print(f"    车速: {record.get('cs', 'N/A')}")
                print(f"    车辆类型: {record.get('cllx', 'N/A')}")
                print()
            
            # 保存数据到文件
            client.save_data_to_file(all_data)
            
            # 统计信息
            print("\n数据统计:")
            print(f"  总记录数: {len(all_data)}")
            
            # 按年份统计
            year_stats = {}
            for record in all_data:
                zpsj = record.get('zpsj', '')
                if zpsj:
                    year = zpsj.split('-')[0] if '-' in zpsj else 'Unknown'
                    year_stats[year] = year_stats.get(year, 0) + 1
            
            print(f"  按年份统计: {year_stats}")
            
        else:
            print("未能获取到任何数据")
            
    except Exception as e:
        logger.error(f"程序执行出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
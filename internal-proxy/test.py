import requests
import concurrent.futures
import time
from datetime import datetime, timedelta
import json


class DataFetcher:
    def __init__(self):
        self.apis = {
            'traffic': {
                'url': 'https://api.wzbc.edu.cn:8888/openApi/API/Service_GEo0z85cWsClabw37WUhC',
                'applyId': '40664926031250432',
                'secretKey': '6bbfe313481a41d7882e7db89a467b7d',
                'time_field': 'zpsj',
                'field_type': 'timestamp',
                'use_api_filter': False
            },
            'visitor': {
                'url': 'https://api.wzbc.edu.cn:8888/openApi/API/Service_7Th9DhZvvk2RsaQaTbeQ6',
                'applyId': '41145425376773120',
                'secretKey': '7352215bf23c494fa7bcfb14614c515c',
                'time_field': 'lfsj',
                'field_type': 'timestamp',
                'use_api_filter': False
            },
            'vehicle': {
                'url': 'https://api.wzbc.edu.cn:8888/openApi/API/Service_armiBZ8u9xVcvpQ2iVxz',
                'applyId': '40664926031250432',
                'secretKey': '6bbfe313481a41d7882e7db89a467b7d',
                'time_field': 'djrq',
                'field_type': 'varchar',
                'use_api_filter': True
            }
        }

    def parse_timestamp(self, time_str):
        """解析时间戳字符串"""
        if not time_str:
            return None
        try:
            if '.' in time_str:
                time_str = time_str.split('.')[0]
            return datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
        except:
            return None

    def parse_vehicle_time(self, time_str):
        """解析vehicle接口的时间格式"""
        if not time_str:
            return None
        try:
            return datetime.strptime(time_str, '%Y/%m/%d')
        except:
            return None

    def fetch_recent_data_by_month(self, api_name, months=3, page_size=200, max_pages=100):
        """
        获取最近几个月的数据（按时间倒序）
        策略：按时间倒序获取，当数据时间超过指定范围时停止
        """
        api_config = self.apis[api_name]
        all_data = []
        page = 1

        # 计算时间边界
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30 * months)  # 近似计算
        print(
            f"获取 {api_name} 最近{months}个月的数据（{start_date.strftime('%Y-%m-%d')} 到 {end_date.strftime('%Y-%m-%d')}）")

        # 对于不支持API过滤的接口，我们需要按时间倒序获取
        # 注意：这里假设接口支持按时间倒序排序，如果不行，我们需要其他策略

        while page <= max_pages:
            payload = {
                "page": page,
                "pagesize": page_size
            }

            # 尝试按时间倒序排序（如果接口支持）
            # 注意：根据API文档，可能需要添加排序参数
            # 但您的API可能不支持排序，我们先用简单方法

            headers = {
                'applyId': api_config['applyId'],
                'secretKey': api_config['secretKey'],
                'content-type': 'application/json'
            }

            try:
                print(f"正在获取 {api_name} 第{page}页数据...")
                response = requests.post(api_config['url'], json=payload, headers=headers, timeout=60)
                result = response.json()

                if result.get('status') == 200:
                    data = result.get('data', {}).get('Rows', [])

                    if not data:
                        print(f"第{page}页没有数据，停止获取")
                        break

                    # 检查这一页数据的时间范围
                    page_has_recent_data = False
                    for item in data:
                        if api_config['time_field'] in item and item[api_config['time_field']]:
                            time_str = item[api_config['time_field']]

                            # 解析时间
                            if api_config['field_type'] == 'timestamp':
                                item_time = self.parse_timestamp(time_str)
                            else:
                                item_time = self.parse_vehicle_time(time_str)

                            if item_time:
                                # 如果数据在时间范围内，保留
                                if start_date <= item_time <= end_date:
                                    all_data.append(item)
                                    page_has_recent_data = True

                    print(
                        f"第{page}页获取到{len(data)}条数据，符合条件的数据: {len(all_data) - sum(1 for _ in all_data[:-len(data)]) if page > 1 else len(all_data)}条")

                    # 如果这一页没有符合时间范围的数据，可能已经超出范围
                    if not page_has_recent_data and page > 1:
                        print(f"第{page}页没有符合时间范围的数据，停止获取")
                        break

                    # 如果数据量已经很大，也可以考虑停止
                    if len(all_data) >= 10000:  # 限制最大获取数量
                        print(f"已达到最大获取数量{len(all_data)}，停止获取")
                        break

                else:
                    print(f"API {api_name} 错误: {result.get('msg', 'Unknown error')}")
                    break

            except Exception as e:
                print(f"API {api_name} 处理异常: {e}")
                break

            page += 1
            time.sleep(0.5)  # 降低延迟，加快获取速度

        print(f"API {api_name} 获取完成，共获取 {len(all_data)} 条符合条件的数据")
        return all_data

    def fetch_data_by_time_range_smart(self, api_name, start_time, end_time, page_size=200, max_pages=50):
        """
        智能获取时间范围数据
        策略：从最新数据开始获取，当数据时间早于开始时间时停止
        """
        api_config = self.apis[api_name]
        all_data = []
        page = 1

        # 解析时间范围
        if api_config['field_type'] == 'timestamp':
            start_dt = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
            end_dt = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
        else:
            start_dt = datetime.strptime(start_time, '%Y/%m/%d')
            end_dt = datetime.strptime(end_time, '%Y/%m/%d')

        print(f"获取 {api_name} 数据，时间范围: {start_dt} 到 {end_dt}")

        # 对于vehicle接口（支持API过滤），直接使用API过滤
        if api_config['use_api_filter']:
            return self.fetch_data_by_api_filter_smart(api_name, start_time, end_time, page_size, max_pages)

        # 对于不支持API过滤的接口，从最新数据开始获取
        earliest_data_time = None

        while page <= max_pages:
            payload = {
                "page": page,
                "pagesize": page_size
            }

            headers = {
                'applyId': api_config['applyId'],
                'secretKey': api_config['secretKey'],
                'content-type': 'application/json'
            }

            try:
                print(f"正在获取 {api_name} 第{page}页数据...")
                response = requests.post(api_config['url'], json=payload, headers=headers, timeout=60)
                result = response.json()

                if result.get('status') == 200:
                    data = result.get('data', {}).get('Rows', [])

                    if not data:
                        print(f"第{page}页没有数据，停止获取")
                        break

                    # 处理这一页数据
                    page_valid_data = []
                    page_earliest_time = None

                    for item in data:
                        if api_config['time_field'] in item and item[api_config['time_field']]:
                            time_str = item[api_config['time_field']]

                            # 解析时间
                            if api_config['field_type'] == 'timestamp':
                                item_time = self.parse_timestamp(time_str)
                            else:
                                item_time = self.parse_vehicle_time(time_str)

                            if item_time:
                                # 更新时间范围内最早的数据时间
                                if page_earliest_time is None or item_time < page_earliest_time:
                                    page_earliest_time = item_time

                                # 如果数据在时间范围内，保留
                                if start_dt <= item_time <= end_dt:
                                    page_valid_data.append(item)

                    # 添加有效数据
                    if page_valid_data:
                        all_data.extend(page_valid_data)

                    print(
                        f"第{page}页获取到{len(data)}条数据，符合条件的数据: {len(page_valid_data)}条，累计{len(all_data)}条")

                    # 更新整体最早数据时间
                    if page_earliest_time:
                        if earliest_data_time is None or page_earliest_time < earliest_data_time:
                            earliest_data_time = page_earliest_time

                        # 如果这一页的最早数据已经早于开始时间，并且我们已经获取了一些数据
                        if page_earliest_time < start_dt and len(all_data) > 0:
                            print(f"第{page}页最早数据时间({page_earliest_time})早于开始时间({start_dt})，停止获取")
                            break

                    # 如果数据量已经满足需求，也可以考虑停止
                    if len(all_data) >= 10000:  # 限制最大获取数量
                        print(f"已达到最大获取数量{len(all_data)}，停止获取")
                        break

                else:
                    print(f"API {api_name} 错误: {result.get('msg', 'Unknown error')}")
                    break

            except Exception as e:
                print(f"API {api_name} 处理异常: {e}")
                break

            page += 1
            time.sleep(0.5)

        print(f"API {api_name} 获取完成，共获取 {len(all_data)} 条符合条件的数据")

        # 按时间倒序排序（最新的在前面）
        all_data.sort(key=lambda x: self.parse_timestamp(x.get(api_config['time_field'], ''))
        if api_config['field_type'] == 'timestamp'
        else self.parse_vehicle_time(x.get(api_config['time_field'], '')),
                      reverse=True)

        return all_data

    def fetch_data_by_api_filter_smart(self, api_name, start_time, end_time, page_size=200, max_pages=50):
        """智能获取API过滤的数据（适用于vehicle接口）"""
        api_config = self.apis[api_name]
        all_data = []
        page = 1

        while page <= max_pages:
            payload = {
                "page": page,
                "pagesize": page_size,
                "params": {
                    api_config['time_field']: [
                        {
                            "relation": "and",
                            "logic": ">=",
                            "value": start_time
                        },
                        {
                            "relation": "and",
                            "logic": "<=",
                            "value": end_time
                        }
                    ]
                }
            }

            headers = {
                'applyId': api_config['applyId'],
                'secretKey': api_config['secretKey'],
                'content-type': 'application/json'
            }

            try:
                print(f"正在获取 {api_name} 第{page}页数据(时间过滤)...")
                response = requests.post(api_config['url'], json=payload, headers=headers, timeout=60)
                result = response.json()

                if result.get('status') == 200:
                    data = result.get('data', {}).get('Rows', [])

                    if not data:
                        print(f"第{page}页没有数据，停止获取")
                        break

                    all_data.extend(data)
                    print(f"第{page}页获取到{len(data)}条数据，累计{len(all_data)}条")

                    if len(data) < page_size:
                        print(f"第{page}页数据不足{page_size}条，可能是最后一页")
                        break

                else:
                    print(f"API {api_name} 错误: {result.get('msg', 'Unknown error')}")
                    break

            except Exception as e:
                print(f"API {api_name} 处理异常: {e}")
                break

            page += 1
            time.sleep(0.5)

        print(f"API {api_name} 获取完成，共获取 {len(all_data)} 条数据")
        return all_data

    def analyze_data_time_range(self, data, api_name):
        """分析数据的时间范围"""
        if not data:
            print(f"{api_name}: 无数据")
            return None, None

        api_config = self.apis[api_name]
        time_values = []

        for item in data:
            if api_config['time_field'] in item and item[api_config['time_field']]:
                time_str = item[api_config['time_field']]

                if api_config['field_type'] == 'timestamp':
                    time_obj = self.parse_timestamp(time_str)
                else:
                    time_obj = self.parse_vehicle_time(time_str)

                if time_obj:
                    time_values.append(time_obj)

        if not time_values:
            print(f"{api_name}: 无有效时间数据")
            return None, None

        min_time = min(time_values)
        max_time = max(time_values)

        print(f"{api_name}: 时间范围 {min_time} 到 {max_time}")
        print(f"      时间跨度: {(max_time - min_time).days} 天")
        print(f"      数据量: {len(data)} 条")

        return min_time, max_time


# 主程序
if __name__ == "__main__":
    fetcher = DataFetcher()

    # 获取最近1个月的数据
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    time_ranges = {
        'traffic': (
            start_date.strftime('%Y-%m-%d 00:00:00'),
            end_date.strftime('%Y-%m-%d 23:59:59')
        ),
        'visitor': (
            start_date.strftime('%Y-%m-%d 00:00:00'),
            end_date.strftime('%Y-%m-%d 23:59:59')
        ),
        'vehicle': (
            start_date.strftime('%Y/%m/%d'),
            end_date.strftime('%Y/%m/%d')
        )
    }

    smart_results = {}

    for api_name in ['traffic', 'visitor', 'vehicle']:
        print(f"\n{'=' * 40}")
        print(f"智能获取 {api_name} 数据")
        print('=' * 40)

        start_time, end_time = time_ranges[api_name]
        data = fetcher.fetch_data_by_time_range_smart(
            api_name, start_time, end_time,
            page_size=200, max_pages=50
        )
        smart_results[api_name] = data
        fetcher.analyze_data_time_range(data, api_name)

    # 保存结果
    output_file = 'api_recent_data.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        results = {
            'last_30_days': smart_results
        }


        def datetime_converter(o):
            if isinstance(o, datetime):
                return o.isoformat()
            return str(o)


        json.dump(results, f, ensure_ascii=False, indent=2, default=datetime_converter)

    print(f"\n数据已保存到 {output_file}")

    # 最终报告
    print("\n" + "=" * 60)
    print("最终数据报告")
    print("=" * 60)

    for api_name in ['traffic', 'visitor', 'vehicle']:
        print(f"\n{api_name}:")
        print(f"  最近30天数据: {len(smart_results.get(api_name, []))} 条")

    print("\n数据获取完成！")
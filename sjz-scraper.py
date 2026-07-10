#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QUCHEN SJZ 数据爬虫
====================
数据源: g.aitags.cn (三角洲改枪码大全)
更新: kkrb-data.json、weapons.json

爬取内容:
  1. 密码门密码 (每日更新) - g.aitags.cn API
  2. 制造利润排行 (每日更新) - g.aitags.cn/manufacture HTML解析

运行: python scraper.py
"""

import requests
import re
import json
import os
import sys
import logging
from datetime import datetime, timezone, timedelta

# ============ 配置 ============
SJZ_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SJZ_DIR, 'public', 'sjz', 'data')
KKRB_JSON = os.path.join(DATA_DIR, 'kkrb-data.json')
WEAPONS_JSON = os.path.join(DATA_DIR, 'weapons.json')

LOG_DIR = os.path.join(SJZ_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, f"scraper_{datetime.now().strftime('%Y%m%d')}.log")

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 常用的 HTTP 请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

TIMEOUT = 20
MAX_RETRIES = 2

# ============ 数据源映射 ============
STATION_NAME_MAP = {
    'tab-content-tech': '技术中心',
    'tab-content-workbench': '工作台',
    'tab-content-pharmacy': '制药台',
    'tab-content-armory': '防具台',
}
STATION_TABS = list(STATION_NAME_MAP.keys())

MAP_PASSWORD_MAP = {
    '零号大坝': '零号大坝',
    '长弓溪谷': '长弓溪谷',
    '巴克什': '巴克什',
    '航天基地': '航天基地',
    '潮汐监狱': '潮汐监狱',
    'AZ3': 'AZ3',
}


# ============ 工具函数 ============
def safe_request(method, url, **kwargs):
    """带重试的安全请求"""
    kwargs.setdefault('headers', HEADERS)
    kwargs.setdefault('timeout', TIMEOUT)
    
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            resp = requests.request(method, url, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.exceptions.Timeout:
            logger.warning(f"[{attempt}/{MAX_RETRIES+1}] 请求超时: {url}")
            if attempt > MAX_RETRIES:
                raise
        except requests.exceptions.HTTPError as e:
            logger.warning(f"[{attempt}/{MAX_RETRIES+1}] HTTP错误: {e}")
            if attempt > MAX_RETRIES:
                raise
        except requests.exceptions.RequestException as e:
            logger.warning(f"[{attempt}/{MAX_RETRIES+1}] 请求失败: {e}")
            if attempt > MAX_RETRIES:
                raise


def load_json(filepath):
    """加载 JSON 文件，失败返回 None"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"文件不存在: {filepath}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"JSON解析失败: {filepath} - {e}")
        return None


def save_json(filepath, data):
    """保存 JSON 文件"""
    tmp_path = filepath + '.tmp'
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, filepath)
    logger.info(f"已保存: {filepath}")


def now_beijing():
    """返回北京时间 (UTC+8) 的 ISO 格式时间戳"""
    return (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()


# ============ 爬虫模块 ============

def scrape_password_doors():
    """
    从 g.aitags.cn API 爬取密码门数据
    API: /wp-json/weaponmod/v1/passwords
    返回: list of {map, door_name, password}
    """
    url = 'https://g.aitags.cn/wp-json/weaponmod/v1/passwords'
    logger.info(f"正在爬取密码门数据: {url}")
    
    resp = safe_request('GET', url)
    result = resp.json()
    
    if not result.get('success'):
        logger.error(f"密码门 API 返回失败: {result}")
        return None
    
    raw_list = result.get('list', [])
    if not raw_list:
        logger.warning("密码门数据为空")
        return None
    
    doors = []
    for item in raw_list:
        map_name = item.get('map', '')
        code = item.get('code', '')
        doors.append({
            'map': map_name,
            'door_name': '彩蛋密码门',
            'password': code
        })
    
    update_info = result.get('update_info', {})
    logger.info(f"密码门: 成功爬取 {len(doors)} 个, 更新时间: {update_info.get('time_text', '未知')}")
    return doors


def scrape_manufacturing():
    """
    从 g.aitags.cn/manufacture HTML 爬取制造利润排行
    返回: list of {station, rank, item, hourly_profit}
    """
    url = 'https://g.aitags.cn/manufacture'
    logger.info(f"正在爬取制造数据: {url}")
    
    resp = safe_request('GET', url)
    html = resp.text
    
    manufacturing = []
    
    for tab_id in STATION_TABS:
        station_name = STATION_NAME_MAP[tab_id]
        
        # 定位 Tab 面板
        idx = html.find(f'id="{tab_id}"')
        if idx < 0:
            logger.warning(f"未找到制造台面板: {tab_id}")
            continue
        
        # 定位 tbody
        tbody_start = html.find('<tbody', idx)
        if tbody_start < 0:
            logger.warning(f"未找到 {station_name} 的表格体")
            continue
        tbody_end = html.find('</tbody>', tbody_start)
        if tbody_end < 0:
            continue
        
        tbody = html[tbody_start:tbody_end + 8]
        
        # 解析行
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody, re.DOTALL)
        
        for row in rows[:5]:  # 只取 TOP5
            # 排名
            rank_match = re.search(r'<span[^>]*>\s*(\d+)\s*</span>', row)
            rank = int(rank_match.group(1)) if rank_match else 0
            
            # 物品名
            name_match = re.search(r'truncate[^"]*"[^>]*>\s*([^<]+)\s*</div>', row)
            item = name_match.group(1).strip() if name_match else 'Unknown'
            
            # 小时利润 (带金币图标的数字)
            profit_match = re.search(
                r'gold_icon\.png["\'][^>]*>\s*([\d,]+)\s*</div>', row, re.DOTALL
            )
            hourly = 0
            if profit_match:
                hourly = int(profit_match.group(1).replace(',', ''))
            
            manufacturing.append({
                'station': station_name,
                'rank': rank,
                'item': item,
                'hourly_profit': hourly,
            })
    
    logger.info(f"制造数据: 成功爬取 {len(manufacturing)} 条记录")
    return manufacturing


# ============ 更新器 ============

def update_kkrb_json(password_doors, manufacturing):
    """更新 kkrb-data.json"""
    existing = load_json(KKRB_JSON)
    if existing is None:
        existing = {}
    
    # 更新密码门
    if password_doors is not None:
        existing['password_doors'] = password_doors
    
    # 更新制造数据
    if manufacturing is not None:
        existing['manufacturing_hourly'] = manufacturing
    
    # 更新源标记和时间戳
    existing['source'] = 'g.aitags.cn'
    existing['update_time'] = now_beijing()
    
    # 保留 gun_configs 和 combat_sets 不变
    if 'gun_configs' not in existing:
        existing['gun_configs'] = {
            'note': '改枪码数据来源 g.aitags.cn, 对应 weapons.json',
            'alternative_source': 'g.aitags.cn'
        }
    if 'combat_sets' not in existing:
        # 空占位，实际数据来自 navigation.json
        existing['combat_sets'] = {}
    
    save_json(KKRB_JSON, existing)
    return existing


def update_weapons_json(password_doors, manufacturing):
    """更新 weapons.json 中的每日密码和制造简表"""
    existing = load_json(WEAPONS_JSON)
    if existing is None:
        logger.warning(f"weapons.json 不存在，跳过更新")
        return None
    
    # 从密码门数据中提取每日密码
    if password_doors:
        # 取第一个地图的密码显示为 daily_password
        # AZ3 地图的密码最为常用
        az3 = [d for d in password_doors if d['map'] == 'AZ3']
        if az3:
            code = f"AZ3{az3[0]['password']}"
        else:
            code = f"{password_doors[0]['map']}{password_doors[0]['password']}"
        
        existing['daily_password'] = {
            'code': code,
            'update_time': datetime.now().strftime('%m-%d %H:%M')
        }
    
    # 更新制造简表 (各台 TOP1)
    if manufacturing:
        top_per_station = {}
        for m in manufacturing:
            if m['station'] not in top_per_station:
                top_per_station[m['station']] = m
        
        existing['manufacturing'] = [
            {
                'station': m['station'],
                'item': m['item'],
                'hourly_profit': m['hourly_profit'],
            }
            for m in top_per_station.values()
        ]
    
    save_json(WEAPONS_JSON, existing)
    return existing


# ============ 主流程 ============

def main():
    logger.info("=" * 50)
    logger.info("QUCHEN SJZ 数据爬虫 - 开始运行")
    logger.info(f"站点目录: {SJZ_DIR}")
    logger.info("=" * 50)
    
    errors = []
    password_doors = None
    manufacturing = None
    
    # 1. 爬取密码门数据
    try:
        password_doors = scrape_password_doors()
        if password_doors:
            logger.info(f"密码门数据: {len(password_doors)} 条")
        else:
            errors.append("密码门: 返回数据为空")
    except Exception as e:
        logger.error(f"密码门爬取失败: {e}", exc_info=True)
        errors.append(f"密码门爬取失败: {e}")
    
    # 2. 爬取制造数据
    try:
        manufacturing = scrape_manufacturing()
        if manufacturing:
            logger.info(f"制造数据: {len(manufacturing)} 条")
        else:
            errors.append("制造数据: 返回数据为空")
    except Exception as e:
        logger.error(f"制造数据爬取失败: {e}", exc_info=True)
        errors.append(f"制造数据爬取失败: {e}")
    
    # 3. 更新 JSON 文件
    if password_doors or manufacturing:
        updated = False
        
        try:
            update_kkrb_json(password_doors, manufacturing)
            updated = True
        except Exception as e:
            logger.error(f"kkrb-data.json 更新失败: {e}", exc_info=True)
            errors.append(f"kkrb-data.json 更新失败: {e}")
        
        try:
            update_weapons_json(password_doors, manufacturing)
        except Exception as e:
            logger.error(f"weapons.json 更新失败: {e}", exc_info=True)
            errors.append(f"weapons.json 更新失败: {e}")
        
        if updated:
            logger.info("数据文件更新完成")
    else:
        logger.warning("无有效数据，跳过文件更新")
        errors.append("无有效数据可写入")
    
    # 4. 汇总
    logger.info("=" * 50)
    if errors:
        logger.warning(f"完成（有 {len(errors)} 个错误）:")
        for err in errors:
            logger.warning(f"  - {err}")
    else:
        logger.info("全部任务成功完成！")
    logger.info("=" * 50)
    
    return len(errors) == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

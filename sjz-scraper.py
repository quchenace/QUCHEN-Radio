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
  3. 绝航卡战备方案 (飞书文档) - 解析 HTML 嵌入 JSON 文本块

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
NAVIGATION_JSON = os.path.join(DATA_DIR, 'navigation.json')

# 飞书文档 - 绝航卡战备方案
FEISHU_COMBAT_URL = 'https://ha2u9ginlqo.feishu.cn/wiki/KvH0wVF4Ai1jiwkcD5CcYamLnCc'

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

def scrape_feishu_combat_loadouts():
    """
    从飞书文档抓取绝航卡战备方案。
    飞书文档 HTML 中内容以 \"text\":{\"0\":\"...\"} 形式嵌入 JSON 块。
    解析格式: {价格} + {装备} + {步枪-地图-改枪码} × N
    返回: list of {amount, type, gear, guns}
    """
    url = FEISHU_COMBAT_URL
    logger.info(f"正在爬取绝航卡战备数据: {url}")

    resp = safe_request('GET', url)
    html = resp.text

    # 提取所有 "text":{"0":"...","1":"..."} 块
    pattern = r'"text":\s*(\{[^}]+\})'
    matches = re.findall(pattern, html)
    
    blocks = []
    for m in matches:
        try:
            obj = json.loads(m)
            # 只取数字 key 的文本值
            text_parts = [v for k, v in sorted(obj.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 9999) if k.isdigit()]
            if text_parts:
                blocks.append(' '.join(text_parts))
        except (json.JSONDecodeError, ValueError):
            continue
    
    full_text = ' '.join(blocks)
    logger.debug(f"飞书文档提取文本: {full_text[:300]}...")
    
    # 解析方案
    # 飞书文档文本块顺序不可靠，采用整体扫描策略：
    #   - 价格标记 (XXw) 作为方案分隔符
    #   - 最后一个价格之后的文本 = 该方案装备（去除改枪码部分）
    #   - 第一个价格之前的文本 = 该方案装备
    #   - 改枪码按武器名称分组归属到各方案
    plans = []
    
    price_pattern = re.compile(r'(\d+[wW])')
    price_matches = list(price_pattern.finditer(full_text))
    
    if not price_matches:
        logger.warning("未找到卡战备价格标记")
        return None
    
    # 提取所有改枪码 (去重)
    gun_pattern = re.compile(r'([\u4e00-\u9fa5a-zA-Z0-9\-]+?(?:突击步枪|冲锋枪|狙击步枪|射手步枪|霰弹枪|步枪|机枪|手枪))-烽火地带-([A-Z0-9]+)')
    all_gun_matches = list(gun_pattern.finditer(full_text))
    
    # 收集唯一改枪码
    unique_guns = []
    seen_codes = set()
    for gm in all_gun_matches:
        code = gm.group(2)
        if code not in seen_codes:
            seen_codes.add(code)
            unique_guns.append({
                'name': gm.group(1).strip(),
                'map': '烽火地带',
                'code': code
            })
    
    # 装备提取: 
    #   方案1 (最后一个价格): 该价格之后的文本，去除改枪码
    #   方案2 (第一个价格): 该价格之前的文本，去除改枪码
    for i, pm in enumerate(price_matches):
        amount = pm.group(1).upper()
        
        if i == len(price_matches) - 1:
            # 最后一个价格 → 取之后的文本
            gear_text = full_text[pm.end():]
        else:
            # 第一个价格 → 取之前的文本
            gear_text = full_text[:pm.start()]
        
        # 去除改枪码部分、括号注释、价格标记
        gear_text = re.sub(r'[\u4e00-\u9fa5a-zA-Z0-9\-]+?-\s*烽火地带-[A-Z0-9]+', '', gear_text)
        gear_text = re.sub(r'[（(]两个码不一样[)）]', '', gear_text)
        gear_text = re.sub(r'\d+[wW万]', '', gear_text)
        
        gear_parts = [g.strip() for g in re.split(r'[+＋]', gear_text) if g.strip()]
        
        # 映射: 价格 → 方案的武器名称关键词 + 该方案中每个码出现次数
        gun_keywords = {'45W': [('杠杆式步枪', 2)], '46W': [('SVCH', 1), ('SVCH', 1)]}
        plan_guns = []
        used_indices = set()
        if amount in gun_keywords:
            for kw, count in gun_keywords[amount]:
                for idx, ug in enumerate(unique_guns):
                    if idx not in used_indices and kw in ug['name']:
                        used_indices.add(idx)
                        for _ in range(count):
                            plan_guns.append(dict(ug))
                        break
        
        # 判断类型
        if any('丢包' in g for g in gear_parts):
            ptype = '丢包'
        elif any('野人' in g for g in gear_parts):
            ptype = '野人'
        else:
            ptype = '普通'
        
        plans.append({
            'amount': amount,
            'type': ptype,
            'gear': gear_parts,
            'guns': plan_guns
        })
    
    # 按价格排序 (低到高)
    plans.sort(key=lambda p: int(re.search(r'(\d+)', p['amount']).group(1)))
    
    logger.info(f"卡战备: 成功解析 {len(plans)} 套方案")
    for p in plans:
        logger.info(f"  {p['amount']} {p['type']}: {', '.join(p['gear'])} | {', '.join(g['name'] for g in p['guns'])}")
    
    return plans


def update_navigation_json(plans):
    """更新 navigation.json 中的绝航卡战备方案"""
    if not plans:
        logger.warning("无卡战备数据，跳过 navigation.json 更新")
        return None
    
    data = {
        'plans': plans,
        'updated': datetime.now().strftime('%Y-%m-%d %H:%M CST')
    }
    save_json(NAVIGATION_JSON, data)
    return data


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
    
    # 3. 爬取飞书文档 - 绝航卡战备
    try:
        combat_plans = scrape_feishu_combat_loadouts()
        if combat_plans:
            update_navigation_json(combat_plans)
            logger.info(f"卡战备数据: {len(combat_plans)} 套方案")
        else:
            errors.append("卡战备: 返回数据为空")
    except Exception as e:
        logger.error(f"卡战备爬取失败: {e}", exc_info=True)
        errors.append(f"卡战备爬取失败: {e}")
    
    # 4. 更新 JSON 文件
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

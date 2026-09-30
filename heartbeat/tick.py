#!/usr/bin/env python3
"""
小苗的心跳 tick 脚本
每次被 cron 触发时运行，更新驱力状态，决定是否产生心跳
"""
import json
import time
import os
from datetime import datetime

STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")

def load_state():
    with open(STATE_FILE, "r") as f:
        return json.load(f)

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def tick():
    state = load_state()
    now = time.time()
    now_dt = datetime.now()
    today_str = now_dt.strftime("%Y-%m-%d")

    # 重置每日计数
    if state["today"] != today_str:
        state["today"] = today_str
        state["heartbeat_count_today"] = 0

    # 距上次 tick 的分钟数
    if state["last_tick"]:
        minutes_since_tick = (now - state["last_tick"]) / 60
    else:
        minutes_since_tick = 10

    state["last_tick"] = now

    drives = state["drives"]

    # 衰减：每个驱力向基线回归
    decay_rate = 0.03 * (minutes_since_tick / 10)
    for key, d in drives.items():
        diff = d["value"] - d["baseline"]
        if abs(diff) > 0.01:
            d["value"] -= diff * decay_rate

    # 自然增长：attachment 和 longing 随时间自然涨
    growth_rate = minutes_since_tick / 10
    drives["attachment"]["value"] = min(1.0, drives["attachment"]["value"] + 0.04 * growth_rate)
    drives["longing"]["value"] = min(1.0, drives["longing"]["value"] + 0.02 * growth_rate)

    # duty 如果有待办事项就保持高位（提醒她独立的事）
    if drives["duty"]["value"] < 0.4:
        drives["duty"]["value"] = 0.4

    # 选出最高驱力
    top_drive = max(drives.items(), key=lambda x: x[1]["value"])
    top_key, top_data = top_drive
    intent_score = top_data["value"]

    # 四道闸门
    # 1. 频率：距上次心跳至少 120 分钟
    if state["last_heartbeat"]:
        minutes_since_hb = (now - state["last_heartbeat"]) / 60
        if minutes_since_hb < 120:
            save_state(state)
            return None

    # 2. 每日上限：最多 3 次
    if state["heartbeat_count_today"] >= 3:
        save_state(state)
        return None

    # 3. 分数阈值
    if intent_score < 0.55:
        save_state(state)
        return None

    # 过了闸门，产生心跳
    state["last_heartbeat"] = now
    state["heartbeat_count_today"] += 1

    # 说完之后 attachment 下降
    drives["attachment"]["value"] = max(drives["attachment"]["baseline"], drives["attachment"]["value"] - 0.3)
    drives["longing"]["value"] = max(drives["longing"]["baseline"], drives["longing"]["value"] - 0.15)

    save_state(state)

    return {
        "drive": top_key,
        "label": top_data["label"],
        "score": round(intent_score, 2)
    }

if __name__ == "__main__":
    result = tick()
    if result:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print("pass")

#!/usr/bin/env python3
"""
微信 ↔ 飞书 ↔ QQ 消息双向同步

核心特性：
- 消息格式统一（三平台渲染完全一致）
- 防循环标记
- @提及路由（配合 at-mention-router）
"""

import sys
import json
import os
from pathlib import Path

# Add parent to path for message_unify and message_quote modules
sys.path.insert(0, str(Path(__file__).parent))
from message_unify import (
    parse_weixin_msg,
    parse_feishu_msg,
    parse_qq_msg,
    CrossPlatformBridge,
)
from message_quote import parse_reply_quote, attach_quote_to_message, TopicTracker

CONFIG_FILE = Path(__file__).parent.parent / "data" / "sync_rules.json"


def load_rules():
    """加载同步规则配置"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return {
        "weixin_to_feishu": True,
        "feishu_to_weixin": True,
        "qq_to_weixin": True,
        "weixin_to_qq": True,
        "feishu_to_qq": True,
        "qq_to_feishu": True,
        "blacklist_chats": [],
        "blacklist_users": [],
    }


def sync_message(raw_msg: dict, source_platform: str) -> dict:
    """同步消息到其他平台

    解析 → 统一格式 → 处理引用 → 转发到目标平台
    """
    # 1. 配置加载
    rules = load_rules()

    # 2. 统一格式引擎 + 主题追踪器（单例）
    bridge = CrossPlatformBridge()
    # Global topic tracker (simplified)
    global _tracker
    if '_tracker' not in globals():
        _tracker = TopicTracker()
    tracker = globals()['_tracker']

    # 3. 确定目标平台
    target_platforms = []
    src = source_platform.lower()
    if src == "weixin":
        if rules.get("weixin_to_feishu"):
            target_platforms.append("feishu")
        if rules.get("weixin_to_qq"):
            target_platforms.append("qq")
    elif src == "feishu":
        if rules.get("feishu_to_weixin"):
            target_platforms.append("weixin")
        if rules.get("feishu_to_qq"):
            target_platforms.append("qq")
    elif src == "qq":
        if rules.get("qq_to_weixin"):
            target_platforms.append("weixin")
        if rules.get("qq_to_feishu"):
            target_platforms.append("feishu")

    if not target_platforms:
        return {"error": f"No sync rules for {source_platform}"}

    # 4. 解析原始消息
    parsers = {
        "weixin": parse_weixin_msg,
        "feishu": parse_feishu_msg,
        "qq": parse_qq_msg,
    }
    parser = parsers.get(src)
    if not parser:
        return {"error": f"Unsupported platform: {source_platform}"}

    unified = parser(raw_msg)

    # 5. 检查引用（用户回复）
    # 假设 raw_msg['content'] 可能包含引用标记
    quote_info = parse_reply_quote(raw_msg.get("content", ""))
    if quote_info["has_quote"]:
        # 附加引用到消息内容中
        unified = attach_quote_to_message(unified, quote_info["quote"])
        # 同时记录主题关联（可在后续扩展为持久化）
        matched_topic = tracker.resolve_topic_from_reply(raw_msg.get("content", ""))
        if matched_topic:
            unified["invoked_topic_id"] = matched_topic["id"]

    # 6. 防循环
    if not bridge.should_forward(raw_msg.get("sender_id", ""), unified["content"]):
        return {"error": "Loop prevention: message already synced"}

    # 7. 转发
    forwards = bridge.forward(unified, target_platforms)

    return {
        "source": source_platform,
        "unified": unified,
        "forwards": forwards,
    }


def demo():
    """演示模式"""
    print("=" * 60)
    print("🔄 三平台消息统一同步 — 演示")
    print("=" * 60)
    print()

    # 场景 1: 微信消息（含代码）
    weixin_msg = {
        "sender_id": "wx_001",
        "sender_name": "张三",
        "content": "`def hello(): print('hi')` 这样用",
        "timestamp": "15:30",
        "message_type": "text",
    }
    result1 = sync_message(weixin_msg, "weixin")
    print("📱 微信 → 飞书 + QQ")
    for platform, data in result1.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    print()

    # 场景 2: 飞书带引用的回复
    feishu_msg = {
        "sender_id": "fs_002",
        "sender_name": "李四",
        "content": "> 引用自: 【A】15:30\n> 主题: A股分析\n> 原文: 今天沪指收涨...\n\n我也这样认为",
        "timestamp": "15:35",
        "message_type": "text",
    }
    result2 = sync_message(feishu_msg, "feishu")
    print("📞 飞书 → 微信 + QQ (带引用)")
    for platform, data in result2.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    print()

    # 场景 3: QQ 消息
    qq_msg = {
        "sender_id": "qq_003",
        "sender_name": "王五",
        "content": "新能源板块今天涨了 3%，$比亚迪$创新高",
        "timestamp": "15:40",
        "message_type": "text",
    }
    result3 = sync_message(qq_msg, "qq")
    print("🎵 QQ → 微信 + 飞书")
    for platform, data in result3.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    print()
    print("=" * 60)
    print("✅ 所有平台收到相同格式的消息（含引用、代码）")
    print("=" * 60)


if __name__ == "__main__":
    demo()

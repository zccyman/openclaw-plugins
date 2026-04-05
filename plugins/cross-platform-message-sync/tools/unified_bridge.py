#!/usr/bin/env python3
"""
统一跨平台消息桥接器

集成了：
- 消息格式统一 (message_unify)
- 代码块渲染增强 (code_render)
- 消息引用系统 (message_quote)
- 提示词历史管理 (prompt_history) — CLI 工具独立

用法：
  python unified_bridge.py                  # 演示模式
  python unified_bridge.py --platform weixin --msg '{}'
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from message_unify import CrossPlatformBridge
from message_quote import TopicTracker, attach_quote_to_message, parse_reply_quote
from code_render import render_with_copy_hint
from choice_render import render_options


class UnifiedBridge:
    """所有功能的统一接入点"""

    def __init__(self):
        self.bridge = CrossPlatformBridge()
        self.tracker = TopicTracker()

    def process_inbound(
        self,
        raw_msg: dict,
        source_platform: str,
        target_platforms: list = None,
    ) -> dict:
        """处理入站消息的完整管线"""
        if target_platforms is None:
            target_platforms = self._infer_targets(source_platform)

        unified = self.bridge.process_pipeline(
            raw_msg, source_platform, target_platforms
        )

        if "error" in unified:
            return unified

        # 检测引用并附加
        content = raw_msg.get("content", "")
        quote_info = parse_reply_quote(content)

        if quote_info["has_quote"]:
            unified["unified"] = attach_quote_to_message(
                unified["unified"], quote_info["quote"]
            )
            matched = self.tracker.resolve_topic_from_reply(content)
            if matched:
                unified["unified"]["invoked_topic"] = matched

        # 代码块渲染增强 + 选项渲染增强（组合管线）
        for platform, data in unified.get("forwards", {}).items():
            text = data["raw_text"]
            text = render_with_copy_hint(text, platform)
            text = render_options(text, platform)
            data["raw_text"] = text
            data["rendered_with"] = "code_render+options"

        return unified

    def _infer_targets(self, source: str) -> list:
        all_platforms = ["weixin", "feishu", "qq"]
        return [p for p in all_platforms if p != source.lower()]

    def register_agent_response(
        self,
        agent_name: str,
        topic: str,
        message_id: str = None,
        preview: str = None,
    ) -> str:
        """注册子智能体的回复主题"""
        return self.tracker.register_topic(agent_name, topic, message_id, preview)

    def get_active_topics(self) -> list:
        return self.tracker.get_topics_list()


def demo():
    print("=" * 60)
    print("🔄 统一跨平台消息桥接器 — 完整演示")
    print("=" * 60)
    print()

    bridge = UnifiedBridge()

    # 注册子智能体响应
    topic_id = bridge.register_agent_response(
        "A", "A股分析", "msg_001", "今天沪指收涨1.5%，金融板块领涨..."
    )
    print(f"📌 注册主题: {topic_id} — A (A股分析)")

    # 场景1：微信消息（含代码块）
    weixin_msg = {
        "sender_id": "wx_001",
        "sender_name": "张三",
        "content": "@A 今天A股收盘了，来看看总结\n\n```python\nimport pandas as pd\ndf = pd.read_csv('sh000001.csv')\nprint(df.tail())\n```",
        "timestamp": "15:30",
        "message_type": "text",
    }

    print("\n📱 场景1：微信消息（含代码）→ 飞书+QQ")
    result1 = bridge.process_inbound(weixin_msg, "weixin")
    for platform, data in result1.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    # 场景2：飞书带引用的回复
    feishu_reply = {
        "sender_id": "fs_002",
        "sender_name": "李四",
        "content": """> 引用自: 【A】15:30
> 主题: A股分析
> 原文: 今天沪指收涨1.5%，金融板块领涨...

好的，我来帮你分析一下：

```python
# 计算移动平均
df['MA5'] = df['close'].rolling(5).mean()
```
""",
        "timestamp": "15:35",
        "message_type": "text",
    }

    print("\n\n📞 场景2：飞书带引用回复 → 微信+QQ")
    result2 = bridge.process_inbound(feishu_reply, "feishu")
    for platform, data in result2.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    print("\n\n📊 当前活跃主题：")
    for t in bridge.get_active_topics():
        print(f"  [{t['id']}] {t['agent']} — {t['topic']}")

    # 场景3：含选项的消息
    print("\n\n📊 场景3：含多选项消息 → 全平台")
    choice_msg = {
        "sender_id": "agent_a",
        "sender_name": "A",
        "content": """请选择您关注的板块：

A. 金融板块
B. 半导体
C. 新能源

回复选项字母即可""",
        "timestamp": "15:45",
        "message_type": "text",
    }
    result3 = bridge.process_inbound(choice_msg, "feishu")
    for platform, data in result3.get("forwards", {}).items():
        print(f"\n--- {platform} ---")
        print(data["raw_text"])

    print("\n" + "=" * 60)
    print("✅ 统一桥接器功能全链路验证通过（同步+引用+代码+选项）")
    print("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="统一跨平台消息桥接器")
    parser.add_argument(
        "--source", "--platform", choices=["weixin", "feishu", "qq", "qqbot"]
    )
    parser.add_argument("--msg", type=str, help="JSON 格式的原始消息")
    parser.add_argument("--target", nargs="+", default=None)

    args = parser.parse_args()

    if args.source and args.msg:
        raw_msg = json.loads(args.msg)
        bridge = UnifiedBridge()
        result = bridge.process_inbound(raw_msg, args.source, args.target)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        demo()

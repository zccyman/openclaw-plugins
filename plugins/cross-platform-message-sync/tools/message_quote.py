#!/usr/bin/env python3
"""
消息引用系统 — 子智能体引用回复 + 主题追踪

功能：
1. 解析用户回复时的引用（回复某条消息）
2. 生成带引用的统一消息格式（飞书标准）
3. 自动关联子智能体主题/问题
4. 持久化主题追踪（JSON 文件存储）

引用格式（飞书标准 Markdown）：
> **引用自：【机器人A】15:30**
> 主题: A股分析
> 原文: 今天A股大盘...

用户回复内容...
"""

import json
import re
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List


TOPICS_FILE = Path(__file__).parent.parent / "data" / "topics.json"


def _get_topics_file():
    env = os.environ.get("TOPICS_FILE_PATH")
    return Path(env) if env else TOPICS_FILE


# ==================== 引用解析 ====================


def parse_reply_quote(raw_content: str) -> Dict[str, Any]:
    """解析带有引用的用户回复。

    支持格式：
    1. 标准引用: > 引用自: 【xxx】time / 主题: xxx / 原文: xxx
    2. 简化引用: > xxx 说: ...
    3. 回复标记: 回复 @xxx: ...
    """
    pattern_standard = re.compile(
        r"> \*?\*?引用自[：:]\s*\*?\*?【(.+?)】(.+?)\n"
        r"> 主题[：:]\s*(.+?)\n"
        r"> 原文[：:]\s*(.+?)(?:\n\n|\n)(.*|$)",
        re.DOTALL,
    )
    m = pattern_standard.search(raw_content)
    if m:
        return {
            "has_quote": True,
            "quote": {
                "sender": m.group(1).strip(),
                "timestamp": m.group(2).strip(),
                "topic": m.group(3).strip(),
                "original_text": m.group(4).strip(),
            },
            "user_reply": (m.group(5) or "").strip(),
        }

    pattern_simple = re.compile(
        r">\s*(.+?)\s*说[：:]\s*(.+?)(?:\n\n|\n)(.*|$)", re.DOTALL
    )
    m2 = pattern_simple.search(raw_content)
    if m2:
        return {
            "has_quote": True,
            "quote": {
                "sender": m2.group(1).strip(),
                "timestamp": "",
                "topic": "",
                "original_text": m2.group(2).strip(),
            },
            "user_reply": (m2.group(3) or "").strip(),
        }

    reply_at = re.match(r"回复\s*@(\S+)\s*[：:]\s*(.*)", raw_content, re.DOTALL)
    if reply_at:
        return {
            "has_quote": True,
            "quote": {
                "sender": reply_at.group(1).strip(),
                "timestamp": "",
                "topic": "",
                "original_text": "",
            },
            "user_reply": reply_at.group(2).strip(),
        }

    cq_pattern = re.compile(r"\[CQ:reply,id=(\d+)\]\s*(.*)", re.DOTALL)
    cq_match = cq_pattern.match(raw_content)
    if cq_match:
        return {
            "has_quote": True,
            "quote": {
                "sender": "",
                "timestamp": "",
                "topic": "",
                "original_text": f"[QQ回复] msg:{cq_match.group(1)}",
            },
            "user_reply": cq_match.group(2).strip(),
        }

    return {
        "has_quote": False,
        "quote": None,
        "user_reply": raw_content,
    }


# ==================== 引用生成 ====================


def generate_quote_header(
    sender: str,
    timestamp: str,
    topic: str,
    original_text: str,
    max_len: int = 100,
) -> str:
    text_preview = original_text[:max_len]
    if len(original_text) > max_len:
        text_preview += "..."

    lines = [f"> **引用自：【{sender}】{timestamp}**"]
    if topic:
        lines.append(f"> 主题: {topic}")
    if text_preview:
        lines.append(f"> 原文: {text_preview}")
    return "\n".join(lines) + "\n"


def attach_quote_to_message(
    unified_msg: Dict[str, Any], quote: Dict[str, Any]
) -> Dict[str, Any]:
    if not quote or not quote.get("sender"):
        return unified_msg

    quote_header = generate_quote_header(
        sender=quote["sender"],
        timestamp=quote.get("timestamp", ""),
        topic=quote.get("topic", "未分类"),
        original_text=quote.get("original_text", ""),
    )

    unified_msg["reply_to"] = quote
    unified_msg["content"] = f"{quote_header}\n{unified_msg['content']}"
    return unified_msg


# ==================== 持久化主题追踪 ====================


class TopicTracker:
    """持久化追踪活跃主题/子智能体对话。

    每个子智能体回复分配 topic_id，用户回复时自动关联。
    主题数据持久化到 JSON 文件。
    """

    def __init__(self, topics_file: Optional[Path] = None):
        self.topics_file = topics_file or _get_topics_file()
        self.active_topics: Dict[str, Dict[str, Any]] = {}
        self.next_id = 1
        self._load()

    def _load(self):
        if self.topics_file.exists():
            try:
                with open(self.topics_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for tid, topic in data.get("topics", {}).items():
                    if topic.get("status") == "active":
                        self.active_topics[tid] = topic
                self.next_id = data.get("next_id", len(self.active_topics) + 1)
            except (json.JSONDecodeError, KeyError):
                self.active_topics = {}
                self.next_id = 1

    def _save(self):
        self.topics_file.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "topics": self.active_topics,
            "next_id": self.next_id,
            "updated_at": datetime.now().isoformat(),
        }
        with open(self.topics_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def register_topic(
        self,
        agent_name: str,
        topic: str,
        message_id: Optional[str] = None,
        preview: Optional[str] = None,
    ) -> str:
        topic_id = f"T{self.next_id:03d}"
        self.next_id += 1

        self.active_topics[topic_id] = {
            "id": topic_id,
            "agent": agent_name,
            "topic": topic,
            "message_id": message_id,
            "preview": preview,
            "created_at": datetime.now().strftime("%H:%M"),
            "status": "active",
        }
        self._save()
        return topic_id

    def find_topic_by_agent(self, agent_name: str) -> Optional[Dict[str, Any]]:
        for t in self.active_topics.values():
            if t["agent"] == agent_name and t["status"] == "active":
                return t
        return None

    def find_topic_by_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        return self.active_topics.get(topic_id)

    def get_topics_list(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(self.active_topics.values())[:limit]

    def resolve_topic_from_reply(self, user_reply: str) -> Optional[Dict[str, Any]]:
        parsed = parse_reply_quote(user_reply)
        if parsed["has_quote"] and parsed["quote"]:
            for topic in self.active_topics.values():
                if topic["agent"] == parsed["quote"]["sender"]:
                    return topic

        active = [t for t in self.active_topics.values() if t["status"] == "active"]
        if len(active) == 1:
            return active[0]

        return None

    def close_topic(self, topic_id: str) -> bool:
        if topic_id in self.active_topics:
            self.active_topics[topic_id]["status"] = "closed"
            self._save()
            return True
        return False


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description="Quote reply / topic tracker tool")
    sub = parser.add_subparsers(dest="command")

    reg_p = sub.add_parser("register", help="Register a new topic")
    reg_p.add_argument("--agent", required=True)
    reg_p.add_argument("--topic", required=True)
    reg_p.add_argument("--message-id", default="")
    reg_p.add_argument("--preview", default="")

    resolve_p = sub.add_parser("resolve", help="Resolve topic from user reply")
    resolve_p.add_argument("--reply", required=True)

    sub.add_parser("list", help="List active topics")

    close_p = sub.add_parser("close", help="Close a topic")
    close_p.add_argument("--topic-id", required=True)

    args = parser.parse_args()

    tracker = TopicTracker()

    if args.command == "register":
        tid = tracker.register_topic(
            args.agent, args.topic, args.message_id, args.preview
        )
        print(
            json.dumps(
                {"ok": True, "topic_id": tid, "agent": args.agent, "topic": args.topic},
                ensure_ascii=False,
            )
        )
    elif args.command == "resolve":
        matched = tracker.resolve_topic_from_reply(args.reply)
        if matched:
            print(json.dumps({"matched": True, "topic": matched}, ensure_ascii=False))
        else:
            print(json.dumps({"matched": False}, ensure_ascii=False))
    elif args.command == "list":
        topics = tracker.get_topics_list()
        print(json.dumps({"topics": topics, "total": len(topics)}, ensure_ascii=False))
    elif args.command == "close":
        ok = tracker.close_topic(args.topic_id)
        print(json.dumps({"ok": ok, "topic_id": args.topic_id}, ensure_ascii=False))
    else:
        import tempfile

        tmpdir = tempfile.mkdtemp()
        tf = Path(tmpdir) / "topics.json"
        t = TopicTracker(topics_file=tf)
        t.register_topic("A", "A股分析", "msg001", "今天沪指收涨1.5%...")
        t.register_topic("B", "新能源板块", "msg002", "宁德时代大涨...")
        for topic in t.get_topics_list():
            print(f"  [{topic['id']}] {topic['agent']} — {topic['topic']}")
        print("✅ Quote reply CLI ready")


if __name__ == "__main__":
    _cli()

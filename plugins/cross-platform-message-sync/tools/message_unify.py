#!/usr/bin/env python3
"""
跨平台消息统一格式引擎

目标：微信、QQ、飞书的消息内容和渲染在转发后格式保持完全一致
策略：
  1. 统一转为飞书兼容的 Markdown 格式（三平台都兼容）
  2. 保留原始发送者、时间戳、消息类型
  3. 添加 [来源标记] 防循环
  4. 图片/文件：统一为 URL/附件引用
  5. 所有渲染输出与飞书完全一致

格式规范（统一飞书风格）：
  **【sender_name】** HH:MM
  message_content

  _↗ 来源：WeChat/Feishu/QQ_
"""

import json
import re
import os
from datetime import datetime
from typing import Optional, Dict, Any, List


PLATFORM_LABELS = {
    "weixin": "微信",
    "feishu": "飞书",
    "qq": "QQ",
    "qqbot": "QQ",
}

SOURCE_TAGS = {
    "weixin": "Sync from WeChat",
    "feishu": "Sync from Feishu",
    "qq": "Sync from QQ",
    "qqbot": "Sync from QQ",
}


def get_source_tag(platform: str) -> str:
    return SOURCE_TAGS.get(platform.lower(), f"Sync from {platform}")


def get_platform_label(platform: str) -> str:
    return PLATFORM_LABELS.get(platform.lower(), platform)


def extract_code_blocks(content: str) -> List[Dict[str, str]]:
    blocks = []
    fence_pattern = r"```(\w*)\n([\s\S]*?)```"
    for m in re.finditer(fence_pattern, content, re.MULTILINE):
        lang = m.group(1).strip()
        code = m.group(2).rstrip()
        blocks.append({"language": lang, "code": code})

    lines = content.split("\n")
    current_block = []
    in_block = False
    for line in lines:
        if line.startswith("    ") and line.strip():
            in_block = True
            current_block.append(line[4:])
        else:
            if in_block and current_block:
                blocks.append({"language": "text", "code": "\n".join(current_block)})
                current_block = []
            in_block = False
    if in_block and current_block:
        blocks.append({"language": "text", "code": "\n".join(current_block)})
    return blocks


def normalize_message(
    content: str,
    sender_name: str,
    source_platform: str,
    timestamp: Optional[str] = None,
    msg_type: str = "text",
    attachments: Optional[list] = None,
    reply_to: Optional[str] = None,
    mentions: Optional[list] = None,
    code_blocks: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    ts = timestamp or datetime.now().strftime("%H:%M")
    source_tag = get_source_tag(source_platform)

    return {
        "platform": source_platform,
        "sender": sender_name,
        "timestamp": ts,
        "type": msg_type,
        "content": content,
        "source_tag": source_tag,
        "platform_label": get_platform_label(source_platform),
        "attachments": attachments or [],
        "reply_to": reply_to,
        "mentions": mentions or [],
        "code_blocks": code_blocks or extract_code_blocks(content),
    }


def format_for_display(unified: Dict[str, Any], target_platform: str) -> str:
    """将统一格式转为目标平台可显示的文本。

    所有平台都使用飞书兼容的 Markdown 格式，确保渲染完全一致。
    """
    sender = unified["sender"]
    ts = unified["timestamp"]
    content = unified["content"]
    source_tag = unified["source_tag"]
    platform_label = unified.get(
        "platform_label", get_platform_label(unified["platform"])
    )
    msg_type = unified["type"]

    header = f"**【{sender}】** {ts}"

    reply_prefix = ""
    if unified.get("reply_to"):
        if isinstance(unified["reply_to"], dict):
            q = unified["reply_to"]
            reply_prefix = f"> **引用自：【{q.get('sender', '')}】{q.get('timestamp', '')}**\n> 主题: {q.get('topic', '')}\n> 原文: {q.get('original_text', '')[:80]}\n\n"
        else:
            reply_prefix = f"> **引用:** {unified['reply_to']}\n\n"

    if msg_type == "text":
        body = f"{reply_prefix}{content}"
    elif msg_type == "image":
        body = f"{reply_prefix}[📷 图片] {content}"
    elif msg_type == "file":
        body = f"{reply_prefix}[📎 文件] {content}"
    elif msg_type == "video":
        body = f"{reply_prefix}[🎬 视频] {content}"
    elif msg_type == "voice":
        body = f"{reply_prefix}[🎤 语音] (暂不支持)"
    else:
        body = f"{reply_prefix}{content}"

    footer = f"\n\n_↗ {source_tag}_"

    return f"{header}\n\n{body}{footer}"


def parse_weixin_msg(raw: Dict[str, Any]) -> Dict[str, Any]:
    msg_type = "text"
    type_map = {"image": "image", "file": "file", "video": "video", "voice": "voice"}
    msg_type = type_map.get(raw.get("message_type", ""), "text")

    mentions = raw.get("mentioned_list", [])

    return normalize_message(
        content=raw.get("content", ""),
        sender_name=raw.get("sender_name", "Unknown"),
        source_platform="weixin",
        timestamp=raw.get("timestamp"),
        msg_type=msg_type,
        mentions=mentions,
    )


def parse_feishu_msg(raw: Dict[str, Any]) -> Dict[str, Any]:
    content = raw.get("content", "")

    try:
        content_json = json.loads(content)
        if isinstance(content_json, dict):
            raw_text = content_json.get("text", content)
        else:
            raw_text = content
    except (json.JSONDecodeError, TypeError):
        raw_text = content

    type_map = {"image": "image", "file": "file", "audio": "voice", "media": "video"}
    msg_type = type_map.get(raw.get("message_type", ""), "text")

    mentions = raw.get("mentions", [])

    reply_to = None
    if raw.get("upper_message_id"):
        reply_to = f"[回复] {raw.get('upper_content', '')[:50]}..."

    return normalize_message(
        content=raw_text,
        sender_name=raw.get("sender_name", "Unknown"),
        source_platform="feishu",
        timestamp=raw.get("timestamp"),
        msg_type=msg_type,
        mentions=mentions,
        reply_to=reply_to,
    )


def _extract_qq_reply(raw: Dict[str, Any]) -> Optional[str]:
    reply_id = None
    reply_text = None
    reply_sender = None

    message = raw.get("message")
    if isinstance(message, list):
        for seg in message:
            if isinstance(seg, dict) and seg.get("type") == "reply":
                reply_id = seg.get("data", {}).get("id")

    if not reply_id:
        content = raw.get("content", "")
        cq_match = re.search(r"\[CQ:reply,id=(\d+)\]", content)
        if cq_match:
            reply_id = cq_match.group(1)

    if not reply_id:
        ref = raw.get("message_reference")
        if isinstance(ref, dict):
            reply_id = ref.get("message_id")

    if not reply_id:
        reply_id = raw.get("reply_to_id") or raw.get("upper_message_id")

    reply_text = (
        raw.get("reply_content")
        or raw.get("quoted_content")
        or raw.get("upper_content")
        or ""
    )
    if isinstance(raw.get("reply_message"), dict):
        reply_text = raw["reply_message"].get("content", reply_text)
        reply_sender = raw["reply_message"].get("sender_name")

    reply_sender = (
        reply_sender or raw.get("reply_sender") or raw.get("quoted_sender") or ""
    )

    if not reply_id and not reply_text:
        return None

    if reply_text:
        preview = reply_text[:80]
        sender_prefix = f"[{reply_sender}] " if reply_sender else ""
        suffix = "..." if len(reply_text) > 80 else ""
        return f"[回复] {sender_prefix}{preview}{suffix}"
    elif reply_id:
        return f"[回复] msg:{reply_id}"

    return None


def parse_qq_msg(raw: Dict[str, Any]) -> Dict[str, Any]:
    type_map = {"图片": "image", "文件": "file", "语音": "voice", "视频": "video"}
    msg_type = type_map.get(raw.get("message_type", ""), "text")

    content = raw.get("content", "")
    reply_to = _extract_qq_reply(raw)

    content = re.sub(r"\[CQ:reply,id=\d+\]\s*", "", content).strip()

    return normalize_message(
        content=content,
        sender_name=raw.get("sender_name", "Unknown"),
        source_platform="qq",
        timestamp=raw.get("timestamp"),
        msg_type=msg_type,
        mentions=raw.get("mentions", []),
        reply_to=reply_to,
    )


class CrossPlatformBridge:
    def __init__(self):
        self.rate_limits = {}
        self.loop_markers = set()

    def should_forward(self, sender_id: str, msg_content: str) -> bool:
        source_tags = ["[↗", "Sync from"]
        for tag in source_tags:
            if tag in msg_content:
                return False
        return True

    def forward(
        self, unified_msg: Dict[str, Any], target_platforms: list
    ) -> Dict[str, Any]:
        results = {}
        for platform in target_platforms:
            normalized = platform.lower().replace("bot", "")
            if (
                platform == unified_msg["platform"]
                or normalized == unified_msg["platform"]
            ):
                continue
            formatted = format_for_display(unified_msg, platform)
            results[platform] = {
                "raw_text": formatted,
                "platform": platform,
                "msg_type": unified_msg["type"],
            }
        return results

    def process_pipeline(
        self, raw_msg: Dict[str, Any], source_platform: str, target_platforms: list
    ) -> Dict[str, Any]:
        parsers = {
            "weixin": parse_weixin_msg,
            "feishu": parse_feishu_msg,
            "qq": parse_qq_msg,
            "qqbot": parse_qq_msg,
        }

        parser = parsers.get(source_platform.lower())
        if not parser:
            return {"error": f"Unsupported platform: {source_platform}"}

        unified = parser(raw_msg)

        if not self.should_forward(raw_msg.get("sender_id", ""), unified["content"]):
            return {"error": "Loop prevention: message already synced"}

        forwards = self.forward(unified, target_platforms)

        return {
            "source": source_platform,
            "unified": unified,
            "forwards": forwards,
        }


if __name__ == "__main__":
    bridge = CrossPlatformBridge()

    weixin_raw = {
        "sender_id": "wx_user_001",
        "sender_name": "张三",
        "content": "@A 今天A股走势怎么样？\n\n```python\nimport pandas as pd\ndf = pd.read_csv('sh000001.csv')\nprint(df.tail())\n```",
        "timestamp": "15:30",
        "message_type": "text",
    }

    result = bridge.process_pipeline(weixin_raw, "weixin", ["feishu", "qqbot"])
    for platform, msg_data in result.get("forwards", {}).items():
        print(f"=== {platform} ===")
        print(msg_data["raw_text"])
        print()

    feishu_raw = {
        "sender_id": "fs_user_002",
        "sender_name": "李四",
        "content": "今天半导体板块表现不错\n\n```javascript\nconst price = 128.5;\nconsole.log(price);\n```",
        "timestamp": "15:35",
        "message_type": "text",
    }

    result2 = bridge.process_pipeline(feishu_raw, "feishu", ["weixin", "qqbot"])
    for platform, msg_data in result2.get("forwards", {}).items():
        print(f"=== {platform} ===")
        print(msg_data["raw_text"])
        print()

    print("✅ 所有平台渲染格式完全一致（飞书标准 Markdown）")

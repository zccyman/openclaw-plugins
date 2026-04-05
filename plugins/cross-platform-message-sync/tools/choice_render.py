#!/usr/bin/env python3
"""
多选项交互确认功能 — 支持单选与多选

功能：
- 检测消息中的选项列表（A. / B. 或 1. / 2. 等）
- 渲染为平台兼容的交互格式（≥3 选项自动标注「可多选」）
- 解析用户的选择回复（支持单选和多选）
- 多选分隔：、和与,+空格 / 连续字母 / 范围（A到C）

目标平台：
- 飞书：支持卡片按钮（交互式）
- 微信：文本标记 + 用户手动输入 A/B
- QQ：类似微信
"""

import re
import json
from typing import List, Dict, Any, Optional

_CHINESE_NUM = {
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "七": "7",
    "八": "8",
    "九": "9",
    "十": "10",
}

_MULTI_SPLIT_RE = re.compile(r"[、，,+\s和与]+")


def extract_options(text: str) -> List[Dict[str, str]]:
    """从文本中提取选项。

    支持格式：
    - A. xxx / A) xxx / A、xxx
    - 1. xxx / 1) xxx / 1、xxx
    - [A] xxx / 【A】xxx
    - Ⓐ xxx / ① xxx
    """
    options = []
    seen_keys = set()

    patterns = [
        r"(?m)^\s*([A-Za-z])[\.\)\、]\s+(.+)$",
        r"(?m)^\s*(\d+)[\.\)\、]\s+(.+)$",
        r"(?m)^\s*[\[【]([A-Za-z0-9]+)[\]】]\s*(.+)$",
        r"(?m)^\s*[Ⓐ-Ⓩ⒜-⒵]([A-Za-z])\s+(.+)$",
        r"(?m)^\s*[①-⑳](\d+)\s+(.+)$",
    ]

    for pattern in patterns:
        for m in re.finditer(pattern, text):
            key = m.group(1).strip().upper()
            val = m.group(2).strip()
            if key and key not in seen_keys and val:
                seen_keys.add(key)
                options.append({"key": key, "text": val})

    return options


def _expand_letter_range(start: str, end: str) -> List[str]:
    s, e = ord(start.upper()), ord(end.upper())
    if s > e or e - s > 25:
        return []
    return [chr(c) for c in range(s, e + 1)]


def _expand_number_range(start: str, end: str) -> List[str]:
    try:
        s, e = int(start), int(end)
    except ValueError:
        return []
    if s > e or e - s > 50:
        return []
    return [str(n) for n in range(s, e + 1)]


def _resolve_chinese_ordinals(text: str) -> Optional[List[str]]:
    matches = re.findall(r"第([一二三四五六七八九十]+)[个选项]?", text)
    if not matches:
        return None
    result = []
    for cn in matches:
        num = _CHINESE_NUM.get(cn)
        if num:
            result.append(num)
    return result if result else None


def _filter_valid(keys: List[str], valid: Optional[List[str]]) -> List[str]:
    if valid is None:
        return keys
    valid_upper = [v.upper() for v in valid]
    return [k for k in keys if k.upper() in valid_upper]


def _parse_multi_selections(
    reply: str, expected: Optional[List[str]] = None
) -> Optional[Dict[str, Any]]:
    reply = reply.strip()
    if not reply:
        return None

    cn_ordinals = _resolve_chinese_ordinals(reply)
    if cn_ordinals and len(cn_ordinals) >= 2:
        return {
            "selected": _filter_valid(cn_ordinals, expected),
            "confidence": "high",
            "multi": True,
            "raw": reply,
        }

    range_m = re.search(r"([A-Za-z0-9]+)\s*(?:到|至|-|~)\s*([A-Za-z0-9]+)", reply)
    if range_m:
        a, b = range_m.group(1), range_m.group(2)
        if a.isalpha() and b.isalpha() and len(a) == 1 and len(b) == 1:
            expanded = _expand_letter_range(a, b)
            valid = _filter_valid(expanded, expected)
            if valid:
                return {
                    "selected": valid,
                    "confidence": "high",
                    "multi": True,
                    "raw": reply,
                }
        elif a.isdigit() and b.isdigit():
            expanded = _expand_number_range(a, b)
            valid = _filter_valid(expanded, expected)
            if valid:
                return {
                    "selected": valid,
                    "confidence": "high",
                    "multi": True,
                    "raw": reply,
                }

    multi_letter_m = re.match(
        r"^\s*(?:选择|选|我要|pick|choose)\s*([A-Za-z]{2,})\s*$", reply, re.IGNORECASE
    )
    if multi_letter_m:
        letters = [c.upper() for c in multi_letter_m.group(1) if c.isalpha()]
        valid = _filter_valid(letters, expected)
        if len(valid) >= 2:
            return {
                "selected": valid,
                "confidence": "high",
                "multi": True,
                "raw": reply,
            }

    prefix_multi_m = re.match(
        r"^\s*(?:选择|选|我要|pick|choose)\s*(.+)$", reply, re.IGNORECASE
    )
    if multi_letter_m:
        letters = [c.upper() for c in multi_letter_m.group(1) if c.isalpha()]
        valid = _filter_valid(letters, expected)
        if len(valid) >= 2:
            return {
                "selected": valid,
                "confidence": "high",
                "multi": True,
                "raw": reply,
            }

    prefix_multi_m = re.match(
        r"^\s*(?:选择|选|我要|pick|choose)\s+(.+)$", reply, re.IGNORECASE
    )
    if prefix_multi_m:
        remainder = prefix_multi_m.group(1).strip()
        parts = _MULTI_SPLIT_RE.split(remainder)
        if len(parts) >= 2:
            candidates = [p.strip().upper() for p in parts if p.strip()]
            valid = _filter_valid(candidates, expected)
            if len(valid) >= 2:
                return {
                    "selected": valid,
                    "confidence": "high",
                    "multi": True,
                    "raw": reply,
                }
            if len(valid) == 1:
                return {
                    "selected": valid,
                    "confidence": "medium",
                    "multi": False,
                    "raw": reply,
                }

    bare_parts = _MULTI_SPLIT_RE.split(reply)
    if len(bare_parts) >= 2:
        candidates = [p.strip().upper() for p in bare_parts if p.strip()]
        valid = _filter_valid(candidates, expected)
        if len(valid) >= 2:
            return {
                "selected": valid,
                "confidence": "medium",
                "multi": True,
                "raw": reply,
            }
        if len(valid) == 1:
            return {
                "selected": valid,
                "confidence": "medium",
                "multi": False,
                "raw": reply,
            }

    bare_letters = re.match(r"^\s*([A-Za-z]{2,})\s*$", reply)
    if bare_letters:
        letters = [c.upper() for c in bare_letters.group(1) if c.isalpha()]
        valid = _filter_valid(letters, expected)
        if len(valid) >= 2:
            return {
                "selected": valid,
                "confidence": "medium",
                "multi": True,
                "raw": reply,
            }

    return None


def render_options(text: str, platform: str = "feishu") -> str:
    """为消息添加选项交互提示。≥3 个选项时自动标注「可多选」。"""
    opts = extract_options(text)
    if not opts:
        return text

    keys = [o["key"] for o in opts]
    multi_hint = "（可多选）" if len(opts) >= 3 else ""

    if platform == "feishu":
        hint = f"\n\n---\n📋 **请点击对应选项或回复字母/数字选择{multi_hint}：** {' / '.join(keys)}"
    elif platform == "weixin":
        hint = f"\n\n---\n📋 请回复选项编号（{'、'.join(keys)}）进行选择{multi_hint}"
    elif platform in ("qq", "qqbot"):
        hint = f"\n\n---\n📋 发送选项编号（{'、'.join(keys)}）进行选择{multi_hint}"
    else:
        hint = f"\n\nOptions: {', '.join(keys)} {multi_hint}"

    return text + hint


def parse_choice_reply(
    reply_text: str, expected_options: Optional[List[str]] = None
) -> Optional[Dict[str, Any]]:
    """解析用户选择回复（单选 + 多选）。

    多选格式：
    - 分隔符："A和C" "A、B" "A, C" "1+3" "A B"
    - 范围："A到C" "1至3"
    - 连续字母："选AC" "AB"
    - 中文序号："第一个和第三个"

    单选格式：
    - 直接输入: "A" / "1" / "B"
    - 带前缀: "选择A" / "我选B" / "选 1"
    - 自然语言: "第一个" / "第二个"

    Returns:
        {"selected": ["A"], "confidence": "high", "multi": false} or None
    """
    reply = reply_text.strip()
    if not reply:
        return None

    multi = _parse_multi_selections(reply, expected_options)
    if multi is not None:
        return multi

    for cn, num in _CHINESE_NUM.items():
        if f"第{cn}" in reply or f"第{cn}个" in reply:
            return {
                "selected": [num],
                "confidence": "high",
                "multi": False,
                "raw": reply,
            }

    if expected_options:
        for opt in expected_options:
            if reply.upper() == opt.upper():
                return {
                    "selected": [opt.upper()],
                    "confidence": "high",
                    "multi": False,
                    "raw": reply,
                }

    choice_patterns = [
        r"(?:选择|选|我要|选第|pick|choose)\s*([A-Za-z0-9])",
        r"^\s*([A-Za-z0-9])\s*[.、)）]\s*$",
        r"^\s*([A-Za-z0-9])\s*$",
    ]
    for pattern in choice_patterns:
        m = re.search(pattern, reply, re.IGNORECASE)
        if m:
            key = m.group(1).upper()
            if not expected_options or key in [o.upper() for o in expected_options]:
                return {
                    "selected": [key],
                    "confidence": "medium",
                    "multi": False,
                    "raw": reply,
                }

    if expected_options:
        for opt in expected_options:
            if opt.upper() in reply.upper():
                return {
                    "selected": [opt.upper()],
                    "confidence": "low",
                    "multi": False,
                    "raw": reply,
                }

    return None


def render_for_tool(content: str, platform: str = "feishu") -> str:
    return render_options(content, platform)


def parse_for_tool(reply: str, expected_options: Optional[List[str]] = None) -> str:
    result = parse_choice_reply(reply, expected_options)
    if result:
        return json.dumps(result, ensure_ascii=False)
    return json.dumps(
        {"error": "Could not parse choice", "raw": reply}, ensure_ascii=False
    )


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description="Choice select/render tool")
    sub = parser.add_subparsers(dest="command")

    parse_p = sub.add_parser("parse", help="Parse user choice reply (single or multi)")
    parse_p.add_argument("--reply", required=True, help="User reply text")
    parse_p.add_argument(
        "--options", default=None, help="Comma-separated expected option keys"
    )

    render_p = sub.add_parser("render", help="Render options with interaction hints")
    render_p.add_argument("--content", required=True, help="Message content")
    render_p.add_argument(
        "--platform", default="feishu", choices=["feishu", "weixin", "qq", "qqbot"]
    )

    args = parser.parse_args()

    if args.command == "parse":
        expected = args.options.split(",") if args.options else None
        print(parse_for_tool(args.reply, expected))
    elif args.command == "render":
        print(render_for_tool(args.content, args.platform))
    else:
        sample = """请选择您关注的板块：

A. 金融板块
B. 半导体
C. 新能源

1. 看涨
2. 看跌
3. 震荡"""

        opts = extract_options(sample)
        print(f"提取到 {len(opts)} 个选项:")
        for o in opts:
            print(f"  {o['key']}. {o['text']}")

        print("\n--- 渲染 ---")
        for platform in ["feishu", "weixin", "qq"]:
            print(f"\n=== {platform.upper()} 渲染 ===")
            print(render_options(sample, platform))

        print("\n--- 多选解析 ---")
        cases = [
            ("A和C", ["A", "B", "C"]),
            ("1、3、5", ["1", "2", "3", "4", "5"]),
            ("A到C", ["A", "B", "C", "D"]),
            ("第一个和第三个", None),
            ("选AC", ["A", "B", "C"]),
            ("B", ["A", "B", "C"]),
            ("选择A", ["A", "B", "C"]),
        ]
        for text, exp in cases:
            r = parse_choice_reply(text, exp)
            print(
                f"  「{text}」 → {json.dumps(r, ensure_ascii=False) if r else 'None'}"
            )


if __name__ == "__main__":
    _cli()

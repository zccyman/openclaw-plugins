#!/usr/bin/env python3
"""
代码块渲染增强 — 一键复制功能

功能：
- 从消息中提取代码块（Markdown fences + inline code）
- 为每个代码块添加平台特定的复制交互
- 飞书：使用 <pre><code> 标签 + 复制提示
- 微信：Markdown fences + 复制标记（选中即复制）
- QQ：Markdown fences + 复制提示

所有平台代码块格式统一为飞书标准。
"""

import re
import json
from typing import List, Dict, Any


def extract_code_blocks(text: str) -> List[Dict[str, str]]:
    blocks = []
    pattern = r"```(\w*)\n([\s\S]*?)```"
    for m in re.finditer(pattern, text):
        lang = m.group(1).strip() or "text"
        code = m.group(2).rstrip()
        blocks.append(
            {
                "language": lang,
                "code": code,
                "start": m.start(),
                "end": m.end(),
                "line_count": code.count("\n") + 1,
            }
        )
    return blocks


def extract_inline_code(text: str) -> List[Dict[str, str]]:
    pattern = r"`([^`\n]+)`"
    results = []
    for m in re.finditer(pattern, text):
        results.append({"code": m.group(1), "start": m.start(), "end": m.end()})
    return results


def render_code_block_feishu(lang: str, code: str, block_index: int) -> str:
    """飞书格式：保留 Markdown fences + 添加复制提示标签"""
    copy_id = f"code-{block_index + 1}"
    return (
        f"```{lang}\n{code}\n```\n"
        f"📋 _[{copy_id}] 点击代码块右上角「复制」按钮即可一键复制_"
    )


def render_code_block_weixin(lang: str, code: str, block_index: int) -> str:
    """微信格式：Markdown fences + 复制说明"""
    copy_id = f"code-{block_index + 1}"
    return f"```{lang}\n{code}\n```\n📋 _[{copy_id}] 长按代码块 → 全选 → 复制_"


def render_code_block_qq(lang: str, code: str, block_index: int) -> str:
    """QQ格式：Markdown fences + 复制说明"""
    copy_id = f"code-{block_index + 1}"
    return f"```{lang}\n{code}\n```\n📋 _[{copy_id}] 长按代码块 → 复制_"


RENDERERS = {
    "feishu": render_code_block_feishu,
    "weixin": render_code_block_weixin,
    "qq": render_code_block_qq,
    "qqbot": render_code_block_qq,
}


def render_with_copy_hint(text: str, platform: str = "feishu") -> str:
    """渲染代码块并添加一键复制提示。

    策略：逐个替换代码块，每个块添加平台特定的复制提示。
    """
    blocks = extract_code_blocks(text)
    if not blocks:
        has_inline = bool(extract_inline_code(text))
        if has_inline:
            return text + "\n\n---\n💡 行内代码可长按复制"
        return text

    renderer = RENDERERS.get(platform.lower(), render_code_block_feishu)

    result = text
    offset = 0
    for i, block in enumerate(blocks):
        original = result[block["start"] + offset : block["end"] + offset]
        replacement = renderer(block["language"], block["code"], i)
        result = (
            result[: block["start"] + offset]
            + replacement
            + result[block["end"] + offset :]
        )
        offset += len(replacement) - len(original)

    return result


def render_code_for_tool(content: str, platform: str = "feishu") -> str:
    """Tool 专用接口：渲染消息中的代码块为带复制提示的格式。"""
    return render_with_copy_hint(content, platform)


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description="Code block copy-render tool")
    sub = parser.add_subparsers(dest="command")

    render_p = sub.add_parser("render-code", help="Render code blocks with copy hints")
    render_p.add_argument("--content", required=True, help="Message content")
    render_p.add_argument(
        "--platform", default="feishu", choices=["feishu", "weixin", "qq", "qqbot"]
    )

    args = parser.parse_args()

    if args.command == "render-code":
        result = render_code_for_tool(args.content, args.platform)
        print(result)
    else:
        sample = """使用以下 Python 代码示例：

```python
def hello(name: str) -> str:
    return f"Hello, {name}!"

print(hello("Claw"))
```

行内代码：`pip install openclaw`
"""
        for platform in ["feishu", "weixin", "qq"]:
            print(f"=== {platform.upper()} ===")
            print(render_with_copy_hint(sample, platform))
            print()


if __name__ == "__main__":
    _cli()

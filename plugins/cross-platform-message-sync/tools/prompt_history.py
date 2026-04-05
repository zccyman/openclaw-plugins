#!/usr/bin/env python3
"""
提示词历史管理工具

功能：
- 自动保存每次的提示词/规格到历史
- 搜索历史提示词（关键词 + 语义）
- 浏览多条历史提示词
- 复用历史提示词（一键重新输入）

用法：
  python tools/prompt_history.py list [--tag TAG]
  python tools/prompt_history.py search --query KEYWORD [--limit N]
  python tools/prompt_history.py get --id ID
  python tools/prompt_history.py reuse --id ID
  python tools/prompt_history.py save --title TITLE --content CONTENT [--tags TAG1,TAG2]
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional


def _get_history_file():
    if len(sys.argv) > 1 and sys.argv[1] == "--history-file":
        idx = sys.argv.index("--history-file")
        if idx + 1 < len(sys.argv):
            return Path(sys.argv[idx + 1])
    env_path = os.environ.get("PROMPT_HISTORY_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).parent.parent / "data" / "prompt-history.json"


def _strip_internal_args():
    cleaned = []
    skip_next = False
    for i, arg in enumerate(sys.argv):
        if skip_next:
            skip_next = False
            continue
        if arg == "--history-file":
            skip_next = True
            continue
        cleaned.append(arg)
    sys.argv = cleaned


def load(history_file: Path) -> list:
    if history_file.exists():
        with open(history_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "entries" in data:
            return data["entries"]
        if isinstance(data, list):
            return data
    return []


def _save_all(entries: list, history_file: Path):
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump({"entries": entries}, f, ensure_ascii=False, indent=2)


def cmd_save(history_file: Path, title: str, content: str, tags: Optional[list] = None):
    entries = load(history_file)
    entry_id = f"prompt-{len(entries) + 1:04d}"
    entry = {
        "id": entry_id,
        "title": title,
        "content": content,
        "tags": tags or [],
        "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "use_count": 0,
    }
    entries.append(entry)
    _save_all(entries, history_file)
    print(json.dumps({"ok": True, "id": entry_id, "title": title}, ensure_ascii=False))


def cmd_list(history_file: Path, tag: Optional[str] = None):
    entries = load(history_file)
    if tag:
        entries = [e for e in entries if tag in e.get("tags", [])]
    if not entries:
        print(json.dumps({"entries": [], "total": 0}, ensure_ascii=False))
        return
    summary = []
    for e in entries[-50:]:
        summary.append(
            {
                "id": e["id"],
                "title": e["title"],
                "created": e["created"],
                "tags": e.get("tags", []),
                "use_count": e.get("use_count", 0),
                "preview": e["content"][:120],
            }
        )
    print(json.dumps({"entries": summary, "total": len(entries)}, ensure_ascii=False))


def cmd_search(history_file: Path, query: str, limit: int = 10):
    entries = load(history_file)
    results = []
    q_lower = query.lower()
    for e in entries:
        score = 0
        if q_lower in e["title"].lower():
            score += 10
        if q_lower in e["content"].lower():
            score += 5
        for tag in e.get("tags", []):
            if q_lower in tag.lower():
                score += 3
        if score > 0:
            results.append((score, e))
    results.sort(key=lambda x: -x[0])
    top = [r[1] for r in results[:limit]]
    output = []
    for e in top:
        output.append(
            {
                "id": e["id"],
                "title": e["title"],
                "created": e["created"],
                "tags": e.get("tags", []),
                "use_count": e.get("use_count", 0),
                "preview": e["content"][:200],
                "content": e["content"],
            }
        )
    print(json.dumps({"results": output, "total": len(output)}, ensure_ascii=False))


def cmd_get(history_file: Path, entry_id: str):
    entries = load(history_file)
    for e in entries:
        if e["id"] == entry_id or str(e.get("id")) == entry_id:
            print(json.dumps(e, ensure_ascii=False))
            return
        try:
            if e["id"] == f"prompt-{int(entry_id):04d}":
                print(json.dumps(e, ensure_ascii=False))
                return
        except (ValueError, TypeError):
            pass
    print(json.dumps({"error": f"Entry {entry_id} not found"}, ensure_ascii=False))


def cmd_reuse(history_file: Path, entry_id: str):
    entries = load(history_file)
    for e in entries:
        matched = False
        if e["id"] == entry_id or str(e.get("id")) == entry_id:
            matched = True
        try:
            if e["id"] == f"prompt-{int(entry_id):04d}":
                matched = True
        except (ValueError, TypeError):
            pass
        if matched:
            e["use_count"] = e.get("use_count", 0) + 1
            e["last_reused"] = datetime.now().strftime("%Y-%m-%d %H:%M")
            _save_all(entries, history_file)
            print(
                json.dumps(
                    {
                        "id": e["id"],
                        "title": e["title"],
                        "content": e["content"],
                        "use_count": e["use_count"],
                    },
                    ensure_ascii=False,
                )
            )
            return
    print(json.dumps({"error": f"Entry {entry_id} not found"}, ensure_ascii=False))


def main():
    history_file = _get_history_file()
    _strip_internal_args()

    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "error": "No command specified",
                    "commands": ["list", "search", "get", "reuse", "save"],
                },
                ensure_ascii=False,
            )
        )
        return

    cmd = sys.argv[1]

    if cmd == "list":
        tag = None
        if "--tag" in sys.argv:
            idx = sys.argv.index("--tag")
            tag = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
        cmd_list(history_file, tag)

    elif cmd == "search":
        query = ""
        limit = 10
        if "--query" in sys.argv:
            idx = sys.argv.index("--query")
            query = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        if "--limit" in sys.argv:
            idx = sys.argv.index("--limit")
            try:
                limit = int(sys.argv[idx + 1])
            except (ValueError, IndexError):
                limit = 10
        cmd_search(history_file, query, limit)

    elif cmd == "get":
        entry_id = ""
        if "--id" in sys.argv:
            idx = sys.argv.index("--id")
            entry_id = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        cmd_get(history_file, entry_id)

    elif cmd == "reuse":
        entry_id = ""
        if "--id" in sys.argv:
            idx = sys.argv.index("--id")
            entry_id = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        cmd_reuse(history_file, entry_id)

    elif cmd == "save":
        title = ""
        content = ""
        tags = []
        if "--title" in sys.argv:
            idx = sys.argv.index("--title")
            title = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        if "--content" in sys.argv:
            idx = sys.argv.index("--content")
            content = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        if "--tags" in sys.argv:
            idx = sys.argv.index("--tags")
            tags_str = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
            tags = [t.strip() for t in tags_str.split(",") if t.strip()]
        cmd_save(history_file, title, content, tags)

    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}, ensure_ascii=False))


if __name__ == "__main__":
    main()

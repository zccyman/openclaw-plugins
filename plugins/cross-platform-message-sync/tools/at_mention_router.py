#!/usr/bin/env python3
"""
at-mention-router: 智能 @ 路由引擎

解析 inbound 消息中的 @mention，匹配 bot 别名，决定是否需要该 bot 响应。
替代/增强 OpenClaw 原生 requireMention。
"""

import json
import sys
import time
import os
import re
from pathlib import Path
from typing import List, Dict, Optional, Set

CONFIG_FILE = Path(__file__).parent.parent / "data/at_mention_router_config.json"
RATE_LIMIT_STATE = Path(__file__).parent.parent / "data/rate_limit_state.json"


class MentionRouter:
    def __init__(self, config_path: Optional[Path] = None, rate_state_file: Optional[str] = None):
        self.config_path = config_path or CONFIG_FILE
        self.rate_state_file = rate_state_file or str(RATE_LIMIT_STATE)
        self.config = self._load_config()
        self.aliases = self._build_alias_index()
        self.rate_limits = self._load_rate_limits()

    def _load_config(self) -> dict:
        p = Path(self.config_path)
        if p.exists():
            with open(self.config_path) as f:
                return json.load(f)
        return {
            "bots": [],
            "rules": {
                "global": {
                    "requireMention": True,
                    "allowWildcard": True,
                    "rateLimit": {"windowSec": 60, "maxTriggers": 5},
                },
                "perGroup": {},
                "blacklistUsers": [],
            },
        }

    def _build_alias_index(self) -> Dict[str, str]:
        """构建 别名→bot_id 索引。"""
        idx = {}
        for bot in self.config.get("bots", []):
            bot_id = bot["id"]
            for alias in bot.get("aliases", []):
                idx[alias.lower()] = bot_id
        return idx

    def _load_rate_limits(self) -> Dict[str, list]:
        p = Path(self.rate_state_file)
        if p.exists():
            with open(RATE_LIMIT_STATE) as f:
                return json.load(f)
        return {}

    def _save_rate_limits(self):
        with open(self.rate_state_file, "w") as f:
            json.dump(self.rate_limits, f)

    def _check_rate_limit(self, user_id: str) -> bool:
        rules = self.config.get("rules", {}).get("global", {})
        rl = rules.get("rateLimit", {})
        window = rl.get("windowSec", 60)
        max_triggers = rl.get("maxTriggers", 5)

        now = time.time()
        entries = self.rate_limits.get(user_id, [])
        # Remove old entries
        entries = [t for t in entries if now - t < window]
        self.rate_limits[user_id] = entries

        if len(entries) >= max_triggers:
            return False  # Over limit

        entries.append(now)
        self._save_rate_limits()
        return True

    def parse_mentions(self, message: str) -> List[str]:
        """从消息文本提取 @mention。"""
        # Pattern: @alias or ＠alias（全角）
        pattern = r"[@＠]\s*([^\s]+)"
        matches = re.findall(pattern, message)
        return [m for m in matches if m.strip()]

    def should_trigger(self, bot_id: str, message: str, chat_id: str = "", user_id: str = "") -> bool:
        """判断 bot 是否应该响应该消息。"""
        rules = self.config.get("rules", {})
        global_rules = rules.get("global", {})

        # 1. Check user blacklist
        if user_id in rules.get("blacklistUsers", []):
            return False

        # 2. Check rate limit
        if user_id and not self._check_rate_limit(user_id):
            return False

        # 3. Per-group override
        group_rules = rules.get("perGroup", {}).get(chat_id, {})
        effective_require = group_rules.get("requireMention", global_rules.get("requireMention", True))
        if not effective_require:
            return True

        # 4. Parse @mentions and match
        mentions = self.parse_mentions(message)
        if not mentions:
            # No mention found
            if global_rules.get("allowWildcard", False):
                return True  # Wildcard allows no-mention
            return False

        # Check if this bot is mentioned
        for mention in mentions:
            target_bot = self.aliases.get(mention.lower())
            if target_bot == bot_id:
                return True
            # Check if wildcard "@所有人"
            if mention in ("所有人", "all", "everyone") and global_rules.get("allowWildcard", False):
                return True

        return False

    def reload(self):
        """热重载配置。"""
        self.config = self._load_config()
        self.aliases = self._build_alias_index()


def main():
    """演示入口。"""
    import tempfile
    tmpdir = tempfile.mkdtemp()
    demo_config = os.path.join(tmpdir, "config.json")
    
    cfg = {
        "bots": [
            {"id": "bot1", "aliases": ["A", "Alpha", "机器人A"]},
            {"id": "employee-a", "aliases": ["James", "分析专家"]},
        ],
        "rules": {
            "global": {
                "requireMention": True,
                "allowWildcard": True,
                "rateLimit": {"windowSec": 60, "maxTriggers": 100},
            },
            "perGroup": {},
            "blacklistUsers": [],
        },
    }
    with open(demo_config, "w") as f:
        json.dump(cfg, f)

    import at_mention_router as mod
    mod.RATE_LIMIT_STATE = os.path.join(tmpdir, "rate.json")

    router = MentionRouter(config_path=demo_config)

    print("=" * 60)
    print("🤖 at-mention-router 演示模式")
    print("=" * 60)

    print("=" * 60)
    print("🤖 at-mention-router 演示模式")
    print("=" * 60)

    test_cases = [
        ("bot1", "@A 你好", "", "user_001", True),
        ("bot1", "@Alpha 在吗", "", "user_002", True),
        ("employee-a", "@James 分析下这个", "", "user_003", True),
        ("bot1", "@B 你好", "", "user_004", False),
        ("bot1", "所有人 早上好", "", "user_005", False),  # 没有 @ 符，不触发
        ("bot1", "你好", "", "user_006", False),  # requireMention=true
        ("bot1", "@所有人 早上好", "", "user_007", True),  # wildcard
        ("bot1", "@A @B 一起", "", "user_008", True),  # multi‑mention
    ]

    for bot_id, msg, chat_id, user_id, expected in test_cases:
        result = router.should_trigger(bot_id, msg, chat_id, user_id)
        status = "✅" if result == expected else "❌"
        print(f"  {status} bot={bot_id} msg='{msg}' → {result} (expected={expected})")

    print()
    print("=" * 60)
    print("要部署：配置 ~/.openclaw/openclaw.json 中 skills.entries.at-mention-router")
    print("=" * 60)


if __name__ == "__main__":
    main()

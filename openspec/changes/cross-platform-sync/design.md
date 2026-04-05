# Design: Cross-Platform Message Sync Plugin

## Plugin Structure

```
plugins/cross-platform-message-sync/
├── openclaw.plugin.json        # 插件清单
├── package.json                # npm 元数据
├── tsconfig.json               # TypeScript 配置
├── vitest.config.ts            # 测试配置
├── setup-entry.ts              # 插件安装时的目录创建
├── src/
│   ├── index.ts                # 主入口（registerFull + channel 可选）
│   ├── tools/
│   │   ├── index.ts            # 注册所有工具
│   │   ├── message-sync-tool.ts
│   │   ├── prompt-history-tool.ts
│   │   └── at-mention-status-tool.ts
│   ├── hooks/
│   │   └── index.ts            # before_tool_call 钩子（日志、认证）
│   └── skills/
│       ├── cross-platform-sync.skill.md
│       └── prompt-history.skill.md
├── tools/                      # 原始 Python 脚本（保持不变）
│   ├── unified_bridge.py
│   ├── message_unify.py
│   ├── message_quote.py
│   ├── code_render.py
│   ├── choice_render.py
│   ├── wechat_feishu_sync.py
│   ├── at_mention_router.py
│   └── prompt_history.py
├── data/
│   ├── sync_rules.json
│   ├── prompt-history.json
│   └── at_mention_router_config.json
└── tests/
    └── tools/
        ├── test-message-sync-tool.ts
        └── test-prompt-history-tool.ts
```

## Tools Registration

| Tool | Description | Input Schema | Output |
|------|-------------|--------------|--------|
| `message_sync_quick` | 快速执行三平台消息同步（传入 raw_msg, source, targets） | `{raw_msg, source, targets[]}` | `UnifiedBridge` 输出 |
| `prompt_history_list` | 列出历史提示词（可选标签过滤） | `{ tag?: string }` | `[{id, title, content, tags, created_at}]` |
| `prompt_history_search` | 搜索提示词（语义/标签） | `{ query, limit?: number }` | 匹配列表 |
| `prompt_history_get` | 获取单个提示词 | `{ id }` | 完整内容 |
| `prompt_history_reuse` | 复用历史提示词（返回可直接粘贴格式） | `{ id }` | `"复制到剪贴板格式"` |
| `at_mention_router_info` | 获取 @路由配置和状态 | `{}` | 配置 + 统计 |

工具实现：TypeScript `Tool` 类，通过 `child_process.spawn` 调用 Python 脚本。

## Configuration Schema

```json
{
  "type": "object",
  "properties": {
    "syncRules": { "type": "string", "default": "data/sync_rules.json" },
    "promptHistoryPath": { "type": "string", "default": "data/prompt-history.json" },
    "atMentionConfig": { "type": "string", "default": "data/at_mention_router_config.json" },
    "requireMention": { "type": "boolean", "default": true },
    "strictSync": { "type": "boolean", "default": false },
    "codeCopyEnhancement": { "type": "boolean", "default": true }
  }
}
```

## Skills

提供两个技能文档，供 LLM 自动注入：
- **cross-platform-sync.skill.md** — 描述三平台消息同步能力
- **prompt-history.skill.md** — 描述提示词历史管理

## Hooks (Optional)

- `before_tool_call`：工具调用日志 + 速度限制检查
- `after_tool_call`：结果缓存、审计日志

## Error Handling

Python 脚本错误：
- 退出码非零 → 抛出 `ExecutionError`
- 超时（30s）→ `TimeoutError`
- JSON 解析失败 → `ParseError`

工具返回结构一致：`{ success: boolean, data?: any, error?: string }`

## Deployment

1. 构建：`pnpm build`（TS → JS）
2. 同步：`./scripts/sync-plugins.sh` → 目标 OpenClaw 插件目录
3. OpenClaw 配置：`plugins.allow: ["~/openclaw-plugins/plugins/*"]`
4. 重启网关 -> 插件自动加载

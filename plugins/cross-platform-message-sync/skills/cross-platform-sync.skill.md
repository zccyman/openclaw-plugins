---
name: cross-platform-message-sync
description: Sync messages across WeChat, QQ, and Feishu platforms
category: messaging
---

# Cross-Platform Message Sync Skill

## 功能

三平台（微信/QQ/飞书）消息同步系统：

1. **消息自动互转** — 任一平台 → 其他平台自动转发
2. **格式统一** — 对齐飞书渲染格式（Markdown 兼容）
3. **代码块复制** — 代码块带 `💡 选中可一键复制` 提示
4. **引用回复** — 子智能体回复带引用（`> 引用自: 【sender】主题`）
5. **多选项交互** — 支持 A/B/1/2/3 等选项
6. **@路由** — 群聊 @特定机器人 才响应

## 可用工具

- `message_sync_quick` — 快速同步消息
- `prompt_history_list` — 列出提示词历史
- `prompt_history_search` — 搜索提示词
- `prompt_history_get` — 按 ID 获取提示词
- `prompt_history_reuse` — 复用历史提示词
- `at_mention_status` — 查看 @路由状态

## 使用方式

```
消息同步：
message_sync_quick(raw_msg="你好世界", source="weixin", targets=["feishu", "qqbot"])

查询提示词：
prompt_history_list()
prompt_history_search(query="微信同步")
prompt_history_reuse(id="prompt-001")
```

---
name: prompt-history-management
description: Manage prompt command history with save/list/search/reuse operations
category: productivity
---

# Prompt History Management Skill

## 功能

历史提示词管理，避免每次重新输入已写过的规格/提示词。

## 操作

- **保存**：`prompt_history.py save --title "标题" --tag "标签"`
- **列表**：`prompt_history.py list [--tag "标签"]`
- **搜索**：`prompt_history.py search --query "关键词" [--limit 10]`
- **获取**：`prompt_history.py get --id "prompt-xxx"`
- **复用**：`prompt_history.py reuse --id "prompt-xxx"`

## 输出格式

```
[1] prompt-abc123 - 2024-04-05 14:30
    标题: 微信↔飞书双向同步开发规格
    标签: dev-workflow, spec, sync
    内容: "设计三平台消息同步系统..."
```

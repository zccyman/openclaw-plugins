# Proposal: Cross-Platform Message Sync OpenClaw Plugin

## What & Why

将已开发的三平台消息同步系统（unified_bridge + 子模块）封装为 OpenClaw 官方插件，使其能够无缝接入 OpenClaw 网关，直接作为工具和技能供所有频道（飞书、微信、CLI）使用。

## Problem

现有同步代码为独立 Python 脚本，位于 `claw-mem/tools/`，未集成到 OpenClaw 插件体系，无法通过插件加载、配置管理和工具注册机制使用。

## Solution

创建 `cross-platform-message-sync` 插件：
- 保留现有 Python 工具脚本不变（在 `plugins/cross-platform-message-sync/tools/` 下）
- 用 TypeScript 编写工具包装器，通过子进程调用 Python 脚本
- 注册为 OpenClaw 工具：`message_sync_quick`, `prompt_history_*` 等
- 提供技能文档，便于 LLM 自动发现和使用
- 支持 Inbound Hook 自动转发（可选配置）

## Impact

- ✅ 将 9 个工具脚本（已实现）无缝集成到 OpenClaw
- ✅ 支持配置驱动：同步规则、@路由、提示词历史存储
- ✅ 可发布到 npm / ClawHub，供其他 OpenClaw 用户安装使用
- ⚠️ 需补充测试覆盖（Full 模式强制）
- ⚠️ 需运行 QA Gate（10 项检查）
- ⚠️ 需生成 Conventional Commits

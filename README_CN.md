# OpenClaw 插件集合

OpenClaw 插件集合 — 单一仓库中包含多个插件。

[English](README.md)

## 插件列表

| 插件 | 描述 | 状态 |
|------|------|------|
| [dev-workflow](plugins/dev-workflow/) | 规格驱动的 AI 开发工作流，多智能体编排 | ✅ 活跃 |
| [wechat](plugins/wechat/) | 微信公众号 & 企业微信频道支持 | ✅ 活跃 |
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness 工具桥接为 OpenClaw 代理工具（文件 I/O、Shell、搜索、Web、任务、代理、定时任务） | ✅ 活跃 |
| [openharness-skills](plugins/openharness-skills/) | 基于 Markdown 的按需技能加载，兼容 anthropics/skills 格式 | ✅ 活跃 |
| [openharness-governance](plugins/openharness-governance/) | 多级权限、路径规则、命令拒绝列表、工具使用前/后钩子 | ✅ 活跃 |
| [openharness-swarm](plugins/openharness-swarm/) | 多代理协调：子代理生成、团队注册、任务委派、后台生命周期 | ✅ 活跃 |
| [openharness-memory](plugins/openharness-memory/) | 持久化跨会话记忆，MEMORY.md 索引，项目级存储，启发式搜索 | ✅ 活跃 |
| [openharness-commands](plugins/openharness-commands/) | 20+ OpenHarness 斜杠命令：/oh-status、/oh-doctor、/oh-permissions、/oh-commit 等 | ✅ 活跃 |
| [openharness-mcp](plugins/openharness-mcp/) | MCP 服务器集成 — 连接/断开、列出服务器、列出工具、调用工具、读取资源 | ✅ 活跃 |
| [openharness-context](plugins/openharness-context/) | 智能上下文管理 — CLAUDE.md 发现、上下文压缩、Token 估算、智能上下文窗口管理 | ✅ 活跃 |
| [openharness-session](plugins/openharness-session/) | 会话管理 — 保存/加载/恢复、导出、分支、浏览对话历史 | ✅ 活跃 |
| [openharness-code-intel](plugins/openharness-code-intel/) | 代码智能 — 符号搜索、定义查找、引用查找、依赖分析、复杂度指标 | ✅ 活跃 |
| [openharness-gitflow](plugins/openharness-gitflow/) | 增强 Git 工作流 — 智能约定式提交、分支管理、PR 描述生成、变更日志、工作树管理 | ✅ 活跃 |
| [openharness-interactive](plugins/openharness-interactive/) | 交互式用户通信 — 提问、确认操作、列表选择、文本输入 | ✅ 活跃 |
| [openharness-lsp](plugins/openharness-lsp/) | 语言服务器协议集成 — 跳转定义、查找引用、悬停信息、诊断、重命名、工作区符号 | ✅ 活跃 |
| [openharness-bridge](plugins/openharness-bridge/) | 桥接系统 — 生成、管理和通信子 OpenHarness 会话，用于委派工作 | ✅ 活跃 |
| [openharness-cost](plugins/openharness-cost/) | 实时成本跟踪、模型管理、推理努力/通过次数配置、使用统计 | ✅ 活跃 |
| [openharness-github](plugins/openharness-github/) | GitHub 集成 — Issue 管理、PR 评论、仓库操作（通过 gh CLI） | ✅ 活跃 |
| [openharness-session-ops](plugins/openharness-session-ops/) | 会话操作 — 上下文显示、对话回退、会话标签、项目初始化、插件重载、运行时配置 | ✅ 活跃 |
| [openharness-repl](plugins/openharness-repl/) | REPL 代码执行，支持 Python、Node.js 和 Ruby — 桥接自 Claw Code | ✅ 活跃 |
| [openharness-structured-output](plugins/openharness-structured-output/) | 从自然语言描述生成结构化 JSON 输出 — 桥接自 Claw Code | ✅ 活跃 |
| [openharness-provider](plugins/openharness-provider/) | 多 Provider LLM 管理（Anthropic、xAI/Grok、OpenAI-compatible）— 桥接自 Claw Code | ✅ 活跃 |
| [openharness-auth](plugins/openharness-auth/) | OAuth/PKCE 认证管理 — 桥接自 Claw Code | ✅ 活跃 |
| [openharness-repl](plugins/openharness-repl/) | REPL 代码执行，支持 Python、Node.js 和 Ruby — 桥接自 Claw Code | ✅ 活跃 |
| [openharness-structured-output](plugins/openharness-structured-output/) | 从自然语言描述生成结构化 JSON 输出 — 桥接自 Claw Code | ✅ 活跃 |
| [openharness-provider](plugins/openharness-provider/) | 多 Provider LLM 管理（Anthropic、xAI/Grok、OpenAI-compatible）— 桥接自 Claw Code | ✅ 活跃 |
| [openharness-auth](plugins/openharness-auth/) | OAuth/PKCE 认证管理 — 桥接自 Claw Code | ✅ 活跃 |

## OpenHarness 集成架构

这 21 个插件将完整的 OpenHarness 代理系统和 Claw Code 能力桥接到 OpenClaw：

```
OpenHarness 子系统        →  OpenClaw 插件
─────────────────────────────────────────────────
43+ 工具注册表            →  openharness-tools (通过 registerTool 注册代理工具)
技能系统 (.md)            →  openharness-skills (发现 + 通过 before_prompt_build 自动注入)
权限 + 钩子               →  openharness-governance (before_tool_call + after_tool_call 钩子)
多代理 Swarm             →  openharness-swarm (子进程生成 + 团队注册)
上下文 & 记忆             →  openharness-memory (MEMORY.md + 项目级存储)
斜杠命令                  →  openharness-commands (20+ 命令的 registerCommand)
MCP 客户端                →  openharness-mcp (连接、发现、调用 MCP 服务器工具/资源)
提示/上下文系统            →  openharness-context (CLAUDE.md 发现、压缩、Token 估算)
会话存储                  →  openharness-session (保存/加载/分支/导出对话会话)
代码理解                  →  openharness-code-intel (符号搜索、依赖图、复杂度)
Git 工作流                →  openharness-gitflow (约定式提交、分支管理、PR/CHANGELOG)
交互式通信                →  openharness-interactive (提问、确认、选择、输入)
语言服务器协议            →  openharness-lsp (定义、引用、悬停、诊断、重命名)
桥接系统                  →  openharness-bridge (生成/管理子会话，上下文传递)
成本 & 模型管理           →  openharness-cost (实时成本跟踪、模型切换、努力/通过次数)
GitHub 集成               →  openharness-github (Issues、PRs、评论，通过 gh CLI)
会话操作                  →  openharness-session-ops (上下文、回退、标签、初始化、配置)
REPL 代码执行             →  openharness-repl (Python/Node.js/Ruby 子进程执行)
结构化输出                →  openharness-structured-output (从自然语言生成 JSON)
多 Provider LLM           →  openharness-provider (Anthropic/xAI/OpenAI-compatible 管理)
OAuth/PKCE 认证           →  openharness-auth (OAuth 登录、Token 管理、Provider 认证状态)
```

## 快速开始

```bash
# 安装所有插件的依赖
pnpm install

# 类型检查所有插件
pnpm -r run typecheck

# 运行所有插件的测试
pnpm -r run test

# Lint 所有插件
pnpm -r run lint
```

## 插件开发

每个插件位于 `plugins/<name>/` 目录下，包含：
- `package.json` — 插件元数据和依赖
- `openclaw.plugin.json` — OpenClaw 插件清单
- `setup-entry.ts` — 插件设置（创建目录等）
- `src/` — 源代码
- `tests/` — 测试文件
- `tsconfig.json` — TypeScript 配置
- `vitest.config.ts` — Vitest 测试配置

### 添加新插件

1. 创建 `plugins/<新插件>/` 目录
2. 从现有插件复制结构
3. 更新 `package.json` 名称和元数据
4. 更新 `openclaw.plugin.json` 中的插件特定配置
5. 在根目录运行 `pnpm install` 链接工作区

## 频道兼容性

| 插件 | CLI | 飞书 | 微信 |
|------|-----|------|------|
| dev-workflow | ✅ 工具 + 钩子 | ✅ 工具可供 LLM 调用 | ✅ 工具可供 LLM 调用 |
| wechat | — | — | ✅ 完整频道支持 |
| openharness-tools | ✅ 43+ 工具 | ✅ 所有工具通过 LLM 代理 | ✅ 所有工具通过 LLM 代理 |
| openharness-skills | ✅ 技能发现 + 自动注入 | ✅ 提示构建时自动注入 | ✅ 提示构建时自动注入 |
| openharness-governance | ✅ 钩子 + 权限工具 | ✅ 所有工具调用钩子 | ✅ 所有工具调用钩子 |
| openharness-swarm | ✅ 子代理生成/管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-memory | ✅ 记忆 CRUD + 自动注入 | ✅ 提示构建时自动注入 | ✅ 提示构建时自动注入 |
| openharness-commands | ✅ 20+ 斜杠命令 | ✅ 通过命令处理器 | ✅ 通过命令处理器 |
| openharness-mcp | ✅ MCP 连接/调用工具 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-context | ✅ 上下文压缩 + 估算 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-session | ✅ 会话 CRUD + 导出 + 分支 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-code-intel | ✅ 符号搜索、依赖、复杂度 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-gitflow | ✅ 智能提交、分支、PR | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-interactive | ✅ 提问/确认/选择/输入 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-lsp | ✅ 定义、引用、悬停、诊断 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-bridge | ✅ 生成/管理子会话 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-cost | ✅ 成本跟踪、模型管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-github | ✅ Issues、PRs、评论 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-session-ops | ✅ 上下文、回退、标签、初始化 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-repl | ✅ 代码执行（Python/Node/Ruby） | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-structured-output | ✅ JSON 输出生成 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-provider | ✅ 多 Provider LLM 管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-auth | ✅ OAuth/PKCE 认证管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-repl | ✅ 代码执行（Python/Node/Ruby） | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-structured-output | ✅ JSON 输出生成 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-provider | ✅ 多 Provider LLM 管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |
| openharness-auth | ✅ OAuth/PKCE 认证管理 | ✅ 通过 LLM 代理工具 | ✅ 通过 LLM 代理工具 |

dev-workflow 通过 OpenClaw 插件 API 注册工具（DevWorkflowTool、WorkflowStatusTool、TaskExecuteTool、SpecViewTool、QAGateTool）。插件加载后，这些工具在**所有频道**（飞书、微信、CLI）中对 LLM 智能体可用。

## 部署（WSL / NTFS 挂载）

`/mnt/g/`（Windows NTFS 挂载）下的插件会被 OpenClaw 的 `path_world_writable` 安全检查阻止。使用同步脚本部署到原生 Linux 路径：

```bash
# 先构建
pnpm run build

# 同步到默认目标（~/openclaw-plugins）
./scripts/sync-plugins.sh

# 或指定自定义目标路径
./scripts/sync-plugins.sh /opt/openclaw-plugins
```

然后配置 OpenClaw 从目标路径加载插件：

```yaml
plugins:
  allow:
    - ~/openclaw-plugins/plugins/*
```

## 许可证

MIT

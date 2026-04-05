# OpenClaw Plugins

OpenClaw plugin collection — multiple plugins in a single monorepo.

[中文文档](README_CN.md)

## Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [dev-workflow](plugins/dev-workflow/) | Spec-driven AI development workflow with multi-agent orchestration | ✅ Active |
| [wechat](plugins/wechat/) | WeChat Official Account & WeCom (企业微信) channel support | ✅ Active |
| [openharness-tools](plugins/openharness-tools/) | 43+ OpenHarness tools bridged as OpenClaw agent tools (file I/O, shell, search, web, tasks, agents, cron) | ✅ Active |
| [openharness-skills](plugins/openharness-skills/) | Markdown-based on-demand skill loading, compatible with anthropics/skills format | ✅ Active |
| [openharness-governance](plugins/openharness-governance/) | Multi-level permissions, path rules, command deny lists, pre/post tool hooks | ✅ Active |
| [openharness-swarm](plugins/openharness-swarm/) | Multi-agent coordination: subagent spawning, team registry, task delegation, background lifecycle | ✅ Active |
| [openharness-memory](plugins/openharness-memory/) | Persistent cross-session memory with MEMORY.md index, project-specific storage, heuristic search | ✅ Active |
| [openharness-commands](plugins/openharness-commands/) | 20+ slash commands from OpenHarness: /oh-status, /oh-doctor, /oh-permissions, /oh-commit, etc. | ✅ Active |
| [openharness-mcp](plugins/openharness-mcp/) | MCP server integration — connect/disconnect, list servers, list tools, call tools, read resources | ✅ Active |
| [openharness-context](plugins/openharness-context/) | Smart context management — CLAUDE.md discovery, context compression, token estimation, intelligent context window management | ✅ Active |
| [openharness-session](plugins/openharness-session/) | Session management — save/load/resume, export, branch, and browse conversation history | ✅ Active |
| [openharness-code-intel](plugins/openharness-code-intel/) | Code intelligence — symbol search, definition lookup, reference finding, dependency analysis, complexity metrics | ✅ Active |
| [openharness-gitflow](plugins/openharness-gitflow/) | Enhanced git workflow — smart conventional commits, branch management, PR descriptions, changelogs, worktree management | ✅ Active |
| [openharness-interactive](plugins/openharness-interactive/) | Interactive user communication — ask questions, confirm actions, select from lists, collect text input | ✅ Active |
| [openharness-lsp](plugins/openharness-lsp/) | Language Server Protocol integration — go-to-definition, find references, hover, diagnostics, rename, workspace symbols | ✅ Active |
| [openharness-bridge](plugins/openharness-bridge/) | Bridge system — spawn, manage, and communicate with child OpenHarness sessions for delegated work | ✅ Active |
| [openharness-cost](plugins/openharness-cost/) | Real cost tracking, model management, effort/passes configuration, and usage statistics | ✅ Active |
| [openharness-github](plugins/openharness-github/) | GitHub integration — issue management, PR comments, repository operations via gh CLI | ✅ Active |
| [openharness-session-ops](plugins/openharness-session-ops/) | Session operations — context display, conversation rewind, session tagging, project init, plugin reload, runtime config | ✅ Active |
| [openharness-repl](plugins/openharness-repl/) | REPL code execution for Python, Node.js, and Ruby — bridged from Claw Code | ✅ Active |
| [openharness-structured-output](plugins/openharness-structured-output/) | Generate structured JSON output from natural language descriptions — bridged from Claw Code | ✅ Active |
| [openharness-provider](plugins/openharness-provider/) | Multi-provider LLM management (Anthropic, xAI/Grok, OpenAI-compatible) — bridged from Claw Code | ✅ Active |
| [openharness-auth](plugins/openharness-auth/) | OAuth/PKCE authentication management for API providers — bridged from Claw Code | ✅ Active |

## OpenHarness Integration Architecture

These 21 plugins bridge the full OpenHarness agent harness and Claw Code capabilities into OpenClaw:

```
OpenHarness Subsystem    →  OpenClaw Plugin
─────────────────────────────────────────────────
43+ Tools Registry       →  openharness-tools (agent tools via registerTool)
Skills System (.md)      →  openharness-skills (discovery + auto-inject via before_prompt_build)
Permissions + Hooks      →  openharness-governance (before_tool_call + after_tool_call hooks)
Multi-Agent Swarm        →  openharness-swarm (subprocess spawning + team registry)
Context & Memory         →  openharness-memory (MEMORY.md + project-specific storage)
Slash Commands           →  openharness-commands (registerCommand for 20+ commands)
MCP Client               →  openharness-mcp (connect, discover, call MCP server tools/resources)
Prompt/Context System    →  openharness-context (CLAUDE.md discovery, compression, token estimation)
Session Storage          →  openharness-session (save/load/branch/export conversation sessions)
Code Understanding       →  openharness-code-intel (symbol search, dependency graph, complexity)
Git Workflow             →  openharness-gitflow (conventional commits, branch management, PR/CHANGELOG)
Interactive Communication→  openharness-interactive (ask questions, confirm, select, input)
Language Server Protocol →  openharness-lsp (definition, references, hover, diagnostics, rename)
Bridge System            →  openharness-bridge (spawn/manage child sessions with context passing)
Cost & Model Management  →  openharness-cost (real cost tracking, model switching, effort/passes)
GitHub Integration       →  openharness-github (issues, PRs, comments via gh CLI)
Session Operations       →  openharness-session-ops (context, rewind, tag, share, init, config)
REPL Execution           →  openharness-repl (Python/Node.js/Ruby code execution via subprocess)
Structured Output        →  openharness-structured-output (JSON generation from natural language)
Multi-Provider LLM       →  openharness-provider (Anthropic/xAI/OpenAI-compatible management)
OAuth/PKCE Auth          →  openharness-auth (OAuth login, token management, provider auth status)
```

## Quick Start

```bash
# Install dependencies for all plugins
pnpm install

# Type check all plugins
pnpm -r run typecheck

# Run tests for all plugins
pnpm -r run test

# Lint all plugins
pnpm -r run lint
```

## Plugin Development

Each plugin lives in `plugins/<name>/` with its own:
- `package.json` — plugin metadata and dependencies
- `openclaw.plugin.json` — OpenClaw plugin manifest
- `setup-entry.ts` — plugin setup (create directories, etc.)
- `src/` — source code
- `tests/` — test files
- `tsconfig.json` — TypeScript configuration
- `vitest.config.ts` — Vitest test configuration

### Adding a New Plugin

1. Create `plugins/<new-plugin>/` directory
2. Copy the structure from an existing plugin
3. Update `package.json` name and metadata
4. Update `openclaw.plugin.json` with plugin-specific config
5. Run `pnpm install` at the root to link workspaces

## Channel Compatibility

| Plugin | CLI | Feishu | WeChat |
|--------|-----|--------|--------|
| dev-workflow | ✅ Tools + Hooks | ✅ Tools available to LLM agent | ✅ Tools available to LLM agent |
| wechat | — | — | ✅ Full channel support |
| openharness-tools | ✅ 43+ tools | ✅ All tools via LLM agent | ✅ All tools via LLM agent |
| openharness-skills | ✅ Skill discovery + auto-inject | ✅ Auto-inject on prompt build | ✅ Auto-inject on prompt build |
| openharness-governance | ✅ Hooks + permissions tool | ✅ Hooks on all tool calls | ✅ Hooks on all tool calls |
| openharness-swarm | ✅ Subagent spawn/manage | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-memory | ✅ Memory CRUD + auto-inject | ✅ Auto-inject on prompt build | ✅ Auto-inject on prompt build |
| openharness-commands | ✅ 20+ slash commands | ✅ Via command handler | ✅ Via command handler |
| openharness-mcp | ✅ MCP connect/call tools | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-context | ✅ Context compression + estimation | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-session | ✅ Session CRUD + export + branch | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-code-intel | ✅ Symbol search, deps, complexity | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-gitflow | ✅ Smart commits, branches, PRs | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-interactive | ✅ Ask/confirm/select/input | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-lsp | ✅ Definition, refs, hover, diag | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-bridge | ✅ Spawn/manage child sessions | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-cost | ✅ Cost tracking, model mgmt | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-github | ✅ Issues, PRs, comments | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-session-ops | ✅ Context, rewind, tag, init | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-repl | ✅ Code execution (Python/Node/Ruby) | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-structured-output | ✅ JSON output generation | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-provider | ✅ Multi-provider LLM mgmt | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-auth | ✅ OAuth/PKCE auth management | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-repl | ✅ Code execution (Python/Node/Ruby) | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-structured-output | ✅ JSON output generation | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-provider | ✅ Multi-provider LLM mgmt | ✅ Via LLM agent tools | ✅ Via LLM agent tools |
| openharness-auth | ✅ OAuth/PKCE auth management | ✅ Via LLM agent tools | ✅ Via LLM agent tools |

dev-workflow registers its tools (DevWorkflowTool, WorkflowStatusTool, TaskExecuteTool, SpecViewTool, QAGateTool) via the OpenClaw plugin API. These tools are available to the LLM agent across **all channels** — Feishu, WeChat, and CLI — once the plugin is loaded.

## Deployment (WSL / NTFS Mount)

Plugins under `/mnt/g/` (Windows NTFS mounts) are blocked by OpenClaw's `path_world_writable` security check. Use the sync script to deploy to a native Linux path:

```bash
# Build first
pnpm run build

# Sync to default target (~/openclaw-plugins)
./scripts/sync-plugins.sh

# Or specify a custom target
./scripts/sync-plugins.sh /opt/openclaw-plugins
```

Then configure OpenClaw to load plugins from the target path:

```yaml
plugins:
  allow:
    - ~/openclaw-plugins/plugins/*
```

## License

MIT

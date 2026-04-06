# DeerFlow Plugin for OpenClaw

[中文文档](./README_CN.md)

DeerFlow super-agent capabilities as native OpenClaw tools: sub-agent orchestration, long-term memory, skills system, sandbox execution, and automatic context injection.

## Features

### Tools
| Tool | Description |
|------|-------------|
| `delegate_task` | Delegate complex tasks to specialized sub-agents |
| `remember` | Store facts in long-term memory |
| `search_memory` | Query cross-session memory |
| `load_skill` | Load SKILL.md-format skills at runtime |
| `list_skills` | List available skills |
| `sandbox_exec` | Execute code in isolated environment with virtual filesystem |

### Hooks (Automatic Context Injection)
| Hook | Trigger | Action |
|------|---------|--------|
| `before_prompt_build` | Every prompt | Inject relevant memory facts and skill instructions |
| `before_tool_call` | Tool execution | Guardrail: block dangerous commands (rm, fork bomb, etc.) |

### Channels Compatibility
- **WeChat** (微信) — via `openclaw-weixin`
- **Feishu** (飞书) — via `feishu`  
- **QQ** — via `qqbot`

All tools and hooks work seamlessly across these channels.

## Installation

```bash
# Clone the repository
git clone https://github.com/zccyman/openclaw-plugins.git
cd openclaw-plugins

# Install dependencies
cd plugins/deer-flow
pnpm install
pnpm build
```

### OpenClaw Setup

```bash
# Install plugin
openclaw plugins install /path/to/openclaw-plugins/plugins/deer-flow

# Add to config paths (if not auto-detected)
# Edit ~/.openclaw/openclaw.json:
# "plugins.load.paths": [..., "~/.openclaw/extensions/deer-flow"]

# Restart gateway
openclaw gateway restart

# Enable plugin
openclaw plugins enable deer-flow
```

## Configuration

```json
{
  "plugins": {
    "entries": {
      "deer-flow": {
        "enabled": true,
        "config": {
          "skillsPath": "./skills",
          "maxMemoryFacts": 15,
          "sandboxMode": "local",
          "sandboxBashEnabled": true
        }
      }
    }
  }
}
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skillsPath` | string | `./skills` | Path to skills directory |
| `maxMemoryFacts` | number | 15 | Max facts to recall per prompt |
| `sandboxMode` | string | `local` | Execution mode: local/remote/disabled |
| `sandboxBashEnabled` | boolean | true | Allow bash commands in sandbox |

## Usage

### Delegate Tasks
```
delegate_task(
  task="Research the latest TypeScript 5.8 features",
  subagent_type="research",
  max_turns=10,
  context="Focus on breaking changes and migration guide",
  expected_output="A summary of new features with code examples"
)
```

### Memory
```
# Store facts
remember(
  content="User prefers TypeScript over JavaScript",
  category="preference",
  confidence=0.9
)

# Search memory
search_memory(
  query="TypeScript preferences",
  category="preference",
  limit=5
)
```

### Skills
```
# List available skills
list_skills()

# Load a specific skill
load_skill(name="frontend-design")
```

### Sandbox
```
sandbox_exec(
  command="python3 -c 'print(2**10)'",
  working_dir="/mnt/user-data/workspace",
  timeout=30
)
```

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test --coverage

# Type check
pnpm typecheck
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  OpenClaw Agent                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  DeerFlow Plugin                          │ │
│  │  ┌─────────┐ ┌────────┐ ┌──────┐ ┌─────┐│ │
│  │  │delegate │ │memory  │ │skills│ │sbx  ││ │
│  │  │_task    │ │tools   │ │tools │ │tools││ │
│  │  └────┬────┘ └───┬────┘ └──┬───┘ └──┬──┘│ │
│  │       │          │         │        │    │ │
│  │  ┌────┴──────────┴─────────┴────────┴──┐│ │
│  │  │  Orchestrator + Memory + Skills     ││ │
│  │  └─────────────────────────────────────┘│ │
│  └───────────────────────────────────────────┘ │
│          ↑                           ↑           │
│   before_prompt_build         before_tool_call │
└─────────────────────────────────────────────────┘
```

## License

MIT
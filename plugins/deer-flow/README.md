# DeerFlow Plugin for OpenClaw

[中文文档](./README_CN.md)

DeerFlow super-agent capabilities as native OpenClaw tools: sub-agent orchestration, long-term memory, skills system, and sandbox execution.

## Features

- **Sub-Agent Orchestration** — Delegate complex tasks to specialized sub-agents with `delegate_task`
- **Long-Term Memory** — Cross-session memory via `search_memory` and `remember` tools
- **Skills System** — Load and manage SKILL.md-format skills with `load_skill` and `list_skills`
- **Sandbox Execution** — Isolated code execution with virtual filesystem via `sandbox_exec`
- **Context Engineering** — Automatic memory and skill injection into agent prompts

## Installation

```bash
# Clone the openclaw-plugins repository
git clone https://github.com/openclaw/openclaw-plugins.git
cd openclaw-plugins

# Install dependencies
pnpm install

# Build the deer-flow plugin
cd plugins/deer-flow
pnpm build
```

## Configuration

Add to your OpenClaw config:

```json
{
  "plugins": {
    "deer-flow": {
      "skillsPath": "./skills",
      "memoryEnabled": true,
      "maxMemoryFacts": 15,
      "defaultSubagentType": "general-purpose",
      "sandboxMode": "local",
      "sandboxBashEnabled": true
    }
  }
}
```

## Usage

### Delegate Tasks

```
Use the delegate_task tool to spawn a sub-agent:

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
Store facts:
remember(
  content="User prefers TypeScript over JavaScript for all projects",
  category="preference",
  confidence=0.9
)

Search memory:
search_memory(
  query="TypeScript preferences",
  category="preference",
  limit=5
)
```

### Skills

```
List available skills:
list_skills()

Load a specific skill:
load_skill(name="frontend-design")
```

### Sandbox

```
Execute commands in isolated environment:
sandbox_exec(
  command="python3 -c 'print(2**10)'",
  working_dir="/mnt/user-data/workspace",
  timeout=30
)
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
└─────────────────────────────────────────────────┘
```

## License

MIT

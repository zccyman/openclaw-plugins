# DeerFlow Plugin — Design Document

## Architecture Overview

```
openclaw-plugins/
└── plugins/
    └── deer-flow/
        ├── openclaw.plugin.json    # Plugin manifest
        ├── package.json            # npm package config
        ├── tsconfig.json           # TypeScript config
        ├── vitest.config.ts        # Test config
        ├── README.md               # English docs
        ├── README_CN.md            # Chinese docs
        ├── setup-entry.ts          # Setup wizard entry
        ├── src/
        │   ├── index.ts            # Plugin entry (definePluginEntry)
        │   ├── types.ts            # Shared type definitions
        │   ├── tools/              # Agent tools
        │   │   ├── index.ts
        │   │   ├── delegate-task.ts     # Sub-agent delegation
        │   │   ├── search-memory.ts     # Memory search
        │   │   ├── remember.ts          # Memory storage
        │   │   ├── load-skill.ts        # Skill loading
        │   │   ├── list-skills.ts       # Skill listing
        │   │   └── sandbox-exec.ts      # Sandbox execution
        │   ├── hooks/              # Lifecycle hooks
        │   │   ├── index.ts
        │   │   ├── memory-inject.ts     # Inject memory into prompt
        │   │   ├── skill-inject.ts      # Inject skills into prompt
        │   │   └── context-engine.ts    # Context engineering
        │   ├── memory/             # Memory adapters
        │   │   ├── index.ts
        │   │   ├── runtime-adapter.ts   # OpenClaw memory runtime adapter
        │   │   ├── prompt-builder.ts    # Memory prompt section builder
        │   │   └── embedding.ts         # Embedding provider adapter
        │   ├── skills/             # Skills system
        │   │   ├── index.ts
        │   │   ├── loader.ts            # SKILL.md parser
        │   │   ├── registry.ts          # Skill registry
        │   │   └── installer.ts         # .skill archive installer
        │   ├── subagents/          # Sub-agent orchestration
        │   │   ├── index.ts
        │   │   ├── orchestrator.ts      # Task decomposition + dispatch
        │   │   ├── executor.ts          # runtime.subagent wrapper
        │   │   └── result-aggregator.ts # Result synthesis
        │   ├── sandbox/            # Sandbox utilities
        │   │   ├── index.ts
        │   │   ├── virtual-path.ts      # Virtual path translation
        │   │   └── tools.ts             # Sandbox tool implementations
        │   └── utils/              # Shared utilities
        │       ├── index.ts
        │       └── prompt.ts            # Prompt template helpers
        └── tests/
            ├── tools/
            ├── hooks/
            ├── memory/
            ├── skills/
            ├── subagents/
            └── sandbox/
```

## Design Decisions

### 1. Tool-Based Architecture (增强工具集)

All DeerFlow capabilities are exposed as OpenClaw agent tools via `registerTool()`. The agent decides when to use them — no automatic takeover of the agent loop.

**Rationale**: User chose "增强工具集" positioning. Tools are opt-in, composable, and don't interfere with OpenClaw's core agent behavior.

### 2. Native Memory Integration

Uses OpenClaw's memory plugin API (`registerMemoryRuntime`, `registerMemoryPromptSection`, `registerMemoryEmbeddingProvider`) instead of DeerFlow's JSON file storage.

**Rationale**: User chose "对接 openclaw 记忆". This ensures memory works across all OpenClaw sessions and plugins, not just deer-flow.

### 3. Sub-Agent Orchestration via `runtime.subagent`

DeerFlow's sub-agent system (thread pools, SSE polling, result aggregation) is re-implemented on top of OpenClaw's native `runtime.subagent.run/waitForRun`.

**Rationale**: OpenClaw already has a battle-tested sub-agent runtime. Re-implementing the orchestration layer (task decomposition, dependency tracking, result synthesis) while delegating execution to the native runtime gives us the best of both worlds.

### 4. SKILL.md Compatibility

The skills loader parses DeerFlow's SKILL.md format (YAML frontmatter + Markdown body) and injects them into the agent prompt via `before_prompt_build` hooks.

**Rationale**: SKILL.md is a simple, portable format. No modification needed — just a parser and injection mechanism.

### 5. Virtual Path System for Sandbox

Implements DeerFlow's virtual path translation (`/mnt/user-data/`, `/mnt/skills/`) on top of OpenClaw's existing sandbox infrastructure.

**Rationale**: Agents expect DeerFlow-style paths. Virtual path translation provides compatibility without requiring filesystem changes.

## Tool Specifications

### `delegate_task`

Delegates a task to a sub-agent with structured parameters.

```typescript
{
  name: "delegate_task",
  description: "Delegate a complex task to a specialized sub-agent. The sub-agent works independently and returns structured results.",
  parameters: {
    task: string,           // Task description
    subagent_type: string,  // "general-purpose" | "bash" | "research" | "code"
    max_turns: number,      // Maximum conversation turns (default: 10)
    context: string,        // Additional context/background
    expected_output: string // Description of expected deliverable
  }
}
```

### `search_memory`

Searches cross-session memory for relevant facts and preferences.

```typescript
{
  name: "search_memory",
  description: "Search long-term memory for facts, preferences, and context from previous sessions.",
  parameters: {
    query: string,          // Search query
    category: string,       // Optional: "preference" | "knowledge" | "context" | "behavior" | "goal"
    limit: number           // Max results (default: 15)
  }
}
```

### `remember`

Stores a fact or preference to long-term memory.

```typescript
{
  name: "remember",
  description: "Store a fact, preference, or piece of context to long-term memory for future sessions.",
  parameters: {
    content: string,        // Fact or preference to store
    category: string,       // "preference" | "knowledge" | "context" | "behavior" | "goal"
    confidence: number      // Confidence 0-1 (default: 0.8)
  }
}
```

### `load_skill`

Loads a skill from the skills directory.

```typescript
{
  name: "load_skill",
  description: "Load a skill by name. Skills provide, best practices, and workflows that extend agent capabilities.",
  parameters: {
    name: string           // Skill name (directory name under skills/)
  }
}
```

### `list_skills`

Lists available skills.

```typescript
{
  name: "list_skills",
  description: "List all available skills with their descriptions and enabled status.",
  parameters: {}
}
```

### `sandbox_exec`

Executes code in an isolated sandbox environment.

```typescript
{
  name: "sandbox_exec",
  description: "Execute code or commands in an isolated sandbox with virtual filesystem.",
  parameters: {
    command: string,        // Command to execute
    working_dir: string,    // Virtual working directory (default: /mnt/user-data/workspace)
    timeout: number         // Timeout in seconds (default: 30)
  }
}
```

## Hook Specifications

### `before_prompt_build` — Memory + Skill Injection

Intercepts prompt building to inject:
1. Top 15 memory facts from OpenClaw memory system
2. Enabled skill instructions
3. Context engineering guidance

### `before_tool_call` — Guardrail Provider

Validates tool calls against a configurable allowlist/denylist. Blocks dangerous operations in sandbox mode.

### `after_tool_call` — Memory Queue

Queues tool results for async memory extraction (similar to DeerFlow's MemoryMiddleware).

## Memory Integration

```
┌─────────────────────────────────────────────┐
│  OpenClaw Memory System                     │
│  ┌─────────────────────────────────────┐   │
│  │ registerMemoryRuntime()             │   │
│  │ registerMemoryPromptSection()       │   │
│  │ registerMemoryEmbeddingProvider()   │   │
│  └─────────────────────────────────────┘   │
│                    ↕                        │
│  DeerFlow Plugin Memory Adapter             │
│  - Fact extraction (LLM-based)              │
│  - Deduplication                            │
│  - Confidence scoring                       │
│  - Category classification                  │
└─────────────────────────────────────────────┘
```

## Sub-Agent Orchestration Flow

```
User Request → delegate_task tool
                    │
                    ▼
          Task Orchestrator
          - Parse task description
          - Select subagent_type
          - Build isolated context
                    │
                    ▼
          runtime.subagent.run()
          - sessionKey (isolated)
          - extraSystemPrompt
          - provider/model selection
                    │
                    ▼
          runtime.subagent.waitForRun()
          - Poll for completion
          - Timeout handling
                    │
                    ▼
          Result Aggregator
          - Structure output
          - Inject into parent context
```

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|----------------|
| Unit (tools) | Vitest | 80%+ |
| Unit (memory) | Vitest + mocks | 80%+ |
| Unit (skills) | Vitest | 90%+ |
| Integration (hooks) | Vitest + OpenClaw test utils | 70%+ |
| E2E | Manual + scripted scenarios | Key flows |

## Ship/Show/Ask Classification

| Component | Category | Rationale |
|-----------|----------|-----------|
| Plugin scaffold + manifest | 🚢 Ship | New code, no risk |
| Tools (delegate_task, etc.) | 👀 Show | New agent capabilities |
| Memory integration | 👀 Show | Integrates with existing memory API |
| Skills system | 🚢 Ship | Self-contained, no side effects |
| Sandbox virtual paths | 👀 Show | New isolation layer |
| Hook registrations | ❓ Ask | Modifies agent behavior |

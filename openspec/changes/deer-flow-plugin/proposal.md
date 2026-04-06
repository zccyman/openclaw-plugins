# DeerFlow Plugin for OpenClaw

## What

Build a native TypeScript plugin (`@openclaw/deer-flow`) that ports DeerFlow's core agent capabilities into the OpenClaw ecosystem as an enhancement toolset.

## Why

DeerFlow (by ByteDance) is a super agent harness with proven capabilities: sub-agent orchestration, long-term memory, skills system, sandbox execution, and context engineering. OpenClaw has a powerful plugin system with native `runtime.subagent`, `registerMemoryRuntime`, and 28 hook points — but lacks the structured agent orchestration patterns that make DeerFlow effective for complex multi-step tasks.

This plugin bridges the gap: it gives OpenClaw users DeerFlow-style agent capabilities (task decomposition, parallel sub-agent execution, cross-session memory, skill loading) as native tools that integrate seamlessly with OpenClaw's existing architecture.

## Impact

- **Affected code**: New plugin at `plugins/deer-flow/` — no changes to existing plugins or OpenClaw core
- **New capabilities**:
  - `delegate_task` tool — structured sub-agent delegation with DeerFlow-style task decomposition
  - `search_memory` / `remember` tools — cross-session memory via OpenClaw native memory API
  - `load_skill` / `list_skills` tools — SKILL.md format skill loading and management
  - `sandbox_exec` tool — isolated code execution with virtual path system
  - Context engineering hooks — automatic skill injection, memory injection, sub-agent context isolation
- **Dependencies**: `@openclaw/deer-flow` depends on `openclaw >= 2026.4.2` (for full plugin API surface)

[
  {
    "id": "task-01-plugin-scaffold",
    "title": "Create plugin scaffold structure",
    "description": "Create the full directory structure for the deer-flow plugin: openclaw.plugin.json, package.json, tsconfig.json, vitest.config.ts, README.md, README_CN.md, setup-entry.ts, and all source/test directories. Match the existing plugin patterns from dev-workflow.",
    "status": "pending",
    "dependencies": [],
    "shipCategory": "ship",
    "files": [
      "plugins/deer-flow/openclaw.plugin.json",
      "plugins/deer-flow/package.json",
      "plugins/deer-flow/tsconfig.json",
      "plugins/deer-flow/vitest.config.ts",
      "plugins/deer-flow/README.md",
      "plugins/deer-flow/README_CN.md",
      "plugins/deer-flow/setup-entry.ts",
      "plugins/deer-flow/src/index.ts",
      "plugins/deer-flow/src/types.ts"
    ],
    "estimatedMinutes": 45
  },
  {
    "id": "task-02-types",
    "title": "Define shared TypeScript types",
    "description": "Create comprehensive type definitions for: SkillMetadata, MemoryFact, MemoryCategory, SubagentType, DelegateTaskParams, SubagentResult, SandboxConfig, VirtualPath, WorkflowTask, WorkflowContext. Align with both DeerFlow concepts and OpenClaw plugin API types.",
    "status": "pending",
    "dependencies": ["task-01-plugin-scaffold"],
    "shipCategory": "ship",
    "files": ["plugins/deer-flow/src/types.ts"],
    "estimatedMinutes": 30
  },
  {
    "id": "task-03-skills-loader",
    "title": "Implement SKILL.md loader and registry",
    "description": "Build the skills system: (1) SKILL.md parser that extracts YAML frontmatter (name, description, license, allowed-tools) and Markdown body, (2) SkillRegistry that manages enabled/disabled state, (3) SkillInstaller that extracts .skill ZIP archives. Match DeerFlow's skills/ directory scanning behavior.",
    "status": "pending",
    "dependencies": ["task-02-types"],
    "shipCategory": "ship",
    "files": [
      "plugins/deer-flow/src/skills/index.ts",
      "plugins/deer-flow/src/skills/loader.ts",
      "plugins/deer-flow/src/skills/registry.ts",
      "plugins/deer-flow/src/skills/installer.ts",
      "plugins/deer-flow/tests/skills/loader.test.ts",
      "plugins/deer-flow/tests/skills/registry.test.ts"
    ],
    "estimatedMinutes": 90
  },
  {
    "id": "task-04-memory-adapter",
    "title": "Implement OpenClaw memory runtime adapter",
    "description": "Build the memory integration layer: (1) MemoryRuntimeAdapter implementing OpenClaw's MemoryPluginRuntime interface, (2) MemoryPromptSectionBuilder for injecting facts into system prompt, (3) MemoryEmbeddingProvider adapter for vector search. Use OpenClaw's native memory API — don't recreate DeerFlow's JSON storage.",
    "status": "pending",
    "dependencies": ["task-02-types"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/memory/index.ts",
      "plugins/deer-flow/src/memory/runtime-adapter.ts",
      "plugins/deer-flow/src/memory/prompt-builder.ts",
      "plugins/deer-flow/src/memory/embedding.ts",
      "plugins/deer-flow/tests/memory/runtime-adapter.test.ts",
      "plugins/deer-flow/tests/memory/prompt-builder.test.ts"
    ],
    "estimatedMinutes": 120
  },
  {
    "id": "task-05-subagent-orchestrator",
    "title": "Implement sub-agent orchestrator on top of runtime.subagent",
    "description": "Build the sub-agent orchestration layer: (1) TaskOrchestrator that decomposes complex tasks and selects subagent_type, (2) SubagentExecutor wrapping runtime.subagent.run/waitForRun with timeout and retry logic, (3) ResultAggregator that synthesizes multiple sub-agent results into structured output. Support parallel execution for independent tasks.",
    "status": "pending",
    "dependencies": ["task-02-types"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/subagents/index.ts",
      "plugins/deer-flow/src/subagents/orchestrator.ts",
      "plugins/deer-flow/src/subagents/executor.ts",
      "plugins/deer-flow/src/subagents/result-aggregator.ts",
      "plugins/deer-flow/tests/subagents/orchestrator.test.ts",
      "plugins/deer-flow/tests/subagents/executor.test.ts"
    ],
    "estimatedMinutes": 150
  },
  {
    "id": "task-06-sandbox-virtual-path",
    "title": "Implement sandbox virtual path system",
    "description": "Build the virtual path translation layer: (1) VirtualPathMapper translating agent-visible paths (/mnt/user-data/, /mnt/skills/) to physical paths, (2) SandboxTool implementations (bash, ls, read_file, write_file, str_replace) with path translation. Reuse OpenClaw's existing sandbox infrastructure.",
    "status": "pending",
    "dependencies": ["task-02-types"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/sandbox/index.ts",
      "plugins/deer-flow/src/sandbox/virtual-path.ts",
      "plugins/deer-flow/src/sandbox/tools.ts",
      "plugins/deer-flow/tests/sandbox/virtual-path.test.ts"
    ],
    "estimatedMinutes": 120
  },
  {
    "id": "task-07-delegate-task-tool",
    "title": "Implement delegate_task agent tool",
    "description": "Create the primary delegation tool that agents use to spawn sub-agents. Parameters: task, subagent_type, max_turns, context, expected_output. Internally uses SubagentOrchestrator. Returns structured results with success/failure status and output.",
    "status": "pending",
    "dependencies": ["task-05-subagent-orchestrator"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/tools/delegate-task.ts",
      "plugins/deer-flow/tests/tools/delegate-task.test.ts"
    ],
    "estimatedMinutes": 60
  },
  {
    "id": "task-08-memory-tools",
    "title": "Implement search_memory and remember tools",
    "description": "Create two memory tools: (1) search_memory — queries OpenClaw memory system with category filter and limit, (2) remember — stores facts with category and confidence scoring. Both use the MemoryRuntimeAdapter from task-04.",
    "status": "pending",
    "dependencies": ["task-04-memory-adapter"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/tools/search-memory.ts",
      "plugins/deer-flow/src/tools/remember.ts",
      "plugins/deer-flow/tests/tools/search-memory.test.ts",
      "plugins/deer-flow/tests/tools/remember.test.ts"
    ],
    "estimatedMinutes": 60
  },
  {
    "id": "task-09-skill-tools",
    "title": "Implement load_skill and list_skills tools",
    "description": "Create two skill management tools: (1) load_skill — loads a skill by name and returns its content for agent use, (2) list_skills — returns all available skills with descriptions and enabled status. Both use the SkillRegistry from task-03.",
    "status": "pending",
    "dependencies": ["task-03-skills-loader"],
    "shipCategory": "ship",
    "files": [
      "plugins/deer-flow/src/tools/load-skill.ts",
      "plugins/deer-flow/src/tools/list-skills.ts",
      "plugins/deer-flow/tests/tools/load-skill.test.ts",
      "plugins/deer-flow/tests/tools/list-skills.test.ts"
    ],
    "estimatedMinutes": 45
  },
  {
    "id": "task-10-sandbox-tool",
    "title": "Implement sandbox_exec agent tool",
    "description": "Create the sandbox execution tool. Parameters: command, working_dir (virtual path), timeout. Uses VirtualPathMapper for path translation and OpenClaw's sandbox for execution. Returns stdout, stderr, and exit code.",
    "status": "pending",
    "dependencies": ["task-06-sandbox-virtual-path"],
    "shipCategory": "show",
    "files": [
      "plugins/deer-flow/src/tools/sandbox-exec.ts",
      "plugins/deer-flow/tests/tools/sandbox-exec.test.ts"
    ],
    "estimatedMinutes": 60
  },
  {
    "id": "task-11-tools-index",
    "title": "Create tools registration and index",
    "description": "Create the tools index module that exports all tools and provides a registerDeerFlowTools(api) function. Wire up all 6 tools (delegate_task, search_memory, remember, load_skill, list_skills, sandbox_exec) to the OpenClaw plugin API.",
    "status": "pending",
    "dependencies": ["task-07-delegate-task-tool", "task-08-memory-tools", "task-09-skill-tools", "task-10-sandbox-tool"],
    "shipCategory": "ship",
    "files": ["plugins/deer-flow/src/tools/index.ts"],
    "estimatedMinutes": 30
  },
  {
    "id": "task-12-hooks",
    "title": "Implement lifecycle hooks",
    "description": "Register OpenClaw plugin hooks: (1) before_prompt_build — inject memory facts and skill instructions into agent prompt, (2) before_tool_call — guardrail validation for sandbox operations, (3) after_tool_call — queue results for memory extraction. Use api.registerHook() with proper priority ordering.",
    "status": "pending",
    "dependencies": ["task-04-memory-adapter", "task-03-skills-loader"],
    "shipCategory": "ask",
    "files": [
      "plugins/deer-flow/src/hooks/index.ts",
      "plugins/deer-flow/src/hooks/memory-inject.ts",
      "plugins/deer-flow/src/hooks/skill-inject.ts",
      "plugins/deer-flow/src/hooks/context-engine.ts",
      "plugins/deer-flow/tests/hooks/memory-inject.test.ts",
      "plugins/deer-flow/tests/hooks/skill-inject.test.ts"
    ],
    "estimatedMinutes": 90
  },
  {
    "id": "task-13-plugin-entry",
    "title": "Wire up plugin entry point",
    "description": "Complete src/index.ts with definePluginEntry(): setRuntime, register(api) calling registerDeerFlowTools and registerDeerFlowHooks. Export all public modules for external use. Match the dev-workflow plugin entry pattern.",
    "status": "pending",
    "dependencies": ["task-11-tools-index", "task-12-hooks"],
    "shipCategory": "ship",
    "files": ["plugins/deer-flow/src/index.ts"],
    "estimatedMinutes": 30
  },
  {
    "id": "task-14-setup-entry",
    "title": "Create setup wizard entry",
    "description": "Implement setup-entry.ts with configuration wizard for deer-flow plugin. Guide users through: skills directory path, memory preferences, sandbox mode selection. Match the dev-workflow setup pattern.",
    "status": "pending",
    "dependencies": ["task-13-plugin-entry"],
    "shipCategory": "ship",
    "files": ["plugins/deer-flow/setup-entry.ts"],
    "estimatedMinutes": 45
  },
  {
    "id": "task-15-utils",
    "title": "Implement shared utilities",
    "description": "Create utility modules: (1) prompt.ts — prompt template helpers for skill injection, memory formatting, context engineering, (2) index.ts — barrel exports. Keep utilities pure and testable.",
    "status": "pending",
    "dependencies": ["task-02-types"],
    "shipCategory": "ship",
    "files": [
      "plugins/deer-flow/src/utils/index.ts",
      "plugins/deer-flow/src/utils/prompt.ts",
      "plugins/deer-flow/tests/utils/prompt.test.ts"
    ],
    "estimatedMinutes": 45
  },
  {
    "id": "task-16-documentation",
    "title": "Write bilingual documentation",
    "description": "Create comprehensive README.md (English) and README_CN.md (Chinese) with: installation, configuration, usage examples for each tool, architecture overview, contributing guide. Second line must link to the other language version.",
    "status": "pending",
    "dependencies": ["task-14-setup-entry"],
    "shipCategory": "ship",
    "files": [
      "plugins/deer-flow/README.md",
      "plugins/deer-flow/README_CN.md"
    ],
    "estimatedMinutes": 60
  },
  {
    "id": "task-17-build-test",
    "title": "Build, typecheck, and run all tests",
    "description": "Run the full verification pipeline: pnpm install, tsc --noEmit (typecheck), vitest run (all tests), oxlint src/ (lint). Fix any failures. Ensure 80%+ coverage on new code.",
    "status": "pending",
    "dependencies": ["task-15-utils"],
    "shipCategory": "ship",
    "files": [],
    "estimatedMinutes": 60
  }
]

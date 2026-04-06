import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { MemoryRuntimeAdapter } from "../memory/runtime-adapter.js";
import type { SkillRegistry } from "../skills/registry.js";
import type { SandboxTools } from "../sandbox/tools.js";
import { createDelegateTaskTool } from "./delegate-task.js";
import { createSearchMemoryTool, createRememberTool } from "./search-memory.js";
import { createLoadSkillTool, createListSkillsTool } from "./load-skill.js";
import { createSandboxExecTool } from "./sandbox-exec.js";

export interface ToolDependencies {
  runtime: PluginRuntime;
  memoryAdapter: MemoryRuntimeAdapter;
  skillRegistry: SkillRegistry;
  sandboxTools: SandboxTools;
  skillsDir: string;
}

export function registerDeerFlowTools(api: OpenClawPluginApi, deps: ToolDependencies): void {
  api.registerTool(createDelegateTaskTool(deps.runtime));
  api.registerTool(createSearchMemoryTool(deps.memoryAdapter));
  api.registerTool(createRememberTool(deps.memoryAdapter));
  api.registerTool(createLoadSkillTool(deps.skillRegistry, deps.skillsDir));
  api.registerTool(createListSkillsTool(deps.skillRegistry, deps.skillsDir));
  api.registerTool(createSandboxExecTool(deps.sandboxTools));
}

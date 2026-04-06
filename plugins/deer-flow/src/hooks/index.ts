import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import type { MemoryRuntimeAdapter } from "../memory/runtime-adapter.js";
import type { SkillRegistry } from "../skills/registry.js";
import { createMemoryInjectHook } from "./memory-inject.js";
import { createSkillInjectHook } from "./skill-inject.js";
import { createGuardrailHook } from "./context-engine.js";

interface HookDeps {
  memoryAdapter: MemoryRuntimeAdapter;
  skillRegistry: SkillRegistry;
  maxMemoryFacts: number;
}

export function registerDeerFlowHooks(
  api: OpenClawPluginApi,
  deps: HookDeps,
): void {
  const memoryHook = createMemoryInjectHook(deps.memoryAdapter, deps.maxMemoryFacts);
  api.on("before_prompt_build", async (event: any, _ctx: any) => {
    return await memoryHook(event);
  });

  const skillHook = createSkillInjectHook(deps.skillRegistry);
  api.on("before_prompt_build", async (event: any, _ctx: any) => {
    return await skillHook(event);
  });

  const guardrailHook = createGuardrailHook();
  api.on("before_tool_call", async (event: any, _ctx: any) => {
    return await guardrailHook(event);
  });

  api.logger.info("[deer-flow] Registered hooks: memory-inject, skill-inject, guardrail");
}

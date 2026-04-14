import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { setDevWorkflowRuntime } from "./channel/runtime.js";
import { registerDevWorkflowTools } from "./tools/index.js";
import { registerDevWorkflowHooks } from "./hooks/index.js";

export { setDevWorkflowRuntime } from "./channel/runtime.js";
export { DevWorkflowEngine } from "./engine/index.js";
export { AgentOrchestrator } from "./agents/agent-orchestrator.js";
export { VerificationAgent } from "./agents/verification-agent.js";
export { HandoverManager } from "./handover/index.js";
export { BootstrapManager } from "./bootstrap/index.js";
export { MemdirManager } from "./memdir/index.js";
export { FeatureFlagManager } from "./feature-flags/index.js";
export { PermissionManager } from "./permissions/index.js";
export { BackgroundTaskManager } from "./background-tasks/index.js";
export { WorkingMemoryManager } from "./working-memory/index.js";
export { DirectoryTemplateManager } from "./directory-templates/index.js";

export default defineChannelPluginEntry({
  id: "dev-workflow",
  name: "Dev Workflow",
  description: "AI-driven spec-driven development workflow with multi-agent orchestration",
  setRuntime: setDevWorkflowRuntime,
  plugin: {} as any,
  registerFull(api: any) {
    registerDevWorkflowTools(api);
    registerDevWorkflowHooks(api);
  },
});

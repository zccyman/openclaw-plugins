import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export function registerDevWorkflowHooks(api: OpenClawPluginApi) {
  api.registerHook("session_start", async (event: any) => {
    api.logger.info(`[dev-workflow] Session started: ${event?.sessionKey ?? "unknown"}`);
  });

  api.registerHook("session_end", async (event: any) => {
    api.logger.info(`[dev-workflow] Session ended: ${event?.sessionKey ?? "unknown"}`);
  });

  api.registerHook("before_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool about to be called: ${event?.toolName ?? "unknown"}`);
  });

  api.registerHook("after_tool_call", async (event: any) => {
    api.logger.info(`[dev-workflow] Tool call completed: ${event?.toolName ?? "unknown"}`);
  });
}

export function registerHooks(api: any) {
  api.registerHook("before_tool_call", async (event: any) => {
    api.logger?.info?.(`[cross-platform-sync] Tool ${event?.toolName ?? "unknown"} called`);
  }, { name: "cross-platform-sync-before-tool-call" });

  api.registerHook("after_tool_call", async (event: any) => {
    api.logger?.info?.(`[cross-platform-sync] Tool ${event?.toolName ?? "unknown"} completed`);
  }, { name: "cross-platform-sync-after-tool-call" });
}

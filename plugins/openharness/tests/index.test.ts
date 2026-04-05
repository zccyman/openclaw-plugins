import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

describe("openharness unified plugin", () => {
  let plugin: any;
  let api: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../src/index.js");
    plugin = mod.default;
    api = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      on: vi.fn(),
      registerHook: vi.fn(),
    };
  }, 30000);

  it("should have correct plugin metadata", () => {
    expect(plugin.id).toBe("openharness");
    expect(plugin.name).toBe("OpenHarness");
    expect(plugin.description).toContain("140+ tools");
    expect(plugin.description).toContain("19 commands");
    expect(plugin.description).toContain("5 hooks");
  });

  it("should call all 21 register functions", () => {
    plugin.register(api);
    expect(api.registerTool).toHaveBeenCalled();
    expect(api.registerTool.mock.calls.length).toBeGreaterThanOrEqual(100);
  });

  it("should register core file I/O tools (tools module)", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_bash");
    expect(names).toContain("oh_file_read");
    expect(names).toContain("oh_file_write");
    expect(names).toContain("oh_file_edit");
    expect(names).toContain("oh_glob");
    expect(names).toContain("oh_grep");
    expect(names).toContain("oh_notebook_edit");
  });

  it("should register web tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_web_fetch");
    expect(names).toContain("oh_web_search");
  });

  it("should register workflow tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_skill");
    expect(names).toContain("oh_config");
    expect(names).toContain("oh_brief");
    expect(names).toContain("oh_todo_write");
    expect(names).toContain("oh_enter_plan_mode");
    expect(names).toContain("oh_exit_plan_mode");
  });

  it("should register task, agent, team, cron tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_task_create");
    expect(names).toContain("oh_task_get");
    expect(names).toContain("oh_task_list");
    expect(names).toContain("oh_agent_spawn");
    expect(names).toContain("oh_send_message");
    expect(names).toContain("oh_team_create");
    expect(names).toContain("oh_team_delete");
    expect(names).toContain("oh_cron_create");
    expect(names).toContain("oh_cron_list");
    expect(names).toContain("oh_cron_delete");
    expect(names).toContain("oh_remote_trigger");
  });

  it("should register auth tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_auth_status");
    expect(names).toContain("oh_auth_login");
    expect(names).toContain("oh_auth_logout");
  });

  it("should register bridge tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_bridge_spawn");
    expect(names).toContain("oh_bridge_send");
    expect(names).toContain("oh_bridge_receive");
    expect(names).toContain("oh_bridge_close");
    expect(names).toContain("oh_bridge_list");
  });

  it("should register code-intel tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_code_symbol_search");
    expect(names).toContain("oh_code_definitions");
    expect(names).toContain("oh_code_references");
    expect(names).toContain("oh_code_dependencies");
    expect(names).toContain("oh_code_outline");
    expect(names).toContain("oh_code_complexity");
  });

  it("should register context tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_context_discover");
    expect(names).toContain("oh_context_compress");
    expect(names).toContain("oh_context_estimate_tokens");
    expect(names).toContain("oh_context_status");
    expect(names).toContain("oh_context_add_instruction");
  });

  it("should register cost tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_cost_track");
    expect(names).toContain("oh_cost_summary");
    expect(names).toContain("oh_model_set");
    expect(names).toContain("oh_model_list");
    expect(names).toContain("oh_effort_set");
    expect(names).toContain("oh_passes_set");
    expect(names).toContain("oh_usage_stats");
    expect(names).toContain("oh_fast_mode");
  });

  it("should register provider tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_provider_list");
    expect(names).toContain("oh_provider_set");
    expect(names).toContain("oh_provider_test");
    expect(names).toContain("oh_model_alias");
  });

  it("should register repl tools", () => {
    plugin.register(api);
    const labels = api.registerTool.mock.calls.map((c: any[]) => c[0].label).filter(Boolean);
    expect(labels).toContain("Execute REPL Code");
    expect(labels).toContain("List REPL Runtimes");
    expect(labels).toContain("Install REPL Runtime");
  });

  it("should register session tools", () => {
    plugin.register(api);
    const labels = api.registerTool.mock.calls.map((c: any[]) => c[0].label).filter(Boolean);
    expect(labels).toContain("Save Session");
    expect(labels).toContain("Load Session");
    expect(labels).toContain("List Sessions");
    expect(labels).toContain("Export Session");
    expect(labels).toContain("Branch Session");
    expect(labels).toContain("Session Summary");
  });

  it("should register session-ops tools", () => {
    plugin.register(api);
    const labels = api.registerTool.mock.calls.map((c: any[]) => c[0].label).filter(Boolean);
    expect(labels).toContain("Show Session Context");
    expect(labels).toContain("Rewind Conversation");
    expect(labels).toContain("Tag Session");
    expect(labels).toContain("Share Session");
    expect(labels).toContain("Initialize Project");
    expect(labels).toContain("Version Info");
  });

  it("should register LSP tools", () => {
    plugin.register(api);
    const names = api.registerTool.mock.calls.map((c: any[]) => c[0].name).filter(Boolean);
    expect(names).toContain("oh_lsp_definition");
    expect(names).toContain("oh_lsp_references");
    expect(names).toContain("oh_lsp_hover");
    expect(names).toContain("oh_lsp_diagnostics");
    expect(names).toContain("oh_lsp_rename");
    expect(names).toContain("oh_lsp_symbols");
    expect(names).toContain("oh_lsp_implementation");
    expect(names).toContain("oh_lsp_completions");
  });

  it("should register governance hooks", () => {
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_tool_call", expect.any(Function));
    expect(api.on).toHaveBeenCalledWith("after_tool_call", expect.any(Function));
  });

  it("should register before_prompt_build hooks from memory, skills, context", () => {
    plugin.register(api);
    const promptHookCalls = api.on.mock.calls.filter((c: any[]) => c[0] === "before_prompt_build");
    expect(promptHookCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("each registered tool with name should have description, parameters, and execute", () => {
    plugin.register(api);
    for (const [tool] of api.registerTool.mock.calls) {
      if (tool.name) {
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("parameters");
        expect(tool).toHaveProperty("execute");
        expect(typeof tool.execute).toBe("function");
      }
    }
  });

  it("each registered tool with label should have parameters and execute", () => {
    plugin.register(api);
    for (const [tool] of api.registerTool.mock.calls) {
      if (tool.label && !tool.name) {
        expect(tool).toHaveProperty("parameters");
        expect(tool).toHaveProperty("execute");
        expect(typeof tool.execute).toBe("function");
      }
    }
  });
});

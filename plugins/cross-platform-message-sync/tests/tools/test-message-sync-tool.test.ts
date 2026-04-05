import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/python-runner.ts", () => ({
  runPythonScript: vi.fn(),
}));

import { MessageSyncTool } from "../../src/tools/message-sync-tool.ts";

describe("MessageSyncTool", () => {
  let tool: MessageSyncTool;
  let runPythonScript: any;

  beforeEach(async () => {
    tool = new MessageSyncTool();
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockResolvedValue('{"success":true}');
  });

  it("should have correct metadata", () => {
    expect(tool.name).toBe("message_sync_quick");
    expect(tool.label).toBe("Quick Message Sync");
    expect(tool.parameters).toBeDefined();
  });

  it("should pass args to python script", async () => {
    await tool.execute("call-1", {
      raw_msg: "test msg",
      source: "weixin",
      targets: ["feishu", "qqbot"],
    });

    expect(runPythonScript).toHaveBeenCalledWith(
      expect.any(String),
      "unified_bridge.py",
      [
        "--source", "weixin",
        "--target", "feishu", "qqbot",
        "--msg", "test msg",
      ]
    );
  });
});

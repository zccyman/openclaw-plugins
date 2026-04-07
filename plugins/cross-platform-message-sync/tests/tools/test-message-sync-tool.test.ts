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

  it("should sync QQ reply message to other platforms", async () => {
    const qqReplyMsg = JSON.stringify({
      content: "[CQ:reply,id=67890]这是我的回复",
      sender_name: "张三",
      message: [
        { type: "reply", data: { id: "67890" } },
        { type: "text", data: { text: "这是我的回复" } },
      ],
      reply_content: "这是机器人的原始消息",
      reply_sender: "AI助手",
      timestamp: "15:30",
      message_type: "text",
    });

    await tool.execute("call-qq-reply", {
      raw_msg: qqReplyMsg,
      source: "qqbot",
      targets: ["feishu", "weixin"],
    });

    expect(runPythonScript).toHaveBeenCalledWith(
      expect.any(String),
      "unified_bridge.py",
      [
        "--source", "qqbot",
        "--target", "feishu", "weixin",
        "--msg", qqReplyMsg,
      ]
    );
  });
});

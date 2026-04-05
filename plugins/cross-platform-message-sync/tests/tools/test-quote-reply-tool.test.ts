import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/python-runner.ts", () => ({
  runPythonScript: vi.fn(),
}));

import { QuoteReplyTool } from "../../src/tools/quote-reply-tool.ts";

describe("QuoteReplyTool", () => {
  let runPythonScript: any;

  beforeEach(async () => {
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockClear();
    vi.mocked(runPythonScript).mockResolvedValue('{"ok":true,"topic_id":"T001"}');
  });

  it("should have correct metadata", () => {
    const tool = new QuoteReplyTool();
    expect(tool.name).toBe("quote_reply");
    expect(tool.label).toBe("Quote Reply");
  });

  it("should register a topic", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-1", {
      action: "register",
      agent_name: "A",
      topic: "A股分析",
      preview: "今天沪指收涨...",
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("register");
    expect(callArgs).toContain("--agent");
    expect(callArgs).toContain("A");
    expect(callArgs).toContain("--topic");
    expect(callArgs).toContain("A股分析");
  });

  it("should resolve topic from reply", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-2", {
      action: "resolve",
      user_reply: "> 引用自: 【A】\n\n好的",
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("resolve");
    expect(callArgs).toContain("--reply");
  });

  it("should list active topics", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-3", { action: "list" });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("list");
  });

  it("should close a topic", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-4", {
      action: "close",
      topic_id: "T001",
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("close");
    expect(callArgs).toContain("--topic-id");
    expect(callArgs).toContain("T001");
  });
});

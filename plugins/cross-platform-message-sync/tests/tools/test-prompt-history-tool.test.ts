import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/python-runner.ts", () => ({
  runPythonScript: vi.fn(),
}));

import {
  PromptHistoryListTool,
  PromptHistorySearchTool,
  PromptHistoryGetTool,
  PromptHistoryReuseTool,
} from "../../src/tools/prompt-history-tool.ts";

describe("PromptHistoryTools", () => {
  let runPythonScript: any;

  beforeEach(async () => {
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockClear();
    vi.mocked(runPythonScript).mockResolvedValue('{"entries":[],"total":0}');
  });

  describe("PromptHistoryListTool", () => {
    it("should call list without tag", async () => {
      const tool = new PromptHistoryListTool();
      await tool.execute("call-1", {});

      expect(runPythonScript).toHaveBeenCalledWith(
        expect.any(String),
        "prompt_history.py",
        expect.arrayContaining(["list"])
      );
      const callArgs = runPythonScript.mock.calls[0][2];
      expect(callArgs).toContain("--history-file");
    });

    it("should include tag when provided", async () => {
      const tool = new PromptHistoryListTool();
      await tool.execute("call-2", { tag: "dev" });

      const callArgs = runPythonScript.mock.calls[0][2];
      expect(callArgs).toContain("--tag");
      expect(callArgs).toContain("dev");
    });
  });

  describe("PromptHistorySearchTool", () => {
    it("should include query and limit", async () => {
      const tool = new PromptHistorySearchTool();
      await tool.execute("call-3", { query: "test", limit: 5 });

      const callArgs = runPythonScript.mock.calls[0][2];
      expect(callArgs).toContain("--query");
      expect(callArgs).toContain("test");
      expect(callArgs).toContain("--limit");
      expect(callArgs).toContain("5");
    });
  });

  describe("PromptHistoryGetTool", () => {
    it("should get prompt by id", async () => {
      const tool = new PromptHistoryGetTool();
      await tool.execute("call-4", { id: "prompt-0001" });

      const callArgs = runPythonScript.mock.calls[0][2];
      expect(callArgs).toContain("--id");
      expect(callArgs).toContain("prompt-0001");
    });
  });

  describe("PromptHistoryReuseTool", () => {
    it("should reuse prompt by id", async () => {
      const tool = new PromptHistoryReuseTool();
      await tool.execute("call-5", { id: "prompt-0001" });

      const callArgs = runPythonScript.mock.calls[0][2];
      expect(callArgs).toContain("reuse");
      expect(callArgs).toContain("--id");
    });
  });
});

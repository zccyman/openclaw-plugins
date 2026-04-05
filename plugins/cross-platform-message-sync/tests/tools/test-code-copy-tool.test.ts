import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/python-runner.ts", () => ({
  runPythonScript: vi.fn(),
}));

import { CodeCopyRenderTool } from "../../src/tools/code-copy-tool.ts";

describe("CodeCopyRenderTool", () => {
  let runPythonScript: any;

  beforeEach(async () => {
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockClear();
    vi.mocked(runPythonScript).mockResolvedValue('rendered code output');
  });

  it("should have correct metadata", () => {
    const tool = new CodeCopyRenderTool();
    expect(tool.name).toBe("code_copy_render");
    expect(tool.label).toBe("Code Copy Render");
  });

  it("should render code blocks for feishu", async () => {
    const tool = new CodeCopyRenderTool();
    const result = await tool.execute("call-1", {
      content: "```python\nprint('hi')\n```",
      platform: "feishu",
    });

    expect(runPythonScript).toHaveBeenCalledWith(
      expect.any(String),
      "code_render.py",
      ["render-code", "--content", "```python\nprint('hi')\n```", "--platform", "feishu"]
    );
    expect(result.content[0].text).toContain("Code blocks rendered");
  });

  it("should render code blocks for weixin", async () => {
    const tool = new CodeCopyRenderTool();
    await tool.execute("call-2", {
      content: "test code",
      platform: "weixin",
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs).toContain("--platform");
    expect(callArgs).toContain("weixin");
  });
});

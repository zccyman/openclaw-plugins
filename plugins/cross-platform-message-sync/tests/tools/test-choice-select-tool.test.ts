import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/python-runner.ts", () => ({
  runPythonScript: vi.fn(),
}));

import { ChoiceSelectTool, ChoiceRenderTool } from "../../src/tools/choice-select-tool.ts";

describe("ChoiceSelectTool", () => {
  let runPythonScript: any;

  beforeEach(async () => {
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockClear();
  });

  it("should have correct metadata", () => {
    const tool = new ChoiceSelectTool();
    expect(tool.name).toBe("choice_select");
    expect(tool.label).toBe("Choice Select");
  });

  it("should parse single choice", async () => {
    vi.mocked(runPythonScript).mockResolvedValue(
      '{"selected":["A"],"confidence":"high","multi":false}'
    );
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-1", {
      reply_text: "A",
      expected_options: ["A", "B", "C"],
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("parse");
    expect(callArgs).toContain("--reply");
    expect(callArgs).toContain("--options");
    expect(result.content[0].text).toContain("Choice parsed");
  });

  it("should parse multi choice with separator", async () => {
    vi.mocked(runPythonScript).mockResolvedValue(
      '{"selected":["A","C"],"confidence":"high","multi":true}'
    );
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-2", {
      reply_text: "A和C",
      expected_options: ["A", "B", "C"],
    });

    expect(result.content[0].text).toContain("Choice parsed");
    expect(result.content[0].text).toContain('"multi":true');
  });

  it("should parse range selection", async () => {
    vi.mocked(runPythonScript).mockResolvedValue(
      '{"selected":["A","B","C"],"confidence":"high","multi":true}'
    );
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-3", {
      reply_text: "A到C",
      expected_options: ["A", "B", "C", "D"],
    });

    expect(result.content[0].text).toContain("Choice parsed");
    expect(result.content[0].text).toContain('"multi":true');
  });
});

describe("ChoiceRenderTool", () => {
  let runPythonScript: any;

  beforeEach(async () => {
    const mod = await import("../../src/tools/python-runner.ts");
    runPythonScript = mod.runPythonScript as any;
    vi.mocked(runPythonScript).mockClear();
    vi.mocked(runPythonScript).mockResolvedValue('rendered options output');
  });

  it("should have correct metadata", () => {
    const tool = new ChoiceRenderTool();
    expect(tool.name).toBe("choice_render");
    expect(tool.label).toBe("Choice Render");
  });

  it("should render options for feishu", async () => {
    const tool = new ChoiceRenderTool();
    await tool.execute("call-4", {
      content: "A. 金融\nB. 半导体",
      platform: "feishu",
    });

    const callArgs = runPythonScript.mock.calls[0][2];
    expect(callArgs[0]).toBe("render");
    expect(callArgs).toContain("--platform");
    expect(callArgs).toContain("feishu");
  });

  it("should render 3+ options with multi-select hint", async () => {
    vi.mocked(runPythonScript).mockResolvedValue(
      'rendered with 可多选 hint'
    );
    const tool = new ChoiceRenderTool();
    const result = await tool.execute("call-5", {
      content: "A. 金融\nB. 半导体\nC. 新能源",
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("Options rendered");
  });
});

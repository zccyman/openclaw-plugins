import { describe, it, expect } from "vitest";

import { ChoiceSelectTool, ChoiceRenderTool } from "../../src/tools/choice-select-tool.ts";

describe("ChoiceSelectTool", () => {
  it("should have correct metadata", () => {
    const tool = new ChoiceSelectTool();
    expect(tool.name).toBe("choice_select");
    expect(tool.label).toBe("Choice Select");
  });

  it("should parse single letter choice", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-1", {
      reply_text: "A",
      expected_options: ["A", "B", "C"],
    });

    expect(result.content[0].text).toContain("Choice parsed");
    const body = result.content[0].text.replace("📋 Choice parsed:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.selected).toEqual(["A"]);
    expect(parsed.confidence).toBe("high");
  });

  it("should parse multi choice with separator", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-2", {
      reply_text: "A和C",
      expected_options: ["A", "B", "C"],
    });

    const body = result.content[0].text.replace("📋 Choice parsed:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.selected).toEqual(["A", "C"]);
    expect(parsed.multi).toBe(true);
  });

  it("should parse range selection A到C", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-3", {
      reply_text: "A到C",
      expected_options: ["A", "B", "C", "D"],
    });

    const body = result.content[0].text.replace("📋 Choice parsed:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.selected).toEqual(["A", "B", "C"]);
    expect(parsed.multi).toBe(true);
  });

  it("should parse Chinese ordinal", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-4", {
      reply_text: "第一和第三",
      expected_options: ["1", "2", "3"],
    });

    const body = result.content[0].text.replace("📋 Choice parsed:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.selected).toEqual(["1", "3"]);
    expect(parsed.multi).toBe(true);
  });

  it("should return error for unparseable input", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-5", {
      reply_text: "xyzzy",
      expected_options: ["A", "B", "C"],
    });

    expect(result.content[0].text).toContain("Could not parse choice");
  });

  it("should parse 'pick AB' as multi letter selection", async () => {
    const tool = new ChoiceSelectTool();
    const result = await tool.execute("call-6", {
      reply_text: "pick AB",
      expected_options: ["A", "B", "C"],
    });

    const body = result.content[0].text.replace("📋 Choice parsed:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.selected).toEqual(["A", "B"]);
    expect(parsed.multi).toBe(true);
  });
});

describe("ChoiceRenderTool", () => {
  it("should have correct metadata", () => {
    const tool = new ChoiceRenderTool();
    expect(tool.name).toBe("choice_render");
    expect(tool.label).toBe("Choice Render");
  });

  it("should render options for feishu with click hint", async () => {
    const tool = new ChoiceRenderTool();
    const result = await tool.execute("call-4", {
      content: "A. 金融\nB. 半导体",
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("Options rendered for feishu");
    expect(result.content[0].text).toContain("点击对应选项");
  });

  it("should render 3+ options with multi-select hint", async () => {
    const tool = new ChoiceRenderTool();
    const result = await tool.execute("call-5", {
      content: "A. 金融\nB. 半导体\nC. 新能源",
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("可多选");
  });

  it("should render options for weixin with reply hint", async () => {
    const tool = new ChoiceRenderTool();
    const result = await tool.execute("call-6", {
      content: "1. 选项1\n2. 选项2",
      platform: "weixin",
    });

    expect(result.content[0].text).toContain("请回复选项编号");
  });

  it("should render options for qq", async () => {
    const tool = new ChoiceRenderTool();
    const result = await tool.execute("call-7", {
      content: "A. 红色\nB. 蓝色",
      platform: "qqbot",
    });

    expect(result.content[0].text).toContain("发送选项编号");
  });
});

import { describe, it, expect } from "vitest";

import { CodeCopyRenderTool } from "../../src/tools/code-copy-tool.ts";

describe("CodeCopyRenderTool", () => {
  it("should have correct metadata", () => {
    const tool = new CodeCopyRenderTool();
    expect(tool.name).toBe("code_copy_render");
    expect(tool.label).toBe("Code Copy Render");
  });

  it("should render fenced code blocks for feishu", async () => {
    const tool = new CodeCopyRenderTool();
    const result = await tool.execute("call-1", {
      content: "```python\nprint('hi')\n```",
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("Code blocks rendered for feishu");
    expect(result.content[0].text).toContain("点击代码块右上角");
  });

  it("should render code blocks for weixin with long-press hint", async () => {
    const tool = new CodeCopyRenderTool();
    const result = await tool.execute("call-2", {
      content: "```js\nconsole.log(1)\n```",
      platform: "weixin",
    });

    expect(result.content[0].text).toContain("长按代码块");
  });

  it("should render code blocks for qq with copy hint", async () => {
    const tool = new CodeCopyRenderTool();
    const result = await tool.execute("call-3", {
      content: "```ts\nconst x = 1;\n```",
      platform: "qq",
    });

    expect(result.content[0].text).toContain("长按代码块 → 复制");
  });

  it("should return original text when no code blocks", async () => {
    const tool = new CodeCopyRenderTool();
    const result = await tool.execute("call-4", {
      content: "just plain text",
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("just plain text");
  });

  it("should handle multiple code blocks", async () => {
    const tool = new CodeCopyRenderTool();
    const input = "```python\na=1\n```\nSome text\n```js\nb=2\n```";
    const result = await tool.execute("call-5", {
      content: input,
      platform: "feishu",
    });

    expect(result.content[0].text).toContain("code-1");
    expect(result.content[0].text).toContain("code-2");
  });
});

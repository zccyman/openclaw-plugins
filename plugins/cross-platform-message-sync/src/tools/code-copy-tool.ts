import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`\n]+)`/g;

interface CodeBlock {
  language: string;
  code: string;
  start: number;
  end: number;
  lineCount: number;
}

interface InlineCode {
  code: string;
  start: number;
  end: number;
}

function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  CODE_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "",
      code: match[2],
      start: match.index,
      end: match.index + match[0].length,
      lineCount: match[2].split("\n").length,
    });
  }
  return blocks;
}

function extractInlineCode(text: string): InlineCode[] {
  const codes: InlineCode[] = [];
  INLINE_CODE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
    codes.push({
      code: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return codes;
}

function renderCodeBlockFeishu(lang: string, code: string, blockIndex: number): string {
  return `\`\`\`${lang}\n${code}\n\`\`\`\n📋 _[code-${blockIndex + 1}] 点击代码块右上角「复制」按钮即可一键复制_`;
}

function renderCodeBlockWeixin(lang: string, code: string, blockIndex: number): string {
  return `\`\`\`${lang}\n${code}\n\`\`\`\n📋 _[code-${blockIndex + 1}] 长按代码块 → 全选 → 复制_`;
}

function renderCodeBlockQq(lang: string, code: string, blockIndex: number): string {
  return `\`\`\`${lang}\n${code}\n\`\`\`\n📋 _[code-${blockIndex + 1}] 长按代码块 → 复制_`;
}

const RENDERERS: Record<string, (lang: string, code: string, blockIndex: number) => string> = {
  feishu: renderCodeBlockFeishu,
  weixin: renderCodeBlockWeixin,
  qq: renderCodeBlockQq,
  qqbot: renderCodeBlockQq,
};

function renderWithCopyHint(text: string, platform: string): string {
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) {
    const inlineCodes = extractInlineCode(text);
    if (inlineCodes.length === 0) {
      return text;
    }
    let result = text;
    let offset = 0;
    for (const inline of inlineCodes) {
      const adjustedStart = inline.start + offset;
      const adjustedEnd = inline.end + offset;
      const replacement = `\`${inline.code}\``;
      result = result.slice(0, adjustedStart) + replacement + result.slice(adjustedEnd);
      offset += replacement.length - (adjustedEnd - adjustedStart);
    }
    return result;
  }

  const renderer = RENDERERS[platform] ?? RENDERERS["feishu"];
  let result = text;
  let offset = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const adjustedStart = block.start + offset;
    const adjustedEnd = block.end + offset;
    const rendered = renderer(block.language, block.code, i);
    result = result.slice(0, adjustedStart) + rendered + result.slice(adjustedEnd);
    offset += rendered.length - (block.end - block.start);
  }
  return result;
}

export class CodeCopyRenderTool implements AnyAgentTool {
  name = "code_copy_render";
  label = "Code Copy Render";
  description = "Render code blocks in a message with one-click copy hints for the specified platform. Returns the enhanced message text.";
  parameters = z.object({
    content: z.string().describe("Message content containing code blocks"),
    platform: z.enum(["feishu", "weixin", "qq", "qqbot"]).describe("Target platform for rendering"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const result = renderWithCopyHint(input.content, input.platform);
      return {
        content: [{ type: "text", text: `✅ Code blocks rendered for ${input.platform}:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Code render failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

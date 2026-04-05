import { z } from "zod";
import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

export class ChoiceSelectTool implements AnyAgentTool {
  name = "choice_select";
  label = "Choice Select";
  description = "Parse a user's choice reply for single or multi selection (A/B/C or 1/2/3). Returns selected keys as array, confidence level, and whether multi-select was detected.";
  parameters = z.object({
    reply_text: z.string().describe("User's reply text to parse"),
    expected_options: z.array(z.string()).optional().describe("Expected option keys (e.g. ['A','B','C'] or ['1','2','3'])"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const args = [
        "parse",
        "--reply", input.reply_text,
      ];
      if (input.expected_options && input.expected_options.length > 0) {
        args.push("--options", input.expected_options.join(","));
      }

      const result = await runPythonScript(pluginRoot, "choice_render.py", args);

      return {
        content: [{ type: "text", text: `📋 Choice parsed:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Choice parse failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export class ChoiceRenderTool implements AnyAgentTool {
  name = "choice_render";
  label = "Choice Render";
  description = "Render a message containing multiple options with platform-specific interaction hints (click-to-confirm for Feishu, reply-to-confirm for WeChat/QQ).";
  parameters = z.object({
    content: z.string().describe("Message content containing options (A. B. C. or 1. 2. 3.)"),
    platform: z.enum(["feishu", "weixin", "qq", "qqbot"]).describe("Target platform"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const args = [
        "render",
        "--content", input.content,
        "--platform", input.platform,
      ];

      const result = await runPythonScript(pluginRoot, "choice_render.py", args);

      return {
        content: [{ type: "text", text: `✅ Options rendered for ${input.platform}:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Choice render failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

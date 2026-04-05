import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";

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
      const pluginRoot = process.cwd();
      const args = [
        "render-code",
        "--content", input.content,
        "--platform", input.platform,
      ];
      const result = await runPythonScript(pluginRoot, "code_render.py", args);

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

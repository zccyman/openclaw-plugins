import { z } from "zod";
import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

export class MessageSyncTool implements AnyAgentTool {
  name = "message_sync_quick";
  label = "Quick Message Sync";
  description = "Quickly sync a message across WeChat/QQ/Feishu using the unified bridge. Pass raw message text, source platform, and target platforms.";
  parameters = z.object({
    raw_msg: z.string().describe("Raw message text (plain text)"),
    source: z.enum(["weixin", "qqbot", "feishu"]).describe("Source platform"),
    targets: z.array(z.enum(["weixin", "qqbot", "feishu"])).describe("Target platforms to forward to"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const args = [
        "--source", input.source,
        "--target", ...input.targets,
        "--msg", input.raw_msg,
      ];

      const pluginRoot = process.cwd();
      const result = await runPythonScript(pluginRoot, "unified_bridge.py", args);

      return {
        content: [{ type: "text", text: `✅ Message synced to ${input.targets.join(", ")}` }],
        details: JSON.parse(result),
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Sync failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

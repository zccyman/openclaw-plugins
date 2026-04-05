import { z } from "zod";
import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

export class AtMentionStatusTool implements AnyAgentTool {
  name = "at_mention_status";
  label = "@ Mention Router Status";
  description = "Show @-mention router configuration and statistics.";
  parameters = z.object({});

  async execute(_toolCallId: string, _input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const result = await runPythonScript(pluginRoot, "at_mention_router.py", ["status"]);

      return {
        content: [{ type: "text", text: `📊 @Mention Router Status:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Status check failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

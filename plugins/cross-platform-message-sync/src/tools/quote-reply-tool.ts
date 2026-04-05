import { z } from "zod";
import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

export class QuoteReplyTool implements AnyAgentTool {
  name = "quote_reply";
  label = "Quote Reply";
  description = "Manage quote-reply for sub-agent conversations. Register topics, resolve topics from user replies, or list active topics.";
  parameters = z.object({
    action: z.enum(["register", "resolve", "list", "close"]).describe("Action: register a new topic, resolve from reply, list active topics, or close a topic"),
    agent_name: z.string().optional().describe("Agent name (for register)"),
    topic: z.string().optional().describe("Topic name (for register)"),
    message_id: z.string().optional().describe("Original message ID (for register)"),
    preview: z.string().optional().describe("Preview text (for register)"),
    user_reply: z.string().optional().describe("User reply text (for resolve)"),
    topic_id: z.string().optional().describe("Topic ID (for close)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      let args: string[] = [];

      if (input.action === "register") {
        args = [
          "register",
          "--agent", input.agent_name || "",
          "--topic", input.topic || "",
          "--message-id", input.message_id || "",
          "--preview", input.preview || "",
        ];
      } else if (input.action === "resolve") {
        args = [
          "resolve",
          "--reply", input.user_reply || "",
        ];
      } else if (input.action === "list") {
        args = ["list"];
      } else if (input.action === "close") {
        args = [
          "close",
          "--topic-id", input.topic_id || "",
        ];
      }

      const result = await runPythonScript(pluginRoot, "message_quote.py", args);

      return {
        content: [{ type: "text", text: `📎 Quote reply result:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Quote reply failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

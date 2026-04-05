import { z } from "zod";
import { runPythonScript } from "./python-runner.js";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

export class PromptHistoryListTool implements AnyAgentTool {
  name = "prompt_history_list";
  label = "List Prompt History";
  description = "List saved prompt history entries. Optionally filter by tag.";
  parameters = z.object({
    tag: z.string().optional().describe("Optional tag filter"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const historyPath = `${pluginRoot}/data/prompt-history.json`;
      const args = ["--history-file", historyPath, "list", ...(input.tag ? ["--tag", input.tag] : [])];
      const result = await runPythonScript(pluginRoot, "prompt_history.py", args);

      return {
        content: [{ type: "text", text: `📜 Prompt History:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ List failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export class PromptHistorySearchTool implements AnyAgentTool {
  name = "prompt_history_search";
  label = "Search Prompt History";
  description = "Search prompt history by keyword or semantic query.";
  parameters = z.object({
    query: z.string().describe("Search query"),
    limit: z.number().int().positive().optional().describe("Max results (default: 10)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const historyPath = `${pluginRoot}/data/prompt-history.json`;
      const args = ["--history-file", historyPath, "search", "--query", input.query, "--limit", String(input.limit || 10)];
      const result = await runPythonScript(pluginRoot, "prompt_history.py", args);

      return {
        content: [{ type: "text", text: `🔍 Search results:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Search failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export class PromptHistoryGetTool implements AnyAgentTool {
  name = "prompt_history_get";
  label = "Get Prompt by ID";
  description = "Get a specific prompt by its ID.";
  parameters = z.object({
    id: z.string().describe("Prompt entry ID to retrieve"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const historyPath = `${pluginRoot}/data/prompt-history.json`;
      const result = await runPythonScript(pluginRoot, "prompt_history.py", ["--history-file", historyPath, "get", "--id", input.id]);

      return {
        content: [{ type: "text", text: `📋 Prompt (${input.id}):\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Get failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export class PromptHistoryReuseTool implements AnyAgentTool {
  name = "prompt_history_reuse";
  label = "Reuse Prompt";
  description = "Reuse a historical prompt and return it formatted for easy copy-paste.";
  parameters = z.object({
    id: z.string().describe("Prompt entry ID to reuse"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const pluginRoot = process.cwd();
      const historyPath = `${pluginRoot}/data/prompt-history.json`;
      const result = await runPythonScript(pluginRoot, "prompt_history.py", ["--history-file", historyPath, "reuse", "--id", input.id]);

      return {
        content: [{ type: "text", text: `📑 Reusable prompt (copy below):\n\`\`\`\n${result}\n\`\`\`` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Reuse failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

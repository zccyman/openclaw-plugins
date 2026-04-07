import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

interface PromptEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: string;
  use_count: number;
  last_reused?: string;
}

interface HistoryData {
  entries: PromptEntry[];
}

function getHistoryPath(): string {
  return join(process.cwd(), "data", "prompt-history.json");
}

function loadHistory(historyPath: string): PromptEntry[] {
  if (!existsSync(historyPath)) {
    return [];
  }
  const raw = readFileSync(historyPath, "utf-8");
  const data: HistoryData = JSON.parse(raw);
  return data.entries || [];
}

function saveHistory(entries: PromptEntry[], historyPath: string): void {
  const data: HistoryData = { entries };
  writeFileSync(historyPath, JSON.stringify(data, null, 2), "utf-8");
}

function findEntry(entries: PromptEntry[], entryId: string): PromptEntry | undefined {
  let match = entries.find((e) => e.id === entryId);
  if (!match) {
    try {
      const num = parseInt(entryId, 10);
      const formatted = `prompt-${String(num).padStart(4, "0")}`;
      match = entries.find((e) => e.id === formatted);
    } catch {
      // not a numeric id
    }
  }
  return match;
}

export class PromptHistoryListTool implements AnyAgentTool {
  name = "prompt_history_list";
  label = "List Prompt History";
  description = "List saved prompt history entries. Optionally filter by tag.";
  parameters = z.object({
    tag: z.string().optional().describe("Optional tag filter"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const historyPath = getHistoryPath();
      const entries = loadHistory(historyPath);
      let filtered = entries;
      if (input.tag) {
        filtered = entries.filter((e) => e.tags && e.tags.includes(input.tag!));
      }
      const result = filtered.slice(-50).reverse().map((e) => ({
        id: e.id,
        title: e.title,
        tags: e.tags,
        created: e.created,
        use_count: e.use_count,
      }));
      const output = JSON.stringify({ entries: result, total: filtered.length });

      return {
        content: [{ type: "text", text: `📜 Prompt History:\n${output}` }],
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
      const historyPath = getHistoryPath();
      const entries = loadHistory(historyPath);
      const query = input.query.toLowerCase();
      const limit = input.limit || 10;

      const scored = entries
        .map((entry) => {
          let score = 0;
          if (entry.title && entry.title.toLowerCase().includes(query)) {
            score += 10;
          }
          if (entry.content && entry.content.toLowerCase().includes(query)) {
            score += 5;
          }
          if (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(query))) {
            score += 3;
          }
          return { entry, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.entry);

      const output = JSON.stringify({ results: scored, total: scored.length });

      return {
        content: [{ type: "text", text: `🔍 Search results:\n${output}` }],
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
      const historyPath = getHistoryPath();
      const entries = loadHistory(historyPath);
      const entry = findEntry(entries, input.id);
      if (!entry) {
        throw new Error(`Entry not found: ${input.id}`);
      }
      const result = JSON.stringify(entry);

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
      const historyPath = getHistoryPath();
      const entries = loadHistory(historyPath);
      const entry = findEntry(entries, input.id);
      if (!entry) {
        throw new Error(`Entry not found: ${input.id}`);
      }
      entry.use_count += 1;
      entry.last_reused = new Date().toISOString().replace("T", " ").substring(0, 16);
      saveHistory(entries, historyPath);

      const result = JSON.stringify({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        use_count: entry.use_count,
      });

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

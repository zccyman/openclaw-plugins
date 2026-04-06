import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { MemorySearchParams, MemoryCategory, MemoryFact } from "../types.js";
import { MemoryRuntimeAdapter } from "../memory/runtime-adapter.js";

export function createSearchMemoryTool(memoryAdapter: MemoryRuntimeAdapter): AnyAgentTool {
  return {
    name: "search_memory",
    description: "Search long-term memory for facts, preferences, and context from previous sessions.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", enum: ["preference", "knowledge", "context", "behavior", "goal"], description: "Optional category filter" },
        limit: { type: "number", description: "Max results (default: 15)" },
      },
      required: ["query"],
    },
    execute: async (args: MemorySearchParams) => {
      const results = await memoryAdapter.search({
        query: args.query,
        category: args.category as MemoryCategory | undefined,
        limit: args.limit,
      });
      return formatMemoryResults(results);
    },
  };
}

export function createRememberTool(memoryAdapter: MemoryRuntimeAdapter): AnyAgentTool {
  return {
    name: "remember",
    description: "Store a fact, preference, or piece of context to long-term memory for future sessions.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Fact or preference to store" },
        category: { type: "string", enum: ["preference", "knowledge", "context", "behavior", "goal"], description: "Category" },
        confidence: { type: "number", description: "Confidence 0-1 (default: 0.8)" },
      },
      required: ["content", "category"],
    },
    execute: async (args: { content: string; category: string; confidence?: number }) => {
      const fact = await memoryAdapter.store({
        content: args.content,
        category: args.category as MemoryCategory,
        confidence: args.confidence ?? 0.8,
        source: "conversation",
      });
      return `Stored memory: [${fact.category}] ${fact.content} (id: ${fact.id})`;
    },
  };
}

function formatMemoryResults(facts: MemoryFact[]): string {
  if (facts.length === 0) return "No relevant memories found.";

  const lines = facts.map((f) => `- [${f.category}] ${f.content} (confidence: ${f.confidence.toFixed(2)})`);
  return `Found ${facts.length} relevant memories:\n${lines.join("\n")}`;
}

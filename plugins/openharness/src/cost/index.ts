import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface UsageEntry {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  turnNumber: number;
}

interface SessionUsage {
  sessionId: string;
  entries: UsageEntry[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalTurns: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-20250514": { input: 0.000003, output: 0.000015, cacheRead: 0.0000003, cacheWrite: 0.00000375 },
  "claude-opus-4-20250514": { input: 0.000015, output: 0.000075, cacheRead: 0.0000015, cacheWrite: 0.00001875 },
  "claude-haiku-3-5-20241022": { input: 0.0000008, output: 0.000004, cacheRead: 0.00000008, cacheWrite: 0.000001 },
  "kimi-k2.5": { input: 0.000001, output: 0.000004, cacheRead: 0.0000001, cacheWrite: 0.000001 },
  "qwen3.5-flash": { input: 0.0000005, output: 0.000002, cacheRead: 0, cacheWrite: 0 },
  "gpt-4o": { input: 0.0000025, output: 0.00001, cacheRead: 0.00000025, cacheWrite: 0.0000025 },
};

const FAST_MODEL = process.env.OPENHARNESS_FAST_MODEL || "kimi-k2.5";
const DEFAULT_MODEL = process.env.OPENHARNESS_MODEL || "claude-sonnet-4-20250514";

async function loadUsageLog(): Promise<UsageEntry[]> {
  const logPath = path.join(process.env.HOME || "~", ".openharness", "data", "cost", "usage.json");
  try {
    return JSON.parse(await fs.readFile(logPath, "utf-8"));
  } catch {
    return [];
  }
}

async function saveUsageLog(entries: UsageEntry[]) {
  const logPath = path.join(process.env.HOME || "~", ".openharness", "data", "cost", "usage.json");
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.writeFile(logPath, JSON.stringify(entries, null, 2));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function calculateCost(inputTokens: number, outputTokens: number, model: string, cacheRead = 0, cacheWrite = 0): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  return inputTokens * pricing.input + outputTokens * pricing.output + cacheRead * pricing.cacheRead + cacheWrite * pricing.cacheWrite;
}

export function registerCost(api: any) {
    api.registerTool({
      name: "oh_cost_track",
      label: "Track Cost",
      description: "Record a token usage entry and calculate the cost. Use after each model response to track spending.",
      parameters: Type.Object({
        input_tokens: Type.Number({ description: "Number of input tokens used" }),
        output_tokens: Type.Number({ description: "Number of output tokens used" }),
        model: Type.Optional(Type.String({ description: "Model used (default: current model)" })),
        cache_read_tokens: Type.Optional(Type.Number({ description: "Cache read tokens" })),
        cache_write_tokens: Type.Optional(Type.Number({ description: "Cache write tokens" })),
        turn_number: Type.Optional(Type.Number({ description: "Conversation turn number" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const model = params.model || DEFAULT_MODEL;
        const cost = calculateCost(params.input_tokens, params.output_tokens, model, params.cache_read_tokens || 0, params.cache_write_tokens || 0);

        const entry: UsageEntry = {
          timestamp: new Date().toISOString(),
          model,
          inputTokens: params.input_tokens,
          outputTokens: params.output_tokens,
          cacheReadTokens: params.cache_read_tokens || 0,
          cacheWriteTokens: params.cache_write_tokens || 0,
          cost,
          turnNumber: params.turn_number || 0,
        };

        const log = await loadUsageLog();
        log.push(entry);
        await saveUsageLog(log);

        return {
          content: [{ type: "text" as const, text: `Cost tracked: $${cost.toFixed(6)}\nModel: ${model}\nInput: ${params.input_tokens.toLocaleString()} tokens\nOutput: ${params.output_tokens.toLocaleString()} tokens\nCache Read: ${params.cache_read_tokens || 0}\nCache Write: ${params.cache_write_tokens || 0}\nTurn: ${params.turn_number || 0}` }],
          details: { success: true, cost, model },
        };
      },
    });

    api.registerTool({
      name: "oh_cost_summary",
      label: "Cost Summary",
      description: "Get a summary of token usage and costs for the current session and total.",
      parameters: Type.Object({
        period: Type.Optional(Type.String({ description: "Time period", enum: ["session", "today", "week", "month", "all"], default: "all" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const log = await loadUsageLog();
        const period = params.period || "all";

        let filtered = log;
        const now = new Date();
        if (period === "today") {
          const today = now.toISOString().split("T")[0];
          filtered = log.filter((e) => e.timestamp.startsWith(today));
        } else if (period === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = log.filter((e) => new Date(e.timestamp) >= weekAgo);
        } else if (period === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = log.filter((e) => new Date(e.timestamp) >= monthAgo);
        }

        const totalInput = filtered.reduce((s, e) => s + e.inputTokens, 0);
        const totalOutput = filtered.reduce((s, e) => s + e.outputTokens, 0);
        const totalCost = filtered.reduce((s, e) => s + e.cost, 0);
        const totalCacheRead = filtered.reduce((s, e) => s + (e.cacheReadTokens || 0), 0);
        const totalCacheWrite = filtered.reduce((s, e) => s + (e.cacheWriteTokens || 0), 0);

        const byModel: Record<string, { count: number; cost: number; input: number; output: number }> = {};
        for (const e of filtered) {
          if (!byModel[e.model]) byModel[e.model] = { count: 0, cost: 0, input: 0, output: 0 };
          byModel[e.model].count++;
          byModel[e.model].cost += e.cost;
          byModel[e.model].input += e.inputTokens;
          byModel[e.model].output += e.outputTokens;
        }

        let output = `## Cost Summary (${period})\n\n`;
        output += `Total Cost: $${totalCost.toFixed(6)}\n`;
        output += `Total Tokens: ${(totalInput + totalOutput).toLocaleString()} (input: ${totalInput.toLocaleString()}, output: ${totalOutput.toLocaleString()})\n`;
        output += `Cache: ${totalCacheRead.toLocaleString()} read, ${totalCacheWrite.toLocaleString()} write\n`;
        output += `API Calls: ${filtered.length}\n\n`;

        if (Object.keys(byModel).length > 0) {
          output += `### By Model\n`;
          for (const [model, stats] of Object.entries(byModel)) {
            output += `- **${model}**: $${stats.cost.toFixed(6)} (${stats.count} calls, ${stats.input.toLocaleString()} in / ${stats.output.toLocaleString()} out)\n`;
          }
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true, totalCost, totalTokens: totalInput + totalOutput, callCount: filtered.length } };
      },
    });

    api.registerTool({
      name: "oh_model_set",
      label: "Set Model",
      description: "Switch the current model. Affects subsequent API calls.",
      parameters: Type.Object({
        model: Type.String({ description: "Model name to switch to" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const available = Object.keys(MODEL_PRICING);
        if (!available.includes(params.model)) {
          return { content: [{ type: "text" as const, text: `Model '${params.model}' not in known pricing table.\n\nAvailable models:\n${available.map((m) => `- ${m}`).join("\n")}\n\nYou can still use it, but cost tracking will use default pricing.` }], details: { success: true, warning: true } };
        }

        process.env.OPENHARNESS_MODEL = params.model;
        const pricing = MODEL_PRICING[params.model];
        return {
          content: [{ type: "text" as const, text: `Model switched to: ${params.model}\n\nPricing:\n  Input: $${pricing.input}/token\n  Output: $${pricing.output}/token\n  Cache Read: $${pricing.cacheRead}/token\n  Cache Write: $${pricing.cacheWrite}/token` }],
          details: { success: true, model: params.model },
        };
      },
    });

    api.registerTool({
      name: "oh_model_list",
      label: "List Models",
      description: "List available models with their pricing information.",
      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const current = process.env.OPENHARNESS_MODEL || DEFAULT_MODEL;
        let output = `## Available Models\n\nCurrent: **${current}**\n\n`;
        output += `| Model | Input ($/token) | Output ($/token) | Cache Read | Cache Write |\n`;
        output += `|-------|---------------|------------------|------------|-------------|\n`;
        for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
          const marker = model === current ? " ← current" : "";
          output += `| ${model}${marker} | ${pricing.input} | ${pricing.output} | ${pricing.cacheRead} | ${pricing.cacheWrite} |\n`;
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true, current, available: Object.keys(MODEL_PRICING).length } };
      },
    });

    api.registerTool({
      name: "oh_effort_set",
      label: "Set Reasoning Effort",
      description: "Set the reasoning effort level for the model. Higher effort = better quality but more tokens/cost.",
      parameters: Type.Object({
        level: Type.String({ description: "Effort level", enum: ["low", "medium", "high"] }),
      }),
      async execute(_toolCallId: string, params: any) {
        process.env.OPENHARNESS_EFFORT = params.level;
        const descriptions: Record<string, string> = {
          low: "Fast, cheap responses. Good for simple tasks and quick questions.",
          medium: "Balanced quality and cost. Default for most tasks.",
          high: "Deep reasoning. Best for complex problems, but uses more tokens.",
        };
        return { content: [{ type: "text" as const, text: `Reasoning effort set to: ${params.level}\n\n${descriptions[params.level]}` }], details: { success: true, level: params.level } };
      },
    });

    api.registerTool({
      name: "oh_passes_set",
      label: "Set Max Passes",
      description: "Set the maximum number of passes (iterations) for multi-pass reasoning.",
      parameters: Type.Object({
        count: Type.Number({ description: "Number of passes (1-8)" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const count = Math.min(8, Math.max(1, params.count));
        process.env.OPENHARNESS_PASSES = count.toString();
        return { content: [{ type: "text" as const, text: `Max passes set to: ${count}\n\nEach pass allows the model to refine its thinking. More passes = better quality but higher cost.` }], details: { success: true, count } };
      },
    });

    api.registerTool({
      name: "oh_usage_stats",
      label: "Usage Statistics",
      description: "Get detailed usage statistics including token counts, costs, and model breakdown.",
      parameters: Type.Object({
        period: Type.Optional(Type.String({ description: "Time period", enum: ["today", "week", "month", "all"], default: "all" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const log = await loadUsageLog();
        const period = params.period || "all";
        let filtered = log;

        if (period === "today") {
          const today = new Date().toISOString().split("T")[0];
          filtered = log.filter((e) => e.timestamp.startsWith(today));
        } else if (period === "week") {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          filtered = log.filter((e) => new Date(e.timestamp) >= weekAgo);
        } else if (period === "month") {
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          filtered = log.filter((e) => new Date(e.timestamp) >= monthAgo);
        }

        const totalInput = filtered.reduce((s, e) => s + e.inputTokens, 0);
        const totalOutput = filtered.reduce((s, e) => s + e.outputTokens, 0);
        const totalCost = filtered.reduce((s, e) => s + e.cost, 0);
        const avgInput = filtered.length > 0 ? Math.round(totalInput / filtered.length) : 0;
        const avgOutput = filtered.length > 0 ? Math.round(totalOutput / filtered.length) : 0;

        let output = `## Usage Statistics (${period})\n\n`;
        output += `API Calls: ${filtered.length}\n`;
        output += `Total Input Tokens: ${totalInput.toLocaleString()} (avg: ${avgInput.toLocaleString()}/call)\n`;
        output += `Total Output Tokens: ${totalOutput.toLocaleString()} (avg: ${avgOutput.toLocaleString()}/call)\n`;
        output += `Total Cost: $${totalCost.toFixed(6)}\n`;
        output += `Total Tokens: ${(totalInput + totalOutput).toLocaleString()}\n`;
        output += `Avg Cost/Call: $${filtered.length > 0 ? (totalCost / filtered.length).toFixed(6) : "0.000000"}\n`;

        return { content: [{ type: "text" as const, text: output }], details: { success: true, calls: filtered.length, totalCost } };
      },
    });

    api.registerTool({
      name: "oh_fast_mode",
      label: "Toggle Fast Mode",
      description: "Toggle between fast/cheap mode and normal mode. Fast mode uses a cheaper model for quicker responses.",
      parameters: Type.Object({
        enabled: Type.Optional(Type.Boolean({ description: "Enable fast mode (default: toggle current state)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const current = process.env.OPENHARNESS_MODEL || DEFAULT_MODEL;
        const isEnabled = params.enabled !== undefined ? params.enabled : current !== FAST_MODEL;

        if (isEnabled) {
          process.env.OPENHARNESS_MODEL = FAST_MODEL;
          return { content: [{ type: "text" as const, text: `Fast mode enabled.\nSwitched to: ${FAST_MODEL}\n\nThis model is faster and cheaper but may have lower quality.` }], details: { success: true, model: FAST_MODEL } };
        } else {
          process.env.OPENHARNESS_MODEL = DEFAULT_MODEL;
          return { content: [{ type: "text" as const, text: `Fast mode disabled.\nSwitched back to: ${DEFAULT_MODEL}` }], details: { success: true, model: DEFAULT_MODEL } };
        }
      },
    });
  }

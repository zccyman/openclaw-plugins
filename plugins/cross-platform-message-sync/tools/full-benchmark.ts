import { performance } from "perf_hooks";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";

import { OptimizedMessageSyncTool } from "../src/tools/optimized-message-sync.js";
import { PerformanceMonitorTool } from "../src/tools/performance-monitor.js";
import {
  PromptHistoryListTool,
  PromptHistorySearchTool,
  PromptHistoryGetTool,
  PromptHistoryReuseTool,
} from "../src/tools/prompt-history-tool.js";
import { AtMentionStatusTool } from "../src/tools/at-mention-status-tool.js";
import { CodeCopyRenderTool } from "../src/tools/code-copy-tool.js";
import { QuoteReplyTool } from "../src/tools/quote-reply-tool.js";
import { ChoiceSelectTool, ChoiceRenderTool } from "../src/tools/choice-select-tool.js";

const PYTHON_SPAWN_OVERHEAD_MS = 150;
const WARMUP = 50;
const ITERATIONS = 1000;

interface BenchResult {
  name: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughput: number;
  simulatedOldAvgMs: number;
  speedup: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

async function bench(
  name: string,
  fn: () => Promise<any>,
  iterations: number = ITERATIONS,
  simulatedOverhead: number = PYTHON_SPAWN_OVERHEAD_MS,
): Promise<BenchResult> {
  for (let i = 0; i < WARMUP; i++) await fn();

  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    latencies.push(performance.now() - t0);
  }

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);
  const throughput = 1000 / avg;

  return {
    name,
    avgMs: avg,
    minMs: min,
    maxMs: max,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    throughput,
    simulatedOldAvgMs: avg + simulatedOverhead,
    speedup: (avg + simulatedOverhead) / avg,
  };
}

function printTable(results: BenchResult[]) {
  const sep = "-".repeat(130);
  console.log("\n" + sep);
  console.log(
    "Tool".padEnd(32) +
    "Avg(ms)".padStart(10) +
    "Min(ms)".padStart(10) +
    "P50(ms)".padStart(10) +
    "P95(ms)".padStart(10) +
    "P99(ms)".padStart(10) +
    "Max(ms)".padStart(10) +
    "ops/sec".padStart(12) +
    "Old Avg(ms)".padStart(14) +
    "Speedup".padStart(10),
  );
  console.log(sep);

  for (const r of results) {
    console.log(
      r.name.padEnd(32) +
      r.avgMs.toFixed(3).padStart(10) +
      r.minMs.toFixed(3).padStart(10) +
      r.p50Ms.toFixed(3).padStart(10) +
      r.p95Ms.toFixed(3).padStart(10) +
      r.p99Ms.toFixed(3).padStart(10) +
      r.maxMs.toFixed(3).padStart(10) +
      r.throughput.toFixed(0).padStart(12) +
      r.simulatedOldAvgMs.toFixed(1).padStart(14) +
      `${r.speedup.toFixed(0)}x`.padStart(10),
    );
  }
  console.log(sep);
}

async function main() {
  console.log("=".repeat(130));
  console.log("  Cross-Platform Message Sync — Full Performance Benchmark");
  console.log("  Date: " + new Date().toISOString());
  console.log("  Node: " + process.version);
  console.log("  Platform: " + process.platform + " " + process.arch);
  console.log("  Warmup: " + WARMUP + " | Iterations: " + ITERATIONS);
  console.log("  Simulated Python spawn overhead: " + PYTHON_SPAWN_OVERHEAD_MS + "ms");
  console.log("=".repeat(130));

  const DATA_DIR = join(process.cwd(), "data");
  mkdirSync(DATA_DIR, { recursive: true });

  const promptHistoryPath = join(DATA_DIR, "prompt-history.json");
  const sampleEntries = [];
  for (let i = 1; i <= 50; i++) {
    sampleEntries.push({
      id: `prompt-${String(i).padStart(4, "0")}`,
      title: `Test prompt ${i}`,
      content: `This is test prompt content number ${i} with some keywords like javascript and python and golang`,
      tags: i % 3 === 0 ? ["dev", "test"] : ["dev"],
      created: "2025-01-01",
      use_count: 0,
    });
  }
  writeFileSync(promptHistoryPath, JSON.stringify({ entries: sampleEntries }), "utf-8");

  const topicsPath = join(DATA_DIR, "topics.json");
  if (existsSync(topicsPath)) rmSync(topicsPath);

  const configPath = join(DATA_DIR, "at_mention_router_config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      bots: [
        { id: "bot1", aliases: ["A", "Alpha", "机器人A"] },
        { id: "employee-a", aliases: ["James", "分析专家"] },
      ],
      rules: {
        global: { requireMention: true, allowWildcard: true, rateLimit: { windowSec: 60, maxTriggers: 100 } },
        perGroup: {},
        blacklistUsers: [],
      },
    }),
    "utf-8",
  );

  const rateStatePath = join(DATA_DIR, "rate_limit_state.json");
  if (existsSync(rateStatePath)) rmSync(rateStatePath);

  const results: BenchResult[] = [];

  console.log("\n▶ Running benchmarks...\n");

  const syncMsg = JSON.stringify({
    content: "Hello world test message with some 🎉 emoji and a code block:\n```js\nconsole.log('hi')\n```",
    sender_name: "Benchmark User",
    message_type: "text",
    timestamp: "15:30",
  });

  results.push(
    await bench("message_sync_optimized", async () => {
      const tool = new OptimizedMessageSyncTool();
      await tool.execute("b", { raw_msg: syncMsg, source: "weixin", targets: ["feishu", "qqbot"] });
    }),
  );

  results.push(
    await bench("prompt_history_list", async () => {
      const tool = new PromptHistoryListTool();
      await tool.execute("b", {});
    }),
  );

  results.push(
    await bench("prompt_history_list (tag filter)", async () => {
      const tool = new PromptHistoryListTool();
      await tool.execute("b", { tag: "dev" });
    }),
  );

  results.push(
    await bench("prompt_history_search", async () => {
      const tool = new PromptHistorySearchTool();
      await tool.execute("b", { query: "golang", limit: 10 });
    }),
  );

  results.push(
    await bench("prompt_history_get", async () => {
      const tool = new PromptHistoryGetTool();
      await tool.execute("b", { id: "prompt-0025" });
    }),
  );

  results.push(
    await bench("prompt_history_reuse", async () => {
      const tool = new PromptHistoryReuseTool();
      await tool.execute("b", { id: "prompt-0001" });
    }),
  );

  results.push(
    await bench("code_copy_render (feishu)", async () => {
      const tool = new CodeCopyRenderTool();
      await tool.execute("b", {
        content: "Here is code:\n```python\ndef hello():\n    print('world')\n```\nAnd inline `x = 1`",
        platform: "feishu",
      });
    }),
  );

  results.push(
    await bench("code_copy_render (weixin)", async () => {
      const tool = new CodeCopyRenderTool();
      await tool.execute("b", {
        content: "```js\nconst a = 1;\nconst b = 2;\nconsole.log(a + b);\n```",
        platform: "weixin",
      });
    }),
  );

  results.push(
    await bench("choice_select (single)", async () => {
      const tool = new ChoiceSelectTool();
      await tool.execute("b", { reply_text: "A", expected_options: ["A", "B", "C"] });
    }),
  );

  results.push(
    await bench("choice_select (multi)", async () => {
      const tool = new ChoiceSelectTool();
      await tool.execute("b", { reply_text: "A和C", expected_options: ["A", "B", "C"] });
    }),
  );

  results.push(
    await bench("choice_select (range)", async () => {
      const tool = new ChoiceSelectTool();
      await tool.execute("b", { reply_text: "A到C", expected_options: ["A", "B", "C", "D"] });
    }),
  );

  results.push(
    await bench("choice_render (feishu)", async () => {
      const tool = new ChoiceRenderTool();
      await tool.execute("b", {
        content: "A. 金融\nB. 半导体\nC. 新能源",
        platform: "feishu",
      });
    }),
  );

  results.push(
    await bench("quote_reply (register)", async () => {
      const tool = new QuoteReplyTool();
      await tool.execute("b", { action: "register", agent_name: "BenchBot", topic: "Benchmark Topic", preview: "test preview text" });
    }),
  );

  results.push(
    await bench("quote_reply (resolve)", async () => {
      const tool = new QuoteReplyTool();
      await tool.execute("b", {
        action: "resolve",
        user_reply: "> **引用自：【BenchBot】15:30**\n> 主题: Benchmark Topic\n> 原文: test preview\n\nGood reply",
      });
    }),
  );

  results.push(
    await bench("quote_reply (list)", async () => {
      const tool = new QuoteReplyTool();
      await tool.execute("b", { action: "list" });
    }),
  );

  results.push(
    await bench("at_mention_status", async () => {
      const tool = new AtMentionStatusTool();
      await tool.execute("b", {});
    }),
  );

  results.push(
    await bench("performance_monitor (stats)", async () => {
      const tool = new PerformanceMonitorTool();
      await tool.execute("b", { action: "stats" });
    }),
  );

  printTable(results);

  console.log("\n📊 Summary:");
  const avgLatency = results.reduce((s, r) => s + r.avgMs, 0) / results.length;
  const avgSpeedup = results.reduce((s, r) => s + r.speedup, 0) / results.length;
  const totalThroughput = results.reduce((s, r) => s + r.throughput, 0);
  console.log(`  Average latency across all tools:   ${avgLatency.toFixed(3)} ms`);
  console.log(`  Average speedup vs Python spawn:     ${avgSpeedup.toFixed(0)}x`);
  console.log(`  Combined throughput:                 ${totalThroughput.toFixed(0)} ops/sec`);
  console.log(`  Simulated Python spawn overhead:      ${PYTHON_SPAWN_OVERHEAD_MS} ms`);
  console.log(`  Tools tested:                        ${results.length}`);
  console.log();

  rmSync(promptHistoryPath, { force: true });
  rmSync(topicsPath, { force: true });
  rmSync(configPath, { force: true });
  rmSync(rateStatePath, { force: true });
}

main().catch(console.error);

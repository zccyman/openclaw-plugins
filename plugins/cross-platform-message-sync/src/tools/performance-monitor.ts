import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

// Performance metrics collector
class PerformanceMetrics {
  private static readonly RING_SIZE = 128;
  private ring = new Float64Array(PerformanceMetrics.RING_SIZE);
  private ringHead = 0;
  private ringCount = 0;
  private throughput = 0;
  private lastReset = Date.now();
  private errors = 0;

  recordSync(latencyMs: number, success: boolean = true): void {
    this.ring[this.ringHead] = latencyMs;
    this.ringHead = (this.ringHead + 1) & (PerformanceMetrics.RING_SIZE - 1);
    if (this.ringCount < PerformanceMetrics.RING_SIZE) this.ringCount++;
    if (success) {
      this.throughput++;
    } else {
      this.errors++;
    }
  }

  getStats(): {
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    throughput: number;
    errorRate: number;
    uptime: number;
  } {
    const uptime = Date.now() - this.lastReset;
    const n = this.ringCount;

    if (n === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        throughput: this.throughput,
        errorRate: this.errors / Math.max(this.throughput + this.errors, 1),
        uptime,
      };
    }

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = this.ring[i];
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    return {
      avgLatency: sum / n,
      maxLatency: max,
      minLatency: min,
      throughput: this.throughput,
      errorRate: this.errors / Math.max(this.throughput + this.errors, 1),
      uptime,
    };
  }

  reset(): void {
    this.ring.fill(0);
    this.ringHead = 0;
    this.ringCount = 0;
    this.throughput = 0;
    this.lastReset = Date.now();
    this.errors = 0;
  }
}

const metrics = new PerformanceMetrics();

// Performance monitoring tool
export class PerformanceMonitorTool implements AnyAgentTool {
  name = "performance_monitor";
  label = "Performance Monitor";
  description = "Monitor message sync performance metrics including latency and throughput.";
  parameters = z.object({
    action: z.enum(["stats", "reset"]).optional().describe("Action to perform (default: stats)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const action = input.action || "stats";

    if (action === "reset") {
      metrics.reset();
      return {
        content: [{ type: "text", text: "✅ Performance metrics reset" }],
      };
    }

    const stats = metrics.getStats();

    const report = `# 📊 Message Sync Performance Report

**Latency (ms):**
- Average: ${stats.avgLatency.toFixed(1)}
- Min: ${stats.minLatency.toFixed(1)}
- Max: ${stats.maxLatency.toFixed(1)}

**Throughput:**
- Messages synced: ${stats.throughput}
- Error rate: ${(stats.errorRate * 100).toFixed(1)}%

**Uptime:** ${Math.floor(stats.uptime / 1000)}s

**Status:** ${stats.errorRate < 0.1 ? "🟢 Good" : stats.errorRate < 0.3 ? "🟡 Warning" : "🔴 Critical"}`;

    return {
      content: [{ type: "text", text: report }],
    };
  }
}

// Export metrics recorder for use in sync tools
export function recordSyncPerformance(latencyMs: number, success: boolean = true): void {
  metrics.recordSync(latencyMs, success);
}
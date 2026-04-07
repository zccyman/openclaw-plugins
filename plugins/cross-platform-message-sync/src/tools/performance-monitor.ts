import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

// Performance metrics collector
class PerformanceMetrics {
  private metrics: {
    syncLatency: number[];
    throughput: number;
    lastReset: number;
    errors: number;
  } = {
    syncLatency: [],
    throughput: 0,
    lastReset: Date.now(),
    errors: 0,
  };

  recordSync(latencyMs: number, success: boolean = true): void {
    this.metrics.syncLatency.push(latencyMs);
    if (success) {
      this.metrics.throughput++;
    } else {
      this.metrics.errors++;
    }

    // Keep only last 100 measurements
    if (this.metrics.syncLatency.length > 100) {
      this.metrics.syncLatency = this.metrics.syncLatency.slice(-100);
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
    const latencies = this.metrics.syncLatency;
    const uptime = Date.now() - this.metrics.lastReset;

    if (latencies.length === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        throughput: this.metrics.throughput,
        errorRate: this.metrics.errors / Math.max(this.metrics.throughput + this.metrics.errors, 1),
        uptime,
      };
    }

    const sum = latencies.reduce((a, b) => a + b, 0);
    return {
      avgLatency: sum / latencies.length,
      maxLatency: Math.max(...latencies),
      minLatency: Math.min(...latencies),
      throughput: this.metrics.throughput,
      errorRate: this.metrics.errors / Math.max(this.metrics.throughput + this.metrics.errors, 1),
      uptime,
    };
  }

  reset(): void {
    this.metrics = {
      syncLatency: [],
      throughput: 0,
      lastReset: Date.now(),
      errors: 0,
    };
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
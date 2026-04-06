import type { SubagentResult } from "../types.js";

export class ResultAggregator {
  private results: SubagentResult[] = [];

  add(result: SubagentResult): void {
    this.results.push(result);
  }

  getAll(): SubagentResult[] {
    return [...this.results];
  }

  getSuccessful(): SubagentResult[] {
    return this.results.filter((r) => r.success);
  }

  getFailed(): SubagentResult[] {
    return this.results.filter((r) => !r.success);
  }

  summarize(): string {
    const total = this.results.length;
    const success = this.getSuccessful().length;
    const failed = this.getFailed().length;

    const lines = [
      `Sub-agent execution summary: ${success}/${total} succeeded, ${failed} failed.`,
      "",
    ];

    for (const r of this.results) {
      lines.push(`- ${r.success ? "OK" : "FAIL"}: ${r.output.slice(0, 200)}${r.output.length > 200 ? "..." : ""}`);
    }

    return lines.join("\n");
  }

  clear(): void {
    this.results = [];
  }
}

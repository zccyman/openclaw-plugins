import { describe, it, expect } from "vitest";
import { ResultAggregator } from "@/subagents/result-aggregator";
import type { SubagentResult } from "@/types";

function makeResult(overrides: Partial<SubagentResult> = {}): SubagentResult {
  return {
    success: true,
    output: "task completed",
    durationMs: 100,
    ...overrides,
  };
}

describe("ResultAggregator", () => {
  it("collects results", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult({ output: "result 1" }));
    agg.add(makeResult({ output: "result 2" }));

    expect(agg.getAll()).toHaveLength(2);
  });

  it("getSuccessful filters successful results", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult({ success: true }));
    agg.add(makeResult({ success: false, output: "failed", error: "err" }));
    agg.add(makeResult({ success: true }));

    expect(agg.getSuccessful()).toHaveLength(2);
    expect(agg.getFailed()).toHaveLength(1);
  });

  it("summarize includes count and status", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult({ success: true, output: "ok task" }));
    agg.add(makeResult({ success: false, output: "bad task", error: "fail" }));

    const summary = agg.summarize();
    expect(summary).toContain("1/2 succeeded");
    expect(summary).toContain("OK");
    expect(summary).toContain("FAIL");
  });

  it("summarize truncates long output", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult({ success: true, output: "x".repeat(300) }));

    const summary = agg.summarize();
    expect(summary).toContain("...");
  });

  it("clear removes all results", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult());
    agg.add(makeResult());
    agg.clear();

    expect(agg.getAll()).toHaveLength(0);
  });

  it("getAll returns a copy", () => {
    const agg = new ResultAggregator();
    agg.add(makeResult());

    const all = agg.getAll();
    all.pop();
    expect(agg.getAll()).toHaveLength(1);
  });
});

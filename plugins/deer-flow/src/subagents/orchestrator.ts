import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { DelegateTaskParams, SubagentResult } from "../types.js";
import { SubagentExecutor } from "./executor.js";
import { ResultAggregator } from "./result-aggregator.js";

export class TaskOrchestrator {
  private executor: SubagentExecutor;
  private aggregator: ResultAggregator;

  constructor(runtime: PluginRuntime) {
    this.executor = new SubagentExecutor(runtime);
    this.aggregator = new ResultAggregator();
  }

  async delegate(params: DelegateTaskParams, sessionKey: string): Promise<SubagentResult> {
    const childKey = `${sessionKey}_sub_${Date.now()}`;
    const result = await this.executor.execute(params, childKey);
    this.aggregator.add(result);
    return result;
  }

  async delegateParallel(
    tasks: DelegateTaskParams[],
    sessionKey: string,
  ): Promise<SubagentResult[]> {
    const childKeys = tasks.map((_, i) => `${sessionKey}_sub_${Date.now()}_${i}`);
    const results = await Promise.all(
      tasks.map((task, i) => this.executor.execute(task, childKeys[i])),
    );
    for (const r of results) this.aggregator.add(r);
    return results;
  }

  getSummary(): string {
    return this.aggregator.summarize();
  }

  getResults(): SubagentResult[] {
    return this.aggregator.getAll();
  }
}

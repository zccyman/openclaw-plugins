import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { DelegateTaskParams, SubagentResult } from "../types.js";

const SUBAGENT_PROMPTS: Record<string, string> = {
  "general-purpose": "You are a general-purpose assistant. Complete the task thoroughly.",
  bash: "You are a bash specialist. Execute commands safely and return structured output.",
  research: "You are a research specialist. Find accurate information and cite sources.",
  code: "You are a coding specialist. Write clean, tested, production-ready code.",
  analysis: "You are an analysis specialist. Break down complex problems systematically.",
};

export class SubagentExecutor {
  constructor(private runtime: PluginRuntime) {}

  async execute(params: DelegateTaskParams, sessionKey: string): Promise<SubagentResult> {
    const start = Date.now();
    const prompt = SUBAGENT_PROMPTS[params.subagent_type] ?? SUBAGENT_PROMPTS["general-purpose"];

    const message = [
      params.context ? `Context: ${params.context}\n\n` : "",
      `Task: ${params.task}`,
      params.expected_output ? `\n\nExpected output: ${params.expected_output}` : "",
    ].join("");

    try {
      const { runId } = await this.runtime.subagent.run({
        sessionKey,
        message,
        extraSystemPrompt: prompt,
      });

      const waitResult = await this.runtime.subagent.waitForRun({
        runId,
        timeoutMs: (params.max_turns ?? 10) * 60_000,
      });

      if (waitResult.status !== "ok") {
        return {
          success: false,
          output: "",
          durationMs: Date.now() - start,
          error: waitResult.error ?? `Sub-agent run ${waitResult.status}`,
          runId,
        };
      }

      const sessionMessages = await this.runtime.subagent.getSessionMessages({
        sessionKey,
        limit: 5,
      });

      const msgs = sessionMessages.messages as Array<Record<string, unknown>>;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const output = typeof (lastAssistant as Record<string, unknown> | undefined)?.content === "string"
        ? (lastAssistant as Record<string, unknown>).content as string
        : "";

      return {
        success: true,
        output,
        durationMs: Date.now() - start,
        runId,
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

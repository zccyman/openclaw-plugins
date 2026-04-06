import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import type { DelegateTaskParams, SubagentResult } from "../types.js";
import { TaskOrchestrator } from "../subagents/orchestrator.js";

export function createDelegateTaskTool(runtime: PluginRuntime): AnyAgentTool {
  const orchestrator = new TaskOrchestrator(runtime);

  return {
    name: "delegate_task",
    description: "Delegate a complex task to a specialized sub-agent. The sub-agent works independently and returns structured results.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task description" },
        subagent_type: { type: "string", enum: ["general-purpose", "bash", "research", "code", "analysis"], description: "Type of sub-agent" },
        max_turns: { type: "number", description: "Maximum conversation turns (default: 10)" },
        context: { type: "string", description: "Additional context" },
        expected_output: { type: "string", description: "Expected deliverable" },
      },
      required: ["task", "subagent_type"],
    },
    execute: async (args: DelegateTaskParams, toolContext?: unknown) => {
      const sessionKey = (toolContext as Record<string, unknown> | undefined)?.sessionId as string ?? `deer_flow_${Date.now()}`;
      const result = await orchestrator.delegate(args, sessionKey);
      return formatResult(result);
    },
  };
}

function formatResult(result: SubagentResult): string {
  if (!result.success) {
    return `Task failed: ${result.error}`;
  }
  return `Task completed in ${result.durationMs}ms.\n\n${result.output}`;
}

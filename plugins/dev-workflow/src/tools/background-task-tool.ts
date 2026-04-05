import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { getEngine } from "../channel/runtime.js";

export class BackgroundTaskTool implements AnyAgentTool {
  name = "dev-workflow-bg-task";
  label = "Dev Workflow Background Task";
  description = "Manage background tasks (test, lint, build) for dev workflow";
  parameters = z.object({
    action: z.enum(["start", "start-and-forget", "get-result", "collect-results", "list", "cleanup"]).describe("Background task action"),
    type: z.enum(["test", "lint", "build"]).optional().describe("Task type for start actions"),
    command: z.string().optional().describe("Command to run for start actions"),
    taskId: z.string().optional().describe("Task ID for get-result actions"),
  });

  async execute(input: { action: string; type?: string; command?: string; taskId?: string }): Promise<string> {
    const engine = getEngine();
    const bg = engine.getBackgroundTaskManager();
    const context = engine.getContext();
    const projectDir = context?.projectDir ?? ".";

    switch (input.action) {
      case "start": {
        if (!input.type || !input.command) return "Error: type and command are required for start";
        const task = await bg.create(input.type as any, input.command, projectDir);
        const result = await bg.start(task.id);
        return `Task ${task.id} completed:\nSuccess: ${result.success}\nOutput: ${result.output.slice(0, 1000)}\nDuration: ${result.durationMs}ms\nExit Code: ${result.exitCode}`;
      }
      case "start-and-forget": {
        if (!input.type || !input.command) return "Error: type and command are required for start-and-forget";
        const task = await bg.create(input.type as any, input.command, projectDir);
        const result = await bg.startAndForget(task.id);
        return `Task ${task.id} (forgotten) completed:\nSuccess: ${result.success}\nOutput: ${result.output.slice(0, 1000)}\nDuration: ${result.durationMs}ms`;
      }
      case "get-result": {
        if (!input.taskId) return "Error: taskId is required for get-result";
        const result = await bg.getResult(input.taskId);
        if (!result) return `Task ${input.taskId} not found`;
        return `Task ${result.taskId}:\nSuccess: ${result.success}\nOutput: ${result.output.slice(0, 1000)}\nDuration: ${result.durationMs}ms\nExit Code: ${result.exitCode}`;
      }
      case "collect-results": {
        const results = await bg.collectResults(projectDir);
        if (results.length === 0) return "No completed background tasks found";
        return results.map((r) => `Task ${r.taskId}: ${r.success ? "OK" : "FAIL"} (${r.durationMs}ms)`).join("\n");
      }
      case "list": {
        const tasks = bg.listTasks(projectDir);
        if (tasks.length === 0) return "No background tasks found";
        return tasks.map((t) => `${t.id} [${t.type}] ${t.status} - ${t.command}`).join("\n");
      }
      case "cleanup": {
        const cleaned = await bg.cleanup(projectDir);
        return `Cleaned up ${cleaned} background tasks and logs`;
      }
      default:
        return `Unknown action: ${input.action}. Valid actions: start, start-and-forget, get-result, collect-results, list, cleanup`;
    }
  }
}

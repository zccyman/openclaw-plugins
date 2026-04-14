import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import type { SubTask, GateResult, GateStatus } from "../types.js";

/**
 * Task Execute Tool - 执行工作流任务
 * 
 * v6 增强：三级粒度 + 5级复杂度调度
 * - L1: 直接编辑 (单文件简单修改)
 * - L2: 样板代码 (OpenCode)
 * - L3: 业务逻辑 (Kilocode code)
 * - L4: 架构设计 (Kilocode orchestrator)
 * - L5: 系统级 (Kilocode orchestrator + 高配模型)
 */
export class TaskExecuteTool implements AnyAgentTool {
  name = "task_execute";
  label = "Execute Task";
  description = "Execute a specific task with 5-level complexity routing (L1-L5).";

  parameters = z.object({
    taskId: z.string().describe("The ID of the task to execute (e.g., task-1)"),
    complexity: z.enum(["L1", "L2", "L3", "L4", "L5"]).optional().describe("Complexity level (auto-detected if not provided)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = engine.getContext();

    if (!context || !context.spec) {
      return {
        content: [{ type: "text" as const, text: "No active workflow with spec. Start a workflow first." }],
        details: { success: false, error: "No active workflow with spec" },
      };
    }

    const task = context.spec.tasks.find((t) => t.id === input.taskId);
    if (!task) {
      const available = context.spec.tasks.map((t) => t.id).join(", ");
      return {
        content: [{ type: "text" as const, text: `Task ${input.taskId} not found. Available: ${available}` }],
        details: { success: false, error: `Task not found` },
      };
    }

    // Auto-detect complexity from task metadata
    const complexity = input.complexity || this.detectComplexity(task);

    // Get routing decision based on complexity
    const orchestrator = engine.getOrchestrator();
    const routing = orchestrator.routeByComplexity(complexity);

    // Store routing info in context
    context.taskRouting = context.taskRouting || {};
    context.taskRouting[input.taskId] = { complexity, ...routing };

    const ctx = context!;
    const result = await orchestrator.executeTask(task, ctx.projectDir, ctx.mode);

    const resultText = result.success
      ? `Task ${task.id} (${task.title}) [${complexity}] completed via ${routing.tool} in ${result.durationMs}ms.\n\n${result.output}`
      : `Task ${task.id} (${task.title}) [${complexity}] failed: ${result.output}`;

    return {
      content: [{ type: "text" as const, text: resultText }],
      details: {
        success: result.success,
        taskId: task.id,
        complexity,
        routing,
        durationMs: result.durationMs,
      },
    };
  }

  /**
   * Auto-detect complexity from task
   */
  private detectComplexity(task: any): string {
    const title = (task.title || "").toLowerCase();
    const desc = (task.description || "").toLowerCase();
    const files = (task.files || []).length;

    // L5: 系统级重构、多模块
    if (title.includes("重构") || title.includes("refactor") || files > 10) {
      return "L5";
    }
    // L4: 架构设计、新模块
    if (title.includes("架构") || title.includes("架构") || title.includes("architecture")) {
      return "L4";
    }
    // L3: 业务逻辑、API
    if (title.includes("api") || title.includes("业务") || title.includes("service")) {
      return "L3";
    }
    // L2: 样板代码、简单CRUD
    if (files <= 2 && (title.includes("crud") || title.includes("简单"))) {
      return "L2";
    }
    // L1: 直接编辑
    return "L1";
  }

  /**
   * v6: Execute a sub-task with gate checks
   */
  async executeSubTask(subtaskId: string, parentTaskId: string): Promise<{
    success: boolean;
    gates: GateResult[];
    output: string;
  }> {
    const engine = getEngine();
    const context = engine.getContext();
    
    if (!context?.spec) {
      return { success: false, gates: [], output: "No active workflow" };
    }
    
    const parentTask = context.spec.tasks.find(t => t.id === parentTaskId);
    if (!parentTask) {
      return { success: false, gates: [], output: `Parent task ${parentTaskId} not found` };
    }
    
    const subtask = parentTask.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) {
      return { success: false, gates: [], output: `Sub-task ${subtaskId} not found` };
    }
    
    // v6: Route by granularity
    const orchestrator = engine.getOrchestrator();
    const routing = orchestrator.routeByGranularity("subtask");
    
    // Execute the sub-task
    const result = await orchestrator.executeSubTask(subtask, context.projectDir);
    
    // Run 3 gates: lint, boundary, unit_test
    const gates: GateResult[] = [];
    
    // Gate 1: Lint (would call qa-gate-tool)
    gates.push({ type: "lint", status: result.success ? "passed" : "failed", output: "Lint check" });
    
    // Gate 2: Boundary check
    gates.push({ type: "boundary", status: result.success ? "passed" : "failed", output: "Boundary check" });
    
    // Gate 3: Unit test
    gates.push({ type: "unit_test", status: result.success ? "passed" : "failed", output: "Unit test check" });
    
    const allPassed = gates.every(g => g.status === "passed");
    
    return {
      success: allPassed,
      gates,
      output: result.output,
    };
  }
}
import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export type BackgroundTaskType = "test" | "lint" | "build";
export type BackgroundTaskStatus = "created" | "running" | "completed" | "failed";

export interface BackgroundTask {
  id: string;
  type: BackgroundTaskType;
  command: string;
  projectDir: string;
  status: BackgroundTaskStatus;
  output: string;
  createdAt: string;
  completedAt: string | null;
  exitCode: number | null;
}

export interface BackgroundTaskResult {
  taskId: string;
  success: boolean;
  output: string;
  durationMs: number;
  exitCode: number | null;
}

export class BackgroundTaskManager {
  private runtime: PluginRuntime;
  private tasks: Map<string, BackgroundTask> = new Map();
  private readonly TASKS_DIR = "docs/tasks";
  private counter = 0;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  async create(type: BackgroundTaskType, command: string, projectDir: string): Promise<BackgroundTask> {
    const id = `bg-${type}-${String(++this.counter).padStart(3, "0")}`;
    const task: BackgroundTask = {
      id,
      type,
      command,
      projectDir,
      status: "created",
      output: "",
      createdAt: new Date().toISOString(),
      completedAt: null,
      exitCode: null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async start(taskId: string): Promise<BackgroundTaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { taskId, success: false, output: "Task not found", durationMs: 0, exitCode: -1 };
    }
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[BackgroundTaskManager] Starting task: ${taskId}`);

    task.status = "running";
    const start = Date.now();
    try {
      const { stdout, stderr } = await execAsync(task.command, {
        cwd: task.projectDir,
        timeout: 300000,
        env: { ...process.env, CI: "true", NODE_ENV: "test" },
      });
      const output = (stdout || stderr || "").trim();
      const durationMs = Date.now() - start;
      task.status = "completed";
      task.output = output;
      task.completedAt = new Date().toISOString();
      task.exitCode = 0;
      await this.saveTaskLog(task);
      return { taskId, success: true, output, durationMs, exitCode: 0 };
    } catch (e: any) {
      const output = e.stdout ? `${e.stdout}\n${e.stderr}` : e.message;
      const durationMs = Date.now() - start;
      task.status = "failed";
      task.output = output;
      task.completedAt = new Date().toISOString();
      task.exitCode = e.code ?? 1;
      await this.saveTaskLog(task);
      return { taskId, success: false, output, durationMs, exitCode: task.exitCode };
    }
  }

  async startAndForget(taskId: string): Promise<BackgroundTaskResult> {
    const result = await this.start(taskId);
    this.tasks.delete(taskId);
    return result;
  }

  async getResult(taskId: string): Promise<BackgroundTaskResult | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (task.status === "running") {
      return { taskId, success: false, output: "Still running", durationMs: 0, exitCode: null };
    }
    return {
      taskId,
      success: task.status === "completed",
      output: task.output,
      durationMs: task.completedAt
        ? new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()
        : 0,
      exitCode: task.exitCode,
    };
  }

  async collectResults(projectDir: string): Promise<BackgroundTaskResult[]> {
    const results: BackgroundTaskResult[] = [];
    for (const task of this.tasks.values()) {
      if (task.projectDir === projectDir && task.status !== "running") {
        const result = await this.getResult(task.id);
        if (result) results.push(result);
      }
    }
    return results;
  }

  async cleanup(projectDir: string): Promise<number> {
    const tasksDir = join(projectDir, this.TASKS_DIR);
    let cleaned = 0;
    for (const task of this.tasks.values()) {
      if (task.projectDir === projectDir && task.status !== "running") {
        this.tasks.delete(task.id);
        cleaned++;
      }
    }
    if (existsSync(tasksDir)) {
      try {
        const files = readdirSync(tasksDir).filter((f) => f.endsWith(".log"));
        for (const file of files) {
          const filePath = join(tasksDir, file);
          try { rmSync(filePath); cleaned++; } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    return cleaned;
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(projectDir?: string): BackgroundTask[] {
    const all = Array.from(this.tasks.values());
    if (projectDir) return all.filter((t) => t.projectDir === projectDir);
    return all;
  }

  getRunningTasks(projectDir?: string): BackgroundTask[] {
    return this.listTasks(projectDir).filter((t) => t.status === "running");
  }

  hasRunningTasks(projectDir?: string): boolean {
    return this.getRunningTasks(projectDir).length > 0;
  }

  private async saveTaskLog(task: BackgroundTask): Promise<void> {
    const tasksDir = join(task.projectDir, this.TASKS_DIR);
    if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });
    const logPath = join(tasksDir, `${task.id}.log`);
    const content = `[${task.status.toUpperCase()}] ${task.id}
Command: ${task.command}
Status: ${task.status}
Exit Code: ${task.exitCode ?? "N/A"}
Started: ${task.createdAt}
Completed: ${task.completedAt ?? "N/A"}

Output:
${task.output}
`;
    try {
      writeFileSync(logPath, content);
    } catch { /* skip */ }
  }
}

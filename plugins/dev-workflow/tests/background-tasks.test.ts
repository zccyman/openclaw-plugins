import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BackgroundTaskManager } from "../src/background-tasks/index.js";

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  } as any;
}

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-bg-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("BackgroundTaskManager", () => {
  it("create returns a new background task", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "npm test", testDir);
    expect(task.id).toMatch(/^bg-test-\d{3}$/);
    expect(task.type).toBe("test");
    expect(task.command).toBe("npm test");
    expect(task.projectDir).toBe(testDir);
    expect(task.status).toBe("created");
    expect(task.output).toBe("");
    expect(task.completedAt).toBeNull();
    expect(task.exitCode).toBeNull();
  });

  it("create increments counter for unique IDs", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task1 = await mgr.create("test", "npm test", testDir);
    const task2 = await mgr.create("lint", "npm run lint", testDir);
    expect(task1.id).not.toBe(task2.id);
  });

  it("start returns error for non-existent task", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const result = await mgr.start("non-existent");
    expect(result.success).toBe(false);
    expect(result.output).toBe("Task not found");
    expect(result.exitCode).toBe(-1);
  });

  it("start runs a successful command", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo hello", testDir);
    const result = await mgr.start(task.id);
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello");
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("start handles failing command", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "exit 1", testDir);
    const result = await mgr.start(task.id);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it("start updates task status", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo done", testDir);
    expect(task.status).toBe("created");
    await mgr.start(task.id);
    expect(task.status).toBe("completed");
    expect(task.completedAt).not.toBeNull();
    expect(task.exitCode).toBe(0);
  });

  it("startAndForget removes task after completion", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo done", testDir);
    const result = await mgr.startAndForget(task.id);
    expect(result.success).toBe(true);
    expect(mgr.getTask(task.id)).toBeUndefined();
  });

  it("getResult returns null for non-existent task", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const result = await mgr.getResult("non-existent");
    expect(result).toBeNull();
  });

  it("getResult returns result for completed task", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo done", testDir);
    await mgr.start(task.id);
    const result = await mgr.getResult(task.id);
    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
  });

  it("collectResults returns results for a project", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task1 = await mgr.create("test", "echo test1", testDir);
    const task2 = await mgr.create("lint", "echo lint1", testDir);
    await mgr.start(task1.id);
    await mgr.start(task2.id);
    const results = await mgr.collectResults(testDir);
    expect(results).toHaveLength(2);
  });

  it("collectResults filters by projectDir", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const otherDir = join(tmpdir(), "other-project");
    mkdirSync(otherDir, { recursive: true });
    const task1 = await mgr.create("test", "echo test1", testDir);
    const task2 = await mgr.create("test", "echo test2", otherDir);
    await mgr.start(task1.id);
    await mgr.start(task2.id);
    const results = await mgr.collectResults(testDir);
    expect(results).toHaveLength(1);
    rmSync(otherDir, { recursive: true, force: true });
  });

  it("cleanup removes completed tasks and logs", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo done", testDir);
    await mgr.start(task.id);
    const cleaned = await mgr.cleanup(testDir);
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(mgr.listTasks(testDir)).toHaveLength(0);
  });

  it("listTasks returns all tasks", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    await mgr.create("test", "npm test", testDir);
    await mgr.create("lint", "npm run lint", testDir);
    const tasks = mgr.listTasks(testDir);
    expect(tasks).toHaveLength(2);
  });

  it("listTasks without projectDir returns all tasks", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    await mgr.create("test", "npm test", testDir);
    const tasks = mgr.listTasks();
    expect(tasks).toHaveLength(1);
  });

  it("getTask returns specific task", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "npm test", testDir);
    const found = mgr.getTask(task.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(task.id);
  });

  it("getTask returns undefined for non-existent task", () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    expect(mgr.getTask("non-existent")).toBeUndefined();
  });

  it("getRunningTasks returns only running tasks", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "npm test", testDir);
    task.status = "running";
    const running = mgr.getRunningTasks(testDir);
    expect(running).toHaveLength(1);
    expect(running[0].id).toBe(task.id);
  });

  it("hasRunningTasks returns correct boolean", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    expect(mgr.hasRunningTasks(testDir)).toBe(false);
    const task = await mgr.create("test", "npm test", testDir);
    task.status = "running";
    expect(mgr.hasRunningTasks(testDir)).toBe(true);
  });

  it("task log is saved to docs/tasks directory", async () => {
    const mgr = new BackgroundTaskManager(createMockRuntime());
    const task = await mgr.create("test", "echo done", testDir);
    await mgr.start(task.id);
    const logPath = join(testDir, "docs", "tasks", `${task.id}.log`);
    expect(existsSync(logPath)).toBe(true);
  });
});

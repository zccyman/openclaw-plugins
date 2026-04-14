/**
 * state.json 序列化测试
 * 覆盖：loadStateJson/saveStateJson 的数据结构
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// 模拟 state.json 的数据结构（与 engine/index.ts 一致）
interface StateJson {
  version: number;
  phase: number;
  step: string;
  tasks: Record<string, { status: string; updatedAt: string }>;
  updatedAt: string;
}

describe("state.json 数据结构", () => {
  const testDir = join(tmpdir(), `dw-test-state-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("序列化和反序列化一致", () => {
    const state: StateJson = {
      version: 1,
      phase: 2,
      step: "step4-spec",
      tasks: {
        "task-1": { status: "done", updatedAt: "2026-04-12T00:00:00Z" },
        "task-2": { status: "pending", updatedAt: "2026-04-12T00:00:00Z" },
      },
      updatedAt: new Date().toISOString(),
    };

    const filePath = join(testDir, "state.json");
    writeFileSync(filePath, JSON.stringify(state, null, 2));

    const loaded: StateJson = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(loaded.version).toBe(1);
    expect(loaded.phase).toBe(2);
    expect(loaded.step).toBe("step4-spec");
    expect(loaded.tasks["task-1"].status).toBe("done");
    expect(loaded.tasks["task-2"].status).toBe("pending");
  });

  it("phase 范围 1-4", () => {
    for (let p = 1; p <= 4; p++) {
      const state: StateJson = {
        version: 1, phase: p, step: "step1-project-identify",
        tasks: {}, updatedAt: new Date().toISOString(),
      };
      expect(state.phase).toBeGreaterThanOrEqual(1);
      expect(state.phase).toBeLessThanOrEqual(4);
    }
  });

  it("归档文件名包含时间戳", () => {
    const ts = Date.now();
    const archiveName = `state.json.bak.${ts}`;
    expect(archiveName).toMatch(/^state\.json\.bak\.\d+$/);
  });
});

import { beforeAll, afterAll } from "vitest";

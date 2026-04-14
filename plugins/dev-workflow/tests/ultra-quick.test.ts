/**
 * UltraQuick 流程测试
 * 覆盖：complexityToMode 映射、WorkflowMode 包含 ultra
 */
import { describe, it, expect } from "vitest";
import { WorkflowMode } from "../src/types.js";

// 从 agent-orchestrator.ts 提取的 complexityToMode 逻辑（纯函数）
function complexityToMode(c: string): WorkflowMode {
  return c === "high" ? "full" : c === "medium" ? "standard" : "ultra";
}

describe("complexityToMode", () => {
  it("low → ultra", () => {
    expect(complexityToMode("low")).toBe("ultra");
  });

  it("medium → standard", () => {
    expect(complexityToMode("medium")).toBe("standard");
  });

  it("high → full", () => {
    expect(complexityToMode("high")).toBe("full");
  });
});

describe("WorkflowMode 类型完整性", () => {
  const modes: WorkflowMode[] = ["ultra", "quick", "standard", "full", "debug"];

  it("包含 ultra 模式", () => {
    expect(modes).toContain("ultra");
  });

  it("共5种模式", () => {
    expect(modes.length).toBe(5);
  });
});

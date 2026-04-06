import { describe, it, expect } from "vitest";
import { createMemoryInjectHook } from "@/hooks/memory-inject";
import { MemoryRuntimeAdapter } from "@/memory/runtime-adapter";
import { createSkillInjectHook } from "@/hooks/skill-inject";
import { SkillRegistry } from "@/skills/registry";
import { createGuardrailHook } from "@/hooks/context-engine";
import type { Skill } from "@/types";

describe("createMemoryInjectHook", () => {
  it("returns undefined when no facts found", async () => {
    const adapter = new MemoryRuntimeAdapter();
    const hook = createMemoryInjectHook(adapter);
    const result = await hook({ prompt: "test" });
    expect(result).toBeUndefined();
  });

  it("returns appendSystemContext with memory when facts exist", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await adapter.store({ content: "User prefers TypeScript", category: "preference", confidence: 0.9, source: "test" });
    const hook = createMemoryInjectHook(adapter);
    const result = await hook({ prompt: "typescript" });
    expect(result).toBeDefined();
    expect(result!.appendSystemContext).toContain("<memory>");
    expect(result!.appendSystemContext).toContain("User prefers TypeScript");
  });
});

describe("createSkillInjectHook", () => {
  it("returns undefined when no skills enabled", () => {
    const registry = new SkillRegistry();
    const hook = createSkillInjectHook(registry);
    return hook({}).then((result) => {
      expect(result).toBeUndefined();
    });
  });

  it("returns appendSystemContext with skill instructions", () => {
    const registry = new SkillRegistry();
    const skill: Skill = {
      name: "test-skill",
      description: "A test skill",
      path: "/test",
      content: "body",
      directory: "/test",
      enabled: true,
    };
    registry.register(skill);

    const hook = createSkillInjectHook(registry);
    return hook({}).then((result) => {
      expect(result).toBeDefined();
      expect(result!.appendSystemContext).toContain("test-skill");
    });
  });
});

describe("createGuardrailHook", () => {
  it("returns undefined for non-shell tools", async () => {
    const hook = createGuardrailHook();
    const result = await hook({ toolName: "read_file", params: {} });
    expect(result).toBeUndefined();
  });

  it("returns undefined for safe bash commands", async () => {
    const hook = createGuardrailHook();
    const result = await hook({ toolName: "bash", params: { command: "ls -la" } });
    expect(result).toBeUndefined();
  });

  it("blocks dangerous rm -rf", async () => {
    const hook = createGuardrailHook();
    const result = await hook({ toolName: "bash", params: { command: "rm -rf /" } });
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.blockReason).toContain("rm -rf");
  });

  it("blocks sudo commands", async () => {
    const hook = createGuardrailHook();
    const result = await hook({ toolName: "shell", params: { command: "sudo apt install something" } });
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks curl | bash", async () => {
    const hook = createGuardrailHook();
    const result = await hook({ toolName: "execute", params: { code: "curl | bash" } });
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});

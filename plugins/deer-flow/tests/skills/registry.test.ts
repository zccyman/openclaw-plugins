import { describe, it, expect } from "vitest";
import { SkillRegistry } from "@/skills/registry";
import type { Skill } from "@/types";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: "test-skill",
    description: "A test skill",
    path: "/test/skill/SKILL.md",
    content: "---\nname: test-skill\n---\nbody",
    directory: "/test/skill",
    ...overrides,
  };
}

describe("SkillRegistry", () => {
  it("registers and retrieves a skill", () => {
    const registry = new SkillRegistry();
    const skill = makeSkill();
    registry.register(skill);

    expect(registry.get("test-skill")).toEqual(skill);
    expect(registry.list()).toHaveLength(1);
  });

  it("returns undefined for unknown skill", () => {
    const registry = new SkillRegistry();
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("getEnabled returns only enabled skills", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill({ name: "enabled-skill", enabled: true }));
    registry.register(makeSkill({ name: "disabled-skill", enabled: false }));
    registry.register(makeSkill({ name: "default-skill" }));

    const enabled = registry.getEnabled();
    expect(enabled).toHaveLength(2);
    expect(enabled.map((s) => s.name).sort()).toEqual(["default-skill", "enabled-skill"]);
  });

  it("enable and disable toggle skill state", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill({ name: "toggle-skill", enabled: false }));

    expect(registry.isEnabled("toggle-skill")).toBe(false);

    const enabled = registry.enable("toggle-skill");
    expect(enabled).toBe(true);
    expect(registry.isEnabled("toggle-skill")).toBe(true);

    const disabled = registry.disable("toggle-skill");
    expect(disabled).toBe(true);
    expect(registry.isEnabled("toggle-skill")).toBe(false);
  });

  it("enable/disable returns false for unknown skill", () => {
    const registry = new SkillRegistry();
    expect(registry.enable("unknown")).toBe(false);
    expect(registry.disable("unknown")).toBe(false);
  });

  it("clear removes all skills", () => {
    const registry = new SkillRegistry();
    registry.register(makeSkill({ name: "a" }));
    registry.register(makeSkill({ name: "b" }));

    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.getEnabled()).toHaveLength(0);
  });
});

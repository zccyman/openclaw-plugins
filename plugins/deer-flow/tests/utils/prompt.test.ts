import { describe, it, expect } from "vitest";
import { formatMemoryFacts, formatSkillInstructions, buildContextGuidance } from "@/utils/prompt";
import type { MemoryFact, Skill } from "@/types";

function makeFact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: "fact_1",
    content: "test fact",
    category: "knowledge",
    confidence: 0.85,
    createdAt: "2026-01-01",
    source: "test",
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: "test-skill",
    description: "A test skill",
    path: "/test/SKILL.md",
    content: "---\nname: test\n---\nbody",
    directory: "/test",
    ...overrides,
  };
}

describe("formatMemoryFacts", () => {
  it("returns empty string for no facts", () => {
    expect(formatMemoryFacts([])).toBe("");
  });

  it("formats facts with category and confidence", () => {
    const facts = [makeFact({ content: "likes TS", category: "preference", confidence: 0.9 })];
    const result = formatMemoryFacts(facts);
    expect(result).toContain("[preference] likes TS");
    expect(result).toContain("0.90");
    expect(result).toContain("<memory>");
  });

  it("respects maxFacts limit", () => {
    const facts = Array.from({ length: 20 }, (_, i) => makeFact({ content: `fact ${i}` }));
    const result = formatMemoryFacts(facts, 3);
    const lines = result.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(3);
  });
});

describe("formatSkillInstructions", () => {
  it("returns empty string for no skills", () => {
    expect(formatSkillInstructions([])).toBe("");
  });

  it("formats skill names and descriptions", () => {
    const skills = [
      makeSkill({ name: "research", description: "Search the web" }),
      makeSkill({ name: "code-gen", description: "Generate code" }),
    ];
    const result = formatSkillInstructions(skills);
    expect(result).toContain("### research");
    expect(result).toContain("Search the web");
    expect(result).toContain("### code-gen");
    expect(result).toContain("Generate code");
    expect(result).toContain("<skills>");
  });
});

describe("buildContextGuidance", () => {
  it("returns empty string when all disabled", () => {
    expect(buildContextGuidance({})).toBe("");
  });

  it("includes thinking guidance", () => {
    const result = buildContextGuidance({ thinkingEnabled: true });
    expect(result).toContain("extended reasoning");
  });

  it("includes plan mode guidance", () => {
    const result = buildContextGuidance({ planMode: true });
    expect(result).toContain("todo list");
  });

  it("includes subagent guidance", () => {
    const result = buildContextGuidance({ subagentEnabled: true });
    expect(result).toContain("delegate_task");
  });

  it("combines multiple guidances", () => {
    const result = buildContextGuidance({ thinkingEnabled: true, planMode: true, subagentEnabled: true });
    expect(result).toContain("extended reasoning");
    expect(result).toContain("todo list");
    expect(result).toContain("delegate_task");
  });
});

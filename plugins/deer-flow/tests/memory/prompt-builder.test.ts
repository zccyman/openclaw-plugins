import { describe, it, expect } from "vitest";
import { buildMemoryPromptSection } from "@/memory/prompt-builder";
import type { MemoryFact } from "@/types";

function makeFact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: "fact_test_1",
    content: "test content",
    category: "knowledge",
    confidence: 0.9,
    createdAt: "2026-01-01T00:00:00Z",
    source: "test",
    ...overrides,
  };
}

describe("buildMemoryPromptSection", () => {
  it("returns empty string for empty facts", () => {
    expect(buildMemoryPromptSection([])).toBe("");
  });

  it("formats single fact with category tag", () => {
    const facts = [makeFact({ content: "TypeScript is preferred", category: "preference" })];
    const result = buildMemoryPromptSection(facts);
    expect(result).toContain("<memory>");
    expect(result).toContain("</memory>");
    expect(result).toContain("[preference] TypeScript is preferred");
  });

  it("formats multiple facts", () => {
    const facts = [
      makeFact({ content: "fact one", category: "knowledge" }),
      makeFact({ content: "fact two", category: "behavior" }),
    ];
    const result = buildMemoryPromptSection(facts);
    expect(result).toContain("[knowledge] fact one");
    expect(result).toContain("[behavior] fact two");
  });

  it("respects maxFacts limit", () => {
    const facts = Array.from({ length: 20 }, (_, i) =>
      makeFact({ content: `fact ${i}`, category: "knowledge" }),
    );
    const result = buildMemoryPromptSection(facts, 5);
    const lines = result.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(5);
  });
});

import type { MemoryFact } from "../types.js";

export function buildMemoryPromptSection(facts: MemoryFact[], maxFacts: number = 15): string {
  if (facts.length === 0) return "";

  const sliced = facts.slice(0, maxFacts);
  const lines = sliced.map((f) => `- [${f.category}] ${f.content}`);
  return `\n<memory>\nRelevant context from previous sessions:\n${lines.join("\n")}\n</memory>\n`;
}

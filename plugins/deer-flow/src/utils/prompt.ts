import type { MemoryFact, Skill } from "../types.js";

export function formatMemoryFacts(facts: MemoryFact[], maxFacts: number = 15): string {
  if (facts.length === 0) return "";

  const sliced = facts.slice(0, maxFacts);
  const lines = sliced.map((f) => `- [${f.category}] ${f.content} (confidence: ${f.confidence.toFixed(2)})`);
  return `\n<memory>\nRelevant context from previous sessions:\n${lines.join("\n")}\n</memory>\n`;
}

export function formatSkillInstructions(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const lines = skills.map((s) => `### ${s.name}\n${s.description}`);
  return `\n<skills>\nAvailable skills:\n${lines.join("\n\n")}\n</skills>\n`;
}

export function buildContextGuidance(params: {
  thinkingEnabled?: boolean;
  planMode?: boolean;
  subagentEnabled?: boolean;
}): string {
  const parts: string[] = [];

  if (params.thinkingEnabled) {
    parts.push("- Use extended reasoning for complex tasks");
  }
  if (params.planMode) {
    parts.push("- Break tasks into a todo list before executing");
  }
  if (params.subagentEnabled) {
    parts.push("- Delegate complex sub-tasks to specialized sub-agents using the delegate_task tool");
  }

  return parts.length > 0 ? `\n<context>\nExecution guidance:\n${parts.map((p) => p).join("\n")}\n</context>\n` : "";
}

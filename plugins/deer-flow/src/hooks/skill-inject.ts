import type { SkillRegistry } from "../skills/registry.js";
import { formatSkillInstructions } from "../utils/prompt.js";

export function createSkillInjectHook(skillRegistry: SkillRegistry) {
  return async (_event: any) => {
    const skills = skillRegistry.getEnabled();
    if (skills.length === 0) return undefined;

    return { appendSystemContext: formatSkillInstructions(skills) };
  };
}

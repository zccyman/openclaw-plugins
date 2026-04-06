import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { Skill } from "../types.js";
import { SkillRegistry, scanSkills, loadSkill } from "../skills/index.js";

export function createLoadSkillTool(registry: SkillRegistry, skillsDir: string): AnyAgentTool {
  return {
    name: "load_skill",
    description: "Load a skill by name. Skills contain expert knowledge, best practices, and workflows that extend agent capabilities.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name (directory name under skills/)" },
      },
      required: ["name"],
    },
    execute: async (args: { name: string }) => {
      const skill = registry.get(args.name);
      if (!skill) {
        return `Skill "${args.name}" not found. Use list_skills to see available skills.`;
      }
      return `## Skill: ${skill.name}\n\n${skill.description}\n\n${skill.content}`;
    },
  };
}

export function createListSkillsTool(registry: SkillRegistry, skillsDir: string): AnyAgentTool {
  return {
    name: "list_skills",
    description: "List all available skills with their descriptions and enabled status.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const skills = registry.list();
      if (skills.length === 0) {
        return "No skills available.";
      }
      const lines = skills.map((s) => `- ${s.name}: ${s.description} [${s.enabled !== false ? "enabled" : "disabled"}]`);
      return `Available skills:\n${lines.join("\n")}`;
    },
  };
}

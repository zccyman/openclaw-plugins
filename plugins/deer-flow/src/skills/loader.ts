import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { Skill, SkillMetadata } from "../types.js";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

function parseYamlLike(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value: string | string[] = trimmed.slice(colonIdx + 1).trim();
    if ((value.startsWith("[") && value.endsWith("]"))) {
      const inner = value.slice(1, -1);
      value = inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    result[key] = value;
  }
  return result;
}

export function parseSkillMarkdown(content: string): { metadata: SkillMetadata; body: string } {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { metadata: { name: "", description: "" }, body: content };
  }

  const raw = parseYamlLike(match[1]);
  const metadata: SkillMetadata = {
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
  };
  if (raw.license) metadata.license = String(raw.license);
  if (raw.allowedTools) metadata.allowedTools = Array.isArray(raw.allowedTools) ? raw.allowedTools as string[] : String(raw.allowedTools).split(",").map((s: string) => s.trim()).filter(Boolean);
  if (raw.enabled !== undefined) metadata.enabled = raw.enabled === true || raw.enabled === "true";
  if (raw.version) metadata.version = String(raw.version);
  if (raw.author) metadata.author = String(raw.author);

  return { metadata, body: match[2].trim() };
}

export function loadSkill(skillDir: string): Skill | null {
  const skillPath = join(skillDir, "SKILL.md");
  try {
    const content = readFileSync(skillPath, "utf-8");
    const { metadata, body } = parseSkillMarkdown(content);
    if (!metadata.name) return null;
    return { ...metadata, path: skillPath, content, directory: skillDir };
  } catch {
    return null;
  }
}

export function scanSkills(skillsDir: string): Skill[] {
  const skills: Skill[] = [];
  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(skillsDir, entry.name);
      const skill = loadSkill(skillDir);
      if (skill) skills.push(skill);
    }
  } catch {
  }
  return skills;
}

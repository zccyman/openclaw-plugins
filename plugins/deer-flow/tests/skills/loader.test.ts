import { describe, it, expect } from "vitest";
import { parseSkillMarkdown, loadSkill, scanSkills } from "@/skills/loader";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("parseSkillMarkdown", () => {
  it("parses frontmatter and body", () => {
    const content = `---
name: test-skill
description: A test skill
license: MIT
enabled: true
version: "1.0"
author: tester
---

# Test Skill

This is the body content.
`;
    const result = parseSkillMarkdown(content);
    expect(result.metadata.name).toBe("test-skill");
    expect(result.metadata.description).toBe("A test skill");
    expect(result.metadata.license).toBe("MIT");
    expect(result.metadata.enabled).toBe(true);
    expect(result.metadata.version).toBe("1.0");
    expect(result.metadata.author).toBe("tester");
    expect(result.body).toContain("# Test Skill");
    expect(result.body).toContain("This is the body content.");
  });

  it("parses allowedTools as array in brackets", () => {
    const content = `---
name: tool-skill
description: Has tools
allowedTools: [read, write, bash]
---

Body
`;
    const result = parseSkillMarkdown(content);
    expect(result.metadata.allowedTools).toEqual(["read", "write", "bash"]);
  });

  it("returns empty metadata when no frontmatter", () => {
    const content = "Just some markdown without frontmatter";
    const result = parseSkillMarkdown(content);
    expect(result.metadata.name).toBe("");
    expect(result.metadata.description).toBe("");
    expect(result.body).toBe(content);
  });

  it("handles enabled false", () => {
    const content = `---
name: disabled-skill
description: Disabled
enabled: false
---

Body
`;
    const result = parseSkillMarkdown(content);
    expect(result.metadata.enabled).toBe(false);
  });

  it("skips comment lines in frontmatter", () => {
    const content = `---
# This is a comment
name: commented
description: Has comments
---

Body
`;
    const result = parseSkillMarkdown(content);
    expect(result.metadata.name).toBe("commented");
  });
});

describe("loadSkill", () => {
  it("loads a valid skill directory", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "deer-flow-test-"));
    const skillContent = `---
name: my-skill
description: My skill
---

Skill body here.
`;
    writeFileSync(join(tmpDir, "SKILL.md"), skillContent, "utf-8");

    const skill = loadSkill(tmpDir);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("my-skill");
    expect(skill!.description).toBe("My skill");
    expect(skill!.path).toBe(join(tmpDir, "SKILL.md"));
    expect(skill!.directory).toBe(tmpDir);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for missing SKILL.md", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "deer-flow-test-"));
    const skill = loadSkill(tmpDir);
    expect(skill).toBeNull();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for skill with empty name", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "deer-flow-test-"));
    writeFileSync(join(tmpDir, "SKILL.md"), "---\ndescription: no name\n---\nBody", "utf-8");
    const skill = loadSkill(tmpDir);
    expect(skill).toBeNull();
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("scanSkills", () => {
  it("scans multiple skill directories", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "deer-flow-test-"));
    mkdirSync(join(tmpDir, "skill-a"));
    mkdirSync(join(tmpDir, "skill-b"));
    writeFileSync(join(tmpDir, "skill-a", "SKILL.md"), "---\nname: a\ndescription: Skill A\n---\nBody A", "utf-8");
    writeFileSync(join(tmpDir, "skill-b", "SKILL.md"), "---\nname: b\ndescription: Skill B\n---\nBody B", "utf-8");

    const skills = scanSkills(tmpDir);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(["a", "b"]);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips non-directory entries", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "deer-flow-test-"));
    writeFileSync(join(tmpDir, "README.md"), "not a skill", "utf-8");
    mkdirSync(join(tmpDir, "real-skill"));
    writeFileSync(join(tmpDir, "real-skill", "SKILL.md"), "---\nname: real\ndescription: Real\n---\nBody", "utf-8");

    const skills = scanSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("real");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty for non-existent directory", () => {
    const skills = scanSkills("/nonexistent/path/skills");
    expect(skills).toHaveLength(0);
  });
});

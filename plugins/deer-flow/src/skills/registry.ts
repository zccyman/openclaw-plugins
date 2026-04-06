import type { Skill } from "../types.js";

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private enabled = new Set<string>();

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
    if (skill.enabled !== false) {
      this.enabled.add(skill.name);
    }
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  getEnabled(): Skill[] {
    return this.list().filter((s) => this.enabled.has(s.name));
  }

  enable(name: string): boolean {
    if (!this.skills.has(name)) return false;
    this.enabled.add(name);
    return true;
  }

  disable(name: string): boolean {
    if (!this.skills.has(name)) return false;
    this.enabled.delete(name);
    return true;
  }

  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }

  clear(): void {
    this.skills.clear();
    this.enabled.clear();
  }
}

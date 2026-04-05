import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "fs";
import { join } from "path";

export interface MemoryEntry {
  id: string;
  type: "decision" | "pattern" | "constraint" | "lesson";
  title: string;
  content: string;
  createdAt: string;
  lastReferenced: string;
  referenceCount: number;
  tags: string[];
  status: "fresh" | "referenced" | "stale" | "archived";
}

export interface MemoryIndex {
  decisions: MemoryEntry[];
  patterns: MemoryEntry[];
  constraints: MemoryEntry[];
  lessons: MemoryEntry[];
  updatedAt: string;
}

const MEMORY_TYPES: MemoryEntry["type"][] = ["decision", "pattern", "constraint", "lesson"];

export class MemdirManager {
  private runtime: PluginRuntime;
  private readonly MEMORY_DIR = "docs/memory";

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  async initialize(projectDir: string): Promise<void> {
    const memDir = join(projectDir, this.MEMORY_DIR);
    const subdirs = ["decisions", "patterns", "constraints", "lessons", "archive"];
    for (const subdir of subdirs) {
      const dirPath = join(memDir, subdir);
      if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
    }
    const indexPath = join(memDir, "index.md");
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, this.generateEmptyIndex());
    }
  }

  async remember(projectDir: string, entry: Omit<MemoryEntry, "id" | "createdAt" | "lastReferenced" | "referenceCount" | "status">): Promise<MemoryEntry> {
    const memoryEntry: MemoryEntry = {
      ...entry,
      id: this.generateId(entry.title),
      createdAt: new Date().toISOString(),
      lastReferenced: new Date().toISOString(),
      referenceCount: 0,
      status: "fresh",
    };
    const dirPath = join(projectDir, this.MEMORY_DIR, entry.type + "s");
    if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
    const filePath = join(dirPath, `${memoryEntry.id}.md`);
    writeFileSync(filePath, this.formatMemoryEntry(memoryEntry));
    await this.updateIndex(projectDir);
    return memoryEntry;
  }

  async recall(projectDir: string, type: MemoryEntry["type"] | "all", query?: string): Promise<MemoryEntry[]> {
    const index = await this.loadIndex(projectDir);
    let entries: MemoryEntry[] = [];
    if (type === "all") {
      entries = [...index.decisions, ...index.patterns, ...index.constraints, ...index.lessons];
    } else {
      entries = this.getEntries(index, type);
    }
    if (query) {
      const lowerQuery = query.toLowerCase();
      entries = entries.filter((e) =>
        e.title.toLowerCase().includes(lowerQuery) ||
        e.content.toLowerCase().includes(lowerQuery) ||
        e.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      );
    }
    entries = entries.filter((e) => e.status !== "archived");
    entries.sort((a, b) => {
      const statusOrder: Record<string, number> = { fresh: 0, referenced: 1, stale: 2, archived: 3 };
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    });
    for (const entry of entries) {
      entry.lastReferenced = new Date().toISOString();
      entry.referenceCount++;
    }
    await this.updateIndex(projectDir);
    return entries.slice(0, 10);
  }

  async forget(projectDir: string, entryId: string): Promise<boolean> {
    const index = await this.loadIndex(projectDir);
    for (const t of MEMORY_TYPES) {
      const entries = this.getEntries(index, t);
      const idx = entries.findIndex((e) => e.id === entryId);
      if (idx !== -1) {
        const entry = entries[idx];
        const srcPath = join(projectDir, this.MEMORY_DIR, entry.type + "s", `${entryId}.md`);
        const dstPath = join(projectDir, this.MEMORY_DIR, "archive", `${entryId}.md`);
        if (existsSync(srcPath)) {
          try { renameSync(srcPath, dstPath); } catch { /* skip */ }
        }
        entries.splice(idx, 1);
        index.updatedAt = new Date().toISOString();
        await this.saveIndex(projectDir, index);
        return true;
      }
    }
    return false;
  }

  async updateAging(projectDir: string): Promise<void> {
    const index = await this.loadIndex(projectDir);
    const now = new Date();
    let changed = false;

    const updateEntry = (entry: MemoryEntry): boolean => {
      const daysSinceRef = (now.getTime() - new Date(entry.lastReferenced).getTime()) / (1000 * 60 * 60 * 24);
      let newStatus: MemoryEntry["status"];
      if (daysSinceRef > 90) newStatus = "archived";
      else if (daysSinceRef > 30) newStatus = "stale";
      else if (daysSinceRef > 7 || entry.referenceCount > 0) newStatus = "referenced";
      else newStatus = "fresh";
      if (entry.status !== newStatus) { entry.status = newStatus; return true; }
      return false;
    };

    for (const t of MEMORY_TYPES) {
      const entries = this.getEntries(index, t);
      for (const entry of entries) {
        if (updateEntry(entry)) changed = true;
      }
      this.setEntries(index, t, entries.filter((e) => e.status !== "archived"));
    }

    if (changed) {
      index.updatedAt = new Date().toISOString();
      await this.saveIndex(projectDir, index);
    }
  }

  async formatAsMarkdown(projectDir: string, query?: string): Promise<string> {
    const entries = await this.recall(projectDir, "all", query);
    const lines = ["# Memory Recall Results", ""];
    if (query) lines.push(`> Query: "${query}"`, "");
    for (const entry of entries) {
      lines.push(`## ${this.statusEmoji(entry.status)} ${entry.title}`);
      lines.push(`- Type: ${entry.type}`);
      lines.push(`- Created: ${entry.createdAt.split("T")[0]}`);
      lines.push(`- Status: ${entry.status}`);
      lines.push(`- References: ${entry.referenceCount}`);
      if (entry.tags.length > 0) lines.push(`- Tags: ${entry.tags.join(", ")}`);
      lines.push("");
      lines.push(entry.content.slice(0, 500));
      lines.push("");
    }
    if (entries.length === 0) lines.push("No memories found.");
    return lines.join("\n");
  }

  private getEntries(index: MemoryIndex, type: MemoryEntry["type"]): MemoryEntry[] {
    switch (type) {
      case "decision": return index.decisions;
      case "pattern": return index.patterns;
      case "constraint": return index.constraints;
      case "lesson": return index.lessons;
    }
  }

  private setEntries(index: MemoryIndex, type: MemoryEntry["type"], entries: MemoryEntry[]): void {
    switch (type) {
      case "decision": index.decisions = entries; break;
      case "pattern": index.patterns = entries; break;
      case "constraint": index.constraints = entries; break;
      case "lesson": index.lessons = entries; break;
    }
  }

  private async loadIndex(projectDir: string): Promise<MemoryIndex> {
    const indexPath = join(projectDir, this.MEMORY_DIR, "index.md");
    if (!existsSync(indexPath)) {
      return { decisions: [], patterns: [], constraints: [], lessons: [], updatedAt: new Date().toISOString() };
    }
    const index: MemoryIndex = { decisions: [], patterns: [], constraints: [], lessons: [], updatedAt: new Date().toISOString() };
    for (const t of MEMORY_TYPES) {
      const dirPath = join(projectDir, this.MEMORY_DIR, t + "s");
      if (existsSync(dirPath)) {
        try {
          const files = readdirSync(dirPath).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            const id = file.replace(".md", "");
            const entries = this.getEntries(index, t);
            const existing = entries.find((e) => e.id === id);
            if (!existing) {
              const filePath = join(dirPath, file);
              const content = readFileSync(filePath, "utf-8");
              const titleMatch = content.match(/^#\s+(.+)$/m);
              entries.push({
                id, type: t, title: titleMatch?.[1] ?? id, content,
                createdAt: new Date().toISOString(), lastReferenced: new Date().toISOString(),
                referenceCount: 0, tags: [], status: "fresh",
              });
            }
          }
        } catch { /* skip */ }
      }
    }
    return index;
  }

  private async saveIndex(projectDir: string, index: MemoryIndex): Promise<void> {
    const indexPath = join(projectDir, this.MEMORY_DIR, "index.md");
    writeFileSync(indexPath, this.formatIndex(index));
  }

  private async updateIndex(projectDir: string): Promise<void> {
    const index = await this.loadIndex(projectDir);
    await this.saveIndex(projectDir, index);
  }

  private formatIndex(index: MemoryIndex): string {
    const lines = ["# Memory Index", ""];
    for (const t of MEMORY_TYPES) {
      const entries = this.getEntries(index, t);
      const header = t.charAt(0).toUpperCase() + t.slice(1) + "s";
      lines.push(`## ${header}`);
      lines.push("| Date/Pattern | Title | File | Status |");
      lines.push("|--------------|-------|------|--------|");
      for (const entry of entries) {
        const file = `${entry.type + "s"}/${entry.id}.md`;
        lines.push(`| ${entry.createdAt.split("T")[0]} | ${entry.title} | ${file} | ${this.statusEmoji(entry.status)} ${entry.status} |`);
      }
      lines.push("");
    }
    lines.push(`> Last updated: ${index.updatedAt}`);
    return lines.join("\n");
  }

  private generateEmptyIndex(): string {
    return `# Memory Index\n\n## Decisions\n| Date | Title | File | Status |\n|------|-------|------|--------|\n\n## Patterns\n| Pattern | Use Case | File | Status |\n|---------|----------|------|--------|\n\n## Constraints\n| Constraint | Scope | File | Status |\n|------------|-------|------|--------|\n\n## Lessons\n| Date | Lesson | File | Status |\n|------|--------|------|--------|\n`;
  }

  private formatMemoryEntry(entry: MemoryEntry): string {
    return `# ${entry.title}\n\n> Type: ${entry.type}\n> Created: ${entry.createdAt}\n> Status: ${entry.status}\n> Tags: ${entry.tags.join(", ")}\n\n${entry.content}\n`;
  }

  private generateId(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50); }
  private statusEmoji(status: string): string {
    switch (status) { case "fresh": return "🟢"; case "referenced": return "🟡"; case "stale": return "🟠"; case "archived": return "🔴"; default: return "⚪"; }
  }
}

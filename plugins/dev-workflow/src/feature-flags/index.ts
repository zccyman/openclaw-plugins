import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface FeatureFlagEntry {
  name: string;
  type: "release" | "ops" | "experiment" | "permission";
  status: "enabled" | "disabled" | "gradual" | "deprecated";
  createdAt: string;
  plannedCleanup: string;
  description: string;
  codeLocations: string[];
  lastReferenced: string;
}

export interface FeatureFlagRegistry {
  flags: FeatureFlagEntry[];
  updatedAt: string;
}

export class FeatureFlagManager {
  private runtime: PluginRuntime;
  private readonly REGISTRY_FILE = "docs/feature-flags.md";

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  async createFlag(projectDir: string, entry: Omit<FeatureFlagEntry, "codeLocations" | "lastReferenced">): Promise<FeatureFlagEntry> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    const flag: FeatureFlagEntry = {
      ...entry,
      codeLocations: [],
      lastReferenced: new Date().toISOString(),
    };

    logger.info(`[FeatureFlagManager] Creating flag: ${flag.name} (${flag.type})`);

    const registry = await this.loadRegistry(projectDir);
    const existing = registry.flags.find((f) => f.name === flag.name);
    if (existing) {
      logger.warn(`[FeatureFlagManager] Flag ${flag.name} already exists, updating`);
      Object.assign(existing, flag);
    } else {
      registry.flags.push(flag);
    }
    registry.updatedAt = new Date().toISOString();
    await this.saveRegistry(projectDir, registry);

    return flag;
  }

  async isEnabled(projectDir: string, flagName: string): Promise<boolean> {
    const registry = await this.loadRegistry(projectDir);
    const flag = registry.flags.find((f) => f.name === flagName);
    if (!flag) return false;
    if (flag.status === "deprecated") return false;
    return flag.status === "enabled" || flag.status === "gradual";
  }

  async scanForFlags(projectDir: string): Promise<FeatureFlagEntry[]> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[FeatureFlagManager] Scanning for flags in ${projectDir}`);

    const found: FeatureFlagEntry[] = [];
    const patterns = [
      { regex: /feature_flags\.is_enabled\(['"]([^'"]+)['"]\)/g, type: "release" as const },
      { regex: /useFeatureFlag\(['"]([^'"]+)['"]\)/g, type: "release" as const },
      { regex: /is_enabled\(['"]([^'"]+)['"]\)/g, type: "release" as const },
      { regex: /featureFlag\(['"]([^'"]+)['"]\)/g, type: "release" as const },
      { regex: /process\.env\.FF_([A-Z_]+)/g, type: "ops" as const },
    ];

    const files = this.findSourceFiles(projectDir);
    for (const file of files.slice(0, 100)) {
      try {
        const content = readFileSync(file, "utf-8");
        for (const { regex, type } of patterns) {
          let match;
          while ((match = regex.exec(content)) !== null) {
            const name = match[1];
            const relativePath = file.replace(projectDir + "/", "");
            found.push({
              name,
              type,
              status: "enabled",
              createdAt: new Date().toISOString(),
              plannedCleanup: "TBD",
              description: `Auto-detected in ${relativePath}`,
              codeLocations: [relativePath],
              lastReferenced: new Date().toISOString(),
            });
          }
        }
      } catch { /* skip */ }
    }

    const registry = await this.loadRegistry(projectDir);
    for (const flag of found) {
      const existing = registry.flags.find((f) => f.name === flag.name);
      if (existing) {
        if (!existing.codeLocations.includes(flag.codeLocations[0])) {
          existing.codeLocations.push(flag.codeLocations[0]);
        }
        existing.lastReferenced = new Date().toISOString();
      } else {
        registry.flags.push(flag);
      }
    }
    registry.updatedAt = new Date().toISOString();
    await this.saveRegistry(projectDir, registry);

    return found;
  }

  async detectCleanupCandidates(projectDir: string): Promise<FeatureFlagEntry[]> {
    const registry = await this.loadRegistry(projectDir);
    const now = new Date();
    const candidates: FeatureFlagEntry[] = [];

    for (const flag of registry.flags) {
      if (flag.plannedCleanup !== "TBD") {
        const cleanupDate = new Date(flag.plannedCleanup);
        if (cleanupDate < now) {
          candidates.push(flag);
        }
      }

      if (flag.status === "deprecated") {
        candidates.push(flag);
      }
    }

    return candidates;
  }

  async generateCodeSnippet(flagName: string, language: "typescript" | "python"): Promise<string> {
    if (language === "typescript") {
      return `const ${flagName}Enabled = useFeatureFlag('${flagName}');
if (${flagName}Enabled) {
  // New feature implementation
} else {
  // Legacy implementation
}`;
    }

    return `if feature_flags.is_enabled('${flagName}'):
    # New feature implementation
    pass
else:
    # Legacy implementation
    pass`;
  }

  async formatRegistryAsMarkdown(projectDir: string): Promise<string> {
    const registry = await this.loadRegistry(projectDir);

    const lines = [
      "# Feature Flags Registry",
      "",
      `> Last updated: ${registry.updatedAt}`,
      "",
      "| Flag Name | Type | Status | Created | Planned Cleanup | Description |",
      "|-----------|------|--------|---------|-----------------|-------------|",
      ...registry.flags.map((f) => `| ${f.name} | ${f.type} | ${this.statusEmoji(f.status)} ${f.status} | ${f.createdAt.split("T")[0]} | ${f.plannedCleanup} | ${f.description} |`),
      "",
    ];

    return lines.join("\n");
  }

  private statusEmoji(status: string): string {
    switch (status) {
      case "enabled": return "🟢";
      case "disabled": return "⚪";
      case "gradual": return "🟡";
      case "deprecated": return "🔴";
      default: return "⚪";
    }
  }

  private async loadRegistry(projectDir: string): Promise<FeatureFlagRegistry> {
    const filePath = join(projectDir, this.REGISTRY_FILE);
    if (!existsSync(filePath)) {
      return { flags: [], updatedAt: new Date().toISOString() };
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const flags: FeatureFlagEntry[] = [];
      const lines = content.split("\n").filter((l) => l.startsWith("|") && !l.includes("---"));

      for (const line of lines.slice(1)) {
        const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 6) {
          flags.push({
            name: parts[0],
            type: parts[1] as FeatureFlagEntry["type"],
            status: parts[2].replace(/^[🟢⚪🟡🔴]\s*/, "") as FeatureFlagEntry["status"],
            createdAt: parts[3],
            plannedCleanup: parts[4],
            description: parts[5],
            codeLocations: [],
            lastReferenced: new Date().toISOString(),
          });
        }
      }

      return { flags, updatedAt: new Date().toISOString() };
    } catch {
      return { flags: [], updatedAt: new Date().toISOString() };
    }
  }

  private async saveRegistry(projectDir: string, registry: FeatureFlagRegistry): Promise<void> {
    const filePath = join(projectDir, this.REGISTRY_FILE);
    const docsDir = join(projectDir, "docs");
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

    const content = await this.formatRegistryAsMarkdown(projectDir);
    writeFileSync(filePath, content);
  }

  private findSourceFiles(projectDir: string): string[] {
    const files: string[] = [];
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py"];
    const skipDirs = ["node_modules", ".git", "dist", "coverage", ".venv"];

    const walk = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!skipDirs.includes(entry.name)) walk(fullPath);
          } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch { /* skip */ }
    };

    walk(projectDir);
    return files;
  }
}

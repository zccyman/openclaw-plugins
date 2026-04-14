import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import type { WorkflowMode } from "../types.js";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { DirectoryTemplateManager } from "../directory-templates/index.js";
import type { TemplateId } from "../directory-templates/index.js";

const execAsync = promisify(exec);

export interface BootstrapReport {
  checks: BootstrapCheck[];
  techStack: TechStackInfo;
  projectType: WorkflowMode;
  suggestions: string[];
}

export interface BootstrapCheck {
  id: number;
  name: string;
  status: "ok" | "created" | "suggested" | "skipped";
  details: string;
}

export interface TechStackInfo {
  language: string;
  frameworks: string[];
  testRunner: string;
  linter: string;
  formatter: string;
}

export class BootstrapManager {
  private runtime: PluginRuntime;
  private templateManager: DirectoryTemplateManager;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
    this.templateManager = new DirectoryTemplateManager(runtime);
  }

  async bootstrap(projectDir: string, mode: WorkflowMode = "standard"): Promise<BootstrapReport> {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[BootstrapManager] Bootstrapping project in ${projectDir} (mode: ${mode})`);

    if (mode === "quick") {
      return { checks: [], techStack: this.detectTechStack(projectDir), projectType: "quick", suggestions: ["Quick mode: skipping bootstrap"] };
    }

    const checks: BootstrapCheck[] = [];
    const suggestions: string[] = [];

    checks.push(await this.checkDevWorkflowFile(projectDir, suggestions));
    checks.push(await this.checkGitIgnore(projectDir, suggestions));
    checks.push(await this.checkProjectStructure(projectDir, mode, suggestions));
    checks.push(await this.checkTestFramework(projectDir, suggestions));
    checks.push(await this.checkLintFormat(projectDir, suggestions));
    checks.push(await this.checkDocsDirectory(projectDir, suggestions));
    checks.push(await this.checkGitRepository(projectDir, suggestions));
    checks.push(await this.checkReadme(projectDir, suggestions));

    if (mode === "full") {
      checks.push(await this.checkMemoryDirectory(projectDir, suggestions));
      checks.push(await this.checkOpenSpecDirectory(projectDir, suggestions));
    }

    const techStack = this.detectTechStack(projectDir);

    const report: BootstrapReport = {
      checks,
      techStack,
      projectType: mode,
      suggestions,
    };

    logger.info(`[BootstrapManager] Bootstrap complete: ${checks.filter((c) => c.status === "ok").length}/${checks.length} checks passed`);
    return report;
  }

  private async checkDevWorkflowFile(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const filePath = join(projectDir, ".dev-workflow.md");
    if (existsSync(filePath)) {
      return { id: 1, name: ".dev-workflow.md", status: "ok", details: "File exists" };
    }

    const techStack = this.detectTechStack(projectDir);
    const content = this.generateDevWorkflowMd(techStack);
    try {
      writeFileSync(filePath, content);
      suggestions.push("Created .dev-workflow.md with auto-detected tech stack");
      return { id: 1, name: ".dev-workflow.md", status: "created", details: "Auto-generated from tech stack detection" };
    } catch {
      suggestions.push("Create .dev-workflow.md with project architecture and validation commands");
      return { id: 1, name: ".dev-workflow.md", status: "suggested", details: "Missing — should create" };
    }
  }

  private async checkGitIgnore(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const filePath = join(projectDir, ".gitignore");
    const devWorkflowEntries = [
      "docs/plans/",
      ".env",
      ".env.local",
      "*.log",
      "node_modules/",
      "dist/",
      "coverage/",
      ".dev-workflow-context.json",
    ];

    if (!existsSync(filePath)) {
      try {
        writeFileSync(filePath, devWorkflowEntries.join("\n") + "\n");
        suggestions.push("Created .gitignore with standard entries");
        return { id: 2, name: ".gitignore", status: "created", details: "Created with dev-workflow entries" };
      } catch {
        suggestions.push("Create .gitignore with standard entries");
        return { id: 2, name: ".gitignore", status: "suggested", details: "Missing" };
      }
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const missing = devWorkflowEntries.filter((entry) => !content.includes(entry));
      if (missing.length > 0) {
        try {
          const appendContent = "\n# Dev Workflow entries\n" + missing.join("\n") + "\n";
          writeFileSync(filePath, content + appendContent);
          suggestions.push(`Added missing .gitignore entries: ${missing.join(", ")}`);
          return { id: 2, name: ".gitignore", status: "created", details: `Appended: ${missing.join(", ")}` };
        } catch {
          suggestions.push(`Add to .gitignore: ${missing.join(", ")}`);
          return { id: 2, name: ".gitignore", status: "suggested", details: `Missing entries: ${missing.join(", ")}` };
        }
      }
      return { id: 2, name: ".gitignore", status: "ok", details: "All entries present" };
    } catch {
      return { id: 2, name: ".gitignore", status: "suggested", details: "Cannot read file" };
    }
  }

  private async checkProjectStructure(projectDir: string, mode: string, suggestions: string[]): Promise<BootstrapCheck> {
    const detectedTemplate = this.templateManager.detectTemplate(projectDir);
    const template = this.templateManager.getTemplate(detectedTemplate);

    if (!template) {
      const expectedDirs = mode === "full"
        ? ["src", "tests", "docs", "openspec"]
        : ["src", "tests", "docs"];
      const missing = expectedDirs.filter((dir) => !existsSync(join(projectDir, dir)));
      if (missing.length === 0) {
        return { id: 3, name: "Project structure", status: "ok", details: "All expected directories present" };
      }
      suggestions.push(`Create missing directories: ${missing.join(", ")}`);
      return { id: 3, name: "Project structure", status: "suggested", details: `Missing: ${missing.join(", ")}` };
    }

    const missing = template.directories.filter((dir) => !existsSync(join(projectDir, dir)));

    if (missing.length === 0) {
      return { id: 3, name: "Project structure", status: "ok", details: `Template ${template.id} structure complete` };
    }

    suggestions.push(`Apply template ${template.id} or create missing directories: ${missing.join(", ")}`);
    return { id: 3, name: "Project structure", status: "suggested", details: `Template ${template.id}: missing ${missing.join(", ")}` };
  }

  private async checkTestFramework(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const techStack = this.detectTechStack(projectDir);
    if (techStack.testRunner) {
      return { id: 4, name: "Test framework", status: "ok", details: `Detected: ${techStack.testRunner}` };
    }

    if (techStack.language === "TypeScript" || techStack.language === "JavaScript") {
      suggestions.push("Install and configure vitest: npm install -D vitest");
      return { id: 4, name: "Test framework", status: "suggested", details: "No test framework detected — suggest vitest" };
    }

    if (techStack.language === "Python") {
      suggestions.push("Install and configure pytest: pip install pytest");
      return { id: 4, name: "Test framework", status: "suggested", details: "No test framework detected — suggest pytest" };
    }

    return { id: 4, name: "Test framework", status: "suggested", details: "Cannot determine recommended test framework" };
  }

  private async checkLintFormat(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const techStack = this.detectTechStack(projectDir);
    const hasLint = !!techStack.linter;
    const hasFormat = !!techStack.formatter;

    if (hasLint && hasFormat) {
      return { id: 5, name: "Lint/Format", status: "ok", details: `Lint: ${techStack.linter}, Format: ${techStack.formatter}` };
    }

    const missing: string[] = [];
    if (!hasLint) missing.push("linter");
    if (!hasFormat) missing.push("formatter");

    if (techStack.language === "TypeScript" || techStack.language === "JavaScript") {
      suggestions.push(`Configure ${missing.join(" and ")}: oxlint/eslint + prettier`);
      return { id: 5, name: "Lint/Format", status: "suggested", details: `Missing: ${missing.join(", ")} — suggest oxlint + prettier` };
    }

    if (techStack.language === "Python") {
      suggestions.push(`Configure ${missing.join(" and ")}: ruff + black`);
      return { id: 5, name: "Lint/Format", status: "suggested", details: `Missing: ${missing.join(", ")} — suggest ruff + black` };
    }

    return { id: 5, name: "Lint/Format", status: "suggested", details: `Missing: ${missing.join(", ")}` };
  }

  private async checkDocsDirectory(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const docsDir = join(projectDir, "docs");
    const plansDir = join(projectDir, "docs", "plans");
    const memoryDir = join(projectDir, "docs", "memory");

    if (existsSync(docsDir) && existsSync(plansDir) && existsSync(memoryDir)) {
      return { id: 6, name: "Docs directory", status: "ok", details: "docs/, docs/plans/, docs/memory/ all exist" };
    }

    try {
      if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
      if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
      if (!existsSync(memoryDir)) {
        mkdirSync(memoryDir, { recursive: true });
        mkdirSync(join(memoryDir, "decisions"), { recursive: true });
        mkdirSync(join(memoryDir, "patterns"), { recursive: true });
        mkdirSync(join(memoryDir, "constraints"), { recursive: true });
        mkdirSync(join(memoryDir, "lessons"), { recursive: true });
      }
      suggestions.push("Created docs/, docs/plans/, docs/memory/ directory structure");
      return { id: 6, name: "Docs directory", status: "created", details: "Created docs structure with plans/ and memory/" };
    } catch {
      suggestions.push("Create docs/, docs/plans/, docs/memory/ directories");
      return { id: 6, name: "Docs directory", status: "suggested", details: "Missing docs structure" };
    }
  }

  private async checkGitRepository(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const gitDir = join(projectDir, ".git");
    if (existsSync(gitDir)) {
      return { id: 7, name: "Git repository", status: "ok", details: "Git repository initialized" };
    }

    try {
      await execAsync("git init", { cwd: projectDir, timeout: 10000 });
      suggestions.push("Initialized git repository");
      return { id: 7, name: "Git repository", status: "created", details: "Git repository initialized" };
    } catch {
      suggestions.push("Initialize git repository: git init");
      return { id: 7, name: "Git repository", status: "suggested", details: "Not a git repository" };
    }
  }

  private async checkReadme(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const readmePath = join(projectDir, "README.md");
    if (!existsSync(readmePath)) {
      const techStack = this.detectTechStack(projectDir);
      const content = this.generateReadme(techStack);
      try {
        writeFileSync(readmePath, content);
        suggestions.push("Created README.md");
        return { id: 8, name: "README.md", status: "created", details: "Auto-generated from project analysis" };
      } catch {
        suggestions.push("Create README.md with project documentation");
        return { id: 8, name: "README.md", status: "suggested", details: "Missing" };
      }
    }

    try {
      const content = readFileSync(readmePath, "utf-8");
      if (content.length < 50) {
        suggestions.push("README.md is too short — consider adding more content");
        return { id: 8, name: "README.md", status: "suggested", details: "Exists but minimal content" };
      }
      return { id: 8, name: "README.md", status: "ok", details: `Exists (${content.length} chars)` };
    } catch {
      return { id: 8, name: "README.md", status: "suggested", details: "Cannot read README.md" };
    }
  }

  private async checkMemoryDirectory(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const memoryDir = join(projectDir, "docs", "memory");
    const subdirs = ["decisions", "patterns", "constraints", "lessons"];
    const missing = subdirs.filter((d) => !existsSync(join(memoryDir, d)));

    if (missing.length === 0) {
      const indexPath = join(memoryDir, "index.md");
      if (existsSync(indexPath)) {
        return { id: 9, name: "Memory directory", status: "ok", details: "Full memdir structure with index.md" };
      }
      try {
        writeFileSync(indexPath, "# Memory Index\n\n## Decisions\n\n## Patterns\n\n## Constraints\n\n## Lessons\n");
        return { id: 9, name: "Memory directory", status: "created", details: "Created index.md" };
      } catch {
        return { id: 9, name: "Memory directory", status: "suggested", details: "Missing index.md" };
      }
    }

    suggestions.push(`Create memory subdirectories: ${missing.join(", ")}`);
    return { id: 9, name: "Memory directory", status: "suggested", details: `Missing: ${missing.join(", ")}` };
  }

  private async checkOpenSpecDirectory(projectDir: string, suggestions: string[]): Promise<BootstrapCheck> {
    const openspecDir = join(projectDir, "openspec");
    const changesDir = join(openspecDir, "changes");
    const specsDir = join(openspecDir, "specs");

    if (existsSync(openspecDir) && existsSync(changesDir) && existsSync(specsDir)) {
      return { id: 10, name: "OpenSpec directory", status: "ok", details: "openspec/changes/ and openspec/specs/ exist" };
    }

    try {
      if (!existsSync(openspecDir)) mkdirSync(openspecDir, { recursive: true });
      if (!existsSync(changesDir)) mkdirSync(changesDir, { recursive: true });
      if (!existsSync(specsDir)) mkdirSync(specsDir, { recursive: true });
      suggestions.push("Created openspec/ directory structure");
      return { id: 10, name: "OpenSpec directory", status: "created", details: "Created openspec/changes/ and openspec/specs/" };
    } catch {
      suggestions.push("Create openspec/ directory with changes/ and specs/ subdirectories");
      return { id: 10, name: "OpenSpec directory", status: "suggested", details: "Missing openspec structure" };
    }
  }

  private detectTechStack(projectDir: string): TechStackInfo {
    const info: TechStackInfo = { language: "Unknown", frameworks: [], testRunner: "", linter: "", formatter: "" };

    if (existsSync(join(projectDir, "package.json"))) {
      info.language = "TypeScript";
      try {
        const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
        info.frameworks = [
          ...(pkg.dependencies?.express ? ["Express"] : []),
          ...(pkg.dependencies?.fastify ? ["Fastify"] : []),
          ...(pkg.dependencies?.react ? ["React"] : []),
          ...(pkg.dependencies?.vue ? ["Vue"] : []),
          ...(pkg.dependencies?.next ? ["Next.js"] : []),
        ];
        if (pkg.devDependencies?.vitest || pkg.devDependencies?.["vitest"]) info.testRunner = "vitest";
        else if (pkg.devDependencies?.jest) info.testRunner = "jest";
        if (pkg.devDependencies?.oxlint) info.linter = "oxlint";
        else if (pkg.devDependencies?.eslint) info.linter = "eslint";
        if (pkg.devDependencies?.prettier) info.formatter = "prettier";
      } catch { /* skip */ }
    }

    if (existsSync(join(projectDir, "requirements.txt")) || existsSync(join(projectDir, "pyproject.toml"))) {
      info.language = "Python";
      if (existsSync(join(projectDir, "pytest.ini")) || existsSync(join(projectDir, "conftest.py"))) info.testRunner = "pytest";
      if (existsSync(join(projectDir, "ruff.toml"))) { info.linter = "ruff"; info.formatter = "ruff format"; }
      else if (existsSync(join(projectDir, ".flake8"))) info.linter = "flake8";
      if (existsSync(join(projectDir, ".prettierrc"))) info.formatter = "black";
    }

    if (existsSync(join(projectDir, "Cargo.toml"))) {
      info.language = "Rust";
      info.testRunner = "cargo test";
      info.linter = "clippy";
      info.formatter = "rustfmt";
    }

    if (existsSync(join(projectDir, "go.mod"))) {
      info.language = "Go";
      info.testRunner = "go test";
      info.linter = "golangci-lint";
      info.formatter = "gofmt";
    }

    return info;
  }

  private generateDevWorkflowMd(techStack: TechStackInfo): string {
    return `# Dev Workflow 配置

## 项目信息
- 技术栈：${techStack.language}${techStack.frameworks.length > 0 ? ` + ${techStack.frameworks.join(", ")}` : ""}
- 项目类型：Standard 📋
- 开源/闭源：待确认

## 架构概览
待分析

## 验证命令
- lint: ${this.getLintCommand(techStack)}
- test: ${this.getTestCommand(techStack)}
- format: ${this.getFormatCommand(techStack)}

## 已知决策
<空，开发过程中积累>

## 约束
<空，开发过程中积累>
`;
  }

  private getLintCommand(tech: TechStackInfo): string {
    if (tech.linter === "oxlint") return "npx oxlint";
    if (tech.linter === "eslint") return "npx eslint .";
    if (tech.linter === "ruff") return "ruff check .";
    if (tech.linter === "clippy") return "cargo clippy";
    if (tech.linter === "golangci-lint") return "golangci-lint run";
    return "<configure lint command>";
  }

  private getTestCommand(tech: TechStackInfo): string {
    if (tech.testRunner === "vitest") return "npx vitest run";
    if (tech.testRunner === "jest") return "npx jest";
    if (tech.testRunner === "pytest") return "pytest -q";
    if (tech.testRunner === "cargo test") return "cargo test";
    if (tech.testRunner === "go test") return "go test ./...";
    return "<configure test command>";
  }

  private getFormatCommand(tech: TechStackInfo): string {
    if (tech.formatter === "prettier") return "npx prettier --write .";
    if (tech.formatter === "ruff format") return "ruff format .";
    if (tech.formatter === "black") return "black .";
    if (tech.formatter === "rustfmt") return "cargo fmt";
    if (tech.formatter === "gofmt") return "gofmt -w .";
    return "<configure format command>";
  }

  private generateReadme(tech: TechStackInfo): string {
    return `# Project

[中文文档](README_CN.md)

## Overview

Auto-generated project documentation.

## Tech Stack

- Language: ${tech.language}
${tech.frameworks.length > 0 ? `- Frameworks: ${tech.frameworks.join(", ")}` : ""}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run tests
npm test

# Lint
npm run lint
\`\`\`

## Project Structure

\`\`\`
project/
├── src/
├── tests/
├── docs/
└── openspec/
\`\`\`
`;
  }
}

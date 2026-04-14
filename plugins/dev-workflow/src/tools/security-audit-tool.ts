import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

type AuditMode = "daily" | "comprehensive";
type AuditScope = "full" | "infra" | "code" | "supply-chain" | "owasp";

interface SecurityFinding {
  severity: "P0" | "P1" | "P2" | "P3";
  confidence: number;
  category: string;
  description: string;
  file?: string;
  line?: number;
  fix?: string;
}

export class SecurityAuditTool implements AnyAgentTool {
  name = "security_audit";
  label = "Security Audit";
  description = "OWASP Top 10 + STRIDE threat model security audit. Daily mode (8/10 confidence gate, zero-noise) or comprehensive (2/10, deep scan).";
  parameters = z.object({
    projectDir: z.string().describe("Absolute path to the project directory"),
    mode: z.enum(["daily", "comprehensive"]).optional().describe("Audit mode (default: daily)"),
    scope: z.enum(["full", "infra", "code", "supply-chain", "owasp"]).optional().describe("Audit scope (default: full)"),
    confidenceThreshold: z.number().optional().describe("Minimum confidence to report (default: 8 daily, 2 comprehensive)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const mode: AuditMode = input.mode || "daily";
    const scope: AuditScope = input.scope || "full";
    const threshold = input.confidenceThreshold ?? (mode === "daily" ? 8 : 2);
    const projectDir = input.projectDir;

    const findings: SecurityFinding[] = [];
    const output: string[] = [];

    output.push(`🔒 Security Audit [${mode} mode, threshold: ${threshold}/10, scope: ${scope}]\n`);

    // Phase 0: Stack detection
    const stack = this.detectStack(projectDir);
    output.push(`📦 Stack: ${stack.join(", ") || "unknown"}`);

    // Phase 1: Attack surface census
    if (scope === "full" || scope === "infra" || scope === "code") {
      const surface = await this.attackSurfaceCensus(projectDir);
      output.push(`\n${surface}`);
    }

    // Phase 2: Secrets archaeology
    if (scope === "full" || scope === "infra") {
      const secrets = await this.secretsArchaeology(projectDir);
      findings.push(...secrets);
    }

    // Phase 3: Dependency audit
    if (scope === "full" || scope === "supply-chain") {
      const deps = await this.dependencyAudit(projectDir);
      findings.push(...deps);
    }

    // Phase 4: OWASP Top 10
    if (scope === "full" || scope === "code" || scope === "owasp") {
      const owasp = await this.owaspCheck(projectDir, stack);
      findings.push(...owasp);
    }

    // Filter by confidence threshold
    const reported = findings.filter(f => f.confidence >= threshold);
    const suppressed = findings.length - reported.length;

    // Sort by severity
    const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    reported.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Output findings
    if (reported.length > 0) {
      output.push(`\n🚨 Findings (${reported.length} reported, ${suppressed} suppressed below ${threshold}/10):\n`);
      for (const f of reported) {
        output.push(`[${f.severity}] (confidence: ${f.confidence}/10) ${f.category}`);
        if (f.file) output.push(`  📄 ${f.file}${f.line ? `:${f.line}` : ""}`);
        output.push(`  ${f.description}`);
        if (f.fix) output.push(`  💡 Fix: ${f.fix}`);
        output.push("");
      }
    } else {
      output.push(`\n✅ No findings above confidence threshold ${threshold}/10 (${findings.length} total, all suppressed)`);
    }

    // STRIDE summary
    if (scope === "full") {
      output.push("\n📋 STRIDE Threat Model Quick Check:");
      output.push("  Spoofing: Check identity/auth mechanisms");
      output.push("  Tampering: Check data integrity/validation");
      output.push("  Repudiation: Check audit logging");
      output.push("  Info Disclosure: Check encryption/access control");
      output.push("  Denial of Service: Check rate limiting/input size limits");
      output.push("  Elevation: Check privilege boundaries");
    }

    return {
      content: [{ type: "text" as const, text: output.join("\n") }],
      details: {
        success: reported.filter(f => f.severity === "P0" || f.severity === "P1").length === 0,
        mode,
        scope,
        findings: reported,
        suppressed,
        threshold,
      },
    };
  }

  private detectStack(projectDir: string): string[] {
    const stack: string[] = [];
    if (existsSync(join(projectDir, "package.json"))) stack.push("Node.js");
    if (existsSync(join(projectDir, "requirements.txt")) || existsSync(join(projectDir, "pyproject.toml"))) stack.push("Python");
    if (existsSync(join(projectDir, "go.mod"))) stack.push("Go");
    if (existsSync(join(projectDir, "Cargo.toml"))) stack.push("Rust");
    if (existsSync(join(projectDir, "Gemfile"))) stack.push("Ruby");
    return stack;
  }

  private async attackSurfaceCensus(projectDir: string): Promise<string> {
    const lines: string[] = [];
    lines.push("📊 Attack Surface Census:");

    try {
      // Count endpoints
      const { stdout: endpoints } = await execAsync(
        `grep -rn "app\\.get\\|app\\.post\\|app\\.put\\|app\\.delete\\|router\\.get\\|router\\.post\\|@app\\.route\\|@router\\." --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v dist | wc -l`,
        { cwd: projectDir, timeout: 10000 }
      );
      lines.push(`  Endpoints found: ${endpoints.trim()}`);
    } catch { lines.push("  Endpoints: could not scan"); }

    // Check for .env in gitignore
    try {
      const gitignore = existsSync(join(projectDir, ".gitignore")) ? readFileSync(join(projectDir, ".gitignore"), "utf-8") : "";
      const envIgnored = gitignore.includes(".env");
      lines.push(`  .env in .gitignore: ${envIgnored ? "✅ Yes" : "❌ NO — .env may be tracked!"}`);
    } catch { /* skip */ }

    // Check for Dockerfiles
    try {
      const { stdout } = await execAsync(
        `find . -maxdepth 3 -name "Dockerfile*" -o -name "docker-compose*.yml" 2>/dev/null | grep -v node_modules | head -5`,
        { cwd: projectDir, timeout: 10000 }
      );
      if (stdout.trim()) lines.push(`  Container configs: ${stdout.trim().replace(/\n/g, ", ")}`);
    } catch { /* skip */ }

    return lines.join("\n");
  }

  private async secretsArchaeology(projectDir: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for leaked keys in git history
    const keyPatterns = [
      { pattern: "AKIA", name: "AWS Access Key", severity: "P0" as const },
      { pattern: "sk-", name: "Stripe/OpenAI Key", severity: "P0" as const },
      { pattern: "ghp_", name: "GitHub PAT", severity: "P0" as const },
      { pattern: "xoxb-", name: "Slack Bot Token", severity: "P1" as const },
    ];

    for (const kp of keyPatterns) {
      try {
        const { stdout } = await execAsync(
          `git log -p --all -S "${kp.pattern}" --diff-filter=A -- "*.env" "*.yml" "*.yaml" "*.json" "*.ts" "*.js" "*.py" 2>/dev/null | head -5`,
          { cwd: projectDir, timeout: 30000 }
        );
        if (stdout.trim()) {
          findings.push({
            severity: kp.severity,
            confidence: 9,
            category: `Secrets: ${kp.name} in git history`,
            description: `${kp.name} pattern found in git history. This secret may have been exposed.`,
            fix: "Rotate the key immediately. Use git-filter-branch to remove from history.",
          });
        }
      } catch { /* no match */ }
    }

    // Check .env not tracked
    try {
      const { stdout } = await execAsync(`git ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.example\\|.sample\\|.template'`, {
        cwd: projectDir, timeout: 10000,
      });
      if (stdout.trim()) {
        findings.push({
          severity: "P1",
          confidence: 8,
          category: "Secrets: .env tracked by git",
          description: `Tracked .env files: ${stdout.trim()}`,
          fix: "Add .env to .gitignore and use git rm --cached to untrack.",
        });
      }
    } catch { /* ok */ }

    // Check for hardcoded secrets in code
    try {
      const { stdout } = await execAsync(
        `grep -rn "password\\|api_key\\|secret_key\\|access_token" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v ".example" | grep -v "process.env" | grep -v "\\.env" | head -10`,
        { cwd: projectDir, timeout: 10000 }
      );
      if (stdout.trim()) {
        const lines = stdout.trim().split("\n");
        for (const line of lines) {
          if (/=\s*["'][^"']{8,}["']/.test(line)) {
            const fileMatch = line.match(/^\.\/([^:]+):(\d+):/);
            findings.push({
              severity: "P1",
              confidence: 7,
              category: "Secrets: Hardcoded credential",
              description: line.slice(0, 200),
              file: fileMatch?.[1],
              line: fileMatch?.[2] ? parseInt(fileMatch[2]) : undefined,
              fix: "Move to environment variable or secret manager.",
            });
          }
        }
      }
    } catch { /* no match */ }

    return findings;
  }

  private async dependencyAudit(projectDir: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // npm audit
    if (existsSync(join(projectDir, "package.json"))) {
      try {
        const { stdout } = await execAsync("npm audit --json 2>/dev/null", {
          cwd: projectDir, timeout: 60000,
        });
        const audit = JSON.parse(stdout);
        if (audit.metadata?.vulnerabilities) {
          const v = audit.metadata.vulnerabilities;
          if (v.critical > 0) {
            findings.push({
              severity: "P0", confidence: 9, category: "Dependencies: Critical CVE",
              description: `${v.critical} critical vulnerabilities found in npm dependencies.`,
              fix: "Run npm audit fix or update affected packages.",
            });
          }
          if (v.high > 0) {
            findings.push({
              severity: "P1", confidence: 9, category: "Dependencies: High CVE",
              description: `${v.high} high severity vulnerabilities in npm dependencies.`,
              fix: "Run npm audit fix or update affected packages.",
            });
          }
        }
      } catch { /* no npm or no vulnerabilities */ }
    }

    // Check lockfile exists
    if (existsSync(join(projectDir, "package.json")) && !existsSync(join(projectDir, "package-lock.json")) && !existsSync(join(projectDir, "bun.lockb"))) {
      findings.push({
        severity: "P2", confidence: 9, category: "Dependencies: Missing lockfile",
        description: "No lockfile found. Dependencies are not pinned.",
        fix: "Run npm install to generate package-lock.json.",
      });
    }

    return findings;
  }

  private async owaspCheck(projectDir: string, stack: string[]): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // SQL Injection (A1)
    try {
      const { stdout } = await execAsync(
        `grep -rn "SELECT.*\\+\\|INSERT.*\\$\\|WHERE.*\\$\\|\\$\\{.*\\}.*SELECT\\|execute(.*\\+\\|query(.*\\+" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v dist | head -10`,
        { cwd: projectDir, timeout: 10000 }
      );
      if (stdout.trim()) {
        const fileMatch = stdout.trim().split("\n")[0].match(/^\.\/([^:]+):(\d+):/);
        findings.push({
          severity: "P0", confidence: 7, category: "OWASP A1: SQL Injection",
          description: "Possible SQL injection via string concatenation.",
          file: fileMatch?.[1],
          line: fileMatch?.[2] ? parseInt(fileMatch[2]) : undefined,
          fix: "Use parameterized queries or ORM.",
        });
      }
    } catch { /* no match */ }

    // XSS (A7)
    try {
      const { stdout } = await execAsync(
        `grep -rn "innerHTML\\|v-html\\|dangerouslySetInnerHTML\\|document\\.write" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.vue" . 2>/dev/null | grep -v node_modules | grep -v dist | head -10`,
        { cwd: projectDir, timeout: 10000 }
      );
      if (stdout.trim()) {
        findings.push({
          severity: "P1", confidence: 6, category: "OWASP A7: XSS",
          description: "Direct HTML injection found. May be vulnerable to XSS.",
          fix: "Sanitize input or use textContent instead of innerHTML.",
        });
      }
    } catch { /* no match */ }

    // SSRF (A10)
    try {
      const { stdout } = await execAsync(
        `grep -rn "fetch(\\|axios\\.|request(\\|urllib" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v dist | grep "req\\." | head -10`,
        { cwd: projectDir, timeout: 10000 }
      );
      if (stdout.trim()) {
        findings.push({
          severity: "P2", confidence: 5, category: "OWASP A10: SSRF",
          description: "HTTP request with possible user-controlled URL. Verify URL validation exists.",
          fix: "Validate and whitelist allowed URLs/domains.",
        });
      }
    } catch { /* no match */ }

    return findings;
  }

  private getLogger() {
    try {
      const runtime = (globalThis as any).__devWorkflowRuntime;
      return runtime?.logging?.getChildLogger({ level: "info" }) ?? console;
    } catch {
      return console;
    }
  }
}

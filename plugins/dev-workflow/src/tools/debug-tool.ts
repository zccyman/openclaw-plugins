import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { getEngine } from "../channel/runtime.js";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

type DebugPhase = "investigate" | "analyze" | "hypothesize" | "implement";

interface DebugFinding {
  phase: DebugPhase;
  symptom?: string;
  hypothesis?: string;
  evidence?: string;
  rootCause?: string;
  fix?: string;
  affectedFiles: string[];
  confidence: number;
  status: "investigating" | "analyzing" | "testing_hypothesis" | "fixed" | "blocked";
}

export class DebugTool implements AnyAgentTool {
  name = "debug";
  label = "Root Cause Debug";
  description = "Systematic 4-phase root cause debugging. Iron Law: no fixes without root cause investigation. Phases: investigate → analyze → hypothesize → implement.";
  parameters = z.object({
    projectDir: z.string().describe("Absolute path to the project directory"),
    phase: z.enum(["investigate", "analyze", "hypothesize", "implement"]).describe("Current debug phase"),
    symptom: z.string().optional().describe("Error message or symptom description"),
    hypothesis: z.string().optional().describe("Root cause hypothesis"),
    evidence: z.string().optional().describe("Evidence gathered so far"),
    fixDescription: z.string().optional().describe("What was fixed (for implement phase)"),
    affectedFiles: z.array(z.string()).optional().describe("Files involved in the bug"),
  });

  private sessionFindings: DebugFinding[] = [];

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const engine = getEngine();
    const context = engine.getContext();

    switch (input.phase) {
      case "investigate":
        return this.phaseInvestigate(input, context?.projectDir || input.projectDir);
      case "analyze":
        return this.phaseAnalyze(input, context?.projectDir || input.projectDir);
      case "hypothesize":
        return this.phaseHypothesize(input);
      case "implement":
        return this.phaseImplement(input, context?.projectDir || input.projectDir);
    }
  }

  private async phaseInvestigate(input: z.infer<typeof this.parameters>, projectDir: string) {
    const results: string[] = [];
    results.push("🔍 Phase 1: Root Cause Investigation\n");

    if (input.symptom) {
      results.push(`Symptom: ${input.symptom}`);
    }

    // Check recent git changes for affected files
    if (input.affectedFiles && input.affectedFiles.length > 0) {
      try {
        const fileList = input.affectedFiles.join(" ");
        const { stdout } = await execAsync(`git log --oneline -20 -- ${fileList}`, {
          cwd: projectDir,
          timeout: 10000,
        });
        if (stdout.trim()) {
          results.push(`\n📜 Recent changes to affected files:\n${stdout.trim()}`);
        } else {
          results.push("\n📜 No recent git history for affected files");
        }
      } catch {
        results.push("\n📜 Could not read git history");
      }
    }

    // Grep for error patterns in affected files
    if (input.affectedFiles && input.affectedFiles.length > 0) {
      try {
        const grepPatterns = input.symptom
          ? input.symptom.split(/\s+/).filter(w => w.length > 3).slice(0, 3).join("|")
          : "Error|Exception|BUG|FIXME";
        const { stdout } = await execAsync(
          `grep -rn "${grepPatterns}" ${input.affectedFiles.join(" ")} 2>/dev/null | head -20`,
          { cwd: projectDir, timeout: 10000 }
        );
        if (stdout.trim()) {
          results.push(`\n🔎 Error pattern matches:\n${stdout.trim()}`);
        }
      } catch {
        // no matches
      }
    }

    // Check for TODOS.md related issues
    if (existsSync(join(projectDir, "TODOS.md"))) {
      try {
        const todos = readFileSync(join(projectDir, "TODOS.md"), "utf-8");
        if (todos.length > 0) {
          results.push(`\n📋 TODOS.md exists (${todos.split("\n").length} lines) — check for related known issues`);
        }
      } catch { /* skip */ }
    }

    const finding: DebugFinding = {
      phase: "investigate",
      symptom: input.symptom,
      affectedFiles: input.affectedFiles || [],
      confidence: 3,
      status: "investigating",
    };
    this.sessionFindings.push(finding);

    results.push("\n\n⚠️ IRON LAW: Do NOT fix anything yet. Form a root cause hypothesis first.");
    results.push("\nOutput: State a specific, testable root cause hypothesis.");

    return {
      content: [{ type: "text" as const, text: results.join("\n") }],
      details: { success: true, phase: "investigate", finding },
    };
  }

  private async phaseAnalyze(input: z.infer<typeof this.parameters>, projectDir: string) {
    const results: string[] = [];
    results.push("🔬 Phase 2: Pattern Analysis\n");

    const patterns = [
      { name: "Race condition", signature: "Intermittent, timing-dependent", check: "Shared mutable state, async without locks" },
      { name: "Null propagation", signature: "NoMethodError, TypeError, Cannot read property", check: "Missing guards on optional values" },
      { name: "State corruption", signature: "Inconsistent data, partial updates", check: "Transactions, callbacks, hooks" },
      { name: "Integration failure", signature: "Timeout, unexpected response format", check: "External API calls, service boundaries" },
      { name: "Config drift", signature: "Works locally, fails in staging/prod", check: "Env vars, feature flags, DB state" },
      { name: "Stale cache", signature: "Shows old data, fixes on cache clear", check: "Redis/CDN/browser cache" },
    ];

    results.push("Known bug patterns — check which matches:\n");
    for (const p of patterns) {
      results.push(`| ${p.name} | ${p.signature} | Check: ${p.check} |`);
    }

    // Check if affected files have recurring bugs (architectural smell)
    if (input.affectedFiles && input.affectedFiles.length > 0) {
      for (const file of input.affectedFiles) {
        try {
          const { stdout } = await execAsync(
            `git log --oneline --all -- "${file}" | grep -i "fix\\|bug\\|patch\\|hotfix" | wc -l`,
            { cwd: projectDir, timeout: 10000 }
          );
          const fixCount = parseInt(stdout.trim());
          if (fixCount > 5) {
            results.push(`\n⚠️ ${file}: ${fixCount} fix commits — architectural smell!`);
          }
        } catch { /* skip */ }
      }
    }

    results.push("\n\nSame file repeatedly buggy = architectural smell, not coincidence.");

    const finding: DebugFinding = {
      phase: "analyze",
      symptom: input.symptom,
      evidence: input.evidence,
      affectedFiles: input.affectedFiles || [],
      confidence: 5,
      status: "analyzing",
    };
    this.sessionFindings.push(finding);

    return {
      content: [{ type: "text" as const, text: results.join("\n") }],
      details: { success: true, phase: "analyze", finding },
    };
  }

  private async phaseHypothesize(input: z.infer<typeof this.parameters>) {
    const results: string[] = [];
    results.push("🧪 Phase 3: Hypothesis Testing\n");

    if (input.hypothesis) {
      results.push(`Hypothesis: ${input.hypothesis}`);
    }
    if (input.evidence) {
      results.push(`Evidence: ${input.evidence}`);
    }

    // Count failed hypotheses
    const failedCount = this.sessionFindings.filter(
      f => f.phase === "hypothesize" && f.status === "blocked"
    ).length;

    if (failedCount >= 3) {
      results.push("\n🛑 3-STRIKE RULE: 3 hypotheses have failed. STOP!");
      results.push("Options:");
      results.push("  A) Continue — I have a new hypothesis");
      results.push("  B) Escalate — needs someone who knows the system");
      results.push("  C) Add logging and wait — instrument the area");

      return {
        content: [{ type: "text" as const, text: results.join("\n") }],
        details: { success: true, phase: "hypothesize", status: "blocked", failedHypotheses: failedCount },
      };
    }

    results.push("\n⚠️ Verify hypothesis before implementing any fix.");
    results.push("Red flags:");
    results.push("  - 'Quick fix for now' — fix it right or escalate");
    results.push("  - Proposing fix before tracing data flow — you're guessing");
    results.push("  - Each fix reveals new problem — wrong layer, not wrong code");

    const finding: DebugFinding = {
      phase: "hypothesize",
      hypothesis: input.hypothesis,
      evidence: input.evidence,
      affectedFiles: input.affectedFiles || [],
      confidence: 7,
      status: "testing_hypothesis",
    };
    this.sessionFindings.push(finding);

    return {
      content: [{ type: "text" as const, text: results.join("\n") }],
      details: { success: true, phase: "hypothesize", finding, failedHypotheses: failedCount },
    };
  }

  private async phaseImplement(input: z.infer<typeof this.parameters>, projectDir: string) {
    const results: string[] = [];
    results.push("🔧 Phase 4: Implementation\n");

    if (!input.fixDescription) {
      return {
        content: [{ type: "text" as const, text: "Error: fixDescription is required for implement phase" }],
        details: { success: false, error: "Missing fixDescription" },
      };
    }

    results.push(`Fix: ${input.fixDescription}`);

    // Check blast radius
    if (input.affectedFiles && input.affectedFiles.length > 5) {
      results.push(`\n⚠️ BLAST RADIUS WARNING: Fix touches ${input.affectedFiles.length} files.`);
      results.push("Options:");
      results.push("  A) Proceed — root cause genuinely spans these files");
      results.push("  B) Split — fix critical path now, defer the rest");
      results.push("  C) Rethink — maybe there's a more targeted approach");
    }

    // Run tests if available
    let testOutput = "";
    try {
      const { stdout, stderr } = await execAsync("npm test 2>&1 || true", {
        cwd: projectDir,
        timeout: 120000,
        env: { ...process.env, CI: "true", NODE_ENV: "test" },
      });
      testOutput = (stdout || stderr || "").slice(0, 500);
      results.push(`\n🧪 Test output:\n${testOutput}`);
    } catch (e: any) {
      results.push(`\n🧪 Tests: Could not run — ${e.message}`);
    }

    // Generate debug report
    results.push("\n" + "═".repeat(40));
    results.push("DEBUG REPORT");
    results.push("═".repeat(40));
    results.push(`Symptom:      ${input.symptom || "N/A"}`);
    results.push(`Root cause:   ${input.hypothesis || "N/A"}`);
    results.push(`Fix:          ${input.fixDescription}`);
    results.push(`Evidence:     ${input.evidence || "N/A"}`);
    results.push(`Files:        ${(input.affectedFiles || []).join(", ") || "N/A"}`);
    results.push(`Status:       DONE`);
    results.push("═".repeat(40));

    results.push("\n💡 Remember: slm remember \"问题→根因→方案\" --tags debug-pattern");

    return {
      content: [{ type: "text" as const, text: results.join("\n") }],
      details: {
        success: true,
        phase: "implement",
        fixDescription: input.fixDescription,
        affectedFiles: input.affectedFiles,
        testOutput,
      },
    };
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

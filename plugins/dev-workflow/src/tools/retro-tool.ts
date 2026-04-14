import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

type RetroPeriod = "24h" | "7d" | "14d" | "30d";

export class RetroTool implements AnyAgentTool {
  name = "retro";
  label = "Weekly Retro";
  description = "Engineering retrospective with commit analysis, hot files, highlights, and trend tracking. Periods: 24h, 7d (default), 14d, 30d.";
  parameters = z.object({
    projectDir: z.string().describe("Absolute path to the project directory"),
    period: z.enum(["24h", "7d", "14d", "30d"]).optional().describe("Lookback period (default: 7d)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const period: RetroPeriod = input.period || "7d";
    const projectDir = input.projectDir;
    const sinceArg = this.getSinceArg(period);

    const output: string[] = [];
    output.push(`📅 Retro Report — last ${period}\n`);
    output.push("═".repeat(50));

    // Basic stats
    let commitCount = 0;
    let netAdded = 0;
    let netDeleted = 0;
    let filesChanged = 0;

    try {
      const { stdout: logOut } = await execAsync(`git log --since="${sinceArg}" --oneline --all`, {
        cwd: projectDir, timeout: 15000,
      });
      commitCount = logOut.trim().split("\n").filter(Boolean).length;
      output.push(`\n📊 Overview`);
      output.push(`  Commits: ${commitCount}`);
    } catch {
      output.push("\n📊 No commits found in period");
    }

    // Shortstat
    try {
      const { stdout: statOut } = await execAsync(
        `git log --since="${sinceArg}" --shortstat --all | grep "files changed"`,
        { cwd: projectDir, timeout: 15000 }
      );
      const lines = statOut.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const insertMatch = line.match(/(\d+) insertion/);
        const deleteMatch = line.match(/(\d+) deletion/);
        const fileMatch = line.match(/(\d+) files? changed/);
        if (insertMatch) netAdded += parseInt(insertMatch[1]);
        if (deleteMatch) netDeleted += parseInt(deleteMatch[1]);
        if (fileMatch) filesChanged += parseInt(fileMatch[1]);
      }
      output.push(`  Net lines: +${netAdded} / -${netDeleted}`);
      output.push(`  Files changed: ${filesChanged}`);
    } catch { /* skip */ }

    // Hot files
    output.push(`\n🔥 Hot Files (most changed):`);
    try {
      const { stdout: hotOut } = await execAsync(
        `git log --since="${sinceArg}" --all --format="" --name-only | sort | uniq -c | sort -rn | head -10`,
        { cwd: projectDir, timeout: 15000 }
      );
      const hotFiles = hotOut.trim().split("\n").filter(Boolean).slice(0, 10);
      if (hotFiles.length > 0) {
        for (const entry of hotFiles) {
          output.push(`  ${entry.trim()}`);
        }
      } else {
        output.push("  No file changes detected");
      }
    } catch {
      output.push("  Could not analyze hot files");
    }

    // Recent commits (highlights)
    output.push(`\n📝 Recent Commits:`);
    try {
      const { stdout: recentOut } = await execAsync(
        `git log --since="${sinceArg}" --oneline --all -20`,
        { cwd: projectDir, timeout: 10000 }
      );
      const commits = recentOut.trim().split("\n").filter(Boolean).slice(0, 20);
      for (const c of commits) {
        output.push(`  ${c}`);
      }
    } catch { /* skip */ }

    output.push("\n" + "═".repeat(50));
    output.push(`\n💡 Highlights — review commits above and identify:`);
    output.push(`  1. Most important achievement this period`);
    output.push(`  2. Lessons learned (what went wrong, what to improve)`);
    output.push(`  3. Technical debt / concerns`);
    output.push(`  4. Next period priorities`);

    // Save to retro history
    this.saveRetroHistory(projectDir, {
      period,
      commitCount,
      netAdded,
      netDeleted,
      filesChanged,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [{ type: "text" as const, text: output.join("\n") }],
      details: {
        success: true,
        period,
        stats: { commitCount, netAdded, netDeleted, filesChanged },
      },
    };
  }

  private getSinceArg(period: RetroPeriod): string {
    switch (period) {
      case "24h": return "24 hours ago";
      case "7d": return "7 days ago";
      case "14d": return "14 days ago";
      case "30d": return "30 days ago";
    }
  }

  private saveRetroHistory(projectDir: string, data: Record<string, unknown>) {
    const retroDir = join(projectDir, ".dev-workflow");
    const retroFile = join(retroDir, "retro-history.json");

    try {
      let history: Record<string, unknown>[] = [];
      if (existsSync(retroFile)) {
        const existing = readFileSync(retroFile, "utf-8");
        history = JSON.parse(existing);
      }
      history.push(data);
      if (!existsSync(retroDir)) {
        // Directory may not exist, skip saving
        return;
      }
      writeFileSync(retroFile, JSON.stringify(history, null, 2));
    } catch {
      // Best effort — don't fail the retro if history save fails
    }
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

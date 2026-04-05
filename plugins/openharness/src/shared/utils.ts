import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as crypto from "node:crypto";

export const execAsync = promisify(exec);

export function getProjectHash(cwd: string): string {
  return crypto.createHash("md5").update(cwd).digest("hex").slice(0, 8);
}

export async function detectRepo(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git remote get-url origin");
    const match = stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function getOpenharnessHome(): string {
  return process.env.HOME ? `${process.env.HOME}/.openharness` : "~/.openharness";
}

export function ensureDirSync(dir: string): void {
  // Lazy import to avoid startup overhead
  const fsSync = require("node:fs");
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
}

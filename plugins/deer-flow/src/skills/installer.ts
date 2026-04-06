import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { SkillInstallResult } from "../types.js";

export async function installSkill(archivePath: string, targetDir: string): Promise<SkillInstallResult> {
  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

import { mkdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Setup entry for deer-flow plugin.
 * Creates necessary data directories on installation.
 */
export async function setupPluginDataDir(pluginRoot: string) {
  const dirs = ["tools", "skills", "data"];

  for (const dir of dirs) {
    const fullPath = join(pluginRoot, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`[deer-flow] Created ${fullPath}`);
    }
  }

  // Create default memory storage if not exists
  const memoryPath = join(pluginRoot, "data", "memory.json");
  if (!existsSync(memoryPath)) {
    const fs = await import("fs");
    fs.writeFileSync(memoryPath, JSON.stringify({ facts: [] }, null, 2));
    console.log("[deer-flow] Created default memory storage");
  }

  // Create skills manifest if not exists
  const manifestPath = join(pluginRoot, "skills", "manifest.json");
  if (!existsSync(manifestPath)) {
    const fs = await import("fs");
    fs.writeFileSync(manifestPath, JSON.stringify({ skills: [] }, null, 2));
    console.log("[deer-flow] Created default skills manifest");
  }
}
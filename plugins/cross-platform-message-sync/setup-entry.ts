import { mkdirSync, existsSync } from "fs";
import { join } from "path";

/**
 * Setup entry for cross-platform-message-sync plugin.
 * Creates necessary data directories on installation.
 */
export async function setupPluginDataDir(pluginRoot: string) {
  const dirs = ["tools", "data", "skills"];

  for (const dir of dirs) {
    const fullPath = join(pluginRoot, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`[cross-platform-message-sync] Created ${fullPath}`);
    }
  }

  // Create default sync rules if not exists
  const syncRulesPath = join(pluginRoot, "data", "sync_rules.json");
  if (!existsSync(syncRulesPath)) {
    const defaultRules = {
      blacklist: [],
      whitelist: ["weixin", "feishu", "qqbot"],
      syncPairs: [
        { from: "weixin", to: ["feishu", "qqbot"] },
        { from: "feishu", to: ["weixin", "qqbot"] },
        { from: "qqbot", to: ["weixin", "feishu"] },
      ],
    };
    const fs = await import("fs");
    fs.writeFileSync(syncRulesPath, JSON.stringify(defaultRules, null, 2));
    console.log("[cross-platform-message-sync] Created default sync rules");
  }

  // Create default prompt history if not exists
  const promptHistoryPath = join(pluginRoot, "data", "prompt-history.json");
  if (!existsSync(promptHistoryPath)) {
    const fs = await import("fs");
    fs.writeFileSync(promptHistoryPath, JSON.stringify({ entries: [] }, null, 2));
    console.log("[cross-platform-message-sync] Created default prompt history");
  }

  // Create default topics file if not exists
  const topicsPath = join(pluginRoot, "data", "topics.json");
  if (!existsSync(topicsPath)) {
    const fs = await import("fs");
    fs.writeFileSync(topicsPath, JSON.stringify({ topics: {}, next_id: 1, updated_at: "" }, null, 2));
    console.log("[cross-platform-message-sync] Created default topics file");
  }
}

import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";

export default defineSetupPluginEntry({
  id: "openharness",
  name: "OpenHarness",
  async setup(ctx) {
    const { mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const home = process.env.HOME || "~";
    const dirs = [
      join(home, ".openharness"),
      join(home, ".openharness", "auth"),
      join(home, ".openharness", "skills"),
      join(home, ".openharness", "data"),
      join(home, ".openharness", "data", "memory"),
      join(home, ".openharness", "data", "tasks"),
      join(home, ".openharness", "data", "teams"),
      join(home, ".openharness", "data", "swarm"),
      join(home, ".openharness", "data", "cron"),
      join(home, ".openharness", "data", "cost"),
      join(home, ".openharness", "data", "sessions"),
      join(home, ".openharness", "data", "bridges"),
      join(home, ".openharness", "data", "mcp"),
      join(home, ".openharness", "logs"),
    ];
    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }
  },
});

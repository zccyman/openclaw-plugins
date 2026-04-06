import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MemoryRuntimeAdapter } from "./memory/runtime-adapter.js";
import { SkillRegistry, scanSkills } from "./skills/index.js";
import { SandboxTools } from "./sandbox/tools.js";
import { registerDeerFlowTools } from "./tools/index.js";
import { registerDeerFlowHooks } from "./hooks/index.js";
import type { DeerFlowPluginConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default definePluginEntry({
  id: "deer-flow",
  name: "DeerFlow",
  description: "DeerFlow super-agent capabilities as native OpenClaw tools: sub-agent orchestration, long-term memory, skills system, and sandbox execution.",

  register(api) {
    const config = (api.pluginConfig ?? {}) as DeerFlowPluginConfig;
    const skillsDir = config.skillsPath ?? join(api.rootDir ?? __dirname, "skills");
    const maxMemoryFacts = config.maxMemoryFacts ?? 15;

    const memoryAdapter = new MemoryRuntimeAdapter();
    const skillRegistry = new SkillRegistry();
    const sandboxTools = new SandboxTools({
      mode: config.sandboxMode ?? "local",
      pathMappings: [
        { virtual: "/mnt/user-data", physical: process.cwd() },
        { virtual: "/mnt/skills", physical: skillsDir },
      ],
      workingDir: "/mnt/user-data/workspace",
      timeout: 30,
      bashEnabled: config.sandboxBashEnabled ?? true,
    });

    const scannedSkills = scanSkills(skillsDir);
    for (const skill of scannedSkills) {
      skillRegistry.register(skill);
    }

    registerDeerFlowTools(api, {
      runtime: api.runtime,
      memoryAdapter,
      skillRegistry,
      sandboxTools,
      skillsDir,
    });

    registerDeerFlowHooks(api, {
      memoryAdapter,
      skillRegistry,
      maxMemoryFacts,
    });

    api.logger.info(`[deer-flow] Loaded ${scannedSkills.length} skills from ${skillsDir}`);
  },
});

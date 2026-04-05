import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerAuth } from "./auth/index.js";
import { registerBridge } from "./bridge/index.js";
import { registerCodeIntel } from "./code-intel/index.js";
import { registerCommands } from "./commands/index.js";
import { registerContext } from "./context/index.js";
import { registerCost } from "./cost/index.js";
import { registerGitflow } from "./gitflow/index.js";
import { registerGithub } from "./github/index.js";
import { registerGovernance } from "./governance/index.js";
import { registerInteractive } from "./interactive/index.js";
import { registerLsp } from "./lsp/index.js";
import { registerMcp } from "./mcp/index.js";
import { registerMemory } from "./memory/index.js";
import { registerProvider } from "./provider/index.js";
import { registerRepl } from "./repl/index.js";
import { registerSession } from "./session/index.js";
import { registerSessionOps } from "./session-ops/index.js";
import { registerSkills } from "./skills/index.js";
import { registerStructuredOutput } from "./structured-output/index.js";
import { registerSwarm } from "./swarm/index.js";
import { registerTools } from "./tools/index.js";

export default definePluginEntry({
  id: "openharness",
  name: "OpenHarness",
  description: "Unified OpenHarness plugin — 140+ tools, 19 commands, 5 hooks for OpenClaw",
  register(api) {
    registerTools(api);
    registerAuth(api);
    registerBridge(api);
    registerCodeIntel(api);
    registerCommands(api);
    registerContext(api);
    registerCost(api);
    registerGitflow(api);
    registerGithub(api);
    registerGovernance(api);
    registerInteractive(api);
    registerLsp(api);
    registerMcp(api);
    registerMemory(api);
    registerProvider(api);
    registerRepl(api);
    registerSession(api);
    registerSessionOps(api);
    registerSkills(api);
    registerStructuredOutput(api);
    registerSwarm(api);
  },
});

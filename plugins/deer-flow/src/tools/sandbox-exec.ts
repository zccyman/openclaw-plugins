import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { SandboxConfig } from "../types.js";
import { SandboxTools } from "../sandbox/tools.js";

export function createSandboxExecTool(sandbox: SandboxTools): AnyAgentTool {
  return {
    name: "sandbox_exec",
    description: "Execute code or commands in an isolated sandbox with virtual filesystem.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        working_dir: { type: "string", description: "Virtual working directory (default: /mnt/user-data/workspace)" },
        timeout: { type: "number", description: "Timeout in seconds (default: 30)" },
      },
      required: ["command"],
    },
    execute: async (args: { command: string; working_dir?: string; timeout?: number }) => {
      const result = await sandbox.bash(args.command, args.timeout);
      let output = "";
      if (result.stdout) output += `stdout:\n${result.stdout}\n`;
      if (result.stderr) output += `stderr:\n${result.stderr}\n`;
      output += `exit_code: ${result.exitCode ?? "timeout"}\n`;
      output += `duration: ${result.durationMs}ms`;
      return output;
    },
  };
}

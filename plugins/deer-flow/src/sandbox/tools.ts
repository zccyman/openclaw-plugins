import { exec } from "child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { promisify } from "util";
import type { SandboxConfig, SandboxExecResult } from "../types.js";
import { VirtualPathMapper } from "./virtual-path.js";

const execAsync = promisify(exec);

export class SandboxTools {
  private pathMapper: VirtualPathMapper;
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.pathMapper = new VirtualPathMapper(config.pathMappings);
  }

  async bash(command: string, timeout?: number): Promise<SandboxExecResult> {
    if (!this.config.bashEnabled) {
      return { exitCode: 1, stdout: "", stderr: "Bash execution disabled", timedOut: false, durationMs: 0 };
    }

    const start = Date.now();
    const resolvedCommand = command.replace(
      /(\/mnt\/[\w-]+\/[\w/-]+)/g,
      (match) => this.pathMapper.toPhysical(match),
    );

    try {
      const { stdout, stderr } = await execAsync(resolvedCommand, {
        timeout: (timeout ?? this.config.timeout) * 1000,
        cwd: this.pathMapper.toPhysical(this.config.workingDir),
      });
      return { exitCode: 0, stdout, stderr, timedOut: false, durationMs: Date.now() - start };
    } catch (err: unknown) {
      const isTimeout = (err as { code?: string }).code === "ETIMEDOUT" || (err as { code?: string }).code === "ERR_CHILD_PROCESS_TIMEOUT";
      const message = err instanceof Error ? err.message : String(err);
      return { exitCode: isTimeout ? null : 1, stdout: "", stderr: message, timedOut: !!isTimeout, durationMs: Date.now() - start };
    }
  }

  readFileSync(virtualPath: string): string {
    const physical = this.pathMapper.toPhysical(virtualPath);
    return readFileSync(physical, "utf-8");
  }

  writeFileSync(virtualPath: string, content: string): void {
    const physical = this.pathMapper.toPhysical(virtualPath);
    writeFileSync(physical, content, "utf-8");
  }

  listDirSync(virtualPath: string): string[] {
    const physical = this.pathMapper.toPhysical(virtualPath);
    return readdirSync(physical);
  }
}

import { spawn, ChildProcess } from "child_process";
import { join } from "path";

// Persistent Python process pool
class PythonProcessPool {
  private processes: Map<string, ChildProcess> = new Map();
  private maxProcesses = 3; // Limit concurrent processes

  async runScript(scriptName: string, args: string[] = [], pluginRoot: string): Promise<string> {
    const scriptPath = join(pluginRoot, "tools", scriptName);
    const key = `${scriptName}:${args.join(':')}`;

    // Try to reuse existing process
    let proc = this.processes.get(key);
    if (proc && !proc.killed) {
      // Process exists and is alive, reuse it
      return this.executeOnProcess(proc, args);
    }

    // Create new process if under limit
    if (this.processes.size < this.maxProcesses) {
      proc = spawn("python3", [scriptPath, ...args], {
        cwd: pluginRoot,
        env: { ...process.env, PYTHONPATH: pluginRoot },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.set(key, proc);
      return this.executeOnProcess(proc, args);
    }

    // Fallback to spawning new process if pool is full
    return new Promise((resolve, reject) => {
      const proc = spawn("python3", [scriptPath, ...args], {
        cwd: pluginRoot,
        env: { ...process.env, PYTHONPATH: pluginRoot },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => (stdout += data.toString()));
      proc.stderr?.on("data", (data) => (stderr += data.toString()));

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python script ${scriptName} failed (exit ${code}): ${stderr}`));
        }
      });

      proc.on("error", (err) => reject(err));

      // Set timeout
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Python script ${scriptName} timed out`));
      }, 30000); // 30 second timeout
    });
  }

  private executeOnProcess(proc: ChildProcess, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const onData = (data: Buffer) => {
        stdout += data.toString();
      };

      const onError = (data: Buffer) => {
        stderr += data.toString();
      };

      const onClose = (code: number | null) => {
        proc.stdout?.off('data', onData);
        proc.stderr?.off('data', onError);
        proc.off('close', onClose);

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Process failed (exit ${code}): ${stderr}`));
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onError);
      proc.on('close', onClose);

      // Send arguments to stdin if needed
      if (args.length > 0) {
        proc.stdin?.write(JSON.stringify({ args }) + '\n');
      }
    });
  }

  cleanup(): void {
    for (const [, proc] of this.processes) {
      if (!proc.killed) {
        proc.kill();
      }
    }
    this.processes.clear();
  }
}

const processPool = new PythonProcessPool();

// Cleanup on process exit
process.on('exit', () => {
  processPool.cleanup();
});

process.on('SIGINT', () => {
  processPool.cleanup();
  process.exit();
});

process.on('SIGTERM', () => {
  processPool.cleanup();
  process.exit();
});

export async function runPythonScriptOptimized(
  pluginRoot: string,
  scriptName: string,
  args: string[] = []
): Promise<string> {
  return processPool.runScript(scriptName, args, pluginRoot);
}
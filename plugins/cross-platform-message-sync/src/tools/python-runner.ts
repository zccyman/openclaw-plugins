import { spawn } from "child_process";
import { join } from "path";


export async function runPythonScript(
  pluginRoot: string,
  scriptName: string,
  args: string[] = []
): Promise<string> {
  const scriptPath = join(pluginRoot, "tools", scriptName);

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
        reject(
          new Error(
            `Python script ${scriptName} failed (exit ${code}): ${stderr}`
          )
        );
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

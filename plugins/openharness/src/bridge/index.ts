import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import * as crypto from "node:crypto";

interface BridgeSession {
  id: string;
  name: string;
  process: cp.ChildProcess;
  workSecret: string;
  logPath: string;
  createdAt: string;
  context: string;
  status: "running" | "completed" | "failed" | "stopped";
  lastActivity: string;
}

const bridges = new Map<string, BridgeSession>();

function encodeWorkSecret(sessionIngress: string, apiBaseUrl: string): string {
  const payload = JSON.stringify({ v: 1, session_ingress_token: sessionIngress, api_base_url: apiBaseUrl });
  return Buffer.from(payload).toString("base64");
}

async function spawnBridgeProcess(bridge: BridgeSession, prompt: string, model?: string): Promise<void> {
  const logPath = path.join(process.env.HOME || "~", ".openharness", "data", "bridges", `${bridge.id}.log`);
  bridge.logPath = logPath;

  const args = ["-p", prompt, "--output-format", "stream-json"];
  if (model) args.push("-m", model);

  const env = { ...process.env, OPENHARNESS_WORK_SECRET: bridge.workSecret };
  const proc = cp.spawn("oh", args, { env, cwd: process.cwd() });

  proc.stdout?.pipe(fsSync.createWriteStream(logPath, { flags: "a" }));
  proc.stderr?.pipe(fsSync.createWriteStream(logPath, { flags: "a" }));

  proc.on("exit", (code) => {
    bridge.status = code === 0 ? "completed" : "failed";
    bridge.lastActivity = new Date().toISOString();
  });

  bridge.process = proc;
}

export function registerBridge(api: any) {
  api.registerTool({
    name: "oh_bridge_spawn",
    label: "Spawn Bridge Session",
    description: "Spawn a child OpenHarness session with encoded context and work secret. Use for delegating work to isolated sub-sessions.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Prompt/task for the child session" }),
      name: Type.Optional(Type.String({ description: "Bridge name (default: auto-generated)" })),
      model: Type.Optional(Type.String({ description: "Model to use in child session" })),
      context: Type.Optional(Type.String({ description: "Context to pass to child session (e.g., file paths, background info)" })),
      api_base_url: Type.Optional(Type.String({ description: "API base URL for child session" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const maxBridges = 5;
      const running = [...bridges.values()].filter((b) => b.status === "running");
      if (running.length >= maxBridges) {
        return { content: [{ type: "text" as const, text: `Maximum bridges reached (${maxBridges}). Close some bridges first.` }], details: { success: false } };
      }

      const id = `bridge_${crypto.randomBytes(4).toString("hex")}`;
      const name = params.name || id;
      const sessionIngress = crypto.randomBytes(16).toString("hex");
      const workSecret = encodeWorkSecret(sessionIngress, params.api_base_url || process.env.ANTHROPIC_BASE_URL || "");

      const bridge: BridgeSession = {
        id, name, process: null as any, workSecret, logPath: "",
        createdAt: new Date().toISOString(), context: params.context || "",
        status: "running", lastActivity: new Date().toISOString(),
      };

      await spawnBridgeProcess(bridge, params.prompt, params.model);
      bridges.set(id, bridge);

      return {
        content: [{ type: "text" as const, text: `Bridge spawned: ${id}\nName: ${name}\nStatus: running\nContext: ${params.context || "(none)"}\n\nUse oh_bridge_send to communicate with it, oh_bridge_receive to get output.` }],
        details: { success: true, bridgeId: id, workSecret },
      };
    },
  });

  api.registerTool({
    name: "oh_bridge_send",
    label: "Send to Bridge",
    description: "Send a message to a running bridge session.",
    parameters: Type.Object({
      bridge_id: Type.String({ description: "Bridge session ID" }),
      message: Type.String({ description: "Message to send" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const bridge = bridges.get(params.bridge_id);
      if (!bridge) {
        return { content: [{ type: "text" as const, text: `Bridge '${params.bridge_id}' not found.` }], details: { success: false } };
      }
      if (bridge.status !== "running") {
        return { content: [{ type: "text" as const, text: `Bridge '${params.bridge_id}' is ${bridge.status}, not running.` }], details: { success: false } };
      }

      try {
        bridge.process.stdin?.write(params.message + "\n");
        bridge.lastActivity = new Date().toISOString();
        return { content: [{ type: "text" as const, text: `Message sent to bridge: ${bridge.name} (${params.bridge_id})` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Failed to send message: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_bridge_receive",
    label: "Receive from Bridge",
    description: "Read the latest output from a bridge session's log file.",
    parameters: Type.Object({
      bridge_id: Type.String({ description: "Bridge session ID" }),
      tail_bytes: Type.Optional(Type.Number({ description: "Number of bytes to read from end of log (default: 5000)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const bridge = bridges.get(params.bridge_id);
      if (!bridge) {
        return { content: [{ type: "text" as const, text: `Bridge '${params.bridge_id}' not found.` }], details: { success: false } };
      }

      try {
        const logContent = await fs.readFile(bridge.logPath, "utf-8");
        const tailBytes = params.tail_bytes || 5000;
        const tail = logContent.slice(-tailBytes);
        const status = bridge.status === "running" ? "🟢 running" : bridge.status === "completed" ? "✅ completed" : bridge.status === "failed" ? "❌ failed" : "⏹️ stopped";

        return {
          content: [{ type: "text" as const, text: `Bridge: ${bridge.name} (${bridge.id})\nStatus: ${status}\nCreated: ${bridge.createdAt}\nLast Activity: ${bridge.lastActivity}\n\n--- Output (last ${tailBytes} bytes) ---\n\n${tail || "(no output yet)"}` }],
          details: { success: true, status: bridge.status, outputLength: tail.length },
        };
      } catch {
        return { content: [{ type: "text" as const, text: `No output available for bridge: ${bridge.name}` }], details: { success: true } };
      }
    },
  });

  api.registerTool({
    name: "oh_bridge_close",
    label: "Close Bridge",
    description: "Close/stop a bridge session and clean up resources.",
    parameters: Type.Object({
      bridge_id: Type.String({ description: "Bridge session ID" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const bridge = bridges.get(params.bridge_id);
      if (!bridge) {
        return { content: [{ type: "text" as const, text: `Bridge '${params.bridge_id}' not found.` }], details: { success: false } };
      }

      try {
        bridge.process.kill("SIGTERM");
        bridge.status = "stopped";
        bridge.lastActivity = new Date().toISOString();
        bridges.delete(params.bridge_id);
        return { content: [{ type: "text" as const, text: `Bridge closed: ${bridge.name} (${params.bridge_id})` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Failed to close bridge: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_bridge_list",
    label: "List Bridges",
    description: "List all active and recent bridge sessions.",
    parameters: Type.Object({
      include_closed: Type.Optional(Type.Boolean({ description: "Include closed bridges (default: false)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const allBridges = [...bridges.values()];
      const filtered = params.include_closed ? allBridges : allBridges.filter((b) => b.status === "running");

      if (filtered.length === 0) {
        return { content: [{ type: "text" as const, text: "No active bridges." }], details: { success: true } };
      }

      const statusIcon: Record<string, string> = { running: "🟢", completed: "✅", failed: "❌", stopped: "⏹️" };
      const list = filtered.map((b, i) => {
        return `${i + 1}. ${statusIcon[b.status] || "?"} ${b.name} (${b.id})\n   Status: ${b.status}\n   Created: ${b.createdAt}\n   Last Activity: ${b.lastActivity}\n   Context: ${b.context || "(none)"}`;
      }).join("\n\n");

      return { content: [{ type: "text" as const, text: `Bridge Sessions (${filtered.length}):\n\n${list}` }], details: { success: true, count: filtered.length } };
    },
  });
}

import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { getEngine } from "../channel/runtime.js";

export class PermissionTool implements AnyAgentTool {
  name = "dev-workflow-permission";
  label = "Dev Workflow Permission";
  description = "Check or manage dev workflow permissions (readonly, workspace-write, danger-full-access)";
  parameters = z.object({
    action: z.enum(["check", "upgrade", "danger-request", "enforce-readonly"]).describe("Permission action to perform"),
    operation: z.string().optional().describe("Operation description for danger requests"),
    durationMinutes: z.number().optional().describe("Duration in minutes for danger access (default: 5)"),
  });

  async execute(input: { action: string; operation?: string; durationMinutes?: number }): Promise<string> {
    const engine = getEngine();
    const perm = engine.getPermissionManager();

    switch (input.action) {
      case "check": {
        const state = perm.getState();
        return `Permission Level: ${state.level}\nReason: ${state.reason}\nGranted At: ${state.grantedAt}\nExpires At: ${state.expiresAt ?? "Never"}\nCan Read: ${perm.canRead()}\nCan Write: ${perm.canWrite()}\nCan Danger: ${perm.canDanger()}`;
      }
      case "upgrade": {
        perm.upgradeToWorkspaceWrite();
        return "Permission upgraded to workspace-write (Plan Gate passed)";
      }
      case "danger-request": {
        if (!input.operation) return "Error: operation is required for danger-request";
        const request = perm.requestDangerAccess(input.operation);
        const granted = perm.grantDangerAccess(input.operation, input.durationMinutes);
        return `Danger Access Request:\nTarget: ${request.targetLevel}\nOperation: ${request.operation}\nReason: ${request.reason}\nGranted: ${granted}`;
      }
      case "enforce-readonly": {
        perm.enforceReadOnly();
        return "Permission enforced to read-only mode";
      }
      default:
        return `Unknown action: ${input.action}. Valid actions: check, upgrade, danger-request, enforce-readonly`;
    }
  }
}

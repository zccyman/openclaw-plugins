import type { PluginRuntime } from "openclaw/plugin-sdk/core";

export type PermissionLevel = "readonly" | "workspace-write" | "danger-full-access";

export interface PermissionState {
  level: PermissionLevel;
  reason: string;
  grantedAt: string;
  expiresAt: string | null;
}

export interface PermissionUpgradeRequest {
  targetLevel: PermissionLevel;
  operation: string;
  reason: string;
}

const DANGEROUS_KEYWORDS = [
  "drop", "truncate", "alter table", "migration", "sequelize sync force",
  "push --force", "reset --hard", "rebase", "filter-branch",
  "rm -rf",
  ".env", "secrets", "credentials", "api key",
];

export class PermissionManager {
  private runtime: PluginRuntime;
  private state: PermissionState;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
    this.state = {
      level: "readonly",
      reason: "Initial state — Plan Gate not passed",
      grantedAt: new Date().toISOString(),
      expiresAt: null,
    };
  }

  getState(): PermissionState {
    return { ...this.state };
  }

  getLevel(): PermissionLevel {
    return this.state.level;
  }

  canRead(): boolean {
    return true;
  }

  canWrite(): boolean {
    return this.state.level === "workspace-write" || this.state.level === "danger-full-access";
  }

  canDanger(): boolean {
    return this.state.level === "danger-full-access";
  }

  upgradeToWorkspaceWrite(): void {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    this.state = {
      level: "workspace-write",
      reason: "Plan Gate approved by user",
      grantedAt: new Date().toISOString(),
      expiresAt: null,
    };
    logger.info(`[PermissionManager] Upgraded to workspace-write`);
  }

  requestDangerAccess(operation: string): PermissionUpgradeRequest {
    const isDangerous = DANGEROUS_KEYWORDS.some((kw) =>
      operation.toLowerCase().includes(kw)
    );
    if (!isDangerous) {
      return { targetLevel: "workspace-write", operation, reason: "Not a dangerous operation" };
    }
    return {
      targetLevel: "danger-full-access",
      operation,
      reason: `Dangerous operation detected: "${operation}"`,
    };
  }

  grantDangerAccess(operation: string, durationMinutes: number = 5): boolean {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    if (this.state.level !== "workspace-write") {
      logger.warn(`[PermissionManager] Cannot grant danger access from ${this.state.level}`);
      return false;
    }
    this.state = {
      level: "danger-full-access",
      reason: `Danger access for: "${operation}"`,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
    };
    logger.info(`[PermissionManager] Granted danger access for: "${operation}" (expires in ${durationMinutes}min)`);
    return true;
  }

  validateOperation(operation: string): { allowed: boolean; requiredLevel: PermissionLevel; reason?: string } {
    const isDangerous = DANGEROUS_KEYWORDS.some((kw) =>
      operation.toLowerCase().includes(kw.toLowerCase())
    );
    if (isDangerous) {
      return {
        allowed: this.canDanger(),
        requiredLevel: "danger-full-access",
        reason: `Dangerous operation: "${operation}" requires danger-full-access`,
      };
    }
    const isWrite = /^(create|modify|delete|write|mkdir|git (add|commit|push|tag))/i.test(operation.toLowerCase());
    if (isWrite) {
      return { allowed: this.canWrite(), requiredLevel: "workspace-write" };
    }
    return { allowed: true, requiredLevel: "readonly" };
  }

  checkExpiration(): void {
    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    if (this.state.expiresAt && new Date(this.state.expiresAt) < new Date()) {
      this.state = {
        level: "workspace-write",
        reason: "Danger access expired, reverted to workspace-write",
        grantedAt: new Date().toISOString(),
        expiresAt: null,
      };
      logger.info("[PermissionManager] Danger access expired, reverted to workspace-write");
    }
  }

  enforceReadOnly(): void {
    this.state = {
      level: "readonly",
      reason: "Enforced read-only mode",
      grantedAt: new Date().toISOString(),
      expiresAt: null,
    };
  }

  isOperationAllowed(operation: string): boolean {
    const validation = this.validateOperation(operation);
    if (validation.requiredLevel === "danger-full-access") {
      return this.canDanger();
    }
    if (validation.requiredLevel === "workspace-write") {
      return this.canWrite();
    }
    return true;
  }
}

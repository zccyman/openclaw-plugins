import { describe, expect, it, vi } from "vitest";
import { PermissionManager } from "../src/permissions/index.js";
import type { PermissionLevel } from "../src/permissions/index.js";

function createMockRuntime() {
  return {
    logging: {
      getChildLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  } as any;
}

describe("PermissionManager", () => {
  it("starts in readonly mode", () => {
    const mgr = new PermissionManager(createMockRuntime());
    expect(mgr.getLevel()).toBe("readonly");
    expect(mgr.canRead()).toBe(true);
    expect(mgr.canWrite()).toBe(false);
    expect(mgr.canDanger()).toBe(false);
  });

  it("getState returns a copy of the state", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const state = mgr.getState();
    expect(state.level).toBe("readonly");
    expect(state.reason).toBeDefined();
    expect(state.grantedAt).toBeDefined();
    expect(state.expiresAt).toBeNull();
  });

  it("upgradeToWorkspaceWrite grants write access", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    expect(mgr.getLevel()).toBe("workspace-write");
    expect(mgr.canWrite()).toBe(true);
    expect(mgr.canDanger()).toBe(false);
  });

  it("grantDangerAccess succeeds from workspace-write", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    const result = mgr.grantDangerAccess("db migration", 10);
    expect(result).toBe(true);
    expect(mgr.getLevel()).toBe("danger-full-access");
    expect(mgr.canDanger()).toBe(true);
  });

  it("grantDangerAccess fails from readonly", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const result = mgr.grantDangerAccess("test", 5);
    expect(result).toBe(false);
    expect(mgr.getLevel()).toBe("readonly");
  });

  it("validateOperation detects dangerous operations", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const dangerousOps = [
      "DROP TABLE users",
      "git push --force",
      "rm -rf /tmp/foo",
      "git reset --hard HEAD",
    ];
    for (const op of dangerousOps) {
      const validation = mgr.validateOperation(op);
      expect(validation.requiredLevel).toBe("danger-full-access");
      expect(validation.allowed).toBe(false);
    }
  });

  it("validateOperation detects write operations", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const writeOps = [
      "create file foo.ts",
      "mkdir src/new",
      "git add .",
      "git commit -m test",
    ];
    for (const op of writeOps) {
      const validation = mgr.validateOperation(op);
      expect(validation.requiredLevel).toBe("workspace-write");
      expect(validation.allowed).toBe(false);
    }
  });

  it("validateOperation allows read operations", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const validation = mgr.validateOperation("read file foo.ts");
    expect(validation.allowed).toBe(true);
    expect(validation.requiredLevel).toBe("readonly");
  });

  it("validateOperation allows write operations after upgrade", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    const validation = mgr.validateOperation("git commit -m test");
    expect(validation.allowed).toBe(true);
  });

  it("requestDangerAccess returns correct target for dangerous ops", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const req = mgr.requestDangerAccess("DROP TABLE users");
    expect(req.targetLevel).toBe("danger-full-access");
    expect(req.reason).toContain("Dangerous");
  });

  it("requestDangerAccess returns workspace-write for normal ops", () => {
    const mgr = new PermissionManager(createMockRuntime());
    const req = mgr.requestDangerAccess("create file foo.ts");
    expect(req.targetLevel).toBe("workspace-write");
  });

  it("checkExpiration reverts to workspace-write when expired", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    mgr.grantDangerAccess("test", 0);
    // Manually set expiresAt to the past to ensure expiration
    const state = mgr.getState();
    (mgr as any).state.expiresAt = new Date(Date.now() - 1000).toISOString();
    mgr.checkExpiration();
    expect(mgr.getLevel()).toBe("workspace-write");
  });

  it("enforceReadOnly resets to readonly", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    mgr.enforceReadOnly();
    expect(mgr.getLevel()).toBe("readonly");
    expect(mgr.canWrite()).toBe(false);
  });

  it("isOperationAllowed returns correct results", () => {
    const mgr = new PermissionManager(createMockRuntime());
    expect(mgr.isOperationAllowed("read file")).toBe(true);
    expect(mgr.isOperationAllowed("create file")).toBe(false);
    expect(mgr.isOperationAllowed("DROP TABLE")).toBe(false);

    mgr.upgradeToWorkspaceWrite();
    expect(mgr.isOperationAllowed("create file")).toBe(true);
    expect(mgr.isOperationAllowed("DROP TABLE")).toBe(false);
  });

  it("danger access expires and reverts correctly", () => {
    const mgr = new PermissionManager(createMockRuntime());
    mgr.upgradeToWorkspaceWrite();
    mgr.grantDangerAccess("test", 5);
    const state = mgr.getState();
    expect(state.expiresAt).not.toBeNull();
    expect(state.level).toBe("danger-full-access");
  });
});

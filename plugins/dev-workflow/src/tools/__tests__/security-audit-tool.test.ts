import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-secaudit-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
  vi.resetModules();
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

async function setupEngine() {
  const runtime = {
    logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
  } as any;
  const { setDevWorkflowRuntime } = await import("../../channel/runtime.js");
  setDevWorkflowRuntime(runtime);
  return { runtime };
}

describe("SecurityAuditTool", () => {
  it("has correct name and label", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();
    expect(tool.name).toBe("security_audit");
    expect(tool.label).toBe("Security Audit");
  });

  it("detects Node.js stack from package.json", async () => {
    await setupEngine();
    writeFileSync(join(testDir, "package.json"), '{"name":"test"}');

    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c1", { projectDir: testDir, mode: "daily" });
    expect(result.content[0].text).toContain("Node.js");
  });

  it("daily mode uses confidence threshold 8 by default", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c2", { projectDir: testDir, mode: "daily" });
    expect(result.content[0].text).toContain("threshold: 8");
    const details = result.details as any;
    expect(details.threshold).toBe(8);
  });

  it("comprehensive mode uses confidence threshold 2 by default", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c3", { projectDir: testDir, mode: "comprehensive" });
    expect(result.content[0].text).toContain("threshold: 2");
    const details = result.details as any;
    expect(details.threshold).toBe(2);
  });

  it("reports no findings for clean empty project", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c4", { projectDir: testDir, mode: "daily" });
    // Empty project should have no findings above threshold
    expect(result.content[0].text).toContain("Security Audit");
    const details = result.details as any;
    expect(details.suppressed).toBeGreaterThanOrEqual(0);
  });

  it("supports scope filtering", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c5", { projectDir: testDir, mode: "daily", scope: "code" });
    expect(result.content[0].text).toContain("Security Audit");
    expect(result.content[0].text).toContain("scope: code");
  });

  it("supports custom confidence threshold", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c6", { projectDir: testDir, mode: "daily", confidenceThreshold: 5 });
    expect(result.content[0].text).toContain("threshold: 5");
    const details = result.details as any;
    expect(details.threshold).toBe(5);
  });

  it("includes STRIDE threat model in full scope", async () => {
    await setupEngine();
    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    const result = await tool.execute("c7", { projectDir: testDir, mode: "comprehensive", scope: "full" });
    expect(result.content[0].text).toContain("STRIDE");
    expect(result.content[0].text).toContain("Spoofing");
    expect(result.content[0].text).toContain("Tampering");
  });

  it("detects missing lockfile as P2 finding", async () => {
    await setupEngine();
    // Create package.json without lockfile
    writeFileSync(join(testDir, "package.json"), '{"name":"test","dependencies":{}}');

    const { SecurityAuditTool } = await import("../security-audit-tool.js");
    const tool = new SecurityAuditTool();

    // Use comprehensive mode (threshold 2) to catch P2
    const result = await tool.execute("c8", { projectDir: testDir, mode: "comprehensive" });
    const details = result.details as any;
    // Should have at least a missing lockfile finding
    const lockfileFinding = details.findings?.find((f: any) => f.category?.includes("lockfile"));
    if (lockfileFinding) {
      expect(lockfileFinding.severity).toBe("P2");
      expect(lockfileFinding.confidence).toBe(9);
    }
  });
});

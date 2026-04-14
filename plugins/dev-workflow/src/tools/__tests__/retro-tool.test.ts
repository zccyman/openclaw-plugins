import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-retro-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
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

describe("RetroTool", () => {
  it("has correct name and label", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();
    expect(tool.name).toBe("retro");
    expect(tool.label).toBe("Weekly Retro");
  });

  it("generates retro report for empty project", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    const result = await tool.execute("c1", { projectDir: testDir });
    expect(result.content[0].text).toContain("Retro Report");
    expect(result.content[0].text).toContain("last 7d");
    expect(result.content[0].text).toContain("Highlights");
    const details = result.details as any;
    expect(details.success).toBe(true);
    expect(details.period).toBe("7d");
  });

  it("uses 7d as default period", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    const result = await tool.execute("c2", { projectDir: testDir });
    expect(result.content[0].text).toContain("last 7d");
    const details = result.details as any;
    expect(details.period).toBe("7d");
  });

  it("supports different periods", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    for (const period of ["24h", "7d", "14d", "30d"] as const) {
      const result = await tool.execute(`c3-${period}`, { projectDir: testDir, period });
      expect(result.content[0].text).toContain(`last ${period}`);
      const details = result.details as any;
      expect(details.period).toBe(period);
    }
  });

  it("returns commit count in stats", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    const result = await tool.execute("c4", { projectDir: testDir });
    const details = result.details as any;
    expect(details.stats).toBeDefined();
    expect(typeof details.stats.commitCount).toBe("number");
    expect(typeof details.stats.netAdded).toBe("number");
    expect(typeof details.stats.netDeleted).toBe("number");
  });

  it("includes hot files section", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    const result = await tool.execute("c5", { projectDir: testDir });
    expect(result.content[0].text).toContain("Hot Files");
  });

  it("includes highlights guidance", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();

    const result = await tool.execute("c6", { projectDir: testDir });
    expect(result.content[0].text).toContain("Highlights");
    expect(result.content[0].text).toContain("Lessons learned");
    expect(result.content[0].text).toContain("Next period priorities");
  });

  it("validates parameters schema", async () => {
    await setupEngine();
    const { RetroTool } = await import("../retro-tool.js");
    const tool = new RetroTool();
    const schema = tool.parameters;
    expect(schema._def.typeName).toBe("ZodObject");
  });
});

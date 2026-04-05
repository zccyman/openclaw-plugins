import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DirectoryTemplateManager } from "../src/directory-templates/index.js";
import type { TemplateId } from "../src/directory-templates/index.js";

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

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `dwf-tpl-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe("DirectoryTemplateManager", () => {
  it("getTemplate returns correct template", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const template = mgr.getTemplate("a-python-backend");
    expect(template).toBeDefined();
    expect(template?.id).toBe("a-python-backend");
    expect(template?.directories.length).toBeGreaterThan(0);
  });

  it("getTemplate returns undefined for invalid ID", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const template = mgr.getTemplate("invalid" as TemplateId);
    expect(template).toBeUndefined();
  });

  it("getAllTemplates returns 5 templates", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const templates = mgr.getAllTemplates();
    expect(templates).toHaveLength(5);
    const ids = templates.map((t) => t.id);
    expect(ids).toContain("a-python-backend");
    expect(ids).toContain("b-python-cli");
    expect(ids).toContain("c-fullstack");
    expect(ids).toContain("d-minimal");
    expect(ids).toContain("e-ai-ml");
  });

  it("detectTemplate returns c-fullstack for package.json", () => {
    writeFileSync(join(testDir, "package.json"), "{}");
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const detected = mgr.detectTemplate(testDir);
    expect(detected).toBe("c-fullstack");
  });

  it("detectTemplate returns a-python-backend for requirements.txt", () => {
    writeFileSync(join(testDir, "requirements.txt"), "fastapi");
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const detected = mgr.detectTemplate(testDir);
    expect(detected).toBe("a-python-backend");
  });

  it("detectTemplate returns e-ai-ml for configs + requirements", () => {
    writeFileSync(join(testDir, "requirements.txt"), "torch");
    mkdirSync(join(testDir, "configs"), { recursive: true });
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const detected = mgr.detectTemplate(testDir);
    expect(detected).toBe("e-ai-ml");
  });

  it("detectTemplate returns c-fullstack for frontend + backend", () => {
    mkdirSync(join(testDir, "src", "frontend"), { recursive: true });
    mkdirSync(join(testDir, "src", "backend"), { recursive: true });
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const detected = mgr.detectTemplate(testDir);
    expect(detected).toBe("c-fullstack");
  });

  it("detectTemplate returns d-minimal for empty project", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const detected = mgr.detectTemplate(testDir);
    expect(detected).toBe("d-minimal");
  });

  it("applyTemplate creates directories", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const result = mgr.applyTemplate(testDir, "d-minimal");
    expect(result.created).toContain("src");
    expect(result.created).toContain("tests");
    expect(existsSync(join(testDir, "src"))).toBe(true);
    expect(existsSync(join(testDir, "tests"))).toBe(true);
  });

  it("applyTemplate skips existing directories", () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const result = mgr.applyTemplate(testDir, "d-minimal");
    expect(result.skipped).toContain("src");
  });

  it("applyTemplate creates test structure directories", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const result = mgr.applyTemplate(testDir, "a-python-backend");
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("applyTemplate returns empty for invalid template", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const result = mgr.applyTemplate(testDir, "invalid" as TemplateId);
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("suggestTemplate returns correct template for backend", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("API backend")).toBe("a-python-backend");
    expect(mgr.suggestTemplate("后端服务")).toBe("a-python-backend");
  });

  it("suggestTemplate returns correct template for CLI", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("data processing CLI")).toBe("b-python-cli");
    expect(mgr.suggestTemplate("数据处理工具")).toBe("b-python-cli");
  });

  it("suggestTemplate returns correct template for fullstack", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("frontend app")).toBe("c-fullstack");
    expect(mgr.suggestTemplate("全栈项目")).toBe("c-fullstack");
  });

  it("suggestTemplate returns correct template for minimal", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("quick tool")).toBe("d-minimal");
    expect(mgr.suggestTemplate("小工具")).toBe("d-minimal");
  });

  it("suggestTemplate returns correct template for AI/ML", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("ML training pipeline")).toBe("e-ai-ml");
    expect(mgr.suggestTemplate("模型训练")).toBe("e-ai-ml");
  });

  it("suggestTemplate returns d-minimal for unknown feature", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    expect(mgr.suggestTemplate("something random")).toBe("d-minimal");
  });

  it("template A has correct test structure", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const template = mgr.getTemplate("a-python-backend");
    expect(template?.testStructure).toContain("tests/conftest.py");
    expect(template?.testStructure).toContain("tests/unit/");
    expect(template?.testStructure).toContain("tests/integration/");
  });

  it("template E has AI/ML readme extra", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const template = mgr.getTemplate("e-ai-ml");
    expect(template?.readmeExtra).toContain("大模型项目规则");
    expect(template?.readmeExtra).toContain("权重不入 Git");
  });

  it("template C has fullstack directories", () => {
    const mgr = new DirectoryTemplateManager(createMockRuntime());
    const template = mgr.getTemplate("c-fullstack");
    expect(template?.directories).toContain("src/frontend");
    expect(template?.directories).toContain("src/backend");
  });
});

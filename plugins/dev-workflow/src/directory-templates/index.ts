import type { PluginRuntime } from "openclaw/plugin-sdk/core";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

export type TemplateId = "a-python-backend" | "b-python-cli" | "c-fullstack" | "d-minimal" | "e-ai-ml";

export interface DirectoryTemplate {
  id: TemplateId;
  name: string;
  description: string;
  signal: string;
  directories: string[];
  testStructure: string[];
  configFiles: string[];
  readmeExtra: string;
}

const TEMPLATES: DirectoryTemplate[] = [
  {
    id: "a-python-backend",
    name: "Template A: Python Backend",
    description: "Python 后端服务 (FastAPI/Flask)",
    signal: "package.json",
    directories: ["src/config", "src/api", "src/services", "src/models", "src/utils", "tests", "tests/unit", "tests/integration", "tests/fixtures", "scripts", "openspec", "docs"],
    testStructure: ["tests/conftest.py", "tests/unit/", "tests/integration/", "tests/fixtures/"],
    configFiles: ["requirements.txt", "setup.py"],
    readmeExtra: "",
  },
  {
    id: "b-python-cli",
    name: "Template B: Python Data/CLI",
    description: "Python 数据处理 / CLI 工具",
    signal: "requirements.txt",
    directories: ["src/cli", "src/core", "src/data", "src/utils", "tests", "tests/unit", "tests/integration", "tests/fixtures", "notebooks", "configs", "openspec", "docs"],
    testStructure: ["tests/conftest.py", "tests/unit/", "tests/integration/"],
    configFiles: ["requirements.txt"],
    readmeExtra: "",
  },
  {
    id: "c-fullstack",
    name: "Template C: Fullstack",
    description: "前后端全栈项目",
    signal: "package.json",
    directories: ["src/frontend", "src/frontend/src/components", "src/frontend/src/hooks", "src/frontend/src/services", "src/frontend/__tests__", "src/backend", "src/backend/app", "tests", "tests/unit", "tests/integration", "openspec", "docs"],
    testStructure: ["src/frontend/__tests__/", "tests/unit/", "tests/integration/"],
    configFiles: ["src/frontend/package.json", "src/backend/requirements.txt", "docker-compose.yml"],
    readmeExtra: "",
  },
  {
    id: "d-minimal",
    name: "Template D: Minimal (Quick)",
    description: "最小项目结构，适用于 Quick 模式",
    signal: "",
    directories: ["src", "tests"],
    testStructure: ["tests/test_main.py", "tests/conftest.py"],
    configFiles: ["requirements.txt"],
    readmeExtra: "",
  },
  {
    id: "e-ai-ml",
    name: "Template E: AI/ML Training",
    description: "AI/大模型训练项目",
    signal: "configs/",
    directories: ["configs", "configs/model", "configs/train", "configs/data", "configs/eval", "src", "src/models", "src/trainers", "src/data", "src/inference", "src/evaluation", "src/utils", "scripts", "tests", "tests/unit", "tests/integration", "tests/fixtures", "tools", "openspec", "docs"],
    testStructure: ["tests/unit/", "tests/integration/", "tests/fixtures/tiny_model.yaml"],
    configFiles: ["requirements.txt", "setup.py"],
    readmeExtra: `## 大模型项目规则
- 权重不入 Git (checkpoints/, outputs/, saved_models/ 在 .gitignore)
- 数据不入 Git (data/raw/ 排除)
- 配置和代码分离 (所有超参放 configs/)
- 多规模支持 (configs/model/ 下按规模分)
- 测试用小模型 (tests/fixtures/tiny_model.yaml)
- 训练脚本独立 (scripts/)
- 分布式工具集中 (utils/distributed.py)`,
  },
];

export class DirectoryTemplateManager {
  private runtime: PluginRuntime;

  constructor(runtime: PluginRuntime) {
    this.runtime = runtime;
  }

  getTemplate(id: TemplateId): DirectoryTemplate | undefined {
    return TEMPLATES.find((t) => t.id === id);
  }

  getAllTemplates(): DirectoryTemplate[] {
    return [...TEMPLATES];
  }

  detectTemplate(projectDir: string): TemplateId {
    const hasPackageJson = existsSync(join(projectDir, "package.json"));
    const hasRequirements = existsSync(join(projectDir, "requirements.txt")) || existsSync(join(projectDir, "pyproject.toml"));
    const hasBackend = existsSync(join(projectDir, "backend")) || existsSync(join(projectDir, "src", "backend"));
    const hasFrontend = existsSync(join(projectDir, "frontend")) || existsSync(join(projectDir, "src", "frontend"));
    const hasConfigs = existsSync(join(projectDir, "configs"));

    if (hasConfigs && hasRequirements) return "e-ai-ml";
    if (hasFrontend && hasBackend) return "c-fullstack";
    if (hasPackageJson && hasBackend) return "c-fullstack";
    if (hasPackageJson) return "c-fullstack";
    if (hasRequirements) return "a-python-backend";
    return "d-minimal";
  }

  applyTemplate(projectDir: string, templateId: TemplateId): { created: string[]; skipped: string[] } {
    const template = this.getTemplate(templateId);
    if (!template) return { created: [], skipped: [] };

    const logger = this.runtime.logging.getChildLogger({ level: "info" });
    logger.info(`[DirectoryTemplateManager] Applying template ${templateId} to ${projectDir}`);

    const created: string[] = [];
    const skipped: string[] = [];

    for (const dir of template.directories) {
      const dirPath = join(projectDir, dir);
      if (!existsSync(dirPath)) {
        try {
          mkdirSync(dirPath, { recursive: true });
          created.push(dir);
        } catch {
          skipped.push(dir);
        }
      } else {
        skipped.push(dir);
      }
    }

    for (const testFile of template.testStructure) {
      if (testFile.endsWith("/")) {
        const dirPath = join(projectDir, testFile);
        if (!existsSync(dirPath)) {
          try {
            mkdirSync(dirPath, { recursive: true });
            created.push(testFile);
          } catch {
            skipped.push(testFile);
          }
        }
      }
    }

    logger.info(`[DirectoryTemplateManager] Created ${created.length} dirs, skipped ${skipped.length}`);
    return { created, skipped };
  }

  suggestTemplate(projectFeature: string): TemplateId {
    const feature = projectFeature.toLowerCase();
    if (feature.includes("api") || feature.includes("后端") || feature.includes("backend")) return "a-python-backend";
    if (feature.includes("cli") || feature.includes("数据") || feature.includes("data")) return "b-python-cli";
    if (feature.includes("前端") || feature.includes("frontend") || feature.includes("全栈") || feature.includes("fullstack")) return "c-fullstack";
    if (feature.includes("小工具") || feature.includes("quick") || feature.includes("最小")) return "d-minimal";
    if (feature.includes("ai") || feature.includes("ml") || feature.includes("训练") || feature.includes("模型")) return "e-ai-ml";
    return "d-minimal";
  }
}

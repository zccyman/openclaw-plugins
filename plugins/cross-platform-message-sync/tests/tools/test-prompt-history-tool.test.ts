import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TMP_DIR = join(process.cwd(), "data");
const HISTORY_FILE = join(TMP_DIR, "prompt-history.json");

const SAMPLE_ENTRIES = [
  { id: "prompt-0001", title: "hello world", content: "print('hi')", tags: ["dev"], created: "2025-01-01", use_count: 0 },
  { id: "prompt-0002", title: "golang tips", content: "go func()", tags: ["dev", "go"], created: "2025-01-02", use_count: 2 },
  { id: "prompt-0003", title: "recipe", content: "boil water", tags: ["life"], created: "2025-01-03", use_count: 1 },
];

function writeSampleHistory() {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify({ entries: SAMPLE_ENTRIES }), "utf-8");
}

function cleanupHistory() {
  if (existsSync(HISTORY_FILE)) rmSync(HISTORY_FILE, { force: true });
}

vi.mock("process", async () => {
  const actual = await vi.importActual("process");
  return { ...actual };
});

import {
  PromptHistoryListTool,
  PromptHistorySearchTool,
  PromptHistoryGetTool,
  PromptHistoryReuseTool,
} from "../../src/tools/prompt-history-tool.ts";

describe("PromptHistoryTools", () => {
  beforeEach(() => {
    cleanupHistory();
  });

  afterEach(() => {
    cleanupHistory();
  });

  describe("PromptHistoryListTool", () => {
    it("should list entries when history file exists", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryListTool();
      const result = await tool.execute("call-1", {});

      expect(result.content[0].text).toContain("📜");
      const body = result.content[0].text.replace("📜 Prompt History:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(3);
    });

    it("should filter by tag", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryListTool();
      const result = await tool.execute("call-2", { tag: "dev" });

      const body = result.content[0].text.replace("📜 Prompt History:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(2);
    });

    it("should return empty when no history file", async () => {
      const tool = new PromptHistoryListTool();
      const result = await tool.execute("call-3", {});

      const body = result.content[0].text.replace("📜 Prompt History:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(0);
    });
  });

  describe("PromptHistorySearchTool", () => {
    it("should search by title match", async () => {
      writeSampleHistory();
      const tool = new PromptHistorySearchTool();
      const result = await tool.execute("call-4", { query: "golang", limit: 10 });

      const body = result.content[0].text.replace("🔍 Search results:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(1);
      expect(parsed.results[0].id).toBe("prompt-0002");
    });

    it("should search by content match", async () => {
      writeSampleHistory();
      const tool = new PromptHistorySearchTool();
      const result = await tool.execute("call-5", { query: "boil", limit: 5 });

      const body = result.content[0].text.replace("🔍 Search results:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(1);
    });

    it("should return empty for no matches", async () => {
      writeSampleHistory();
      const tool = new PromptHistorySearchTool();
      const result = await tool.execute("call-6", { query: "nonexistent" });

      const body = result.content[0].text.replace("🔍 Search results:\n", "");
      const parsed = JSON.parse(body);
      expect(parsed.total).toBe(0);
    });
  });

  describe("PromptHistoryGetTool", () => {
    it("should get prompt by exact id", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryGetTool();
      const result = await tool.execute("call-7", { id: "prompt-0002" });

      expect(result.content[0].text).toContain("golang tips");
    });

    it("should get prompt by numeric id", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryGetTool();
      const result = await tool.execute("call-8", { id: "1" });

      expect(result.content[0].text).toContain("hello world");
    });

    it("should return error for missing id", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryGetTool();
      const result = await tool.execute("call-9", { id: "prompt-9999" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("PromptHistoryReuseTool", () => {
    it("should increment use_count and update last_reused", async () => {
      writeSampleHistory();
      const tool = new PromptHistoryReuseTool();
      const result = await tool.execute("call-10", { id: "prompt-0001" });

      expect(result.content[0].text).toContain("Reusable prompt");
      const body = result.content[0].text.split("```")[1];
      const parsed = JSON.parse(body);
      expect(parsed.use_count).toBe(1);
    });
  });
});

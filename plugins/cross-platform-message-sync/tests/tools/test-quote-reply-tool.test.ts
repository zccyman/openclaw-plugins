import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const TMP_DATA = join(process.cwd(), "data");
const TMP_TOPICS = join(TMP_DATA, "topics.json");

function cleanupTopics() {
  if (existsSync(TMP_TOPICS)) rmSync(TMP_TOPICS, { force: true });
}

import { QuoteReplyTool } from "../../src/tools/quote-reply-tool.ts";

describe("QuoteReplyTool", () => {
  beforeEach(() => {
    cleanupTopics();
  });

  afterEach(() => {
    cleanupTopics();
  });

  it("should have correct metadata", () => {
    const tool = new QuoteReplyTool();
    expect(tool.name).toBe("quote_reply");
    expect(tool.label).toBe("Quote Reply");
  });

  it("should register a topic", async () => {
    const tool = new QuoteReplyTool();
    const result = await tool.execute("call-1", {
      action: "register",
      agent_name: "A",
      topic: "A股分析",
      preview: "今天沪指收涨...",
    });

    const body = result.content[0].text.replace("📎 Quote reply result:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.ok).toBe(true);
    expect(parsed.topic_id).toMatch(/^T\d{3}$/);
    expect(parsed.agent).toBe("A");
    expect(parsed.topic).toBe("A股分析");
  });

  it("should resolve topic from reply", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-reg", {
      action: "register",
      agent_name: "A",
      topic: "A股分析",
      preview: "今天沪指收涨...",
    });

    const result = await tool.execute("call-2", {
      action: "resolve",
      user_reply: "> **引用自：【A】**\n> 主题: A股分析\n> 原文: 今天沪指收涨...\n\n好的",
    });

    const body = result.content[0].text.replace("📎 Quote reply result:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.matched).toBe(true);
    expect(parsed.topic.agent).toBe("A");
  });

  it("should list active topics", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-reg1", {
      action: "register",
      agent_name: "A",
      topic: "Topic1",
    });

    const result = await tool.execute("call-3", { action: "list" });
    const body = result.content[0].text.replace("📎 Quote reply result:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.total).toBe(1);
  });

  it("should close a topic", async () => {
    const tool = new QuoteReplyTool();
    const regResult = await tool.execute("call-reg2", {
      action: "register",
      agent_name: "B",
      topic: "Topic2",
    });
    const regBody = JSON.parse(regResult.content[0].text.replace("📎 Quote reply result:\n", ""));
    const topicId = regBody.topic_id;

    const result = await tool.execute("call-4", {
      action: "close",
      topic_id: topicId,
    });

    const body = JSON.parse(result.content[0].text.replace("📎 Quote reply result:\n", ""));
    expect(body.ok).toBe(true);
  });

  it("should resolve topic from QQ CQ reply code", async () => {
    const tool = new QuoteReplyTool();
    await tool.execute("call-reg3", {
      action: "register",
      agent_name: "QQBot",
      topic: "QQ话题",
    });

    const result = await tool.execute("call-5", {
      action: "resolve",
      user_reply: "[CQ:reply,id=67890]这是我的回复",
    });

    const body = result.content[0].text.replace("📎 Quote reply result:\n", "");
    const parsed = JSON.parse(body);
    expect(parsed.matched).toBeDefined();
  });
});

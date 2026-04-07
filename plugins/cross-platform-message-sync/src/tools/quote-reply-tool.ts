import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

const RE_STANDARD = new RegExp(
  "> \\*?\\*?引用自[：:]\\s*\\*?\\*?【(.+?)】(.+?)\\n> 主题[：:]\\s*(.+?)\\n> 原文[：:]\\s*(.+?)(?:\\n\\n|\\n)(.*|$)",
  "s",
);
const RE_SIMPLE = new RegExp(">\\s*(.+?)\\s*说[：:]\\s*(.+?)(?:\\n\\n|\\n)(.*|$)", "s");
const RE_REPLY_AT = /^回复\s*@(\S+)\s*[：:]\s*(.*)/s;
const RE_CQ = /^\[CQ:reply,id=(\d+)\]\s*(.*)/s;

const TOPICS_FILE = join(process.cwd(), "data", "topics.json");

interface QuoteData {
  sender: string;
  timestamp: string;
  topic: string;
  original_text: string;
}

interface ParseResult {
  has_quote: boolean;
  quote: QuoteData | null;
  user_reply: string;
}

interface TopicEntry {
  id: string;
  agent: string;
  topic: string;
  message_id: string | null;
  preview: string | null;
  created_at: string;
  status: string;
}

function parseReplyQuote(rawContent: string): ParseResult {
  let m = RE_STANDARD.exec(rawContent);
  if (m) {
    return {
      has_quote: true,
      quote: {
        sender: m[1].trim(),
        timestamp: m[2].trim(),
        topic: m[3].trim(),
        original_text: m[4].trim(),
      },
      user_reply: (m[5] || "").trim(),
    };
  }

  m = RE_SIMPLE.exec(rawContent);
  if (m) {
    return {
      has_quote: true,
      quote: {
        sender: m[1].trim(),
        timestamp: "",
        topic: "",
        original_text: m[2].trim(),
      },
      user_reply: (m[3] || "").trim(),
    };
  }

  m = RE_REPLY_AT.exec(rawContent);
  if (m) {
    return {
      has_quote: true,
      quote: {
        sender: m[1].trim(),
        timestamp: "",
        topic: "",
        original_text: "",
      },
      user_reply: m[2].trim(),
    };
  }

  m = RE_CQ.exec(rawContent);
  if (m) {
    return {
      has_quote: true,
      quote: {
        sender: "",
        timestamp: "",
        topic: "",
        original_text: `[QQ回复] msg:${m[1]}`,
      },
      user_reply: m[2].trim(),
    };
  }

  return {
    has_quote: false,
    quote: null,
    user_reply: rawContent,
  };
}

class TopicTracker {
  private topicsFile: string;
  private activeTopics: Map<string, TopicEntry> = new Map();
  private nextId = 1;

  constructor(topicsFile?: string) {
    this.topicsFile = topicsFile || TOPICS_FILE;
    this.load();
  }

  private load() {
    if (existsSync(this.topicsFile)) {
      try {
        const data = JSON.parse(readFileSync(this.topicsFile, "utf-8"));
        const topics = data.topics || {};
        for (const [tid, topic] of Object.entries(topics) as [string, TopicEntry][]) {
          if (topic.status === "active") {
            this.activeTopics.set(tid, topic);
          }
        }
        this.nextId = data.next_id || this.activeTopics.size + 1;
      } catch {
        this.activeTopics.clear();
        this.nextId = 1;
      }
    }
  }

  private save() {
    mkdirSync(join(this.topicsFile, ".."), { recursive: true });
    const topicsObj: Record<string, TopicEntry> = {};
    for (const [k, v] of this.activeTopics) {
      topicsObj[k] = v;
    }
    const data = {
      topics: topicsObj,
      next_id: this.nextId,
      updated_at: new Date().toISOString(),
    };
    writeFileSync(this.topicsFile, JSON.stringify(data, null, 2), "utf-8");
  }

  registerTopic(
    agentName: string,
    topic: string,
    messageId?: string,
    preview?: string,
  ): string {
    const topicId = `T${String(this.nextId).padStart(3, "0")}`;
    this.nextId++;

    this.activeTopics.set(topicId, {
      id: topicId,
      agent: agentName,
      topic,
      message_id: messageId || null,
      preview: preview || null,
      created_at: new Date().toTimeString().slice(0, 5),
      status: "active",
    });
    this.save();
    return topicId;
  }

  findTopicByAgent(agentName: string): TopicEntry | undefined {
    for (const t of this.activeTopics.values()) {
      if (t.agent === agentName && t.status === "active") {
        return t;
      }
    }
    return undefined;
  }

  findTopicById(topicId: string): TopicEntry | undefined {
    return this.activeTopics.get(topicId);
  }

  getTopicsList(limit = 20): TopicEntry[] {
    return Array.from(this.activeTopics.values()).slice(0, limit);
  }

  resolveTopicFromReply(userReply: string): TopicEntry | null {
    const parsed = parseReplyQuote(userReply);
    if (parsed.has_quote && parsed.quote) {
      for (const t of this.activeTopics.values()) {
        if (t.agent === parsed.quote.sender) {
          return t;
        }
      }
    }

    const active = Array.from(this.activeTopics.values()).filter(
      (t) => t.status === "active",
    );
    if (active.length === 1) {
      return active[0];
    }

    return null;
  }

  closeTopic(topicId: string): boolean {
    const topic = this.activeTopics.get(topicId);
    if (topic) {
      topic.status = "closed";
      this.activeTopics.delete(topicId);
      this.save();
      return true;
    }
    return false;
  }
}

export class QuoteReplyTool implements AnyAgentTool {
  name = "quote_reply";
  label = "Quote Reply";
  description =
    "Manage quote-reply for sub-agent conversations. Register topics, resolve topics from user replies, or list active topics.";
  parameters = z.object({
    action: z
      .enum(["register", "resolve", "list", "close"])
      .describe(
        "Action: register a new topic, resolve from reply, list active topics, or close a topic",
      ),
    agent_name: z.string().optional().describe("Agent name (for register)"),
    topic: z.string().optional().describe("Topic name (for register)"),
    message_id: z.string().optional().describe("Original message ID (for register)"),
    preview: z.string().optional().describe("Preview text (for register)"),
    user_reply: z.string().optional().describe("User reply text (for resolve)"),
    topic_id: z.string().optional().describe("Topic ID (for close)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const tracker = new TopicTracker();
      let result: any;

      if (input.action === "register") {
        const tid = tracker.registerTopic(
          input.agent_name || "",
          input.topic || "",
          input.message_id,
          input.preview,
        );
        result = { ok: true, topic_id: tid, agent: input.agent_name, topic: input.topic };
      } else if (input.action === "resolve") {
        const matched = tracker.resolveTopicFromReply(input.user_reply || "");
        if (matched) {
          result = { matched: true, topic: matched };
        } else {
          result = { matched: false };
        }
      } else if (input.action === "list") {
        const topics = tracker.getTopicsList();
        result = { topics, total: topics.length };
      } else if (input.action === "close") {
        const ok = tracker.closeTopic(input.topic_id || "");
        result = { ok, topic_id: input.topic_id };
      }

      return {
        content: [{ type: "text" as const, text: `📎 Quote reply result:\n${JSON.stringify(result)}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `❌ Quote reply failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

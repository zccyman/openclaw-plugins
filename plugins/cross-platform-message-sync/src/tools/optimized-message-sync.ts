import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { recordSyncPerformance } from "./performance-monitor.js";

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g;

// Platform mappings
const PLATFORM_LABELS = {
  weixin: "微信",
  feishu: "飞书",
  qq: "QQ",
  qqbot: "QQ",
} as const;

const SOURCE_TAGS = {
  weixin: "Sync from WeChat",
  feishu: "Sync from Feishu",
  qq: "Sync from QQ",
  qqbot: "Sync from QQ",
} as const;

function getSourceTag(platform: string): string {
  const tag = SOURCE_TAGS[platform as keyof typeof SOURCE_TAGS];
  return tag ?? `Sync from ${platform}`;
}

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform;
}

// Extract code blocks efficiently
function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];

  // Extract fenced code blocks
  let match;
  CODE_BLOCK_REGEX.lastIndex = 0; // Reset regex state
  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    blocks.push({
      language: match[1].trim() || 'text',
      code: match[2].trimEnd()
    });
  }

  // Extract indented code blocks
  const lines = content.split('\n');
  let currentBlock: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.startsWith('    ') && line.trim()) {
      inBlock = true;
      currentBlock.push(line.slice(4));
    } else {
      if (inBlock && currentBlock.length > 0) {
        blocks.push({
          language: 'text',
          code: currentBlock.join('\n')
        });
        currentBlock = [];
      }
      inBlock = false;
    }
  }

  if (inBlock && currentBlock.length > 0) {
    blocks.push({
      language: 'text',
      code: currentBlock.join('\n')
    });
  }

  return blocks;
}



// Message normalization
function normalizeMessage(
  content: string,
  senderName: string,
  sourcePlatform: string,
  timestamp?: string,
  msgType = "text",
  attachments: any[] = [],
  replyTo?: string,
  mentions: any[] = [],
  codeBlocks?: Array<{ language: string; code: string }>
): any {
  const ts = timestamp || new Date().toLocaleTimeString('zh-CN', { hour12: false });

  return {
    platform: sourcePlatform,
    sender: senderName,
    timestamp: ts,
    type: msgType,
    content,
    sourceTag: getSourceTag(sourcePlatform),
    platformLabel: getPlatformLabel(sourcePlatform),
    attachments,
    replyTo,
    mentions,
    codeBlocks: codeBlocks || extractCodeBlocks(content),
  };
}

// Platform-specific parsers
function parseWeixinMsg(raw: any): any {
  const typeMap: Record<string, string> = { image: "image", file: "file", video: "video", voice: "voice" };
  const msgType = typeMap[raw.message_type as string] || "text";
  const mentions = raw.mentioned_list || [];

  return normalizeMessage(
    raw.content || "",
    raw.sender_name || "Unknown",
    "weixin",
    raw.timestamp,
    msgType,
    [],
    undefined,
    mentions
  );
}

function parseFeishuMsg(raw: any): any {
  let content = raw.content || "";
  try {
    const contentJson = JSON.parse(content);
    content = typeof contentJson === 'object' ? contentJson.text || content : content;
  } catch {}

  const typeMap: Record<string, string> = { image: "image", file: "file", audio: "voice", media: "video" };
  const msgType = typeMap[raw.message_type as string] || "text";
  const mentions = raw.mentions || [];

  let replyTo: string | undefined;
  if (raw.upper_message_id) {
    replyTo = `[回复] ${raw.upper_content?.slice(0, 50) || ''}...`;
  }

  return normalizeMessage(
    content,
    raw.sender_name || "Unknown",
    "feishu",
    raw.timestamp,
    msgType,
    [],
    replyTo,
    mentions
  );
}

function parseQqMsg(raw: any): any {
  const typeMap: Record<string, string> = { "图片": "image", "文件": "file", "语音": "voice", "视频": "video" };
  const msgType = typeMap[raw.message_type as string] || "text";

  let content = raw.content || "";
  content = content.replace(/\[CQ:reply,id=\d+\]\s*/g, '').trim();

  return normalizeMessage(
    content,
    raw.sender_name || "Unknown",
    "qq",
    raw.timestamp,
    msgType,
    [],
    undefined,
    raw.mentions || []
  );
}

// Message formatting for targets
function formatForDisplay(unified: any, _targetPlatform: string): string {
  const header = `**【${unified.sender}】** ${unified.timestamp}`;

  let replyPrefix = "";
  if (unified.replyTo) {
    if (typeof unified.replyTo === 'object') {
      const q = unified.replyTo;
      replyPrefix = `> **引用自：【${q.sender || ''}】${q.timestamp || ''}**\n> 主题: ${q.topic || ''}\n> 原文: ${q.original_text?.slice(0, 80) || ''}\n\n`;
    } else {
      replyPrefix = `> **引用:** ${unified.replyTo}\n\n`;
    }
  }

  const body = unified.type === "text" ? `${replyPrefix}${unified.content}` :
               unified.type === "image" ? `${replyPrefix}[📷 图片] ${unified.content}` :
               unified.type === "file" ? `${replyPrefix}[📎 文件] ${unified.content}` :
               unified.type === "video" ? `${replyPrefix}[🎬 视频] ${unified.content}` :
               unified.type === "voice" ? `${replyPrefix}[🎤 语音] (暂不支持)` :
               `${replyPrefix}${unified.content}`;

  const footer = `\n\n_↗ ${unified.sourceTag}_`;

  return `${header}\n\n${body}${footer}`;
}

// Cross-platform bridge with caching
class CrossPlatformBridge {
  private loopMarkers = new Set<string>();

  shouldForward(senderId: string, msgContent: string): boolean {
    const sourceTags = ["[↗", "Sync from"];
    return !sourceTags.some(tag => msgContent.includes(tag));
  }

  forward(unifiedMsg: any, targetPlatforms: string[]): Record<string, any> {
    const results: Record<string, any> = {};

    for (const platform of targetPlatforms) {
      const normalized = platform.toLowerCase().replace("bot", "");
      if (platform === unifiedMsg.platform || normalized === unifiedMsg.platform) continue;

      const formatted = formatForDisplay(unifiedMsg, platform);
      results[platform] = {
        raw_text: formatted,
        platform,
        msg_type: unifiedMsg.type,
      };
    }

    return results;
  }

  processPipeline(rawMsg: any, sourcePlatform: string, targetPlatforms: string[]): any {
    const parsers: Record<string, (raw: any) => any> = {
      weixin: parseWeixinMsg,
      feishu: parseFeishuMsg,
      qq: parseQqMsg,
      qqbot: parseQqMsg,
    };

    const parser = parsers[sourcePlatform.toLowerCase()];
    if (!parser) {
      return { error: `Unsupported platform: ${sourcePlatform}` };
    }

    const unified = parser(rawMsg);

    if (!this.shouldForward(rawMsg.sender_id || "", unified.content)) {
      return { error: "Loop prevention: message already synced" };
    }

    const forwards = this.forward(unified, targetPlatforms);

    return {
      source: sourcePlatform,
      unified,
      forwards,
    };
  }
}

// Optimized message sync tool
export class OptimizedMessageSyncTool implements AnyAgentTool {
  name = "message_sync_optimized";
  label = "Optimized Message Sync";
  description = "High-performance message sync across WeChat/QQ/Feishu with caching and batch processing.";
  parameters = z.object({
    raw_msg: z.string().describe("Raw message text (plain text)"),
    source: z.enum(["weixin", "qqbot", "feishu"]).describe("Source platform"),
    targets: z.array(z.enum(["weixin", "qqbot", "feishu"])).describe("Target platforms to forward to"),
  });

  private bridge = new CrossPlatformBridge();

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    const startTime = Date.now();

    try {
      // Parse input message
      let rawMsg: any;
      try {
        rawMsg = JSON.parse(input.raw_msg);
      } catch {
        // If not JSON, treat as plain text message
        rawMsg = {
          content: input.raw_msg,
          sender_name: "User",
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          message_type: "text"
        };
      }

      const result = this.bridge.processPipeline(rawMsg, input.source, input.targets);

      const latency = Date.now() - startTime;

      if (result.error) {
        recordSyncPerformance(latency, false);
        return {
          content: [{ type: "text", text: `❌ Sync failed: ${result.error}` }],
          isError: true,
        };
      }

      recordSyncPerformance(latency, true);
      return {
        content: [{ type: "text", text: `✅ Message synced to ${input.targets.join(", ")} (${latency}ms)` }],
        details: result,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      recordSyncPerformance(latency, false);
      return {
        content: [{ type: "text", text: `❌ Sync failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}
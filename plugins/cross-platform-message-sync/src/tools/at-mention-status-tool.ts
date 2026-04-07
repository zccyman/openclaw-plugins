import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

const MENTION_PATTERN = /[@＠]\s*([^\s]+)/g;

interface BotConfig {
  id: string;
  aliases: string[];
}

interface RateLimitConfig {
  windowSec: number;
  maxTriggers: number;
}

interface GlobalRules {
  requireMention: boolean;
  allowWildcard: boolean;
  rateLimit: RateLimitConfig;
}

interface RouterConfig {
  bots: BotConfig[];
  rules: {
    global: GlobalRules;
    perGroup: Record<string, Partial<GlobalRules & { requireMention: boolean }>>;
    blacklistUsers: string[];
  };
}

const DEFAULT_CONFIG: RouterConfig = {
  bots: [],
  rules: {
    global: {
      requireMention: true,
      allowWildcard: true,
      rateLimit: { windowSec: 60, maxTriggers: 5 },
    },
    perGroup: {},
    blacklistUsers: [],
  },
};

class MentionRouter {
  private config: RouterConfig;
  private aliases: Map<string, string>;
  private rateLimits: Record<string, number[]>;
  private configPath: string;
  private rateStatePath: string;

  constructor(configPath?: string, rateStatePath?: string) {
    this.configPath = configPath ?? join(process.cwd(), "data", "at_mention_router_config.json");
    this.rateStatePath = rateStatePath ?? join(process.cwd(), "data", "rate_limit_state.json");
    this.config = this.loadConfig();
    this.aliases = this.buildAliasIndex();
    this.rateLimits = this.loadRateLimits();
  }

  private loadConfig(): RouterConfig {
    if (existsSync(this.configPath)) {
      return JSON.parse(readFileSync(this.configPath, "utf-8"));
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  private buildAliasIndex(): Map<string, string> {
    const idx = new Map<string, string>();
    for (const bot of this.config.bots ?? []) {
      for (const alias of bot.aliases ?? []) {
        idx.set(alias.toLowerCase(), bot.id);
      }
    }
    return idx;
  }

  private loadRateLimits(): Record<string, number[]> {
    if (existsSync(this.rateStatePath)) {
      return JSON.parse(readFileSync(this.rateStatePath, "utf-8"));
    }
    return {};
  }

  private saveRateLimits(): void {
    writeFileSync(this.rateStatePath, JSON.stringify(this.rateLimits));
  }

  private checkRateLimit(userId: string): boolean {
    const rl = this.config.rules?.global?.rateLimit ?? { windowSec: 60, maxTriggers: 5 };
    const window = rl.windowSec ?? 60;
    const maxTriggers = rl.maxTriggers ?? 5;
    const now = Date.now() / 1000;
    let entries = this.rateLimits[userId] ?? [];
    entries = entries.filter((t) => now - t < window);
    this.rateLimits[userId] = entries;
    if (entries.length >= maxTriggers) {
      return false;
    }
    entries.push(now);
    this.saveRateLimits();
    return true;
  }

  parseMentions(message: string): string[] {
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags);
    while ((m = re.exec(message)) !== null) {
      if (m[1].trim()) {
        matches.push(m[1]);
      }
    }
    return matches;
  }

  shouldTrigger(botId: string, message: string, chatId = "", userId = ""): boolean {
    const rules = this.config.rules ?? DEFAULT_CONFIG.rules!;
    const globalRules = rules.global ?? DEFAULT_CONFIG.rules!.global;

    if (userId && (rules.blacklistUsers ?? []).includes(userId)) {
      return false;
    }

    if (userId && !this.checkRateLimit(userId)) {
      return false;
    }

    const groupRules = (rules.perGroup ?? {})[chatId] ?? {};
    const effectiveRequire = groupRules.requireMention ?? globalRules.requireMention ?? true;
    if (!effectiveRequire) {
      return true;
    }

    const mentions = this.parseMentions(message);
    if (mentions.length === 0) {
      if (globalRules.allowWildcard ?? false) {
        return true;
      }
      return false;
    }

    for (const mention of mentions) {
      const targetBot = this.aliases.get(mention.toLowerCase());
      if (targetBot === botId) {
        return true;
      }
      if (["所有人", "all", "everyone"].includes(mention) && (globalRules.allowWildcard ?? false)) {
        return true;
      }
    }

    return false;
  }

  reload(): void {
    this.config = this.loadConfig();
    this.aliases = this.buildAliasIndex();
  }

  getStatus(): string {
    const lines: string[] = [];

    lines.push("Configured Bots:");
    const bots = this.config.bots ?? [];
    if (bots.length === 0) {
      lines.push("  (none)");
    } else {
      for (const bot of bots) {
        lines.push(`  - ${bot.id}: aliases [${(bot.aliases ?? []).join(", ")}]`);
      }
    }

    const global = this.config.rules?.global ?? DEFAULT_CONFIG.rules!.global;
    lines.push("");
    lines.push("Global Rules:");
    lines.push(`  requireMention: ${global.requireMention}`);
    lines.push(`  allowWildcard: ${global.allowWildcard}`);
    const rl = global.rateLimit ?? { windowSec: 60, maxTriggers: 5 };
    lines.push(`  rateLimit: window=${rl.windowSec}s, maxTriggers=${rl.maxTriggers}`);

    const activeEntries = Object.keys(this.rateLimits).filter(
      (k) => this.rateLimits[k] && this.rateLimits[k].length > 0
    ).length;
    lines.push("");
    lines.push(`Active Rate Limit Entries: ${activeEntries}`);

    return lines.join("\n");
  }
}

const router = new MentionRouter();

export class AtMentionStatusTool implements AnyAgentTool {
  name = "at_mention_status";
  label = "@ Mention Router Status";
  description = "Show @-mention router configuration and statistics.";
  parameters = z.object({});

  async execute(_toolCallId: string, _input: z.infer<typeof this.parameters>) {
    try {
      const statusText = router.getStatus();
      return {
        content: [{ type: "text", text: `📊 @Mention Router Status:\n${statusText}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Status check failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

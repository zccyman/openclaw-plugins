import { z } from "zod";
import type { AnyAgentTool } from "openclaw/plugin-sdk/core";

const _CHINESE_NUM: Record<string, string> = {
  "一": "1",
  "二": "2",
  "三": "3",
  "四": "4",
  "五": "5",
  "六": "6",
  "七": "7",
  "八": "8",
  "九": "9",
  "十": "10",
};

const _MULTI_SPLIT_RE = /[、，,+\s和与]+/;

const _OPTION_PATTERNS = [
  /^\s*([A-Za-z])[.)、]\s+(.+)$/gm,
  /^\s*(\d+)[.)、]\s+(.+)$/gm,
  /^\s*[【[]([A-Za-z0-9]+)[】\]]\s*(.+)$/gm,
  /^\s*[Ⓐ-Ⓩ⒜-⒵]([A-Za-z])\s+(.+)$/gm,
  /^\s*[①-⑳](\d+)\s+(.+)$/gm,
];

const _CHOICE_PATTERNS = [
  /(?:选择|选|我要|选第|pick|choose)\s*([A-Za-z0-9])/i,
  /^\s*([A-Za-z0-9])\s*[.、)）]\s*$/,
  /^\s*([A-Za-z0-9])\s*$/,
];

const _RANGE_RE = /([A-Za-z0-9]+)\s*(?:到|至|[-~])\s*([A-Za-z0-9]+)/;

const _MULTI_LETTER_RE = /^\s*(?:选择|选|我要|pick|choose)\s*([A-Za-z]{2,})\s*$/i;

const _PREFIX_MULTI_RE = /^\s*(?:选择|选|我要|pick|choose)\s+(.+)$/i;

const _CHINESE_ORDINAL_RE = /第([一二三四五六七八九十]+)[个选项]?/g;

interface Option {
  key: string;
  text: string;
}

interface ParseResult {
  selected: string[];
  confidence: "high" | "medium" | "low";
  multi: boolean;
  raw: string;
}

function extractOptions(text: string): Option[] {
  const options: Option[] = [];
  const seenKeys = new Set<string>();

  for (const pattern of _OPTION_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    for (const m of matches) {
      const key = m[1].trim().toUpperCase();
      const val = m[2].trim();
      if (key && !seenKeys.has(key) && val) {
        seenKeys.add(key);
        options.push({ key, text: val });
      }
    }
  }

  return options;
}

function expandLetterRange(start: string, end: string): string[] {
  const s = start.toUpperCase().charCodeAt(0);
  const e = end.toUpperCase().charCodeAt(0);
  if (s > e || e - s > 25) return [];
  const result: string[] = [];
  for (let c = s; c <= e; c++) {
    result.push(String.fromCharCode(c));
  }
  return result;
}

function expandNumberRange(start: string, end: string): string[] {
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  if (isNaN(s) || isNaN(e) || s > e || e - s > 50) return [];
  const result: string[] = [];
  for (let n = s; n <= e; n++) {
    result.push(String(n));
  }
  return result;
}

function resolveChineseOrdinals(text: string): string[] | null {
  const matches = Array.from(text.matchAll(_CHINESE_ORDINAL_RE));
  if (!matches.length) return null;
  const result: string[] = [];
  for (const m of matches) {
    const num = _CHINESE_NUM[m[1]];
    if (num) result.push(num);
  }
  return result.length ? result : null;
}

function filterValid(keys: string[], valid: string[] | null | undefined): string[] {
  if (!valid) return keys;
  const validUpper = valid.map((v) => v.toUpperCase());
  return keys.filter((k) => validUpper.includes(k.toUpperCase()));
}

function parseMultiSelections(reply: string, expected?: string[] | null): ParseResult | null {
  const trimmed = reply.trim();
  if (!trimmed) return null;

  const cnOrdinals = resolveChineseOrdinals(trimmed);
  if (cnOrdinals && cnOrdinals.length >= 2) {
    return {
      selected: filterValid(cnOrdinals, expected),
      confidence: "high",
      multi: true,
      raw: trimmed,
    };
  }

  const rangeM = trimmed.match(_RANGE_RE);
  if (rangeM) {
    const a = rangeM[1];
    const b = rangeM[2];
    if (/^[A-Za-z]$/.test(a) && /^[A-Za-z]$/.test(b)) {
      const expanded = expandLetterRange(a, b);
      const valid = filterValid(expanded, expected);
      if (valid.length) {
        return { selected: valid, confidence: "high", multi: true, raw: trimmed };
      }
    } else if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
      const expanded = expandNumberRange(a, b);
      const valid = filterValid(expanded, expected);
      if (valid.length) {
        return { selected: valid, confidence: "high", multi: true, raw: trimmed };
      }
    }
  }

  const multiLetterM = trimmed.match(_MULTI_LETTER_RE);
  if (multiLetterM) {
    const letters = multiLetterM[1].split("").filter((c) => /[A-Za-z]/.test(c)).map((c) => c.toUpperCase());
    const valid = filterValid(letters, expected);
    if (valid.length >= 2) {
      return { selected: valid, confidence: "high", multi: true, raw: trimmed };
    }
  }

  const prefixMultiM = trimmed.match(_PREFIX_MULTI_RE);
  if (prefixMultiM) {
    const remainder = prefixMultiM[1].trim();
    const parts = remainder.split(_MULTI_SPLIT_RE);
    if (parts.length >= 2) {
      const candidates = parts.map((p) => p.trim().toUpperCase()).filter(Boolean);
      const valid = filterValid(candidates, expected);
      if (valid.length >= 2) {
        return { selected: valid, confidence: "high", multi: true, raw: trimmed };
      }
      if (valid.length === 1) {
        return { selected: valid, confidence: "medium", multi: false, raw: trimmed };
      }
    }
  }

  const bareParts = trimmed.split(_MULTI_SPLIT_RE);
  if (bareParts.length >= 2) {
    const candidates = bareParts.map((p) => p.trim().toUpperCase()).filter(Boolean);
    const valid = filterValid(candidates, expected);
    if (valid.length >= 2) {
      return { selected: valid, confidence: "medium", multi: true, raw: trimmed };
    }
    if (valid.length === 1) {
      return { selected: valid, confidence: "medium", multi: false, raw: trimmed };
    }
  }

  const bareLettersM = trimmed.match(/^\s*([A-Za-z]{2,})\s*$/);
  if (bareLettersM) {
    const letters = bareLettersM[1].split("").filter((c) => /[A-Za-z]/.test(c)).map((c) => c.toUpperCase());
    const valid = filterValid(letters, expected);
    if (valid.length >= 2) {
      return { selected: valid, confidence: "medium", multi: true, raw: trimmed };
    }
  }

  return null;
}

function renderOptions(text: string, platform: string = "feishu"): string {
  const opts = extractOptions(text);
  if (!opts.length) return text;

  const keys = opts.map((o) => o.key);
  const multiHint = opts.length >= 3 ? "（可多选）" : "";

  let hint: string;
  if (platform === "feishu") {
    hint = `\n\n---\n📋 **请点击对应选项或回复字母/数字选择${multiHint}：** ${keys.join(" / ")}`;
  } else if (platform === "weixin") {
    hint = `\n\n---\n📋 请回复选项编号（${keys.join("、")}）进行选择${multiHint}`;
  } else if (platform === "qq" || platform === "qqbot") {
    hint = `\n\n---\n📋 发送选项编号（${keys.join("、")}）进行选择${multiHint}`;
  } else {
    hint = `\n\nOptions: ${keys.join(", ")} ${multiHint}`;
  }

  return text + hint;
}

function parseChoiceReply(replyText: string, expectedOptions?: string[] | null): ParseResult | null {
  const reply = replyText.trim();
  if (!reply) return null;

  const multi = parseMultiSelections(reply, expectedOptions);
  if (multi) return multi;

  for (const [cn, num] of Object.entries(_CHINESE_NUM)) {
    if (reply.includes(`第${cn}`) || reply.includes(`第${cn}个`)) {
      return { selected: [num], confidence: "high", multi: false, raw: reply };
    }
  }

  if (expectedOptions) {
    for (const opt of expectedOptions) {
      if (reply.toUpperCase() === opt.toUpperCase()) {
        return { selected: [opt.toUpperCase()], confidence: "high", multi: false, raw: reply };
      }
    }
  }

  for (const pattern of _CHOICE_PATTERNS) {
    const m = reply.match(pattern);
    if (m) {
      const key = m[1].toUpperCase();
      if (!expectedOptions || expectedOptions.some((o) => o.toUpperCase() === key)) {
        return { selected: [key], confidence: "medium", multi: false, raw: reply };
      }
    }
  }

  if (expectedOptions) {
    for (const opt of expectedOptions) {
      if (reply.toUpperCase().includes(opt.toUpperCase())) {
        return { selected: [opt.toUpperCase()], confidence: "low", multi: false, raw: reply };
      }
    }
  }

  return null;
}

export class ChoiceSelectTool implements AnyAgentTool {
  name = "choice_select";
  label = "Choice Select";
  description = "Parse a user's choice reply for single or multi selection (A/B/C or 1/2/3). Returns selected keys as array, confidence level, and whether multi-select was detected.";
  parameters = z.object({
    reply_text: z.string().describe("User's reply text to parse"),
    expected_options: z.array(z.string()).optional().describe("Expected option keys (e.g. ['A','B','C'] or ['1','2','3'])"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const result = parseChoiceReply(input.reply_text, input.expected_options);
      if (!result) {
        return {
          content: [{
            type: "text" as const,
            text: `📋 Choice parsed:\n${JSON.stringify({ error: "Could not parse choice", raw: input.reply_text })}`,
          }],
        };
      }
      return {
        content: [{ type: "text" as const, text: `📋 Choice parsed:\n${JSON.stringify(result)}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `❌ Choice parse failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export class ChoiceRenderTool implements AnyAgentTool {
  name = "choice_render";
  label = "Choice Render";
  description = "Render a message containing multiple options with platform-specific interaction hints (click-to-confirm for Feishu, reply-to-confirm for WeChat/QQ).";
  parameters = z.object({
    content: z.string().describe("Message content containing options (A. B. C. or 1. 2. 3.)"),
    platform: z.enum(["feishu", "weixin", "qq", "qqbot"]).describe("Target platform"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    try {
      const result = renderOptions(input.content, input.platform);
      return {
        content: [{ type: "text" as const, text: `✅ Options rendered for ${input.platform}:\n${result}` }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `❌ Choice render failed: ${err.message}` }],
        isError: true,
      };
    }
  }
}

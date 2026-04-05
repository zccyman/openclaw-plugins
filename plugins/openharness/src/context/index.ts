import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface InstructionFile {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
  source: string;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

async function discoverClaudeMdFiles(cwd: string): Promise<InstructionFile[]> {
  const results: InstructionFile[] = [];
  let current = path.resolve(cwd);
  const root = path.parse(current).root;

  while (current !== root) {
    for (const candidate of [
      path.join(current, "CLAUDE.md"),
      path.join(current, ".claude", "CLAUDE.md"),
    ]) {
      try {
        const stat = await fs.stat(candidate);
        results.push({
          path: candidate,
          name: path.relative(cwd, candidate),
          size: stat.size,
          modifiedAt: stat.mtimeMs,
          source: "claude_md",
        });
      } catch { /* not found */ }
    }

    const rulesDir = path.join(current, ".claude", "rules");
    try {
      const entries = await fs.readdir(rulesDir);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const filePath = path.join(rulesDir, entry);
          try {
            const stat = await fs.stat(filePath);
            results.push({
              path: filePath,
              name: path.relative(cwd, filePath),
              size: stat.size,
              modifiedAt: stat.mtimeMs,
              source: "claude_rule",
            });
          } catch { /* skip */ }
        }
      }
    } catch { /* no rules dir */ }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return results;
}

async function discoverProjectContext(cwd: string): Promise<InstructionFile[]> {
  const results: InstructionFile[] = [];
  const candidates = [
    { file: "CLAUDE.md", source: "claude_md" },
    { file: ".claude/CLAUDE.md", source: "claude_md" },
    { file: "AGENTS.md", source: "agents_md" },
    { file: "CONTEXT.md", source: "context_md" },
    { file: ".openharness/context.md", source: "openharness_context" },
    { file: "docs/context.md", source: "docs_context" },
    { file: "README.md", source: "readme" },
  ];

  for (const { file, source } of candidates) {
    const filePath = path.join(cwd, file);
    try {
      const stat = await fs.stat(filePath);
      results.push({
        path: filePath,
        name: file,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        source,
      });
    } catch { /* not found */ }
  }

  return results;
}

function extractSummary(content: string, maxLen: number = 500): string {
  const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
  return lines.slice(0, 10).join("\n").slice(0, maxLen);
}

export function registerContext(api: any) {
    api.registerTool({
      name: "oh_context_discover",
      label: "Discover Context Files",
      description: "Discover all context files (CLAUDE.md, AGENTS.md, project instructions) in the current project. Walks up the directory tree to find instruction files.",
      parameters: Type.Object({
        cwd: Type.Optional(Type.String({ description: "Working directory to scan (default: current directory)" })),
        maxDepth: Type.Optional(Type.Number({ description: "Maximum directory depth to walk up (default: 10)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = params.cwd || process.cwd();
        const claudeMdFiles = await discoverClaudeMdFiles(cwd);
        const projectFiles = await discoverProjectContext(cwd);
        const allFiles = [...claudeMdFiles, ...projectFiles];
        const seen = new Set<string>();
        const unique = allFiles.filter((f) => {
          if (seen.has(f.path)) return false;
          seen.add(f.path);
          return true;
        });

        if (unique.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No context files found in ${cwd} or parent directories.` }],
            details: { success: true },
          };
        }

        let totalTokens = 0;
        const details = await Promise.all(unique.map(async (f) => {
          const content = await fs.readFile(f.path, "utf-8");
          const tokens = estimateTokens(content);
          totalTokens += tokens;
          return `${f.name} (${(f.size / 1024).toFixed(1)}KB, ~${tokens} tokens)\n  Source: ${f.source} | Path: ${f.path}\n  Preview: ${extractSummary(content)}`;
        }));

        return {
          content: [{
            type: "text" as const,
            text: `Context Files (${unique.length} found, ~${totalTokens} total tokens):\n\n${details.join("\n\n")}`,
          }],
          details: { success: true, fileCount: unique.length, totalTokens },
        };
      },
    });

    api.registerTool({
      name: "oh_context_compress",
      label: "Compress Context",
      description: "Compress a block of text to reduce token usage. Useful for summarizing long documents, conversation history, or large file contents before injecting into context.",
      parameters: Type.Object({
        content: Type.String({ description: "The text content to compress" }),
        strategy: Type.Optional(Type.String({ description: "Compression strategy", enum: ["summary", "key-points", "outline", "extract-keywords"], default: "summary" })),
        maxTokens: Type.Optional(Type.Number({ description: "Target maximum tokens for the output (default: 500)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const { content, strategy = "summary", maxTokens = 500 } = params;
        const originalTokens = estimateTokens(content);

        if (originalTokens <= maxTokens) {
          return {
            content: [{ type: "text" as const, text: `Content is already within target (~${originalTokens} tokens). No compression needed.\n\n${content}` }],
            details: { success: true, originalTokens, compressedTokens: originalTokens, ratio: 1.0 },
          };
        }

        let compressed: string;
        switch (strategy) {
          case "key-points": {
            const lines = content.split("\n").filter((l: string) => l.trim());
            const keyLines = lines.filter((l: string) =>
              /^(#{1,3}\s|[-*]\s|\d+\.\s|TODO|FIXME|IMPORTANT|NOTE|WARNING|>)/.test(l.trim()) ||
              l.trim().length > 50
            );
            compressed = keyLines.slice(0, maxTokens).join("\n");
            break;
          }
          case "outline": {
            const headings = content.split("\n").filter((l: string) => /^#{1,4}\s/.test(l.trim()));
            const firstPara = content.split("\n\n").slice(0, 3).join("\n\n");
            compressed = headings.length > 0
              ? `# Outline\n${headings.join("\n")}\n\n## Summary\n${firstPara.slice(0, maxTokens * 4)}`
              : content.slice(0, maxTokens * 4);
            break;
          }
          case "extract-keywords": {
            const words = content.toLowerCase().split(/\s+/);
            const freq = new Map<string, number>();
            const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "out", "off", "over", "under", "again", "further", "then", "once", "and", "but", "or", "nor", "not", "so", "yet", "both", "either", "neither", "each", "every", "all", "any", "few", "more", "most", "other", "some", "such", "no", "only", "own", "same", "than", "too", "very", "just", "because", "if", "when", "where", "how", "what", "which", "who", "whom", "this", "that", "these", "those", "it", "its"]);
            for (const word of words) {
              const clean = word.replace(/[^a-z0-9]/g, "");
              if (clean.length > 3 && !stopWords.has(clean)) {
                freq.set(clean, (freq.get(clean) || 0) + 1);
              }
            }
            const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
            compressed = `# Keywords (${sorted.length})\n\n${sorted.map(([w, c]) => `- ${w} (${c}x)`).join("\n")}\n\n## First 500 chars\n${content.slice(0, 500)}`;
            break;
          }
          default: {
            const sentences = content.split(/[.!?\n]+/).filter((s: string) => s.trim().length > 20);
            const targetSentences = Math.min(sentences.length, Math.ceil(maxTokens / 15));
            compressed = sentences.slice(0, targetSentences).join(". ") + ".";
            if (compressed.length > maxTokens * 4) {
              compressed = compressed.slice(0, maxTokens * 4) + "...";
            }
          }
        }

        const compressedTokens = estimateTokens(compressed);
        const ratio = compressedTokens / originalTokens;

        return {
          content: [{
            type: "text" as const,
            text: `Compressed (${strategy}): ${originalTokens} → ${compressedTokens} tokens (${(ratio * 100).toFixed(1)}%)\n\n${compressed}`,
          }],
          details: { success: true, originalTokens, compressedTokens, ratio, strategy },
        };
      },
    });

    api.registerTool({
      name: "oh_context_estimate_tokens",
      label: "Estimate Tokens",
      description: "Estimate the token count for text content. Useful for managing context window budget.",
      parameters: Type.Object({
        content: Type.Optional(Type.String({ description: "Text content to estimate tokens for" })),
        file_path: Type.Optional(Type.String({ description: "Path to a file to estimate tokens for" })),
        model: Type.Optional(Type.String({ description: "Model for estimation accuracy", enum: ["generic", "claude", "gpt4"], default: "generic" })),
      }),
      async execute(_toolCallId: string, params: any) {
        let text = params.content || "";
        if (params.file_path) {
          try {
            text = await fs.readFile(params.file_path, "utf-8");
          } catch (err: any) {
            return { content: [{ type: "text" as const, text: `Cannot read file: ${err.message}` }], details: { success: true } };
          }
        }

        if (!text) {
          return { content: [{ type: "text" as const, text: "Provide either 'content' or 'file_path'" }], details: { success: true } };
        }

        const charCount = text.length;
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const lineCount = text.split("\n").length;
        const baseTokens = estimateTokens(text);

        const modelMultipliers: Record<string, number> = {
          generic: 1.0,
          claude: 1.1,
          gpt4: 0.95,
        };
        const multiplier = modelMultipliers[params.model || "generic"] || 1.0;
        const estimatedTokens = Math.ceil(baseTokens * multiplier);

        return {
          content: [{
            type: "text" as const,
            text: `Token Estimation (${params.model || "generic"}):\n  Characters: ${charCount}\n  Words: ${wordCount}\n  Lines: ${lineCount}\n  Estimated Tokens: ~${estimatedTokens}\n  Context Window Usage: ${(estimatedTokens / 200000 * 100).toFixed(2)}% (200K context)`,
          }],
          details: { success: true, charCount, wordCount, lineCount, estimatedTokens },
        };
      },
    });

    api.registerTool({
      name: "oh_context_status",
      label: "Context Status",
      description: "Show the current context window status — what instruction files are loaded, estimated token budget, and recommendations.",
      parameters: Type.Object({
        cwd: Type.Optional(Type.String({ description: "Working directory" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = params.cwd || process.cwd();
        const files = await discoverProjectContext(cwd);
        let totalTokens = 0;
        const fileDetails: string[] = [];

        for (const f of files) {
          try {
            const content = await fs.readFile(f.path, "utf-8");
            const tokens = estimateTokens(content);
            totalTokens += tokens;
            fileDetails.push(`  ${f.name}: ~${tokens} tokens (${(f.size / 1024).toFixed(1)}KB)`);
          } catch { /* skip */ }
        }

        const contextWindowBudget = 200000;
        const systemPromptTokens = ~2000;
        const conversationTokens = 0;
        const usedTokens = totalTokens + systemPromptTokens + conversationTokens;
        const remainingTokens = contextWindowBudget - usedTokens;
        const usagePercent = (usedTokens / contextWindowBudget * 100).toFixed(1);

        const recommendations: string[] = [];
        if (totalTokens > 50000) recommendations.push("⚠️ Context files exceed 50K tokens. Consider using oh_context_compress.");
        if (totalTokens > 100000) recommendations.push("🔴 Context files exceed 100K tokens. Critical: compress or remove files.");
        if (recommendations.length === 0) recommendations.push("✅ Context budget looks healthy.");

        return {
          content: [{
            type: "text" as const,
            text: `Context Window Status\n${"━".repeat(40)}\nBudget: ${contextWindowBudget} tokens\nUsed: ~${usedTokens} tokens (${usagePercent}%)\nRemaining: ~${remainingTokens} tokens\n\nContext Files:\n${fileDetails.join("\n") || "  (none found)"}\n\nRecommendations:\n${recommendations.join("\n")}`,
          }],
          details: { success: true, totalTokens, usedTokens, remainingTokens },
        };
      },
    });

    api.registerTool({
      name: "oh_context_add_instruction",
      label: "Add Context Instruction",
      description: "Add a custom instruction file to the project context. Creates or appends to CLAUDE.md or a custom instruction file.",
      parameters: Type.Object({
        content: Type.String({ description: "Instruction content to add" }),
        file: Type.Optional(Type.String({ description: "Target file name (default: CLAUDE.md)", default: "CLAUDE.md" })),
        cwd: Type.Optional(Type.String({ description: "Working directory" })),
        append: Type.Optional(Type.Boolean({ description: "Append to existing file instead of overwriting", default: true })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = params.cwd || process.cwd();
        const filePath = path.join(cwd, params.file || "CLAUDE.md");

        try {
          if (params.append !== false) {
            let existing = "";
            try {
              existing = await fs.readFile(filePath, "utf-8");
            } catch { /* file doesn't exist */ }

            const newContent = existing
              ? `${existing}\n\n${params.content}`
              : params.content;
            await fs.writeFile(filePath, newContent, "utf-8");
          } else {
            await fs.writeFile(filePath, params.content, "utf-8");
          }

          return {
            content: [{ type: "text" as const, text: `Instruction ${params.append !== false ? "appended to" : "written to"} ${filePath}` }],
            details: { success: true, path: filePath },
          };
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `Failed to write instruction: ${err.message}` }],
            details: { success: false },
          };
        }
      },
    });

    api.on("before_prompt_build", async (event: any, ctx: any) => {
      const cwd = process.cwd();
      const claudeMdFiles = await discoverClaudeMdFiles(cwd);
      if (claudeMdFiles.length === 0) return;

      const sections: string[] = [];
      for (const f of claudeMdFiles) {
        try {
          const content = await fs.readFile(f.path, "utf-8");
          if (content.length > 12000) {
            sections.push(`## ${f.name}\n${content.slice(0, 12000)}\n...[truncated]...`);
          } else {
            sections.push(`## ${f.name}\n${content}`);
          }
        } catch { /* skip */ }
      }

      if (sections.length > 0) {
        event.context = (event.context || "") + "\n\n## Project Instructions (Auto-Loaded)\n" + sections.join("\n\n");
      }
    });
  }

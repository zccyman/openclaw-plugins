import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "constant" | "method" | "property" | "namespace" | "module";
  filePath: string;
  line: number;
  endLine?: number;
  exported: boolean;
  language: string;
  signature?: string;
}

interface DependencyNode {
  filePath: string;
  imports: string[];
  importedBy: string[];
  exportNames: string[];
}

interface ComplexityResult {
  filePath: string;
  functions: { name: string; complexity: number; line: number; risk: "low" | "medium" | "high" | "very high" }[];
  averageComplexity: number;
  totalFunctions: number;
}

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".venv", "__pycache__", ".tox", "vendor", ".next", ".nuxt", "coverage", ".cache", ".turbo"]);

const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
};

const FUNCTION_RE = /^(export\s+)?(async\s+)?function\s+(\w+)/;
const CLASS_RE = /^(export\s+)?(default\s+)?(abstract\s+)?class\s+(\w+)/;
const INTERFACE_RE = /^(export\s+)?interface\s+(\w+)/;
const TYPE_RE = /^(export\s+)?type\s+(\w+)/;
const ENUM_RE = /^(export\s+)?enum\s+(\w+)/;
const CONST_RE = /^(export\s+)?const\s+(\w+)/;
const METHOD_RE = /^\s+(async\s+)?(\w+)\s*\(/;
const ARROW_RE = /^(export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\(/;
const PYTHON_DEF_RE = /^(async\s+)?def\s+(\w+)/;
const PYTHON_CLASS_RE = /^class\s+(\w+)/;
const GO_FUNC_RE = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/;
const GO_TYPE_RE = /^type\s+(\w+)\s+/;
const IMPORT_TS_RE = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
const IMPORT_PY_RE = /^(?:from\s+(\S+)\s+)?import\s+(.+)/;
const IMPORT_GO_RE = /^import\s+(?:\(([^)]+)\)|"([^"]+)")/;

async function walkDir(dir: string, maxFiles = 500, ignorePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string) {
    if (files.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (ignorePatterns.some((p) => entry.name.match(p.replace(/\*/g, ".*")))) continue;
        await walk(fullPath);
      } else {
        const ext = path.extname(entry.name);
        if (EXTENSION_MAP[ext]) {
          files.push(fullPath);
        }
      }
    }
  }
  await walk(dir);
  return files;
}

function parseFileSymbols(content: string, filePath: string): CodeSymbol[] {
  const ext = path.extname(filePath);
  const language = EXTENSION_MAP[ext] || "unknown";
  const symbols: CodeSymbol[] = [];
  const lines = content.split("\n");

  if (language === "typescript" || language === "javascript") {
    parseTsSymbols(lines, filePath, language, symbols);
  } else if (language === "python") {
    parsePythonSymbols(lines, filePath, symbols);
  } else if (language === "go") {
    parseGoSymbols(lines, filePath, symbols);
  }

  return symbols;
}

function parseTsSymbols(lines: string[], filePath: string, language: string, symbols: CodeSymbol[]) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    let m;
    if ((m = trimmed.match(FUNCTION_RE))) {
      symbols.push({ name: m[3], kind: "function", filePath, line: i + 1, exported: !!m[1], language, signature: trimmed.slice(0, 120) });
    } else if ((m = trimmed.match(ARROW_RE))) {
      symbols.push({ name: m[2], kind: "function", filePath, line: i + 1, exported: !!m[1], language, signature: trimmed.slice(0, 120) });
    } else if ((m = trimmed.match(CLASS_RE))) {
      const classSym: CodeSymbol = { name: m[4], kind: "class", filePath, line: i + 1, exported: !!m[1], language };
      symbols.push(classSym);
      for (let j = i + 1; j < lines.length && j < i + 200; j++) {
        const inner = lines[j].trim();
        if (inner.startsWith("}") && !inner.includes("} else")) break;
        const methodMatch = inner.match(METHOD_RE);
        if (methodMatch && !inner.startsWith("//") && !inner.startsWith("*") && !["if", "for", "while", "switch", "catch", "constructor"].includes(methodMatch[2])) {
          symbols.push({ name: methodMatch[2], kind: "method", filePath, line: j + 1, exported: classSym.exported, language, signature: inner.slice(0, 120) });
        }
      }
    } else if ((m = trimmed.match(INTERFACE_RE))) {
      symbols.push({ name: m[2], kind: "interface", filePath, line: i + 1, exported: !!m[1], language });
    } else if ((m = trimmed.match(TYPE_RE))) {
      symbols.push({ name: m[2], kind: "type", filePath, line: i + 1, exported: !!m[1], language });
    } else if ((m = trimmed.match(ENUM_RE))) {
      symbols.push({ name: m[2], kind: "enum", filePath, line: i + 1, exported: !!m[1], language });
    } else if ((m = trimmed.match(CONST_RE))) {
      if (!trimmed.includes("=>") && !trimmed.includes("(")) {
        symbols.push({ name: m[2], kind: "constant", filePath, line: i + 1, exported: !!m[1], language });
      }
    }
  }
}

function parsePythonSymbols(lines: string[], filePath: string, symbols: CodeSymbol[]) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(PYTHON_DEF_RE))) {
      const isMethod = i > 0 && lines[i - 1].match(/^\s*class\s+/) === null && lines.slice(Math.max(0, i - 20), i).some((l) => l.match(/^\s*class\s+/));
      symbols.push({ name: m[2], kind: isMethod ? "method" : "function", filePath, line: i + 1, exported: !line.startsWith(" "), language: "python", signature: line.trim().slice(0, 120) });
    } else if ((m = line.match(PYTHON_CLASS_RE))) {
      symbols.push({ name: m[1], kind: "class", filePath, line: i + 1, exported: true, language: "python" });
    }
  }
}

function parseGoSymbols(lines: string[], filePath: string, symbols: CodeSymbol[]) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let m;
    if ((m = line.match(GO_FUNC_RE))) {
      const exported = m[1][0] === m[1][0].toUpperCase() && m[1][0] !== m[1][0].toLowerCase();
      symbols.push({ name: m[1], kind: "function", filePath, line: i + 1, exported, language: "go", signature: line.slice(0, 120) });
    } else if ((m = line.match(GO_TYPE_RE))) {
      const isStruct = line.includes("struct");
      const exported = m[1][0] === m[1][0].toUpperCase() && m[1][0] !== m[1][0].toLowerCase();
      symbols.push({ name: m[1], kind: isStruct ? "class" : "type", filePath, line: i + 1, exported, language: "go" });
    }
  }
}

function parseImports(content: string, filePath: string, language: string): string[] {
  const imports: string[] = [];
  const lines = content.split("\n");

  if (language === "typescript" || language === "javascript") {
    let match;
    while ((match = IMPORT_TS_RE.exec(content)) !== null) {
      imports.push(match[3]);
    }
  } else if (language === "python") {
    for (const line of lines) {
      const m = line.match(IMPORT_PY_RE);
      if (m) {
        imports.push(m[1] || m[2].split(",")[0].trim());
      }
    }
  } else if (language === "go") {
    for (const line of lines) {
      const m = line.match(IMPORT_GO_RE);
      if (m) {
        if (m[1]) {
          imports.push(...m[1].split("\n").map((s) => s.trim().replace(/"/g, "")).filter(Boolean));
        } else if (m[2]) {
          imports.push(m[2]);
        }
      }
    }
  }

  return imports;
}

function parseExports(content: string, language: string): string[] {
  const exports: string[] = [];
  if (language === "typescript" || language === "javascript") {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      let m;
      if ((m = trimmed.match(/^(?:export\s+)?function\s+(\w+)/))) exports.push(m[1]);
      else if ((m = trimmed.match(/^export\s+const\s+(\w+)/))) exports.push(m[1]);
      else if ((m = trimmed.match(/^export\s+(?:default\s+)?class\s+(\w+)/))) exports.push(m[1]);
      else if ((m = trimmed.match(/^export\s+interface\s+(\w+)/))) exports.push(m[1]);
      else if ((m = trimmed.match(/^export\s+type\s+(\w+)/))) exports.push(m[1]);
      else if ((m = trimmed.match(/^export\s+enum\s+(\w+)/))) exports.push(m[1]);
    }
  } else if (language === "python") {
    const lines = content.split("\n");
    for (const line of lines) {
      const m = line.match(/^(?:async\s+)?def\s+(\w+)/);
      if (m && !line.startsWith(" ") && !line.startsWith("\t")) exports.push(m[1]);
    }
  }
  return exports;
}

function calculateCyclomaticComplexity(content: string, language: string): { name: string; complexity: number; line: number }[] {
  const results: { name: string; complexity: number; line: number }[] = [];
  const lines = content.split("\n");

  if (language === "typescript" || language === "javascript") {
    let currentFn = "";
    let currentLine = 0;
    let complexity = 1;
    let braceDepth = 0;
    let fnBraceDepth = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const fnMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/) || line.match(/^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      if (fnMatch && !inFunction) {
        if (currentFn) {
          results.push({ name: currentFn, complexity, line: currentLine });
        }
        currentFn = fnMatch[1];
        currentLine = i + 1;
        complexity = 1;
        inFunction = true;
        fnBraceDepth = braceDepth;
      }

      if (inFunction) {
        complexity += (line.match(/\bif\b/g) || []).length;
        complexity += (line.match(/\belse\s+if\b/g) || []).length;
        complexity += (line.match(/\bcase\b/g) || []).length;
        complexity += (line.match(/\?\?/g) || []).length;
        complexity += (line.match(/\?\./g) || []).length;
        complexity += (line.match(/&&/g) || []).length;
        complexity += (line.match(/\|\|/g) || []).length;
        complexity += (line.match(/\bfor\b/g) || []).length;
        complexity += (line.match(/\bwhile\b/g) || []).length;
        complexity += (line.match(/\bcatch\b/g) || []).length;
      }

      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      if (inFunction && braceDepth <= fnBraceDepth && i > currentLine) {
        results.push({ name: currentFn, complexity, line: currentLine });
        currentFn = "";
        inFunction = false;
      }
    }
    if (currentFn) {
      results.push({ name: currentFn, complexity, line: currentLine });
    }
  } else if (language === "python") {
    let currentFn = "";
    let currentLine = 0;
    let complexity = 1;
    let baseIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const trimmed = line.trim();

      const fnMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
      if (fnMatch && (indent === 0 || i === 0)) {
        if (currentFn) {
          results.push({ name: currentFn, complexity, line: currentLine });
        }
        currentFn = fnMatch[1];
        currentLine = i + 1;
        complexity = 1;
        baseIndent = indent;
      }

      if (currentFn && indent >= baseIndent) {
        complexity += (trimmed.match(/\bif\b/g) || []).length;
        complexity += (trimmed.match(/\belif\b/g) || []).length;
        complexity += (trimmed.match(/\bfor\b/g) || []).length;
        complexity += (trimmed.match(/\bwhile\b/g) || []).length;
        complexity += (trimmed.match(/\bexcept\b/g) || []).length;
        complexity += (trimmed.match(/\band\b/g) || []).length;
        complexity += (trimmed.match(/\bor\b/g) || []).length;
      }

      if (currentFn && indent <= baseIndent && trimmed.length > 0 && !fnMatch) {
        results.push({ name: currentFn, complexity, line: currentLine });
        currentFn = "";
      }
    }
    if (currentFn) {
      results.push({ name: currentFn, complexity, line: currentLine });
    }
  }

  return results;
}

function formatComplexity(c: number): "low" | "medium" | "high" | "very high" {
  if (c <= 5) return "low";
  if (c <= 10) return "medium";
  if (c <= 20) return "high";
  return "very high";
}

function buildOutline(symbols: CodeSymbol[], content: string): string {
  if (symbols.length === 0) return "(no symbols found)";
  const lines = content.split("\n");
  return symbols.map((s) => {
    const lineContent = lines[s.line - 1]?.trim() || "";
    const prefix = s.exported ? "📌 " : "  ";
    const kindIcon: Record<string, string> = { function: "ƒ", class: "C", interface: "I", type: "T", enum: "E", variable: "v", constant: "K", method: "m", property: "p", namespace: "N", module: "M" };
    return `${prefix}${kindIcon[s.kind] || "?"} ${s.name} (L${s.line})${lineContent.length > 80 ? "" : " — " + lineContent}`;
  }).join("\n");
}

export function registerCodeIntel(api: any) {
  api.registerTool({
    name: "oh_code_symbol_search",
    label: "Symbol Search",
    description: "Search for symbols (functions, classes, interfaces, types) across the project. Supports TypeScript, JavaScript, Python, Go.",
    parameters: Type.Object({
      query: Type.String({ description: "Symbol name or pattern to search for" }),
      kind: Type.Optional(Type.String({ description: "Filter by kind: function, class, interface, type, enum, variable, constant", enum: ["function", "class", "interface", "type", "enum", "variable", "constant"] })),
      cwd: Type.Optional(Type.String({ description: "Project root directory (default: process.cwd())" })),
      max_results: Type.Optional(Type.Number({ description: "Maximum results (default: 30)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const maxResults = params.max_results || 30;
      const files = await walkDir(root);
      const allSymbols: CodeSymbol[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const symbols = parseFileSymbols(content, file);
          allSymbols.push(...symbols);
        } catch { continue; }
      }

      const query = params.query.toLowerCase();
      let matches = allSymbols.filter((s) => s.name.toLowerCase().includes(query));
      if (params.kind) {
        matches = matches.filter((s) => s.kind === params.kind);
      }
      matches = matches.slice(0, maxResults);

      if (matches.length === 0) {
        return { content: [{ type: "text" as const, text: `No symbols matching '${params.query}' found. Searched ${files.length} files, ${allSymbols.length} total symbols.` }], details: { success: true } };
      }

      const result = matches.map((s, i) => {
        const rel = path.relative(root, s.filePath);
        return `${i + 1}. ${s.kind} ${s.name}${s.exported ? " [exported]" : ""}\n   ${rel}:${s.line}${s.signature ? "\n   " + s.signature : ""}`;
      }).join("\n\n");

      return {
        content: [{ type: "text" as const, text: `Symbol Search: '${params.query}' (${matches.length} results from ${allSymbols.length} symbols in ${files.length} files)\n\n${result}` }],
        details: { success: true, count: matches.length, totalSymbols: allSymbols.length },
      };
    },
  });

  api.registerTool({
    name: "oh_code_definitions",
    label: "Find Definitions",
    description: "Find the definition location(s) of a symbol. Returns file path, line number, and surrounding context.",
    parameters: Type.Object({
      symbol: Type.String({ description: "Symbol name to find definitions for" }),
      cwd: Type.Optional(Type.String({ description: "Project root directory" })),
      context_lines: Type.Optional(Type.Number({ description: "Lines of context around definition (default: 3)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const contextLines = params.context_lines || 3;
      const files = await walkDir(root);
      const definitions: { symbol: CodeSymbol; context: string }[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const symbols = parseFileSymbols(content, file);
          const lines = content.split("\n");
          for (const sym of symbols) {
            if (sym.name === params.symbol || sym.name === params.symbol.replace(/^#/, "")) {
              const start = Math.max(0, sym.line - 1 - contextLines);
              const end = Math.min(lines.length, sym.line + contextLines);
              const context = lines.slice(start, end).map((l, idx) => {
                const lineNum = start + idx + 1;
                const marker = lineNum === sym.line ? " →" : "  ";
                return `${marker} ${lineNum}: ${l}`;
              }).join("\n");
              definitions.push({ symbol: sym, context });
            }
          }
        } catch { continue; }
      }

      if (definitions.length === 0) {
        return { content: [{ type: "text" as const, text: `No definition found for '${params.symbol}'. Searched ${files.length} files.` }], details: { success: true } };
      }

      const result = definitions.map((d, i) => {
        const rel = path.relative(root, d.symbol.filePath);
        return `${i + 1}. ${d.symbol.kind} ${d.symbol.name} [${d.symbol.exported ? "exported" : "private"}]\n   File: ${rel}:${d.symbol.line}\n${d.context}`;
      }).join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `Definitions of '${params.symbol}' (${definitions.length}):\n\n${result}` }],
        details: { success: true, count: definitions.length },
      };
    },
  });

  api.registerTool({
    name: "oh_code_references",
    label: "Find References",
    description: "Find all references to a symbol across the project. Searches for the symbol name in all source files.",
    parameters: Type.Object({
      symbol: Type.String({ description: "Symbol name to find references for" }),
      cwd: Type.Optional(Type.String({ description: "Project root directory" })),
      max_results: Type.Optional(Type.Number({ description: "Maximum results (default: 50)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const maxResults = params.max_results || 50;
      const files = await walkDir(root);
      const references: { filePath: string; line: number; content: string; type: "definition" | "usage" | "import" }[] = [];

      const symbols = new Map<string, CodeSymbol>();
      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          for (const sym of parseFileSymbols(content, file)) {
            if (sym.name === params.symbol) {
              symbols.set(`${file}:${sym.line}`, sym);
              references.push({ filePath: file, line: sym.line, content: content.split("\n")[sym.line - 1]?.trim() || "", type: "definition" });
            }
          }
        } catch { continue; }
      }

      const symPattern = new RegExp(`\\b${params.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");
          const ext = path.extname(file);
          const lang = EXTENSION_MAP[ext] || "";
          for (let i = 0; i < lines.length; i++) {
            if (symPattern.test(lines[i])) {
              const key = `${file}:${i + 1}`;
              if (!symbols.has(key)) {
                const trimmed = lines[i].trim();
                const isImport = (lang === "typescript" || lang === "javascript") && trimmed.includes("import");
                references.push({ filePath: file, line: i + 1, content: trimmed, type: isImport ? "import" : "usage" });
              }
            }
          }
        } catch { continue; }
      }

      const sorted = references.sort((a, b) => {
        const order = { definition: 0, import: 1, usage: 2 };
        return order[a.type] - order[b.type];
      }).slice(0, maxResults);

      if (sorted.length === 0) {
        return { content: [{ type: "text" as const, text: `No references found for '${params.symbol}'. Searched ${files.length} files.` }], details: { success: true } };
      }

      const result = sorted.map((r, i) => {
        const rel = path.relative(root, r.filePath);
        const typeIcon = r.type === "definition" ? "📍" : r.type === "import" ? "📦" : "→";
        return `${i + 1}. ${typeIcon} ${rel}:${r.line}\n   ${r.content.slice(0, 150)}`;
      }).join("\n");

      const counts = { definition: sorted.filter((r) => r.type === "definition").length, import: sorted.filter((r) => r.type === "import").length, usage: sorted.filter((r) => r.type === "usage").length };

      return {
        content: [{ type: "text" as const, text: `References to '${params.symbol}' (${sorted.length}: ${counts.definition} definitions, ${counts.import} imports, ${counts.usage} usages)\n\n${result}` }],
        details: { success: true, total: sorted.length, counts },
      };
    },
  });

  api.registerTool({
    name: "oh_code_dependencies",
    label: "Dependency Analysis",
    description: "Analyze the import/export dependency graph of the project. Shows what each module imports and what imports each module.",
    parameters: Type.Object({
      file_path: Type.Optional(Type.String({ description: "Specific file to analyze (relative to cwd). If omitted, analyzes the whole project." })),
      direction: Type.Optional(Type.String({ description: "Dependency direction", enum: ["imports", "imported_by", "both"], default: "both" })),
      cwd: Type.Optional(Type.String({ description: "Project root directory" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const direction = params.direction || "both";
      const files = await walkDir(root);
      const depMap = new Map<string, DependencyNode>();

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const ext = path.extname(file);
          const lang = EXTENSION_MAP[ext] || "";
          const rel = path.relative(root, file);
          const imports = parseImports(content, file, lang);
          const exports = parseExports(content, lang);
          depMap.set(rel, { filePath: rel, imports, importedBy: [], exportNames: exports });
        } catch { continue; }
      }

      const resolver = new Map<string, string[]>();
      for (const [rel, node] of depMap) {
        const resolved: string[] = [];
        for (const imp of node.imports) {
          let found = false;
          for (const [otherRel] of depMap) {
            if (otherRel.endsWith(imp) || otherRel.endsWith(imp + ".ts") || otherRel.endsWith(imp + ".tsx") || otherRel.endsWith(imp + ".js")) {
              resolved.push(otherRel);
              found = true;
              break;
            }
          }
          if (!found) resolved.push(imp);
        }
        resolver.set(rel, resolved);
      }

      for (const [rel, resolved] of resolver) {
        for (const target of resolved) {
          const node = depMap.get(target);
          if (node) {
            node.importedBy.push(rel);
          }
        }
      }

      if (params.file_path) {
        const target = params.file_path;
        const node = depMap.get(target);
        if (!node) {
          return { content: [{ type: "text" as const, text: `File '${target}' not found in dependency map.` }], details: { success: true } };
        }

        let output = `## Dependencies: ${target}\n\n`;
        if (direction === "imports" || direction === "both") {
          output += `### Imports (${node.imports.length})\n`;
          output += node.imports.length > 0 ? node.imports.map((i) => `  - ${i}`).join("\n") : "  (none)";
          output += "\n\n";
        }
        if (direction === "imported_by" || direction === "both") {
          output += `### Imported By (${node.importedBy.length})\n`;
          output += node.importedBy.length > 0 ? node.importedBy.map((i) => `  - ${i}`).join("\n") : "  (none)";
          output += "\n\n";
        }
        output += `### Exports (${node.exportNames.length})\n`;
        output += node.exportNames.length > 0 ? node.exportNames.map((e) => `  - ${e}`).join("\n") : "  (none)";

        return { content: [{ type: "text" as const, text: output }], details: { success: true, node } };
      }

      let output = `## Project Dependency Graph\n${files.length} files analyzed\n\n`;
      const topImporters = [...depMap.entries()].sort((a, b) => b[1].imports.length - a[1].imports.length).slice(0, 20);
      output += `### Top Importers\n${topImporters.map(([rel, node]) => `  ${rel} (${node.imports.length} imports)`).join("\n")}\n\n`;

      const topImported = [...depMap.entries()].sort((a, b) => b[1].importedBy.length - a[1].importedBy.length).slice(0, 20);
      output += `### Most Imported\n${topImported.map(([rel, node]) => `  ${rel} (${node.importedBy.length} dependents)`).join("\n")}`;

      return { content: [{ type: "text" as const, text: output }], details: { success: true, fileCount: files.length } };
    },
  });

  api.registerTool({
    name: "oh_code_outline",
    label: "Code Outline",
    description: "Generate a structured outline of a source file showing all symbols, their types, and locations. Supports TypeScript, JavaScript, Python, Go.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path to outline (relative to cwd)" }),
      cwd: Type.Optional(Type.String({ description: "Project root directory" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const fullPath = path.resolve(root, params.file_path);

      let content: string;
      try {
        content = await fs.readFile(fullPath, "utf-8");
      } catch {
        return { content: [{ type: "text" as const, text: `File not found: ${params.file_path}` }], details: { success: true } };
      }

      const ext = path.extname(fullPath);
      const language = EXTENSION_MAP[ext];
      if (!language) {
        return { content: [{ type: "text" as const, text: `Unsupported file type: ${ext}` }], details: { success: true } };
      }

      const symbols = parseFileSymbols(content, fullPath);
      const outline = buildOutline(symbols, content);
      const lines = content.split("\n").length;

      const counts: Record<string, number> = {};
      for (const s of symbols) {
        counts[s.kind] = (counts[s.kind] || 0) + 1;
      }
      const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? "s" : ""}`).join(", ");

      return {
        content: [{ type: "text" as const, text: `## ${params.file_path} (${lines} lines, ${language})\n**Symbols:** ${summary}\n\n${outline}` }],
        details: { success: true, symbolCount: symbols.length, lineCount: lines },
      };
    },
  });

  api.registerTool({
    name: "oh_code_complexity",
    label: "Code Complexity",
    description: "Calculate cyclomatic complexity metrics for source files. Identifies high-complexity functions that may need refactoring.",
    parameters: Type.Object({
      file_path: Type.Optional(Type.String({ description: "Specific file to analyze (relative to cwd). If omitted, analyzes the whole project." })),
      cwd: Type.Optional(Type.String({ description: "Project root directory" })),
      threshold: Type.Optional(Type.Number({ description: "Only show functions with complexity above this threshold (default: 0)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const root = params.cwd || process.cwd();
      const threshold = params.threshold || 0;
      const targetFiles = params.file_path ? [path.resolve(root, params.file_path)] : await walkDir(root);

      const allResults: ComplexityResult[] = [];

      for (const file of targetFiles) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const ext = path.extname(file);
          const lang = EXTENSION_MAP[ext] || "";
          if (!lang) continue;

          const rawResults = calculateCyclomaticComplexity(content, lang);
          const functions = rawResults
            .map((r) => ({ ...r, risk: formatComplexity(r.complexity) }))
            .filter((r) => r.complexity >= threshold);

          if (functions.length > 0) {
            const avg = functions.reduce((sum, f) => sum + f.complexity, 0) / functions.length;
            allResults.push({ filePath: path.relative(root, file), functions, averageComplexity: Math.round(avg * 10) / 10, totalFunctions: functions.length });
          }
        } catch { continue; }
      }

      if (allResults.length === 0) {
        return { content: [{ type: "text" as const, text: params.file_path ? `No functions found in ${params.file_path}` : "No functions found in the project." }], details: { success: true } };
      }

      const totalFns = allResults.reduce((sum, r) => sum + r.totalFunctions, 0);
      const highRisk = allResults.reduce((sum, r) => sum + r.functions.filter((f) => f.risk === "high" || f.risk === "very high").length, 0);
      const avgComplexity = allResults.reduce((sum, r) => sum + r.averageComplexity * r.totalFunctions, 0) / totalFns;

      let output = `## Complexity Report\n${totalFns} functions analyzed | ${highRisk} high risk | Avg complexity: ${avgComplexity.toFixed(1)}\n\n`;

      for (const result of allResults) {
        output += `### ${result.filePath} (avg: ${result.averageComplexity})\n`;
        for (const fn of result.functions.sort((a, b) => b.complexity - a.complexity)) {
          const riskLabel = fn.risk === "very high" ? "🔴" : fn.risk === "high" ? "🟠" : fn.risk === "medium" ? "🟡" : "🟢";
          output += `  ${riskLabel} ${fn.name}() — complexity: ${fn.complexity} (line ${fn.line})\n`;
        }
        output += "\n";
      }

      return { content: [{ type: "text" as const, text: output }], details: { success: true, totalFunctions: totalFns, highRisk, averageComplexity: Math.round(avgComplexity * 10) / 10 } };
    },
  });
}

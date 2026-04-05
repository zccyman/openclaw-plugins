import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";

interface LspServer {
  language: string;
  process: cp.ChildProcess;
  requestSeq: number;
  pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>;
  rootPath: string;
  buffer: string;
}

const LSP_COMMANDS: Record<string, { command: string; args: string[] }> = {
  typescript: { command: "typescript-language-server", args: ["--stdio"] },
  python: { command: "pyright-langserver", args: ["--stdio"] },
  go: { command: "gopls", args: [] },
  rust: { command: "rust-analyzer", args: [] },
  java: { command: "jdtls", args: [] },
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath);
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "typescript", ".jsx": "typescript",
    ".py": "python", ".go": "go", ".rs": "rust", ".java": "java",
  };
  return map[ext] || "";
}

function findRoot(filePath: string, language: string): string {
  const markers: Record<string, string[]> = {
    typescript: ["tsconfig.json", "package.json", "jsconfig.json"],
    python: ["pyproject.toml", "setup.py", "requirements.txt", ".git"],
    go: ["go.mod", ".git"],
    rust: ["Cargo.toml", ".git"],
    java: ["pom.xml", "build.gradle", ".git"],
  };
  let dir = path.dirname(path.resolve(filePath));
  const roots = markers[language] || [".git"];
  while (true) {
    for (const m of roots) {
      try {
        if (fsSync.statSync(path.join(dir, m)).isDirectory() || fsSync.statSync(path.join(dir, m)).isFile()) {
          return dir;
        }
      } catch { /* not found */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(path.resolve(filePath));
}

const servers = new Map<string, LspServer>();

async function startLspServer(filePath: string): Promise<LspServer | null> {
  const language = detectLanguage(filePath);
  if (!language) return null;

  const rootPath = findRoot(filePath, language);
  const serverKey = `${language}:${rootPath}`;
  if (servers.has(serverKey)) return servers.get(serverKey)!;

  const cmd = LSP_COMMANDS[language];
  if (!cmd) return null;

  try {
    const proc = cp.spawn(cmd.command, cmd.args, { cwd: rootPath });
    const server: LspServer = { language, process: proc, requestSeq: 0, pendingRequests: new Map(), rootPath, buffer: "" };

    proc.stdout?.on("data", (chunk: Buffer) => {
      server.buffer += chunk.toString();
      processLspMessages(server);
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      // LSP servers often log to stderr, ignore
    });

    servers.set(serverKey, server);
    await sendLspRequest(server, "initialize", {
      processId: process.pid,
      clientInfo: { name: "openclaw", version: "1.0.0" },
      rootUri: `file://${rootPath}`,
      capabilities: {
        textDocument: {
          definition: { linkSupport: true },
          references: {},
          hover: { contentFormat: ["markdown", "plaintext"] },
          publishDiagnostics: { relatedInformation: true },
          rename: { prepareSupport: true },
          completion: { completionItem: { snippetSupport: true } },
          implementation: { linkSupport: true },
          symbol: { dynamicRegistration: false },
        },
        workspace: { workspaceFolders: true },
      },
    });
    await sendLspRequest(server, "initialized", {});

    return server;
  } catch {
    return null;
  }
}

function processLspMessages(server: LspServer) {
  const contentLengthRegex = /Content-Length:\s*(\d+)/g;
  let match;
  while ((match = contentLengthRegex.exec(server.buffer)) !== null) {
    const contentLength = parseInt(match[1], 10);
    const headerEnd = server.buffer.indexOf("\r\n\r\n", match.index);
    if (headerEnd === -1) continue;
    const bodyStart = headerEnd + 4;
    if (server.buffer.length < bodyStart + contentLength) continue;

    const body = server.buffer.slice(bodyStart, bodyStart + contentLength);
    server.buffer = server.buffer.slice(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body);
      if (msg.id !== undefined && server.pendingRequests.has(msg.id)) {
        const req = server.pendingRequests.get(msg.id)!;
        server.pendingRequests.delete(msg.id);
        if (msg.error) {
          req.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          req.resolve(msg.result);
        }
      }
    } catch { /* ignore parse errors */ }
  }
}

function sendLspRequest(server: LspServer, method: string, params: any): Promise<any> {
  const id = ++server.requestSeq;
  const content = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
  server.process.stdin?.write(header + content);

  return new Promise((resolve, reject) => {
    server.pendingRequests.set(id, { resolve, reject });
    setTimeout(() => {
      if (server.pendingRequests.has(id)) {
        server.pendingRequests.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }
    }, 10000);
  });
}

function sendLspNotification(server: LspServer, method: string, params: any) {
  const content = JSON.stringify({ jsonrpc: "2.0", method, params });
  const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
  server.process.stdin?.write(header + content);
}

function formatLocation(uri: string, range?: any): string {
  const filePath = uri.replace(/^file:\/\//, "");
  const line = range?.start?.line ? range.start.line + 1 : "?";
  const col = range?.start?.character ? range.start.character + 1 : "?";
  return `${filePath}:${line}:${col}`;
}

export function registerLsp(api: any) {
  api.registerTool({
    name: "oh_lsp_definition",
    label: "LSP Go to Definition",
    description: "Find the definition location of a symbol using the Language Server Protocol. More accurate than regex-based search.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path containing the symbol" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
      symbol: Type.Optional(Type.String({ description: "Symbol name (if position not known)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}. No LSP server found for this language, or server failed to start.` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      const line = params.line - 1;
      const col = (params.column || 1) - 1;

      try {
        const result = await sendLspRequest(server, "textDocument/definition", {
          textDocument: { uri },
          position: { line, character: col },
        });

        if (!result) {
          return { content: [{ type: "text" as const, text: `No definition found at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        const locations = Array.isArray(result) ? result : [result];
        const formatted = locations.map((loc: any, i: number) => {
          const locPath = formatLocation(loc.uri || loc.targetUri, loc.range || loc.targetRange);
          return `${i + 1}. ${locPath}`;
        }).join("\n");

        return { content: [{ type: "text" as const, text: `Definition found (${locations.length}):\n\n${formatted}` }], details: { success: true, count: locations.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP definition failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_references",
    label: "LSP Find References",
    description: "Find all references to a symbol using LSP. More accurate than text search.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path containing the symbol" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
      include_declaration: Type.Optional(Type.Boolean({ description: "Include the declaration in results (default: true)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      try {
        const result = await sendLspRequest(server, "textDocument/references", {
          textDocument: { uri },
          position: { line: params.line - 1, character: (params.column || 1) - 1 },
          context: { includeDeclaration: params.include_declaration !== false },
        });

        if (!result || result.length === 0) {
          return { content: [{ type: "text" as const, text: `No references found at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        const formatted = (result as any[]).map((ref: any, i: number) => {
          const loc = formatLocation(ref.uri, ref.range);
          return `${i + 1}. ${loc}`;
        }).join("\n");

        return { content: [{ type: "text" as const, text: `References found (${result.length}):\n\n${formatted}` }], details: { success: true, count: result.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP references failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_hover",
    label: "LSP Hover Info",
    description: "Get hover information (type, documentation) for a symbol at a specific position using LSP.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      try {
        const result = await sendLspRequest(server, "textDocument/hover", {
          textDocument: { uri },
          position: { line: params.line - 1, character: (params.column || 1) - 1 },
        });

        if (!result || !result.contents) {
          return { content: [{ type: "text" as const, text: `No hover info at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        let content = "";
        const contents = result.contents;
        if (typeof contents === "string") {
          content = contents;
        } else if (Array.isArray(contents)) {
          content = contents.map((c: any) => typeof c === "string" ? c : c.value).join("\n\n");
        } else if (contents.value) {
          content = contents.value;
        } else if (contents.kind === "markdown" && contents.value) {
          content = contents.value;
        }

        return { content: [{ type: "text" as const, text: `Hover at ${params.file_path}:${params.line}:${params.column || 1}:\n\n${content}` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP hover failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_diagnostics",
    label: "LSP Diagnostics",
    description: "Get diagnostics (errors, warnings, hints) for a file using LSP. Shows compile/type errors.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path to check" }),
      severity: Type.Optional(Type.String({ description: "Filter by severity", enum: ["error", "warning", "hint", "all"], default: "all" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      sendLspNotification(server, "textDocument/didOpen", {
        textDocument: { uri, languageId: server.language, version: 1, text: await fs.readFile(params.file_path, "utf-8") },
      });

      await new Promise((r) => setTimeout(r, 2000));

      const severityFilter = params.severity === "all" ? undefined : { error: 1, warning: 2, hint: 4 }[params.severity as string] || 0;

      try {
        const result = await sendLspRequest(server, "workspace/executeCommand", {
          command: "typescript.tsserverRequest",
          arguments: [{ command: "geterr", arguments: { files: [uri], delay: 0 } }],
        }).catch(() => null);

        const content = await fs.readFile(params.file_path, "utf-8");
        const lines = content.split("\n");
        const diagnostics: { line: number; column: number; severity: string; message: string; code?: string }[] = [];

        if (result?.body?.diagnostics) {
          for (const diag of result.body.diagnostics) {
            if (severityFilter && diag.severity !== severityFilter) continue;
            diagnostics.push({
              line: diag.start?.line || 0,
              column: diag.start?.offset || 0,
              severity: diag.severity === 1 ? "error" : diag.severity === 2 ? "warning" : "hint",
              message: diag.message || diag.text,
              code: diag.code,
            });
          }
        }

        if (diagnostics.length === 0) {
          return { content: [{ type: "text" as const, text: `No diagnostics for ${params.file_path}` }], details: { success: true } };
        }

        const severityIcon: Record<string, string> = { error: "🔴", warning: "🟡", hint: "ℹ️" };
        const formatted = diagnostics.map((d, i) => {
          const lineContent = lines[d.line - 1] || "";
          return `${i + 1}. ${severityIcon[d.severity] || "?"} ${d.severity.toUpperCase()} at line ${d.line}, col ${d.column}\n   ${d.message}${d.code ? ` (${d.code})` : ""}\n   ${lineContent.trim().slice(0, 100)}`;
        }).join("\n\n");

        return { content: [{ type: "text" as const, text: `Diagnostics for ${params.file_path} (${diagnostics.length}):\n\n${formatted}` }], details: { success: true, count: diagnostics.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP diagnostics failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_rename",
    label: "LSP Rename Symbol",
    description: "Rename a symbol across the project using LSP. Safe refactoring that updates all references.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path containing the symbol" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
      new_name: Type.String({ description: "New name for the symbol" }),
      dry_run: Type.Optional(Type.Boolean({ description: "Show what would be renamed without making changes" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      try {
        const result = await sendLspRequest(server, "textDocument/rename", {
          textDocument: { uri },
          position: { line: params.line - 1, character: (params.column || 1) - 1 },
          newName: params.new_name,
        });

        if (!result || !result.changes) {
          return { content: [{ type: "text" as const, text: `No rename edits needed at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        const changes = result.changes as Record<string, any[]>;
        const totalEdits = Object.values(changes).reduce((sum, edits) => sum + edits.length, 0);

        let output = `Rename to '${params.new_name}' (${totalEdits} edits in ${Object.keys(changes).length} files):\n\n`;
        for (const [fileUri, edits] of Object.entries(changes)) {
          const filePath = fileUri.replace(/^file:\/\//, "");
          output += `## ${filePath} (${edits.length} edits)\n`;
          for (const edit of (edits as any[]).slice(0, 10)) {
            output += `  L${edit.range.start.line + 1}: ${edit.newText}\n`;
          }
          if (edits.length > 10) output += `  ... and ${edits.length - 10} more\n`;
          output += "\n";
        }

        if (!params.dry_run) {
          for (const [fileUri, edits] of Object.entries(changes)) {
            const filePath = fileUri.replace(/^file:\/\//, "");
            const content = await fs.readFile(filePath, "utf-8");
            let newContent = content;
            const sortedEdits = (edits as any[]).sort((a, b) => b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character);
            for (const edit of sortedEdits) {
              const lines = newContent.split("\n");
              const lineIdx = edit.range.start.line;
              const line = lines[lineIdx];
              lines[lineIdx] = line.slice(0, edit.range.start.character) + edit.newText + line.slice(edit.range.end.character);
              newContent = lines.join("\n");
            }
            await fs.writeFile(filePath, newContent, "utf-8");
          }
          output += "\n✅ Rename applied successfully.";
        } else {
          output += "\n(Dry run — no changes made)";
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true, totalEdits, filesChanged: Object.keys(changes).length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP rename failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_symbols",
    label: "LSP Workspace Symbols",
    description: "Search for symbols across the workspace using LSP. Returns classes, functions, variables, etc.",
    parameters: Type.Object({
      query: Type.String({ description: "Symbol name or pattern to search for" }),
      kind: Type.Optional(Type.String({ description: "Filter by symbol kind", enum: ["class", "function", "method", "variable", "constant", "interface", "enum", "all"], default: "all" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const cwd = process.cwd();
      let server: LspServer | null = null;
      for (const lang of ["typescript", "python", "go", "rust"]) {
        const testFile = path.join(cwd, lang === "typescript" ? "src/index.ts" : lang === "python" ? "src/__init__.py" : lang === "go" ? "main.go" : "src/main.rs");
        try {
          if (await fs.stat(testFile)) {
            server = await startLspServer(testFile);
            if (server) break;
          }
        } catch { /* try next */ }
      }

      if (!server) {
        return { content: [{ type: "text" as const, text: "No LSP server available. Tried TypeScript, Python, Go, and Rust." }], details: { success: true } };
      }

      try {
        const result = await sendLspRequest(server, "workspace/symbol", { query: params.query });

        if (!result || result.length === 0) {
          return { content: [{ type: "text" as const, text: `No symbols matching '${params.query}' found via LSP` }], details: { success: true } };
        }

        const kindMap: Record<number, string> = { 1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class", 6: "method", 7: "property", 8: "field", 9: "constructor", 10: "enum", 11: "interface", 12: "function", 13: "variable", 14: "constant", 15: "string", 16: "number", 17: "boolean", 18: "array", 25: "typeParameter" };

        const filtered = (result as any[]).filter((s: any) => {
          if (params.kind === "all") return true;
          const kindName = kindMap[s.kind] || "";
          return kindName === params.kind;
        });

        const formatted = filtered.map((s: any, i: number) => {
          const loc = formatLocation(s.location.uri, s.location.range);
          const kind = kindMap[s.kind] || "unknown";
          return `${i + 1}. [${kind}] ${s.name}\n   ${loc}`;
        }).join("\n\n");

        return { content: [{ type: "text" as const, text: `Workspace symbols matching '${params.query}' (${filtered.length}):\n\n${formatted}` }], details: { success: true, count: filtered.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP workspace symbols failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_implementation",
    label: "LSP Find Implementations",
    description: "Find all implementations of an interface, abstract class, or method using LSP.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path containing the interface/symbol" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      try {
        const result = await sendLspRequest(server, "textDocument/implementation", {
          textDocument: { uri },
          position: { line: params.line - 1, character: (params.column || 1) - 1 },
        });

        if (!result || result.length === 0) {
          return { content: [{ type: "text" as const, text: `No implementations found at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        const formatted = (result as any[]).map((loc: any, i: number) => {
          const locPath = formatLocation(loc.uri, loc.range);
          return `${i + 1}. ${locPath}`;
        }).join("\n");

        return { content: [{ type: "text" as const, text: `Implementations found (${result.length}):\n\n${formatted}` }], details: { success: true, count: result.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP implementations failed: ${err.message}` }], details: { success: false } };
      }
    },
  });

  api.registerTool({
    name: "oh_lsp_completions",
    label: "LSP Code Completions",
    description: "Get code completion suggestions at a specific position using LSP.",
    parameters: Type.Object({
      file_path: Type.String({ description: "File path" }),
      line: Type.Number({ description: "Line number (1-based)" }),
      column: Type.Optional(Type.Number({ description: "Column number (1-based)" })),
      trigger_char: Type.Optional(Type.String({ description: "Trigger character (e.g., '.', '(')" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const server = await startLspServer(params.file_path);
      if (!server) {
        return { content: [{ type: "text" as const, text: `LSP server not available for ${params.file_path}` }], details: { success: true } };
      }

      const uri = `file://${path.resolve(params.file_path)}`;
      try {
        const result = await sendLspRequest(server, "textDocument/completion", {
          textDocument: { uri },
          position: { line: params.line - 1, character: (params.column || 1) - 1 },
          context: { triggerKind: params.trigger_char ? 2 : 1, triggerCharacter: params.trigger_char },
        });

        if (!result) {
          return { content: [{ type: "text" as const, text: `No completions at ${params.file_path}:${params.line}:${params.column || 1}` }], details: { success: true } };
        }

        const items = Array.isArray(result) ? result : (result.items || []);
        const formatted = items.slice(0, 20).map((item: any, i: number) => {
          const kind = item.kind ? ["", "Text", "Method", "Function", "Constructor", "Field", "Variable", "Class", "Interface", "Module", "Property", "Unit", "Value", "Enum", "Keyword", "Snippet", "Color", "File", "Reference", "Folder", "EnumMember", "Constant", "Struct", "Event", "Operator", "TypeParameter"][item.kind] || "" : "";
          const detail = item.detail ? ` — ${item.detail}` : "";
          return `${i + 1}. ${kind ? `[${kind}] ` : ""}${item.label}${detail}`;
        }).join("\n");

        return { content: [{ type: "text" as const, text: `Completions at ${params.file_path}:${params.line}:${params.column || 1} (${items.length} total, showing 20):\n\n${formatted}` }], details: { success: true, count: items.length } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `LSP completions failed: ${err.message}` }], details: { success: false } };
      }
    },
  });
}

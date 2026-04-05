import { Type } from "@sinclair/typebox";

const PROVIDERS = {
  anthropic: {

    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-opus-4-6", "claude-sonnet-4-20250514", "claude-haiku-3.5"],
    baseUrl: "https://api.anthropic.com/v1/messages",
  },
  xai: {

    envKey: "XAI_API_KEY",
    models: ["grok-3", "grok-3-mini"],
    baseUrl: "https://api.x.ai/v1/chat/completions",
  },
  openai_compatible: {

    envKey: "OPENAI_API_KEY",
    models: [],
    baseUrlEnv: "OPENAI_BASE_URL",
    defaultBaseUrl: "http://localhost:11434/v1/chat/completions",
  },
};

const MODEL_ALIASES: Record<string, string> = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-20250514",
  haiku: "claude-haiku-3.5",
  grok: "grok-3",
};

let activeProvider = "anthropic";
let activeModel = "claude-sonnet-4-20250514";

function isProviderConfigured(provider: string): boolean {
  const config = PROVIDERS[provider as keyof typeof PROVIDERS];
  if (!config) return false;
  if (provider === "openai_compatible") {
    return !!(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
  }
  return !!process.env[config.envKey];
}

function validateProviderKey(provider: string): { valid: boolean; missing?: string } {
  const config = PROVIDERS[provider as keyof typeof PROVIDERS];
  if (!config) return { valid: false, missing: "unknown provider" };
  if (provider === "openai_compatible") {
    if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_BASE_URL) {
      return { valid: false, missing: "OPENAI_API_KEY or OPENAI_BASE_URL" };
    }
    return { valid: true };
  }
  if (!process.env[config.envKey]) {
    return { valid: false, missing: config.envKey };
  }
  return { valid: true };
}

export function registerProvider(api: any) {

    api.registerTool({
      name: "oh_provider_list",
      description: "List available LLM providers and their status",
      parameters: Type.Object({}),
      async execute() {
        const providerList = Object.entries(PROVIDERS).map(([key, config]: [string, any]) => ({
          id: key,
          name: key,
          configured: isProviderConfigured(key),
          models: config.models,
        }));

        const text = [
          "Available LLM Providers:",
          "",
          ...providerList.map(
            (p) => `${p.configured ? "[✓]" : "[ ]"} ${p.name} (${p.id})${p.models.length > 0 ? ` - Models: ${p.models.join(", ")}` : ""}`
          ),
          "",
          `Active provider: ${activeProvider}`,
          `Active model: ${activeModel}`,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text }],
          details: {
            success: true,
            providers: providerList,
            activeProvider,
            activeModel,
          },
        };
      },
    });

    api.registerTool({
      name: "oh_provider_set",
      description: "Switch the active LLM provider and model",

      parameters: Type.Object({
        provider: Type.Enum({
          anthropic: "anthropic",
          xai: "xai",
          openai_compatible: "openai_compatible",
        }),
        model: Type.Optional(Type.String()),
        base_url: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId: string, params: { provider: string; model?: string; base_url?: string }) {
        const { provider, model, base_url } = params;
        const validation = validateProviderKey(provider);
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to switch to ${provider}: missing ${validation.missing}`,
              },
            ],
            details: { success: false, error: validation.missing },
          };
        }

        activeProvider = provider;
        if (model) {
          activeModel = model;
        } else {
          const config = PROVIDERS[provider as keyof typeof PROVIDERS];
          if (config.models.length > 0) {
            activeModel = config.models[0];
          }
        }

        if (provider === "openai_compatible" && base_url) {
          process.env.OPENAI_BASE_URL = base_url;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Switched to ${provider} (${activeModel})`,
            },
          ],
          details: { success: true, provider: activeProvider, model: activeModel },
        };
      },
    });

    api.registerTool({
      name: "oh_provider_test",
      description: "Test a provider connection",
      parameters: Type.Object({
        provider: Type.Enum({
          anthropic: "anthropic",
          xai: "xai",
          openai_compatible: "openai_compatible",
        }),
        prompt: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId: string, params: { provider: string; prompt?: string }) {
        const { provider, prompt } = params;
        const testPrompt = prompt || "Hello, respond with OK";
        const startTime = Date.now();

        try {
          const validation = validateProviderKey(provider);
          if (!validation.valid) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Provider ${provider} not configured: missing ${validation.missing}`,
                },
              ],
              details: { success: false, error: validation.missing },
            };
          }

          let response: Response;

          if (provider === "anthropic") {
            response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": process.env.ANTHROPIC_API_KEY || "",
              },
              body: JSON.stringify({
                model: "claude-haiku-3-5-20241022",
                max_tokens: 10,
                messages: [{ role: "user", content: testPrompt }],
              }),
            });
          } else if (provider === "xai") {
            response = await fetch("https://api.x.ai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.XAI_API_KEY || ""}`,
              },
              body: JSON.stringify({
                model: "grok-3-mini",
                messages: [{ role: "user", content: testPrompt }],
                max_tokens: 10,
              }),
            });
          } else {
            const baseUrl =
              process.env.OPENAI_BASE_URL || "http://localhost:11434/v1";
            response = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
              },
              body: JSON.stringify({
                model: "test",
                messages: [{ role: "user", content: testPrompt }],
                max_tokens: 10,
              }),
            });
          }

          const latency = Date.now() - startTime;

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Provider ${provider} test failed (${response.status}): ${errorText}`,
                },
              ],
              details: { success: false, status: response.status, latency },
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `Provider ${provider} test successful (latency: ${latency}ms)`,
              },
            ],
            details: { success: true, latency },
          };
        } catch (error) {
          const latency = Date.now() - startTime;
          return {
            content: [
              {
                type: "text" as const,
                text: `Provider ${provider} test failed: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: { success: false, error: String(error), latency },
          };
        }
      },
    });

    api.registerTool({
      name: "oh_model_alias",
      description: "Manage model aliases",

      parameters: Type.Object({
        action: Type.Enum({
          list: "list",
          resolve: "resolve",
          set: "set",
        }),
        alias: Type.Optional(Type.String()),
        model: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId: string, params: { action: string; alias?: string; model?: string }) {
        const { action, alias, model } = params;

        if (action === "list") {
          const aliasList = Object.entries(MODEL_ALIASES)
            .map(([k, v]) => `${k} -> ${v}`)
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `Model Aliases:\n${aliasList}`,
              },
            ],
            details: { success: true, aliases: MODEL_ALIASES },
          };
        }

        if (action === "resolve") {
          if (!alias) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: alias parameter required for resolve action",
                },
              ],
              details: { success: false, error: "alias required" },
            };
          }
          const resolved = MODEL_ALIASES[alias.toLowerCase()] || alias;
          return {
            content: [
              {
                type: "text" as const,
                text: `${alias} -> ${resolved}${MODEL_ALIASES[alias.toLowerCase()] ? "" : " (not a predefined alias, using as-is)"}`,
              },
            ],
            details: { success: true, alias, resolved },
          };
        }

        if (action === "set") {
          if (!alias || !model) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: alias and model parameters required for set action",
                },
              ],
              details: { success: false, error: "alias and model required" },
            };
          }
          MODEL_ALIASES[alias.toLowerCase()] = model;
          return {
            content: [
              {
                type: "text" as const,
                text: `Set alias: ${alias} -> ${model}`,
              },
            ],
            details: { success: true, alias, model },
          };
        }

        return {
          content: [{ type: "text" as const, text: "Unknown action" }],
          details: { success: false },
        };
      },
    });
}

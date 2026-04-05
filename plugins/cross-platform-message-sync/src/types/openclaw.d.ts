declare module 'openclaw/plugin-sdk/core' {
  export interface OpenClawPluginApi {
    registerTool(tool: AnyAgentTool): void;
    registerChannel?(channel: any): void;
    beforeToolCall?(fn: (ctx: any, next: () => Promise<void>) => Promise<void>): void;
  }
  export interface AnyAgentTool {
    name: string;
    label?: string;
    description?: string;
    parameters: any;
    execute(toolCallId: string, input: any): Promise<{
      content: Array<{type: string, text: string}>;
      isError?: boolean;
      details?: any;
    }>;
  }
  export function defineChannelPluginEntry(config: any): any;
}

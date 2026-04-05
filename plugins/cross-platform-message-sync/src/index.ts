import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks/index.js";

export function register(api: any) {
  registerTools(api);
  registerHooks(api);
}

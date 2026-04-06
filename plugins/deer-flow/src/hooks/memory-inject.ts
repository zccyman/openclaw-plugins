import type { MemoryRuntimeAdapter } from "../memory/runtime-adapter.js";
import { buildMemoryPromptSection } from "../memory/prompt-builder.js";

export function createMemoryInjectHook(
  memoryAdapter: MemoryRuntimeAdapter,
  maxFacts: number = 15,
) {
  return async (event: any) => {
    const query = event?.prompt ?? "";
    const facts = await memoryAdapter.search({ query, limit: maxFacts });
    if (facts.length === 0) return undefined;

    return { appendSystemContext: buildMemoryPromptSection(facts, maxFacts) };
  };
}

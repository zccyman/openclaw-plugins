import { describe, it, expect } from "vitest";
import { MemoryRuntimeAdapter } from "@/memory/runtime-adapter";
import type { MemoryFact } from "@/types";

async function seedFacts(adapter: MemoryRuntimeAdapter): Promise<MemoryFact[]> {
  const f1 = await adapter.store({ content: "User prefers TypeScript", category: "preference", confidence: 0.9, source: "test" });
  const f2 = await adapter.store({ content: "React is the framework of choice", category: "knowledge", confidence: 0.8, source: "test" });
  const f3 = await adapter.store({ content: "Always use strict TypeScript", category: "behavior", confidence: 0.7, source: "test" });
  return [f1, f2, f3];
}

describe("MemoryRuntimeAdapter", () => {
  it("stores a fact and assigns id/createdAt", async () => {
    const adapter = new MemoryRuntimeAdapter();
    const fact = await adapter.store({ content: "test fact", category: "knowledge", confidence: 0.5, source: "test" });

    expect(fact.id).toMatch(/^fact_\d+_/);
    expect(fact.createdAt).toBeTruthy();
    expect(fact.content).toBe("test fact");
    expect(fact.category).toBe("knowledge");
  });

  it("searches by query matching content", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);

    const results = await adapter.search({ query: "typescript" });
    expect(results).toHaveLength(2);
    expect(results.every((f) => f.content.toLowerCase().includes("typescript"))).toBe(true);
  });

  it("searches by category filter", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);

    const results = await adapter.search({ query: "", category: "knowledge" });
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("knowledge");
  });

  it("searches with limit", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);

    const results = await adapter.search({ query: "", limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("returns all facts sorted by confidence when no query", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);

    const results = await adapter.search({ query: "" });
    expect(results).toHaveLength(3);
    expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
  });

  it("deletes a fact", async () => {
    const adapter = new MemoryRuntimeAdapter();
    const fact = await adapter.store({ content: "to delete", category: "context", confidence: 0.5, source: "test" });

    const deleted = await adapter.delete(fact.id);
    expect(deleted).toBe(true);
    expect(await adapter.count()).toBe(0);
  });

  it("delete returns false for unknown id", async () => {
    const adapter = new MemoryRuntimeAdapter();
    expect(await adapter.delete("nonexistent")).toBe(false);
  });

  it("lists all facts", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);
    const all = await adapter.list();
    expect(all).toHaveLength(3);
  });

  it("lists facts by category", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);
    const prefs = await adapter.list("preference");
    expect(prefs).toHaveLength(1);
    expect(prefs[0].category).toBe("preference");
  });

  it("count returns correct count", async () => {
    const adapter = new MemoryRuntimeAdapter();
    expect(await adapter.count()).toBe(0);
    await seedFacts(adapter);
    expect(await adapter.count()).toBe(3);
  });

  it("clear removes all facts", async () => {
    const adapter = new MemoryRuntimeAdapter();
    await seedFacts(adapter);
    await adapter.clear();
    expect(await adapter.count()).toBe(0);
  });
});

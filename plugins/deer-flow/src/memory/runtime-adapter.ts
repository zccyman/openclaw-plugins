import type { MemoryFact, MemoryCategory, MemorySearchParams } from "../types.js";

export class MemoryRuntimeAdapter {
  private facts: MemoryFact[] = [];

  async store(fact: Omit<MemoryFact, "id" | "createdAt">): Promise<MemoryFact> {
    const stored: MemoryFact = {
      ...fact,
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    this.facts.push(stored);
    return stored;
  }

  async search(params: MemorySearchParams): Promise<MemoryFact[]> {
    let results = [...this.facts];

    if (params.category) {
      results = results.filter((f) => f.category === params.category);
    }

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results
        .map((f) => ({
          fact: f,
          score: f.content.toLowerCase().includes(q) ? 1 : 0,
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score || b.fact.confidence - a.fact.confidence)
        .map((r) => r.fact);
    } else {
      results.sort((a, b) => b.confidence - a.confidence);
    }

    const limit = params.limit ?? 15;
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.facts.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    this.facts.splice(idx, 1);
    return true;
  }

  async list(category?: MemoryCategory): Promise<MemoryFact[]> {
    if (!category) return [...this.facts];
    return this.facts.filter((f) => f.category === category);
  }

  async count(): Promise<number> {
    return this.facts.length;
  }

  async clear(): Promise<void> {
    this.facts = [];
  }
}

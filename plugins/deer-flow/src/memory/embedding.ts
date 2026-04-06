import type { MemoryFact } from "../types.js";

function simpleHash(text: string): number[] {
  const vec = new Array(32).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 32] += text.charCodeAt(i);
  }
  const max = Math.max(...vec, 1);
  return vec.map((v) => v / max);
}

export function embedFact(fact: MemoryFact): number[] {
  return simpleHash(`${fact.category}: ${fact.content}`);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

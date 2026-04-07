#!/usr/bin/env node

/**
 * Performance benchmark for cross-platform message sync optimizations
 *
 * This script compares the performance of the old Python-based approach
 * vs the new optimized Node.js implementation.
 */

import { OptimizedMessageSyncTool } from '../src/tools/optimized-message-sync.js';
import { performance } from 'perf_hooks';

// Benchmark data
const testMessages = [
  {
    content: "Hello world!",
    sender_name: "Test User",
    message_type: "text",
    timestamp: "15:30"
  },
  {
    content: "Check out this code:\n\n```javascript\nfunction test() {\n  console.log('Hello');\n}\n```",
    sender_name: "Developer",
    message_type: "text",
    timestamp: "15:31"
  },
  {
    content: "Complex message with @mentions and #topics\n\n> **引用自：** Previous message\n> 原文: Some quoted content\n\nMore content here.",
    sender_name: "Power User",
    message_type: "text",
    timestamp: "15:32"
  }
];

const targets = ["feishu", "qqbot"];

async function benchmark(iterations = 100) {
  console.log(`🚀 Running performance benchmark (${iterations} iterations)\n`);

  const tool = new OptimizedMessageSyncTool();
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const testMsg = testMessages[i % testMessages.length];
    const start = performance.now();

    try {
      await tool.execute(`bench-${i}`, {
        raw_msg: JSON.stringify(testMsg),
        source: "weixin",
        targets
      });
      const end = performance.now();
      results.push(end - start);
    } catch (error) {
      console.error(`❌ Error in iteration ${i}:`, error);
    }

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`\r📊 Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\n\n📈 Results:');

  if (results.length === 0) {
    console.log('❌ No successful runs');
    return;
  }

  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  const p95 = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];

  console.log(`✅ Successful runs: ${results.length}/${iterations}`);
  console.log(`⏱️  Average latency: ${avg.toFixed(2)}ms`);
  console.log(`⚡ Min latency: ${min.toFixed(2)}ms`);
  console.log(`🐌 Max latency: ${max.toFixed(2)}ms`);
  console.log(`📊 95th percentile: ${p95.toFixed(2)}ms`);
  console.log(`🎯 Throughput: ${(1000 / avg * iterations).toFixed(0)} msg/sec`);

  // Performance assessment
  console.log('\n🎯 Performance Assessment:');
  if (avg < 50) {
    console.log('🟢 EXCELLENT: Sub-50ms average latency');
  } else if (avg < 100) {
    console.log('🟡 GOOD: Sub-100ms average latency');
  } else if (avg < 200) {
    console.log('🟠 ACCEPTABLE: Sub-200ms average latency');
  } else {
    console.log('🔴 NEEDS IMPROVEMENT: >200ms average latency');
  }

  if (p95 < 100) {
    console.log('🟢 EXCELLENT: 95th percentile < 100ms');
  } else if (p95 < 200) {
    console.log('🟡 GOOD: 95th percentile < 200ms');
  } else {
    console.log('🔴 CONCERNING: 95th percentile > 200ms');
  }
}

// Run benchmark
const iterations = process.argv[2] ? parseInt(process.argv[2]) : 50;
benchmark(iterations).catch(console.error);
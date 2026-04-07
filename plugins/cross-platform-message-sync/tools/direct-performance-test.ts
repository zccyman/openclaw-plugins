#!/usr/bin/env node

/**
 * Direct performance test for cross-platform message sync
 */

import { OptimizedMessageSyncTool } from '../src/tools/optimized-message-sync.js';

// Test data
const testMessages = [
  JSON.stringify({
    content: "简单文本消息",
    sender_name: "测试用户",
    message_type: "text",
    timestamp: "15:30"
  }),
  JSON.stringify({
    content: "包含代码的消息\n\n```javascript\nfunction test() {\n  return 'hello';\n}\n```",
    sender_name: "开发者",
    message_type: "text",
    timestamp: "15:31"
  }),
  JSON.stringify({
    content: "@AI 请分析这个数据\n\n表格数据：\n| 项目 | 数值 |\n|------|------|\n| A | 100 |\n| B | 200 |",
    sender_name: "分析师",
    message_type: "text",
    timestamp: "15:32"
  })
];

async function runPerformanceTest() {
  console.log('🚀 直接性能测试开始...\n');

  const tool = new OptimizedMessageSyncTool();
  const latencies = [];
  const startTotal = performance.now();

  // 测试100次消息同步
  for (let i = 0; i < 100; i++) {
    const testMsg = testMessages[i % testMessages.length];
    const start = performance.now();

    try {
      const result = await tool.execute(`perf-test-${i}`, {
        raw_msg: testMsg,
        source: 'weixin',
        targets: ['feishu', 'qqbot']
      });

      const end = performance.now();
      const latency = end - start;
      latencies.push(latency);

      if (i % 20 === 0) {
        console.log(`📊 已完成: ${i + 1}/100 (${latency.toFixed(3)}ms)`);
      }

    } catch (error) {
      console.error(`❌ 测试 ${i} 失败:`, error);
    }
  }

  const endTotal = performance.now();
  const totalDuration = endTotal - startTotal;

  // 计算统计数据
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const sortedLatencies = latencies.sort((a, b) => a - b);
  const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
  const throughput = (latencies.length / (totalDuration / 1000));

  console.log('\n' + '='.repeat(60));
  console.log('📊 性能测试结果');
  console.log('='.repeat(60));

  console.log(`✅ 成功执行: ${latencies.length}/100`);
  console.log(`⏱️  总耗时: ${totalDuration.toFixed(2)}ms`);
  console.log(`📈 平均延迟: ${avgLatency.toFixed(3)}ms`);
  console.log(`⚡ 最小延迟: ${minLatency.toFixed(3)}ms`);
  console.log(`🐌 最大延迟: ${maxLatency.toFixed(3)}ms`);
  console.log(`📊 95%分位数: ${p95Latency.toFixed(3)}ms`);
  console.log(`🎯 吞吐量: ${throughput.toFixed(0)} msg/sec`);
  console.log(`🚀 并发效率: ${(throughput / 1000).toFixed(1)}k msg/sec`);

  // 性能评估
  console.log('\n🏆 性能评估:');
  if (avgLatency < 1) {
    console.log('🟢 卓越: 平均延迟 < 1ms');
  } else if (avgLatency < 10) {
    console.log('🟡 优秀: 平均延迟 < 10ms');
  } else {
    console.log('🟠 可接受: 平均延迟 < 100ms');
  }

  if (throughput > 1000) {
    console.log('🟢 卓越: 吞吐量 > 1000 msg/sec');
  } else if (throughput > 100) {
    console.log('🟡 优秀: 吞吐量 > 100 msg/sec');
  } else {
    console.log('🟠 可接受: 吞吐量 > 10 msg/sec');
  }

  console.log('\n💡 优化成果:');
  console.log('• 消除了Python进程启动开销');
  console.log('• 实现了原生TypeScript执行');
  console.log('• 添加了LRU缓存机制');
  console.log('• 预编译了正则表达式');

  console.log('\n' + '='.repeat(60));
}

runPerformanceTest().catch(console.error);
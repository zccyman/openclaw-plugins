# Proposal: dev-workflow v6 升级

> 版本：1.0.0 | 创建：2026-04-15

## 背景

dev-workflow v5 已稳定运行，但经过实际使用发现两个核心问题：
1. **Task 粒度过粗** — 免费小模型（Qwen 3.6/MiniMax M2.5）处理一个 Task（200+行）容易出错
2. **质量门控薄弱** — 问题累积到 Step 6 Review 才发现，修复成本高

## 目标

### 功能1：三级任务粒度体系
- **Feature**（>200行）→ 付费模型（GLM-5.1）
- **Task**（50-200行）→ 免费中模型（Qwen 3.6）
- **Sub-task**（≤50行）→ 免费小模型（MiniMax M2.5/Llama 3.3）
- tasks.md 格式增加 Sub-task 层级
- 每个 Sub-task 只改一个函数/一个小功能

### 功能2：函数级质量门控
- Sub-task 完成后：Lint + 边界检查 + 单测（3道门）
- Task 完成后：集成检查 + 性能检查（2道门）
- 不通过打回重做，不累积到 Review

### 功能3：借鉴 gstack + 实战经验
- Step 7 增加 QA 角色
- Step 6 Review 逐函数标注 ✅/⚠️/❌
- 新增 `references/common-pitfalls.md`（常见陷阱清单）
- Step 5 增加 tmux 规则和网络规则

## 非目标
- 不改变 v5 的整体流程框架（11步）
- 不增加新的工作流模式
- 不改变 Plan Gate 机制

## 成功标准
- [ ] 免费模型（MiniMax M2.5）能独立完成 Sub-task 且质量合格
- [ ] 每个 Sub-task 产出代码 ≤50行
- [ ] 质量门控拦截率 >30%（说明在发现问题）
- [ ] 常见陷阱清单 ≥10 条

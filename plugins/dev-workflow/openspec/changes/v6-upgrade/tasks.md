# Tasks: dev-workflow v6 升级

> 版本：1.0.0 | 创建：2026-04-15

## Task 1: SKILL.md — 三级粒度体系
- **文件**: `SKILL.md`（修改 Step 3 + Step 5 部分）
- **内容**: 
  - Step 3 中增加 Feature/Task/Sub-task 层级说明和格式模板
  - Step 5 中增加模型匹配规则和拆分原则
  - Agent角色表格增加 Sub-task 对应模型
- **验收**: 新格式在 tasks.md 示例中清晰展示三级结构

## Task 2: SKILL.md — 质量门控流程
- **文件**: `SKILL.md`（修改 Step 5 部分）
- **内容**:
  - Sub-task 3道门控（Lint/边界/单测）+ 打回机制
  - Task 2道门控（集成/性能）
  - 门控流程图
- **验收**: 门控流程清晰，每道门控有检查清单

## Task 3: SKILL.md — Step 6 Review 逐函数标注
- **文件**: `SKILL.md` + `references/review-methodology.md`（修改）
- **内容**:
  - Review 逐函数标注格式（✅/⚠️/❌ + P级别 + 置信度）
  - 更新 review-methodology.md 增加逐函数检查模板
- **依赖**: 无
- **验收**: Review 输出格式示例清晰

## Task 4: SKILL.md — Step 7 QA 角色增强
- **文件**: `SKILL.md`（修改 Step 7）
- **内容**:
  - 增加 QA 角色视角和检查清单
  - QA 角色使用的模型建议
- **验收**: QA 检查清单完整（错误路径/极端输入/接口契约/UX）

## Task 5: SKILL.md — Step 5 执行纪律
- **文件**: `SKILL.md`（修改 Step 5）
- **内容**:
  - tmux 规则、网络规则、依赖检查、增量验证
  - 执行纪律4条
- **验收**: 规则明确，可直接执行

## Task 6: references/common-pitfalls.md — 常见陷阱清单
- **文件**: `references/common-pitfalls.md`（新建）
- **内容**: ≥10 条实战经验，结构化格式
- **验收**: 每条有根因+应对+日期，可直接查阅

## Task 7: SKILL.md — 版本号和元数据更新
- **文件**: `SKILL.md`（修改头部）
- **内容**:
  - 版本号更新 v5 → v6
  - description 更新
  - 变更日志
- **依赖**: Task 1-6
- **验收**: 版本信息正确

## 执行顺序

```
Task 6（独立）───┐
Task 1 ──────────┤
Task 2 ──────────┤→ Task 7
Task 3 ──────────┤
Task 4 ──────────┤
Task 5 ──────────┘
```

## 预估

| Task | 预估 |
|------|------|
| 1 | 15min |
| 2 | 15min |
| 3 | 10min |
| 4 | 10min |
| 5 | 10min |
| 6 | 10min |
| 7 | 5min |
| **合计** | **~75min** |

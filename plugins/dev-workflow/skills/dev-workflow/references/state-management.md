# 进度持久化 — state.json 规范

> v6.0.0 | 借鉴：OpenSpec Archive + gstack /autoplan

---

## 概述

每个开发流程自动维护 `state.json`，实现断点续跑。与 `handover.md`（手动交接）共存，state.json 优先。

---

## 文件位置

`.dev-workflow/state.json`（项目根目录下）

---

## Schema

```json
{
  "version": "6.0.0",
  "mode": "ultra|quick|standard|full|debug",
  "current_phase": 1,
  "current_step": 3,
  "started_at": "2026-04-11T16:00:00+08:00",
  "updated_at": "2026-04-11T17:30:00+08:00",
  "steps_completed": [1, 2],
  "plan_gate_passed": false,
  "tasks": {
    "proposal": "openspec/proposal.md",
    "design": "openspec/design.md",
    "task_list": "openspec/tasks.json"
  },
  "task_progress": {
    "task-1": {
      "status": "done",
      "files": ["src/main.ts"],
      "completed_at": "2026-04-11T17:00:00+08:00"
    },
    "task-2": {
      "status": "in_progress",
      "files": ["src/utils.ts"],
      "started_at": "2026-04-11T17:10:00+08:00"
    }
  },
  "decisions": [
    {
      "step": 4,
      "timestamp": "2026-04-11T16:30:00+08:00",
      "decision": "使用TypeScript + React",
      "reason": "用户指定 + 项目需要"
    }
  ],
  "tech_stack": ["typescript", "react", "vitest"],
  "experience_injected": true,
  "blocked": false,
  "block_reason": null
}
```

---

## 生命周期

### 创建（Step 1）

Step 1 项目识别时：
1. 检查 `.dev-workflow/state.json` 是否存在
2. **存在** → 读取 → 提示用户"检测到未完成任务，Step N，要继续吗？"
3. **不存在** → 创建初始 state.json

### 更新（每步完成）

每完成一个 Step：
1. 更新 `current_step` 和 `current_phase`
2. 追加到 `steps_completed`
3. 更新 `updated_at`
4. 如有决策，追加到 `decisions`

### Plan Gate（Step 6）

通过后：
- `plan_gate_passed: true`
- 解锁 Phase 3 写权限

### 任务进度（Step 7）

每个 task 完成：
- 更新 `task_progress[task-id].status` = "done" | "in_progress" | "failed"
- 记录修改的文件列表

### 归档（Step 12）

完成后：
1. 移动到 `.dev-workflow/history/{timestamp}.json`
2. 创建新的空 state.json 供下次使用（或删除）

---

## 恢复逻辑

新会话 Step 1 检测到 state.json：

```
state.json 存在
  ↓
读取 current_step
  ↓
Step ≤ 2 (Phase 1): 重新开始（分析阶段不值得恢复）
Step 3-6 (Phase 2): 从 current_step 继续
Step 7+ (Phase 3-4): 从 current_step + task_progress 恢复
  ↓
展示恢复信息给用户确认
  ↓
用户确认 → 继续
用户拒绝 → 删除 state.json → 从 Step 1 开始
```

---

## 与 handover.md 的关系

| 特性 | state.json | handover.md |
|------|-----------|-------------|
| 触发 | 自动（每步） | 手动（用户说"暂停"） |
| 格式 | JSON（机器可读） | Markdown（人可读） |
| 内容 | 步骤进度+任务状态 | 上下文+决策+恢复策略 |
| 优先级 | **高**（Step 1 先读） | 次要 |
| 共存 | 两者都有时，state.json 为主，handover.md 补充上下文 | |

---

## 错误处理

- state.json 损坏 → 备份损坏文件 → 从 Step 1 开始
- 版本不匹配 → 尝试兼容读取 → 失败则从 Step 1 开始
- 权限问题 → 提示用户检查 `.dev-workflow/` 目录权限

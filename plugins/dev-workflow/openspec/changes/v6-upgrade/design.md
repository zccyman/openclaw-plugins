# Design: dev-workflow v6 升级

> 版本：1.0.0 | 创建：2026-04-15

## 变更清单

### 1. SKILL.md 主文件升级

#### 1.1 三级任务粒度（Step 3 + Step 5）

**tasks.md 新格式**：
```markdown
## Feature: Model Arena 模块（>200行，GLM-5.1）

### Task 1: 后端模型分组（50-200行，Qwen 3.6）
- Sub-task 1.1: 定义 NVIDIA_PROVIDERS 常量（≤50行，MiniMax M2.5）
- Sub-task 1.2: 实现 load_models() 函数（≤50行，MiniMax M2.5）
- Sub-task 1.3: 实现 GET /models 端点（≤50行，MiniMax M2.5）

### Task 2: 前端 ModelGroupSelector（50-200行，Qwen 3.6）
- Sub-task 2.1: 组件骨架 + props 定义（≤50行，MiniMax M2.5）
- Sub-task 2.2: 全选/取消逻辑（≤50行，MiniMax M2.5）
- Sub-task 2.3: 样式和交互细节（≤50行，MiniMax M2.5）
```

**模型匹配规则**：
| 层级 | 代码量 | 模型 | 说明 |
|------|--------|------|------|
| Feature | >200行 | GLM-5.1 / Kimi K2.5 | 架构决策，付费 |
| Task | 50-200行 | Qwen 3.6 / MiniMax M2.7 | 完整功能，免费 |
| Sub-task | ≤50行 | MiniMax M2.5 / Llama 3.3 70B | 单函数/小块，免费最快 |

**拆分原则**：
- 一个 Sub-task 只做一件事
- 一个 Sub-task 只改 1-2 个文件
- 每个 Sub-task 有明确的输入和预期输出
- 可独立测试

#### 1.2 函数级质量门控（Step 5 增强）

**Sub-task 门控（3道）**：
```
Sub-task 完成 → Lint门控 → 边界检查 → 单测门控 → ✅通过
                    ↓ 失败      ↓ 失败     ↓ 失败
                  打回修复    打回修复    打回修复
```

1. **Lint 门控**：运行 eslint/shellcheck/flake8，零 warning
2. **边界检查清单**：
   - [ ] 空值/null 处理
   - [ ] 数组越界/空数组
   - [ ] 类型检查（特别是外部输入）
   - [ ] try/catch 或等价错误处理
   - [ ] 超时处理（网络/IO）
3. **单测门控**：每个新函数 ≥1 个测试用例

**Task 门控（额外2道）**：
4. **集成检查**：新代码与现有代码接口匹配
5. **性能检查**：无 N+1、无内存泄漏、无同步阻塞

#### 1.3 Step 6 Review 增强

**逐函数标注**：
```
## Review: router.py
- load_models(): ✅ 正确分组，边界处理完善
- get_models_endpoint(): ⚠️ 缺少 rate limiting，[P2] (7/10)
- compare_stream(): ❌ SSE 格式错误，[P0] (9/10) — 需修复
```

#### 1.4 Step 7 增加 QA 角色

| 视角 | 重点 |
|------|------|
| QA | 边界测试、异常路径、回归测试、用户体验 |

QA 检查清单：
- [ ] 所有错误路径有测试
- [ ] 极端输入（空、超长、特殊字符）已测试
- [ ] 前后端接口契约一致
- [ ] 用户体验：加载状态、错误提示、空状态

### 2. 新增 references/common-pitfalls.md

常见陷阱清单（从实战经验提炼）：

| # | 陷阱 | 根因 | 应对 | 日期 |
|---|------|------|------|------|
| 1 | 长任务超时被杀 | exec 默认超时 | >30s 必须用 tmux | 2026-04-15 |
| 2 | Privoxy 劫持 localhost | 全局代理 env | 网络请求加 --noproxy localhost | 2026-04-15 |
| 3 | Ollama 模型名缺版本号 | API 需要 tag | 检查 `ollama list` 确认全名 | 2026-04-15 |
| 4 | Docker rootless 代理残留 | config.json + daemon.json | 两处都要清除 | 2026-04-15 |
| 5 | miniMax M2.5 代码质量不够 | 模型能力限制 | 复杂逻辑用更强模型 | 2026-04-12 |
| 6 | DDG search 包更名 | duckduckgo-search → ddgs | import 时用 ddgs | 2026-04-12 |
| 7 | asyncio.wait([]) 抛错 | 空列表不合法 | 先检查 len > 0 | 2026-04-12 |
| 8 | Claude Code 未登录不可用 | 需要认证 | 用户禁用，不走这条路径 | 2026-04-12 |

### 3. Step 5 新增规则

在「规划纪律」部分追加：

**执行纪律**：
1. **>30s 任务必须 tmux** — `tmux new-session -d -s <name> "command"`
2. **网络请求必须 --noproxy localhost** — 避免 Privoxy 劫持
3. **依赖检查** — 使用前验证工具/模型/服务是否可用
4. **增量验证** — 每完成一个 Sub-task 就验证，不等 Task 结束

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `SKILL.md` | 修改 | 三级粒度+门控+QA+规则 |
| `references/common-pitfalls.md` | 新增 | 常见陷阱清单 |
| `references/review-methodology.md` | 修改 | 增加逐函数标注 |
| `openspec/changes/v6-upgrade/` | 新增 | 本规格文件 |

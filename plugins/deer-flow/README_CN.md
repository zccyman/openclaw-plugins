# DeerFlow OpenClaw 插件

[English Documentation](./README.md)

将 DeerFlow 超级 Agent 能力作为原生 OpenClaw 工具：子 Agent 编排、长期记忆、技能系统和沙箱执行。

## 功能特性

- **子 Agent 编排** — 通过 `delegate_task` 将复杂任务委派给专业子 Agent
- **长期记忆** — 跨会话记忆，通过 `search_memory` 和 `remember` 工具
- **技能系统** — 加载和管理 SKILL.md 格式技能，通过 `load_skill` 和 `list_skills`
- **沙箱执行** — 虚拟文件系统的隔离代码执行，通过 `sandbox_exec`
- **上下文工程** — 自动将记忆和技能注入 Agent 提示词

## 安装

```bash
# 克隆 openclaw-plugins 仓库
git clone https://github.com/openclaw/openclaw-plugins.git
cd openclaw-plugins

# 安装依赖
pnpm install

# 构建 deer-flow 插件
cd plugins/deer-flow
pnpm build
```

## 配置

在 OpenClaw 配置中添加：

```json
{
  "plugins": {
    "deer-flow": {
      "skillsPath": "./skills",
      "memoryEnabled": true,
      "maxMemoryFacts": 15,
      "defaultSubagentType": "general-purpose",
      "sandboxMode": "local",
      "sandboxBashEnabled": true
    }
  }
}
```

## 使用

### 委派任务

```
使用 delegate_task 工具生成子 Agent：

delegate_task(
  task="研究最新的 TypeScript 5.8 特性",
  subagent_type="research",
  max_turns=10,
  context="重点关注破坏性变更和迁移指南",
  expected_output="新特性摘要及代码示例"
)
```

### 记忆

```
存储事实：
remember(
  content="用户所有项目都偏好 TypeScript 而非 JavaScript",
  category="preference",
  confidence=0.9
)

搜索记忆：
search_memory(
  query="TypeScript 偏好",
  category="preference",
  limit=5
)
```

### 技能

```
列出可用技能：
list_skills()

加载特定技能：
load_skill(name="frontend-design")
```

### 沙箱

```
在隔离环境中执行命令：
sandbox_exec(
  command="python3 -c 'print(2**10)'",
  working_dir="/mnt/user-data/workspace",
  timeout=30
)
```

## 架构

```
┌─────────────────────────────────────────────────┐
│  OpenClaw Agent                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  DeerFlow 插件                            │ │
│  │  ┌─────────┐ ┌────────┐ ┌──────┐ ┌─────┐│ │
│  │  │delegate │ │memory  │ │skills│ │sbx  ││ │
│  │  │_task    │ │tools   │ │tools │ │tools││ │
│  │  └────┬────┘ └───┬────┘ └──┬───┘ └──┬──┘│ │
│  │       │          │         │        │    │ │
│  │  ┌────┴──────────┴─────────┴────────┴──┐│ │
│  │  │  编排器 + 记忆 + 技能               ││ │
│  │  └─────────────────────────────────────┘│ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 许可证

MIT

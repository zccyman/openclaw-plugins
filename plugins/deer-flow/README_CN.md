# DeerFlow OpenClaw 插件

[English Documentation](./README.md)

将 DeerFlow 超级 Agent 能力作为原生 OpenClaw 工具：子 Agent 编排、长期记忆、技能系统、沙箱执行和自动上下文注入。

## 功能特性

### 工具
| 工具 | 描述 |
|------|------|
| `delegate_task` | 将复杂任务委派给专业子 Agent |
| `remember` | 存储事实到长期记忆 |
| `search_memory` | 跨会话记忆检索 |
| `load_skill` | 运行时加载 SKILL.md 格式技能 |
| `list_skills` | 列出可用技能 |
| `sandbox_exec` | 在虚拟文件系统的隔离环境中执行代码 |

### 钩子（自动上下文注入）
| 钩子 | 触发时机 | 操作 |
|------|---------|------|
| `before_prompt_build` | 每次提示词构建 | 注入相关记忆事实和技能指令 |
| `before_tool_call` | 工具执行 | 防护：阻止危险命令（rm、fork bomb 等）|

### 通道兼容性
- **微信** — 通过 `openclaw-weixin`
- **飞书** — 通过 `feishu`
- **QQ** — 通过 `qqbot`

所有工具和钩子可在这些通道无缝使用。

## 安装

```bash
# 克隆仓库
git clone https://github.com/zccyman/openclaw-plugins.git
cd openclaw-plugins

# 安装依赖
cd plugins/deer-flow
pnpm install
pnpm build
```

### OpenClaw 配置

```bash
# 安装插件
openclaw plugins install /path/to/openclaw-plugins/plugins/deer-flow

# 添加到配置路径（如未自动检测）
# 编辑 ~/.openclaw/openclaw.json:
# "plugins.load.paths": [..., "~/.openclaw/extensions/deer-flow"]

# 重启网关
openclaw gateway restart

# 启用插件
openclaw plugins enable deer-flow
```

## 配置

```json
{
  "plugins": {
    "entries": {
      "deer-flow": {
        "enabled": true,
        "config": {
          "skillsPath": "./skills",
          "maxMemoryFacts": 15,
          "sandboxMode": "local",
          "sandboxBashEnabled": true
        }
      }
    }
  }
}
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|---------|------|
| `skillsPath` | string | `./skills` | 技能目录路径 |
| `maxMemoryFacts` | number | 15 | 每次提示词召回的最大事实数 |
| `sandboxMode` | string | `local` | 执行模式：local/remote/disabled |
| `sandboxBashEnabled` | boolean | true | 允许沙箱中执行 bash 命令 |

## 使用

### 委派任务
```
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
# 存储事实
remember(
  content="用户偏好 TypeScript 而非 JavaScript",
  category="preference",
  confidence=0.9
)

# 搜索记忆
search_memory(
  query="TypeScript 偏好",
  category="preference",
  limit=5
)
```

### 技能
```
# 列出可用技能
list_skills()

# 加载特定技能
load_skill(name="frontend-design")
```

### 沙箱
```
sandbox_exec(
  command="python3 -c 'print(2**10)'",
  working_dir="/mnt/user-data/workspace",
  timeout=30
)
```

## 测试

```bash
# 运行测试
pnpm test

# 运行覆盖率
pnpm test --coverage

# 类型检查
pnpm typecheck
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
│          ↑                           ↑           │
│   before_prompt_build         before_tool_call │
└─────────────────────────────────────────────────┘
```

## 许可证

MIT
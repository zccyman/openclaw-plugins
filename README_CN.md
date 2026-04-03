# OpenClaw 插件集合

OpenClaw 插件集合 — 单一仓库中包含多个插件。

## 插件列表

| 插件 | 描述 | 状态 |
|------|------|------|
| [dev-workflow](plugins/dev-workflow/) | 规格驱动的 AI 开发工作流，多智能体编排 | ✅ 活跃 |
| [wechat](plugins/wechat/) | 微信公众号 & 企业微信频道支持 | ✅ 活跃 |

## 快速开始

```bash
# 安装所有插件的依赖
npm install

# 构建所有插件
npm run build

# 运行所有插件的测试
npm run test

# 类型检查所有插件
npm run typecheck
```

## 插件开发

每个插件位于 `plugins/<name>/` 目录下，包含：
- `package.json` — 插件元数据和依赖
- `openclaw.plugin.json` — OpenClaw 插件清单
- `src/` — 源代码
- `tests/` — 测试文件
- `skills/` — （可选）插件技能文件

### 添加新插件

1. 创建 `plugins/<新插件>/` 目录
2. 从现有插件复制结构
3. 更新 `package.json` 名称和元数据
4. 更新 `openclaw.plugin.json` 中的插件特定配置
5. 在根目录运行 `npm install` 链接工作区

## 许可证

MIT

# OpenClaw Plugins

OpenClaw plugin collection — multiple plugins in a single monorepo.

## Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [dev-workflow](plugins/dev-workflow/) | Spec-driven AI development workflow with multi-agent orchestration | ✅ Active |
| [wechat](plugins/wechat/) | WeChat Official Account & WeCom (企业微信) channel support | ✅ Active |

## Quick Start

```bash
# Install dependencies for all plugins
npm install

# Build all plugins
npm run build

# Run tests for all plugins
npm run test

# Type check all plugins
npm run typecheck
```

## Plugin Development

Each plugin lives in `plugins/<name>/` with its own:
- `package.json` — plugin metadata and dependencies
- `openclaw.plugin.json` — OpenClaw plugin manifest
- `src/` — source code
- `tests/` — test files
- `skills/` — (optional) skill files for the plugin

### Adding a New Plugin

1. Create `plugins/<new-plugin>/` directory
2. Copy the structure from an existing plugin
3. Update `package.json` name and metadata
4. Update `openclaw.plugin.json` with plugin-specific config
5. Run `npm install` at the root to link workspaces

## License

MIT

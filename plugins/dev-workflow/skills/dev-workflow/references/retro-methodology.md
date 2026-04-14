# Retro 方法论（借鉴 gstack retro）

## 触发
- 用户说"回顾"/"retro"/"本周总结"
- 心跳中建议（每周五）

## 数据收集

```bash
# 基本统计
git log --since="7 days ago" --oneline --all
git log --since="7 days ago" --shortstat --all | grep "files changed"

# 热点文件
git log --since="7 days ago" --all --format="" --name-only | sort | uniq -c | sort -rn | head -10

# 按项目（如果在多项目repo）
git log --since="7 days ago" --all --format="" --name-only | cut -d/ -f1-2 | sort | uniq -c | sort -rn
```

## 报告结构

```
📅 周回顾 (YYYY-MM-DD ~ YYYY-MM-DD)
════════════════════════════════════

📊 概览
  提交数: N | 净增行: +X/-Y | 文件变更: N

🏆 本周亮点
  1. [最重要的成果]
  2. [第二重要]
  3. [第三重要]

📈 趋势
  代码量: [增长/稳定/减少]
  测试覆盖: [改善/持平/下降]
  Bug修复: N个

🔥 热点区域
  [变更最频繁的文件/模块] — 可能需要重构

💡 经验教训
  1. [本周踩的坑 → 学到什么]
  2. [...]

⚠️ 关注项
  1. [技术债/风险]
  2. [...]

📋 下周计划
  1. [优先事项]
  2. [...]
════════════════════════════════════
```

## 趋势追踪
每次 retro 数据追加到 `data/retro-history.json`，可看长期趋势。

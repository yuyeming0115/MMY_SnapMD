# SnapMD 闪阅渲染样本

这是 Phase 0 的基础样本，用来验证常见 Markdown 文档在 SnapMD 中的最终阅读效果。

## 核心目标

- 双击或拖拽即可打开 Markdown
- 文档布局稳定、阅读清晰
- 支持明暗主题与导出
- 不执行不可信 HTML

## 引用与链接

> SnapMD 的 MVP 不追求功能堆叠，优先把 Markdown 预览做得快、准、稳。

访问 [Tauri 官方文档](https://v2.tauri.app/) 了解桌面壳能力。

## 任务列表

- [x] 建立渲染样本集
- [x] 搭建 Vue 预览核心
- [ ] 接入 Tauri 文件打开参数
- [ ] 接入文件监听自动刷新

## 脚注

Markdown 预览的关键是渲染契约，而不是先扩展一堆插件。[^contract]

[^contract]: 渲染契约定义语法范围、安全边界、资源解析与导出一致性。

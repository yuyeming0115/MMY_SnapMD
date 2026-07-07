# SnapEdit 闪书 —— 极简 Markdown 编辑器开发计划（修订版 v0.3）

> 修订日期：2026-06-16
> 产品阶段：立项评审 / 架构决策
> 关联产品：SnapMD 闪阅（Markdown 预览器）
> 修订说明：v0.1→v0.2 修正编辑内核选型、补充 Editing Contract、调整 MVP 排期。v0.3 新增公众号格式导出（Phase 1 W5 同周完成）与双向链接知识网络（新增 Phase 1.5 独立阶段，2 周）

---

## 一、执行摘要

SnapEdit（闪书）与 SnapMD（闪阅）构成 MMY Markdown 工具矩阵的"写 + 阅"闭环。本修订版在原始方案基础上做出以下关键调整：

1. **编辑内核从 Tiptap 调整为主推 CodeMirror 6**——源文本是唯一真相，避免 HTML↔Markdown 双向转换的格式失真风险
2. **新增 Editing Contract（编辑契约）**——定义 round-trip 保真、编码处理、格式纯净性等硬性规则
3. **MVP 排期从 4 周调整为 6 周**——原方案对编辑器工程复杂度估计不足
4. **Phase 0 增加量化决策门槛**——编辑内核选型不以主观偏好定案，以实测数据拍板
5. **新增公众号格式导出**（v0.3）——微信专用样式渲染、内联 CSS、代码块 SVG、手机宽度预览、一键复制，作为导出周高杠杆功能
6. **新增双向链接知识网络**（v0.3，Phase 1.5）——`[[wiki-link]]` 自动补全、反向链接面板、悬浮预览卡片、工作区文件索引，从编辑器升级为轻量知识书写工具

---

## 二、项目概述

### 2.1 产品定位

**SnapEdit（闪书）**是一款主打"沉浸式写作、极简高效、无缝预览"的轻量级 Markdown 编辑器。它与 SnapMD 闪阅形成"写+阅"产品闭环。

### 2.2 核心理念

| 理念 | 说明 |
|------|------|
| **专注（Focus）** | 无干扰写作模式，隐藏非必要 UI 元素 |
| **即时（Instant）** | 源文本即时渲染（CodeMirror Decoration），实时预览窗 |
| **轻量（Light）** | 冷启动 ≤ 700ms，内存占用 ≤ 120MB |
| **联动（Link）** | 一键调用 SnapMD 预览最终效果，标记解析版本统一 |

### 2.3 目标用户

- 技术文档撰写者
- 博客/公众号作者
- 知识管理爱好者（笔记、日记）
- 需要轻量编辑器的办公用户

### 2.4 与 SnapMD 的关系

```
┌─────────────────────────────────────────────────────────┐
│                  MMY Markdown 工具矩阵                    │
├───────────────────────┬─────────────────────────────────┤
│     SnapEdit 闪书      │         SnapMD 闪阅              │
│    （Markdown 编辑器）  │        （Markdown 预览器）         │
├───────────────────────┼─────────────────────────────────┤
│ • 源文本编辑            │ • 双击秒开预览                    │
│ • CodeMirror 即时渲染   │ • markdown-it 解析渲染            │
│ • 分屏预览              │ • 主题切换                        │
│ • 大纲导航              │ • 一键分享                        │
│ • 快捷导出              │ • PDF/HTML 导出                   │
├───────────────────────┴─────────────────────────────────┤
│  共享技术资产：markdown-it 解析链 / CSS 主题变量 / 渲染测试样本  │
│  共享运行时可互调：SnapEdit → 一键打开 SnapMD 预览最终效果   │
└─────────────────────────────────────────────────────────┘
```

---

## 三、技术架构

### 3.1 技术选型

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 桌面框架 | Tauri 2 | 与 SnapMD 一致，可复用工程经验和打包流水线 |
| 前端框架 | Vue 3 + TypeScript | 轻量、响应式，与 SnapMD 一致 |
| 编辑内核 | **CodeMirror 6**（主推） | 源文本是唯一真相，Decoration 层做所见即所得渲染 |
| Markdown 解析 | markdown-it + 插件 | 与 SnapMD 保持一致，保证预览和编辑解析结果一致 |
| 样式方案 | Tailwind CSS + CSS Variables | 主题系统，与 SnapMD 可共享变量 |

### 3.2 编辑内核选型对比（修订）

这是本项目最关键的技术决策。原始方案推荐 Tiptap ⭐⭐⭐⭐⭐，修订后调整为 **CodeMirror 6 主推**。

#### 为什么 Tiptap 不适合做 Markdown 编辑器

Tiptap 内部使用 ProseMirror JSON 存储文档，Markdown 只是序列化格式。这导致：

```
用户打开 .md 文件  →  解析为 JSON 文档树  →  渲染 WYSIWYG
                                 ↕ 双向转换（每次可能丢失信息）
用户切换到源码模式 →  JSON → Markdown  ← 可能与原始 Markdown 不同
用户切回 WYSIWYG   →  Markdown → JSON  ← 可能与之前的 JSON 不同
```

**核心矛盾**：WYSIWYG ↔ 源码的双向转换链路，每次都面临格式丢失或结构变化的风险。对 Markdown 编辑器而言，**源文本必须是唯一真相（Single Source of Truth）**。

#### 对比表

| 方案 | 数据模型 | 源文本保真 | WYSIWYG 能力 | 大文件性能 | 推荐度 |
|------|----------|-----------|-------------|-----------|--------|
| **CodeMirror 6** | 纯文本 + Decoration 渲染层 | ⭐⭐⭐⭐⭐ 编辑即原文 | Decoration 叠加渲染（类 WYSIWYG） | ⭐⭐⭐⭐⭐ 虚拟滚动原生 | ⭐⭐⭐⭐⭐ |
| Tiptap | ProseMirror JSON | ⭐⭐ 转 Markdown 可能丢失信息 | ⭐⭐⭐⭐⭐ 原生 WYSIWYG | ⭐⭐⭐ 大文档需优化 | ⭐⭐ |
| Milkdown | ProseMirror + Markdown-first | ⭐⭐⭐ 比 Tiptap 更偏向 Markdown | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| ByteMD | React/Vue 组件 | ⭐⭐⭐⭐ 分屏成熟 | ⭐⭐ 主要做分屏 | ⭐⭐⭐⭐ | ⭐⭐⭐ |

#### CodeMirror 6 的 WYSIWYG 能力

CodeMirror 6 通过 **Decoration** 机制，可以在编辑器内部直接对 Markdown 源文本做视觉增强：

- `# 标题` → 标题行自动放大加粗（源文本仍是 `# 标题`）
- `**粗体**` → 直接显示为粗体样式（源文本仍是 `**粗体**`）
- `- [x] 任务` → 复选框可点击切换（修改源文本 `[x]` ↔ `[ ]`）
- 表格格式化自动对齐列宽
- 图片链接可显示缩略图预览

这套机制在一条数据链路上同时实现了"源文本编辑"和"所见即所得渲染"，避免了双向转换问题。

#### 最终建议

```text
主路线：CodeMirror 6（源文本驱动 + Decoration WYSIWYG + 独立预览窗）

对照路线：Tiptap 做 1 周 Spike，重点测试：
  1. 复杂 Markdown 文件的 parse → JSON → serialize 全链路
  2. WYSIWYG ↔ 源码模式 5 次往返后的内容差异
  3. 大文件（10 万字）编辑性能

决策门槛：
  - Round-trip 正确率 ≥ 95%
  - 模式切换不引入不可见格式字符
  - 满足性能目标
```

### 3.3 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     SnapEdit 架构（修订）                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐ │
│  │                   前端层 (Vue 3)                       │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ 编辑器组件     │ │ 工具栏    │ │ 侧边栏（大纲）     │  │ │
│  │  │(CodeMirror 6)│ │(操作按钮) │ │                  │  │ │
│  │  └──────┬───────┘ └──────────┘ └──────────────────┘  │ │
│  │         │ markdown-it 共享解析（与 SnapMD 一致）        │ │
│  │  ┌──────┴───────┐                                      │ │
│  │  │  预览窗组件    │ ← 左编辑 / 右预览（分屏）             │ │
│  │  │(同 SnapMD    │                                      │ │
│  │  │ 渲染链)      │                                      │ │
│  │  └──────────────┘                                      │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ 状态管理(Pinia)│ │ 主题系统  │ │ 快捷键管理        │  │ │
│  │  └──────────────┘ └──────────┘ └──────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │ IPC                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                 后端层 (Tauri / Rust)                   │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ 文件系统       │ │ 导出服务  │ │ SnapMD 调用       │  │ │
│  │  │(读写/编码检测) │ │(PDF/HTML)│ │ (文件路径传递)     │  │ │
│  │  └──────────────┘ └──────────┘ └──────────────────┘  │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐  │ │
│  │  │ 自动保存(防抖) │ │ 配置管理  │ │ 自动更新          │  │ │
│  │  └──────────────┘ └──────────┘ └──────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、Editing Contract（编辑契约）

这是 SnapEdit 产品的质量底盘，地位等同于 SnapMD 的 Rendering Contract。

### 4.1 硬性规则

| 规则 | 内容 | 验收方式 |
|------|------|----------|
| **Round-trip 保真** | 打开文件 → 不做任何修改 → 保存 → 文件内容逐字节一致 | 自动化测试 + 样本文档集 |
| **不引入不可见字符** | 不自动添加 HTML 标签、零宽字符、BOM 等 | 自动化检查 |
| **不改变空白** | 保持原始缩进（空格/Tab）、行尾符号（LF/CRLF） | 二进制对比 |
| **编码保持** | 打开 GBK 文件，保存后仍为 GBK（不强制转 UTF-8） | 编码检测测试 |
| **编码降级策略** | 编码检测失败时，保留原始字节，提示用户 | 人工测试 |
| **大文件策略** | >500KB 文件弹窗确认；>2MB 文件默认只读模式 | 人工测试 |

### 4.2 编辑行为规范

| 规则 | 说明 |
|------|------|
| Markdown 快捷输入规则 | 遵循 CommonMark + GFM 规范，不注入非标准语法 |
| 表格格式化 | 对齐列宽时使用空格填充，保持 Markdown 源码可读 |
| 链接和图片 | 粘贴图片时自动存到相对路径 `assets/` 目录 |
| 代码块 | 缩进保持原样，不自动修改 |
| 撤销/重做 | 基于 CodeMirror 原生历史，不引入额外状态层 |

### 4.3 样本文档集（edit-fixtures）

在仓库中建立 `edit-fixtures/` 目录：

```
edit-fixtures/
├── roundtrip-basic.md          # 标题、段落、粗体、斜体、列表
├── roundtrip-table.md          # GFM 表格
├── roundtrip-codeblock.md      # 多种语言代码块
├── roundtrip-nested-list.md    # 4 级嵌套列表
├── roundtrip-link-image.md     # 链接和图片引用
├── roundtrip-tasklist.md       # GFM 任务列表
├── encoding-gbk.md             # GBK 编码文件
├── encoding-utf8-bom.md        # UTF-8 BOM 文件
├── encoding-crlf.md            # CRLF 行尾
├── mixed-whitespace.md         # Tab/空格混合
├── large-100k.md               # 大型文档性能测试
└── large-500k.md               # 大文件警告测试
```

所有编辑内核选型、回归测试、发布前检查都基于此样本集。

---

## 五、核心功能模块

### 5.1 功能分级

#### MVP（v1.0 — Phase 1）

| 模块 | 功能 | 优先级 | 说明 | 验收标准 |
|------|------|--------|------|----------|
| **编辑器** | 源文本编辑 | P0 | CodeMirror 6 核心编辑 | 语法高亮正常 |
| | Decoration 渲染 | P0 | 标题/粗体/斜体视觉增强 | 即输即显 |
| | Markdown 快捷输入 | P0 | `# ` → 标题样式, `**` → 粗体 | 所有快捷输入覆盖 |
| | 分屏预览 | P1 | 左编辑右预览，基于 markdown-it | 预览与 SnapMD 一致 |
| **文件** | 打开/新建/保存 | P0 | 标准文件操作 | Round-trip 保真 |
| | 自动保存 | P0 | 2 秒防抖 | 断电不丢内容 |
| | 最近文件 | P1 | 快速访问列表 | 最多 10 个 |
| | 编码检测 | P0 | 自动检测 UTF-8/GBK 等 | 编辑契约验收 |
| **格式** | 工具栏 | P1 | Bold/Italic/Heading/List/Link | 交互可用 |
| | 快捷键 | P0 | Ctrl+B/I/K 等 | 与标准编辑器一致 |
| **主题** | 亮/暗主题 | P0 | CSS Variables 驱动 | 切换无闪烁 |
| **导出** | 导出 HTML | P1 | 与 SnapMD 一致的渲染结果 | 视觉效果一致 |
| | 导出 PDF | P1 | 调用系统打印（v1.0），后续独立实现 | 可输出 PDF 文件 |
| | ★ 公众号导出 | P1 | 微信专用样式、内联 CSS、代码块 SVG、手机预览 | 复制到微信粘贴样式不丢失 |
| **集成** | 调用 SnapMD | P2 | 一键打开当前文件到闪阅预览 | 正确调起 SnapMD |

#### v1.1 阶段（Phase 1.5 — 知识网络）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **★ 双向链接** `[[笔记名]]` | 输入 `[[` 触发自动补全，Ctrl+Click 跳转，自动索引工作区所有 .md 文件 | P0 |
| **★ 反向链接面板** | 侧边栏显示当前文件被哪些页面引用，含上下文片段 | P0 |
| | 悬浮预览卡片 | 鼠标悬浮 `[[链接]]` 显示目标文件前 3 行 | P1 |
| | 不存在的链接自动创建 | 输入 `[[新笔记]]`，自动创建同名 .md 文件 | P1 |
| | 工作区概念 | 打开文件夹而非单文件，统一管理知识网络 | P0 |
| **常规增强** | 大纲导航 | 根据标题生成可点击大纲树 | P1 |
| | 字数统计 | 实时字数/行数/字符数 | P1 |
| | 专注模式 | 全屏沉浸式写作 | P2 |
| | 表格可视化编辑 | CodeMirror + GFM 表格格式化 | P2 |

#### v2.0（后置评估）

| 模块 | 功能 | 说明 |
|------|------|------|
| 高级编辑 | 图片粘贴/拖拽管理 | 自动存储到本地 assets 目录 |
| | Mermaid / KaTeX | 流程图和公式 |
| 文件管理 | 文件夹树 + 多标签 | 项目级编辑体验 |
| | 全文搜索 | 跨文件搜索 |
| 协作 | 本地版本历史 | 自动保存历史快照 |
| | Git 集成 | 基础 commit/diff |
| 扩展 | 插件系统 | 自定义扩展 |

### 5.2 核心交互流程

#### 5.2.1 编辑与保存（修订版）

```
用户在 CodeMirror 编辑器中输入 Markdown 源文本
     │
     ├──► CodeMirror Decoration 层实时渲染视觉样式
     │    （标题加粗、**粗体**变粗、列表缩进对齐等）
     │    ── 数据链路单一：源文本 → Decoration → 视觉
     │
     ├──► markdown-it 实时解析 → 右侧预览窗更新
     │    ── 预览链路与 SnapMD 完全一致
     │
     └──► 防抖触发自动保存（2s 无操作）
          │
          ▼
     读取编辑器源文本 → 以原始编码写入 .md 文件
          │
          ▼
     状态栏显示「已保存」
```

#### 5.2.2 调用 SnapMD 预览

```
用户点击「用闪阅预览」
     │
     ▼
获取当前文件绝对路径
     │
     ▼
先触发保存（确保 SnapMD 读到的是最新内容）
     │
     ▼
通过系统文件关联打开（.md → SnapMD）
或调用 SnapMD 暴露的文件路径参数
     │
     ▼
SnapMD 打开并渲染最终效果
```

### 5.3 公众号格式导出（详细设计）

这是 SnapEdit 的"高杠杆"功能——用 3 天额外开发量换取一个几乎没有竞品做好的刚需场景。

#### 5.3.1 微信对 HTML 的限制

| 限制 | 影响 | 对策 |
|------|------|------|
| 只认内联样式 | `<style>` 和 class 全被过滤 | 用 juice 库将 CSS class → `style=""` 内联化 |
| 禁 JS | 任何 `<script>` 被删除 | 导出为纯静态 HTML |
| 图片需上传 | 离线 HTML 中的 `<img>` 被阻止 | v1.0 base64 内嵌（<32KB），v1.1 对接图床 API |
| 代码块极丑 | 默认 `<pre>` 无高亮且字体小 | 渲染为 Carbon 风格 SVG（白底灰字 + 行号）或用内联样式 `<pre>` |
| 表格适配窄屏 | 手机宽度 375px，表格易撑破 | 自动缩小字号 + 外层套 `overflow-x:auto` 容器 |
| 链接不可点击 | 微信正文中外链被拦截 | 自动在末尾追加脚注展示原始 URL |

#### 5.3.2 公众号导出数据流

```
原始 Markdown 源文本（CodeMirror 编辑器）
         │
         ▼
   markdown-it 解析 → 生成 HTML
         │
         ▼
   juice 内联 CSS（class → style=""）
   · 标题字号/颜色/边距
   · 正文行高/字间距
   · 引用块左边框 + 灰色背景
   · 代码块等宽字体 + 背景色
         │
         ▼
   微信专用后处理管线：
   ┌─────────────────────────────────────────────┐
   │ 1. 图片处理                                  │
   │    ├── 本地图片 <32KB → base64 内嵌          │
   │    ├── 本地图片 >32KB → 占位提示「需手动上传」 │
   │    └── 网络图片 → 保留原始 URL（需图床白名单）  │
   │                                              │
   │ 2. 代码块处理                                │
   │    ├── 短代码块 → <pre> + 内联高亮样式         │
   │    └── 长代码块 → 渲染为 SVG（Carbon 风格）    │
   │                                              │
   │ 3. 表格处理                                  │
   │    ├── 外包 <div style="overflow-x:auto">    │
   │    └── 缩小字号至 13px                        │
   │                                              │
   │ 4. 链接处理                                  │
   │    ├── 正文中保留超链接格式                    │
   │    └── 末尾追加脚注列表 [^1] 显示完整 URL      │
   └─────────────────────────────────────────────┘
         │
         ▼
   预览窗弹出（375px 宽度模拟手机）
   用户可以滚动查看最终效果
         │
    ┌────┴────┐
    ▼         ▼
  复制到剪贴板    导出 .html 文件
  （富文本格式）
```

#### 5.3.3 技术要点

**juice 内联化（核心依赖）**

```typescript
// src/utils/wechat-export.ts
import juice from 'juice'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true, breaks: true })

export function renderForWechat(markdown: string): string {
  // Step 1: Markdown → HTML
  const html = md.render(markdown)

  // Step 2: 包裹微信正文模板
  const withTemplate = `
    <div class="wx-article">
      <h1 class="wx-title">${extractTitle(markdown)}</h1>
      <div class="wx-body">${html}</div>
      <div class="wx-footnotes">${extractFootnotes(html)}</div>
    </div>
  `

  // Step 3: 内联 CSS
  const css = `
    .wx-article { max-width: 100%; padding: 12px; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
    .wx-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; text-align: center; }
    .wx-body { font-size: 15px; line-height: 1.8; color: #333; }
    .wx-body h2 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; color: #1a1a2e; }
    .wx-body h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; color: #1a1a2e; }
    .wx-body p { margin-bottom: 12px; }
    .wx-body blockquote { border-left: 3px solid #d0d0d0; padding-left: 12px; color: #666; margin: 12px 0; }
    .wx-body code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 13px; font-family: "SF Mono", "Fira Code", monospace; }
    .wx-body pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
    .wx-body table { border-collapse: collapse; width: 100%; font-size: 13px; }
    .wx-body th, .wx-body td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .wx-body img { max-width: 100%; height: auto; }
    .wx-footnotes { font-size: 12px; color: #999; border-top: 1px solid #eee; margin-top: 24px; padding-top: 12px; }
  `

  return juice.inlineContent(withTemplate, css)
}
```

**预览窗组件**

```vue
<!-- src/components/Editor/WechatPreviewModal.vue -->
<template>
  <div class="preview-overlay" @click.self="close">
    <div class="preview-container">
      <div class="preview-toolbar">
        <span>公众号预览（375px 手机宽度）</span>
        <button @click="copyToClipboard">📋 复制到剪贴板</button>
        <button @click="exportHtml">📥 导出 .html</button>
        <button @click="close">✕</button>
      </div>
      <div class="preview-phone-frame">
        <iframe :srcdoc="wechatHtml" class="preview-iframe" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-phone-frame {
  width: 375px;
  height: 100%;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,.12);
}
.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
```

#### 5.3.4 排期

公众号导出放在 Phase 1 第 5 周（导出周），与普通 HTML/PDF 导出共用 markdown-it 渲染基础设施，额外增加：

| 子任务 | 工时 |
|--------|------|
| juice 内联化实现 | 0.5 天 |
| 微信专用 CSS 模板 | 1 天 |
| 代码块 SVG 渲染（Carbon 风格） | 1 天 |
| 手机宽度预览窗组件 | 0.5 天 |
| 复制到剪贴板（富文本） | 0.5 天 |
| **合计** | **3.5 天** |

---

### 5.4 双向链接与知识网络（详细设计）

在 v1.0 纯单文件编辑器的基础上，引入**工作区（Workspace）概念**和 `[[wiki-link]]` 双向链接，将 SnapEdit 从"编辑器"升级为"轻量知识书写工具"。

#### 5.4.1 数据模型

```
工作区 = 用户打开的一个文件夹，包含 N 个 .md 文件

启动时构建文件索引（Rust 侧，异步不阻塞 UI）：
  {
    "file-a.md": {
      "title": "file-a 的第一个 # 标题",
      "outgoing": ["file-b.md", "file-c.md"],   // 本文件引用了谁
      "backlinks": []                            // 谁引用了本文件（反向索引）
    },
    "file-b.md": {
      "title": "相关笔记 B",
      "outgoing": [],
      "backlinks": [
        { "file": "file-a.md", "context": "这里提到了 [[file-b]] 的详细..." }
      ]
    }
  }

增量更新：
  - 保存文件时，只重新扫描当前文件的 outgoing links
  - 更新受影响文件的 backlinks
  - 不需要每次保存都全量重扫
```

#### 5.4.2 UI 交互设计

```
┌──────────────────────────────────────────────────────────┐
│  ≡  SnapEdit 闪书  [工作区: my-notes/]    ──  □  ✕  │
├──────────────────────────────────────────────────────────┤
│  工具栏                                                   │
├──────────────┬───────────────────────────────┬───────────┤
│              │                               │  大纲      │
│  编辑器区域    │  # SnapEdit 设计笔记           │  ├ 概述    │
│              │                               │  ├ 架构    │
│  在 Snapedit  │  这里记录了 [[CodeMirror6]]     │  └ 导出    │
│  [[ ←输入自动│  的选型分析，详见                │           │
│   补全：      │  [[编辑器内核对比]]。            │  ═══════  │
│   CodeMirror6│                               │  ◀ 反向链接 │
│   编辑器内核   │  参考了 [[Obsidian]] 的         │  被引用:   │
│   Obsidian   │  Decoration 机制。              │  · 技术选型 │
│              │                               │    分析     │
│              │                              │    "详见    │
│              │                              │    [[SnapEdit│
│              │                              │    设计]]"   │
│              │                              │  · 周报     │
│              │                              │    "...引用了│
│              │                              │    闪书的    │
│              │                              │    方案"     │
├──────────────┴───────────────────────────────┴───────────┤
│  字数: 1,234 │ 编码: UTF-8 │ 链接: 3 个 │ 已保存 │ 🌙 │ ⚙ │
└──────────────────────────────────────────────────────────┘
```

#### 5.4.3 技术实现

**链接解析 + Decoration 高亮**

```typescript
// src/composables/useWikiLinks.ts
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// 识别 [[xxx]] 语法
const wikiLinkRegex = /\[\[([^\[\]]+)\]\]/g

function wikiLinkDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to)
    let match
    while ((match = wikiLinkRegex.exec(text)) !== null) {
      const absFrom = from + match.index
      const absTo = absFrom + match[0].length
      const targetFile = match[1] + '.md'
      const exists = linkIndex.exists(targetFile)

      // 存在的链接：蓝色下划线；不存在的：橙色虚线
      builder.add(absFrom, absTo, Decoration.mark({
        class: exists ? 'cm-wikilink-exists' : 'cm-wikilink-missing',
        attributes: { 'data-target': targetFile }
      }))
    }
  }
  return builder.finish()
}
```

**自动补全（CodeMirror Completion Extension）**

```typescript
// src/composables/useWikiLinkCompletion.ts
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'

export function wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
  const pos = context.pos
  const line = context.state.doc.lineAt(pos)
  const beforeCursor = line.text.slice(0, pos - line.from)

  // 检测是否在 [[ 之后
  const bracketMatch = beforeCursor.match(/\[\[([^\]]*)$/)
  if (!bracketMatch) return null

  const query = bracketMatch[1].toLowerCase()

  // 从工作区索引中筛选匹配文件
  const options = linkIndex.search(query).map(file => ({
    label: file.name.replace('.md', ''),
    type: 'wiki',
    detail: file.title || file.name,
    // 补全后自动闭合 ]]
    apply: file.name.replace('.md', '') + ']]',
  }))

  return {
    from: pos - query.length,
    options,
    validFor: /^\[\[[^\]]*$/,
  }
}
```

**文件索引器（Rust 侧）**

```rust
// src-tauri/src/commands/linker.rs
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use regex::Regex;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub title: String,
    pub outgoing: Vec<String>,
    pub backlinks: Vec<BacklinkItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BacklinkItem {
    pub file: String,
    pub context: String,  // 引用处的上下文文本
}

#[tauri::command]
pub async fn build_workspace_index(workspace_dir: String) -> HashMap<String, FileNode> {
    let mut index: HashMap<String, FileNode> = HashMap::new();
    let link_re = Regex::new(r"\[\[([^\[\]]+)\]\]").unwrap();
    let title_re = Regex::new(r"^#\s+(.+)$").unwrap();

    // Step 1: 扫描所有 .md 文件，构建 outgoing links
    let entries = fs::read_dir(&workspace_dir).unwrap();
    for entry in entries {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "md") {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let name = path.file_name().unwrap().to_str().unwrap().to_string();

            // 提取标题
            let title = title_re.captures(&content)
                .map(|c| c[1].to_string())
                .unwrap_or_else(|| name.clone());

            // 提取全部 [[链接]]
            let outgoing: Vec<String> = link_re.captures_iter(&content)
                .map(|c| c[1].to_string() + ".md")
                .collect();

            index.insert(name.clone(), FileNode {
                name,
                title,
                outgoing,
                backlinks: vec![],
            });
        }
    }

    // Step 2: 构建反向链接
    let mut backlinks_map: HashMap<String, Vec<BacklinkItem>> = HashMap::new();
    for (source_name, node) in &index {
        for target in &node.outgoing {
            // 提取引用上下文（目标链接前后各 30 个字符）
            let context = extract_context(&source_name, &target, &link_re);
            backlinks_map.entry(target.clone()).or_default().push(BacklinkItem {
                file: source_name.clone(),
                context,
            });
        }
    }

    // Step 3: 回填反向链接
    for (target, backlinks) in backlinks_map {
        if let Some(node) = index.get_mut(&target) {
            node.backlinks = backlinks;
        }
    }

    index
}

fn extract_context(source: &str, target: &str, re: &Regex) -> String {
    let content = fs::read_to_string(
        Path::new(source)
    ).unwrap_or_default();

    for cap in re.captures_iter(&content) {
        let link_text = cap[1].to_string() + ".md";
        if link_text == *target {
            let start = cap.get(0).unwrap().start();
            let context_start = start.saturating_sub(30);
            let context_end = (cap.get(0).unwrap().end() + 30).min(content.len());
            return content[context_start..context_end].replace('\n', " ").trim().to_string();
        }
    }
    String::new()
}
```

#### 5.4.4 排期

双向链接与知识网络作为独立的 **Phase 1.5**（2 周），不挤占 MVP 的 6 周：

| 子任务 | 工时 |
|--------|------|
| 工作区概念（打开文件夹 vs 单文件）+ UI 适配 | 1 天 |
| `[[wiki-link]]` 解析 + CodeMirror Decoration 高亮 | 1 天 |
| 自动补全 Extension | 1 天 |
| 文件索引器（Rust 侧，全量 + 增量更新） | 1.5 天 |
| 反向链接面板 Vue 组件 | 1 天 |
| Ctrl+Click 跳转 + 新建不存在的笔记 | 0.5 天 |
| 悬浮预览卡片 | 0.5 天 |
| 测试（Round-trip + 链接完整性） | 1 天 |
| **合计** | **7.5 天（≈ 1.5 周）** |

## 六、UI/UX 设计

### 6.1 主界面布局（源文本编辑模式，含 Decoration 渲染）

```
┌─────────────────────────────────────────────────────────┐
│  ≡  SnapEdit 闪书           ─────  □  ✕  │  标题栏       │
├─────────────────────────────────────────────────────────┤
│  📁 ⏮ ⏭ │ B I U S ` H▾  🔗 📷 │ ¶ ≡ ⋮  │ 闪阅 │  工具栏 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  # 标题（自动放大加粗，源文本仍是 "# 标题"）               │
│                                                         │
│  正文内容以正常大小显示。**粗体直接渲染为粗体**，           │
│  *斜体直接渲染为斜体*。`代码`有灰色背景。                   │
│                                                         │
│  - 列表项 1（项目符号自动美化）                            │
│  - 列表项 2（嵌套列表自动缩进对齐）                        │
│  - [x] 已完成任务（复选框可点击）                          │
│  - [ ] 未完成任务                                         │
│                                                         │
│  ── Decoration 层在源文本之上叠加视觉样式 ──                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  字数: 1,234 │ 行: 56 │ 编码: UTF-8 │ 已保存 │ 🌙 │ ⚙ │  状态栏
└─────────────────────────────────────────────────────────┘
```

### 6.2 分屏预览模式

```
┌─────────────────────────────────────────────────────────┐
│  ≡  SnapEdit 闪书           ─────  □  ✕  │
├─────────────────────────────────────────────────────────┤
│  工具栏                                                  │
├────────────────────────┬────────────────────────────────┤
│                        │                                │
│  Markdown 源码          │  实时预览（与 SnapMD 一致）      │
│  (CodeMirror 编辑)      │  (markdown-it 渲染)             │
│                        │                                │
│  # 标题                │  标题                            │
│  正文 **粗体**          │  正文 粗体                       │
│                        │                                │
├────────────────────────┴────────────────────────────────┤
│  状态栏                                                  │
└─────────────────────────────────────────────────────────┘
```

### 6.3 设计风格

- **设计语言**：Modern Flat，与 SnapMD 保持一致的视觉体系
- **主色调**：与 SnapMD 共享 CSS 变量（亮/暗主题）
- **圆角**：8px 统一圆角
- **动画**：克制使用，不追求花哨转场

---

## 七、开发里程碑（修订版）

### 总排期

| 阶段 | 周期 | 目标 |
|------|------|------|
| Phase 0 | 1.5 周 | 编辑内核 Spike，产出拍板数据 |
| Phase 1 | 6 周 | MVP 开发，可日常使用的编辑器（含公众号导出） |
| Phase 1.5 | 2 周 | ★ 知识网络：双向链接 + 反向链接面板 |
| Phase 2 | 2 周 | Alpha 测试 + Bug 修复 |
| Phase 3 | 2 周 | Beta 发布 + 反馈迭代 |
| Phase 4 | - | v1.0 正式发布 |

---

### Phase 0：编辑内核技术 Spike（1.5 周）

**目标**：验证 CodeMirror 6 + Tiptap 双栈，产出可拍板的量化对比数据。

#### 任务清单

| 任务 | 产出 | 预计工时 |
|------|------|----------|
| CodeMirror 6 最小可运行 Demo | .md 文件打开、编辑、保存 | 1.5 天 |
| CM6 Decoration 渲染验证 | 标题/粗体/列表视觉增强 | 1 天 |
| CM6 分屏预览集成 | markdown-it 实时预览窗 | 1 天 |
| Tiptap（对照）最小 Demo | .md parse → WYSIWYG → serialize | 1 天 |
| Round-trip 测试（10 个样本） | 两套方案的正确率数据 | 1 天 |
| 性能基准测试 | 冷启动/内存/大文件 | 0.5 天 |
| 决策记录文档 | 对比表 + 最终结论 | 0.5 天 |

#### 决策维度与门槛

| 维度 | 指标 | 门槛 | 权重 |
|------|------|------|------|
| Round-trip 正确率 | 10 样本 × 3 操作路径 | ≥ 95% | 最高 |
| 内容纯净性 | 不引入 HTML/不可见字符 | 0 新增 | 最高 |
| 冷启动 | 1MB 文档打开 | ≤ 700ms | 高 |
| 大文件滚动 | 10 万字文档 | 60fps 滚动 | 高 |
| 内存空闲/峰值 | 空载 / 大型文档 | ≤ 80MB / ≤ 200MB | 中 |
| 编码支持 | UTF-8 / GBK / CRLF | 全部通过 | 中 |

**决策门槛**：Round-trip 正确率 ≥ 95% **且** 内容纯净性达标 → 拍板通过。

---

### Phase 1：MVP 开发（6 周）

#### 第 1 周：工程基础（搭建 + 编辑器核心）

- [ ] Tauri 2 项目脚手架（含自动更新框架）
- [ ] CodeMirror 6 编辑器集成
- [ ] Decoration 渲染层（标题/粗体/斜体/代码块视觉增强）
- [ ] 基础亮/暗主题系统

#### 第 2 周：编辑器核心功能

- [ ] Markdown 快捷输入系统（`#`, `**`, `- `, `` ` ``, `> ` 等）
- [ ] CodeMirror 扩展配置（行号/折叠/括号匹配/搜索）
- [ ] 分屏预览窗（左侧源文本 + 右侧 markdown-it 渲染）
- [ ] 预览窗与编辑器滚动同步

#### 第 3 周：文件操作

- [ ] 文件打开/新建/保存（含编码检测）
- [ ] 系统文件关联注册（Windows/macOS）
- [ ] 自动保存机制（2 秒防抖 + 退出前确认）
- [ ] 最近文件列表

#### 第 4 周：工具栏与快捷键

- [ ] 工具栏组件
- [ ] 快捷键系统（与标准编辑器一致）
- [ ] 撤销/重做
- [ ] 查找/替换

#### 第 5 周：导出与联动

- [ ] HTML 导出（与 SnapMD 一致渲染结果）
- [ ] PDF 导出
- [ ] ★ 公众号格式导出（微信内联样式 + 代码块 SVG + 手机预览窗 + 一键复制）
- [ ] 调用 SnapMD 预览（保存 → 打开）
- [ ] 拖拽打开文件支持

#### 第 6 周：测试与打磨

- [ ] Round-trip 自动化测试（edit-fixtures 全样本）
- [ ] 编码兼容性测试
- [ ] Windows/macOS 跨平台测试
- [ ] Bug 修复 + 性能优化
- [ ] 用户文档编写

---

### Phase 1.5：知识网络（2 周）★ 新增

**目标**：在 MVP 编辑器基础上引入工作区概念和双向链接，将 SnapEdit 升级为轻量知识书写工具。

#### 第 1 周：工作区 + 链接系统

- [ ] 工作区概念：打开文件夹而非单文件，统一管理知识网络
- [ ] Rust 侧文件索引器（全量扫描 + 增量更新）
- [ ] `[[wiki-link]]` 解析 + CodeMirror Decoration 高亮
- [ ] 自动补全 Extension（输入 `[[` 触发，模糊搜索工作区文件名）

#### 第 2 周：反向链接 + 交互完善

- [ ] 反向链接面板（侧边栏组件，上下文片段展示）
- [ ] Ctrl+Click 跳转目标文件
- [ ] 悬浮预览卡片（鼠标悬浮显示目标文件标题 + 前 3 行）
- [ ] 新建不存在的笔记（输入 `[[新笔记]]` 自动创建）
- [ ] 测试：链接完整性 + Round-trip 回归

---

### Phase 2：Alpha 测试（2 周）

- [ ] 内部团队测试（3 人 × 日常使用）
- [ ] 收集 Bug 和体验问题
- [ ] 迭代修复
- [ ] 代码签名配置（Windows EV / macOS Developer ID）
- [ ] 自动更新通道配置

### Phase 3：Beta 发布（2 周）

- [ ] 公开 Beta 测试
- [ ] 收集反馈
- [ ] 迭代优化
- [ ] 官网/文档上线

### Phase 4：v1.0 正式发布

- [ ] v1.0 正式版打包
- [ ] 各平台应用商店提交（Snap Store / Microsoft Store 等）
- [ ] 发布公告

---

## 八、技术细节（修订）

### 8.1 项目结构

```
snapedit/
├── src/                         # Vue 3 前端源码
│   ├── main.ts                  # 前端入口
│   ├── App.vue                  # 根组件
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── CodeMirrorEditor.vue   # CodeMirror 6 编辑器封装
│   │   │   ├── PreviewPane.vue        # 分屏预览窗
│   │   │   ├── EditorToolbar.vue      # 工具栏
│   │   │   ├── StatusBar.vue          # 状态栏
│   │   │   └── WechatPreviewModal.vue # 公众号导出预览窗
│   │   ├── Sidebar/
│   │   │   ├── OutlinePanel.vue       # 大纲导航
│   │   │   └── BacklinksPanel.vue     # 反向链接面板（Phase 1.5）
│   │   └── dialogs/
│   │       ├── FileOpenDialog.vue
│   │       └── ExportDialog.vue
│   ├── composables/
│   │   ├── useCodeMirror.ts           # CM6 初始化与配置
│   │   ├── useEditorState.ts          # 编辑状态（脏标记等）
│   │   ├── useFileIO.ts               # 文件读写逻辑
│   │   ├── useAutoSave.ts             # 自动保存（防抖）
│   │   ├── useEncoding.ts             # 编码检测
│   │   ├── useHotkey.ts               # 快捷键管理
│   │   ├── useWikiLinks.ts            # 双向链接解析与 Decoration（Phase 1.5）
│   │   └── useWikiLinkCompletion.ts   # [[ 自动补全 Extension（Phase 1.5）
│   ├── stores/
│   │   ├── editor.ts                  # Pinia 编辑器状态
│   │   ├── preferences.ts             # 用户偏好
│   │   └── workspace.ts               # 工作区索引状态（Phase 1.5）
│   ├── styles/
│   │   ├── themes/
│   │   │   ├── light.css
│   │   │   └── dark.css
│   │   ├── editor.css                 # CodeMirror 自定义样式
│   │   └── wechat-export.css          # 公众号导出专用样式
│   └── utils/
│       ├── markdown.ts                # markdown-it 配置（与 SnapMD 共享）
│       ├── encoding.ts                # 编码检测工具
│       └── wechat-export.ts           # 公众号导出核心逻辑
├── src-tauri/                         # Tauri 2 Rust 后端
│   ├── src/
│   │   ├── main.rs                    # Rust 入口
│   │   ├── lib.rs                     # 库入口
│   │   ├── commands/
│   │   │   ├── file.rs                # 文件系统操作
│   │   │   ├── export.rs              # 导出服务
│   │   │   ├── encoding.rs            # 编码检测（Rust 侧）
│   │   │   ├── external.rs            # 调用外部程序
│   │   │   └── linker.rs              # 工作区文件索引器（Phase 1.5）
│   │   └── utils/
│   │       └── autosave.rs            # 自动保存服务
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── icons/                         # 应用图标
├── edit-fixtures/                     # 编辑测试样本集
│   ├── roundtrip-basic.md
│   ├── roundtrip-table.md
│   ├── ...
│   └── large-500k.md
├── tests/                             # E2E 测试
│   ├── roundtrip.spec.ts
│   └── encoding.spec.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> 注意：Tauri 2 的标准结构是前端在 `/src`，Rust 后端在 `/src-tauri`。原始方案中 `src/main.rs` 和 `frontend/` 共存的情况不正确，已修正。

### 8.2 关键代码示例

#### CodeMirror 6 编辑器初始化

```typescript
// src/composables/useCodeMirror.ts
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// Decoration: 将 Markdown 语法标记渲染为视觉样式
// 源文本保持 "# 标题"，但视觉上显示为加粗大号字体
function markdownDecorations(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to)
    const lines = text.split('\n')

    let pos = from
    for (const line of lines) {
      // 标题行：隐藏 # 标记，放大字体
      const headingMatch = line.match(/^(#{1,6})\s/)
      if (headingMatch) {
        builder.add(pos, pos + headingMatch[1].length + 1,
          Decoration.replace({}))
        builder.add(pos, pos + line.length,
          Decoration.mark({ class: `cm-heading-${headingMatch[1].length}` }))
      }

      // 粗体：**text** 直接显示为粗体
      const boldRegex = /\*\*(.+?)\*\*/g
      let match
      while ((match = boldRegex.exec(line)) !== null) {
        const absStart = pos + match.index
        builder.add(absStart, absStart + 2, Decoration.replace({}))       // 隐藏开头的 **
        builder.add(absStart + 2, absStart + 2 + match[1].length,
          Decoration.mark({ class: 'cm-bold' }))
        builder.add(absStart + 2 + match[1].length,
          absStart + match[0].length, Decoration.replace({})) // 隐藏结尾的 **
      }

      pos += line.length + 1 // +1 for newline
    }
  }
  return builder.finish()
}

export function createCodeMirrorEditor(parent: HTMLElement) {
  const startState = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      // Decoration 层：在源文本之上叠加视觉样式
      EditorView.decorations.of(markdownDecorations),
      // 主题
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-heading-1': { fontSize: '1.8em', fontWeight: '700' },
        '.cm-heading-2': { fontSize: '1.5em', fontWeight: '600' },
        '.cm-bold': { fontWeight: '700' },
        '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
      }),
    ],
  })

  return new EditorView({
    state: startState,
    parent,
  })
}
```

#### 自动保存（Tauri）

```rust
// src-tauri/src/commands/file.rs
use tauri::command;
use std::fs;
use std::path::Path;

#[command]
pub async fn save_file(path: String, content: String) -> Result<String, String> {
    fs::write(&path, &content)
        .map_err(|e| format!("保存失败: {}", e))?;
    Ok(path)
}

#[command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("读取失败: {}", e))
}

// 文件存在性检查
#[command]
pub async fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}
```

#### 编码检测（Rust 侧 + 前端 fallback）

```rust
// src-tauri/src/commands/encoding.rs
use tauri::command;
use std::fs;

#[command]
pub async fn detect_encoding(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;

    // 检测 BOM
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return Ok("UTF-8-BOM".to_string());
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return Ok("UTF-16-LE".to_string());
    }

    // 简易 GBK 检测：尝试用 GBK 解码，看是否合法
    let (gbk_encoding, _) = encoding_rs::GBK.decode(&bytes);
    let (utf8_encoding, _, had_errors) = encoding_rs::UTF_8.decode(&bytes);

    if had_errors {
        Ok("GBK".to_string())
    } else {
        Ok("UTF-8".to_string())
    }
}
```

#### 调用 SnapMD 预览

```typescript
// src/composables/useSnapMD.ts
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'

export function useSnapMD() {
  async function openWithSnapMD(filePath: string) {
    // Step 1: 先保存当前文件
    await saveCurrentFile()

    // Step 2: 尝试通过系统关联打开（.md 默认应用应为 SnapMD）
    try {
      await open(filePath)
    } catch {
      // 降级：提示用户先安装 SnapMD
      console.warn('SnapMD 未安装，请先安装闪阅预览器')
    }
  }

  return { openWithSnapMD }
}
```

### 8.3 性能指标（修订）

| 指标 | 目标值 | 测试条件 | 备注 |
|------|--------|----------|------|
| 冷启动 P50 | ≤ 700ms | Windows，1MB 文档 | 从双击到可编辑 |
| 冷启动 P95 | ≤ 1200ms | 同上 | 含 WebView 初始化 |
| 内存空闲 | ≤ 80MB | 空文档打开 | 不含 WebView 自身 |
| 内存峰值 | ≤ 200MB | 编辑 10 万字文档 | 滚动操作 |
| 大文件滚动 | ≥ 60fps | 10 万字文档滚动 | CodeMirror 虚拟滚动 |
| 自动保存延迟 | 2s | 防抖时间 | 可配置 |
| Decoration 渲染延迟 | < 16ms | 单次视口内容 Decoration 更新 | 保持 60fps |

---

## 九、风险与对策（修订）

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| **CM6 Decoration 在复杂场景下渲染异常** | 中 | 高 | Phase 0 验证所有 edit-fixtures 样本 |
| **大文件编辑卡顿** | 中 | 中 | CM6 原生虚拟滚动，Phase 0 验证 |
| **编码检测不准确（GBK/UTF-8 混淆）** | 中 | 中 | Rust encoding_rs + 前端 fallback，Phase 1 W3 专项测试 |
| **跨平台文件关联不一致** | 低 | 中 | Windows/macOS 分别实现，Phase 1 W3 两平台测试 |
| **与 SnapMD 解析版本不同步** | 低 | 高 | 共用 markdown-it 配置文件和测试样本，CI 同步检查 |
| **自动保存导致文件损坏** | 低 | 高 | 先写临时文件 → 校验 → 原子替换原文件 |
| **自动更新签名问题** | 中 | 中 | Phase 2 提前配置代码签名证书 |
| **CodeMirror Extension 兼容性** | 低 | 低 | 锁定 @codemirror/* 版本，Phase 0 确定扩展组合 |

---

## 十、测试策略

### 10.1 测试分层

| 层次 | 工具 | 覆盖内容 | 频率 |
|------|------|----------|------|
| 单元测试 | Vitest | composables / utils / stores | 每次提交 |
| 组件测试 | Vue Test Utils | 工具栏、状态栏、对话框 | 每次 PR |
| Round-trip 测试 | Playwright + edit-fixtures | 打开→保存→重新打开→对比 | 每次 PR |
| 编码兼容性测试 | 自定义脚本 | GBK/UTF-8-BOM/CRLF 文件 | 每次发布前 |
| 性能测试 | 自定义脚本 | 冷启动/内存/滚动帧率 | Phase 0 + 每次发布前 |
| E2E 测试 | Playwright | 完整编辑流程 | 每次发布前 |

### 10.2 Round-trip 自动化测试

```typescript
// tests/roundtrip.spec.ts
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const fixturesDir = path.resolve(__dirname, '../edit-fixtures')
const samples = fs.readdirSync(fixturesDir).filter(f => f.startsWith('roundtrip-'))

for (const sample of samples) {
  test(`Round-trip: ${sample}`, async ({ page }) => {
    const originalContent = fs.readFileSync(path.join(fixturesDir, sample), 'utf-8')

    // Step 1: 打开文件
    await page.evaluate((content) => {
      // 通过 Tauri IPC 打开文件并加载到编辑器
      window.__setEditorContent(content)
    }, originalContent)

    // Step 2: 不做任何修改，直接保存
    await page.click('[data-testid="save-btn"]')

    // Step 3: 读取保存后的文件
    const savedContent = await page.evaluate(() => {
      return window.__getSavedContent()
    })

    // Step 4: 逐字节对比
    expect(savedContent).toBe(originalContent)
  })
}
```

---

## 十一、分发与运维

### 11.1 打包与签名

| 平台 | 打包格式 | 签名要求 |
|------|----------|----------|
| Windows | .msi / .exe (NSIS) | EV Code Signing Certificate |
| macOS | .dmg | Apple Developer ID (Notarization) |

### 11.2 自动更新

- 使用 Tauri updater plugin
- 更新服务器托管静态 JSON manifest
- Beta 通道和 Stable 通道分离

### 11.3 CI/CD

- GitHub Actions 构建 + 测试
- 每次合并 main → 自动构建 → Beta 通道发布
- 手动触发 → Stable 通道发布

---

## 十二、与 SnapMD 的协同策略

| 协同维度 | 具体做法 |
|----------|----------|
| 解析一致性 | 共用 markdown-it 配置 + 样本集，CI 中交叉验证 |
| 主题一致性 | 共用 CSS Variables 定义文件 |
| 运行时可互调 | SnapMD 可唤起 SnapEdit 编辑；SnapEdit 可唤起 SnapMD 预览 |
| 工程经验复用 | Tauri 2 配置、打包脚本、代码签名流程共享 |
| 代码仓库 | 建议 monorepo 或独立仓库共享 `packages/shared-markdown/` |

---

## 十三、变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-06-16 | v0.1 | 初始版本，完成产品规划 | - |
| 2026-06-16 | v0.2 | 修订版：修正编辑内核选型、补充 Editing Contract、调整 MVP 排期至 6 周、增加测试策略和验收标准 | - |
| 2026-06-16 | v0.3 | 新增公众号格式导出（Phase 1 W5 同周完成）+ 双向链接知识网络（新增 Phase 1.5，2 周），包含完整技术方案和排期 | - |

---

## 十四、附录

### 14.1 竞品参考

| 产品 | 内核 | 可借鉴 |
|------|------|--------|
| Typora | 自研（类 CodeMirror） | 无缝编辑体验、导出质量 |
| Obsidian | CodeMirror 6 | Decoration 渲染效果、插件架构 |
| MarkText | CodeMirror | 分屏模式布局 |
| iA Writer | 自研 | 专注模式设计 |
| Zed | 自研（GPUI） | 极致性能追求 |

### 14.2 相关资源

- [Tauri 2 文档](https://v2.tauri.app/)
- [CodeMirror 6 文档](https://codemirror.net/)
- [CodeMirror Markdown Decoration 示例](https://codemirror.net/examples/decoration/)
- [markdown-it 插件生态](https://github.com/markdown-it/markdown-it)

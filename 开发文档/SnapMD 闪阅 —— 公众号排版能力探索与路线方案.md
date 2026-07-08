# SnapMD 闪阅 —— 公众号排版能力探索与路线方案

> 日期：2026-07-07
> 背景：评估 `isjiamu/gzh-design-skill` 是否适合结合 SnapMD，判断是作为现有项目增强、后续模块，还是另做公众号排版编辑器。

## 一、结论

这个 skill 对 SnapMD **有参考价值，也有可转化价值**，但不建议直接把它当依赖或主题库完整集成进当前 SnapMD。

推荐路线：

1. **短期不改变 SnapMD 主定位**：SnapMD 继续做本地 Markdown / TXT / JSON / CSV / YAML 的快速阅读、轻编辑和普通 HTML/PDF 导出。
2. **中期新增“导出适配器”能力**：先做一个自研的“公众号 HTML 导出 Beta”，只覆盖 Markdown，输出可复制到公众号编辑器的 HTML 片段和预览页。
3. **长期若公众号需求强，再另做独立产品**：可以命名为 `SnapGZH` / `SnapPub` / `SnapMD Publish`，聚焦公众号排版、主题、素材、复制粘贴、发布前检查；它可以复用 SnapMD 的文件读取、Markdown 编辑和图片资产管理经验，但产品边界独立。

核心判断：

```text
gzh-design-skill 不是“SnapMD 的一个主题”，而是一条公众号发布工作流。
它适合启发我们做“发布导出层”，不适合现在直接塞进“快速阅读器”主流程。
```

## 二、外部 skill 事实判断

`gzh-design-skill` 的公开信息显示，它定位为 AI Agent 使用的微信公众号排版 skill，核心能力包括：

- 将 Markdown 排成可直接粘贴进微信公众号编辑器的 HTML。
- 支持 6 套主题：摸鱼绿、红白色系、石墨极简风、留白禅意风、摸鱼票据风、橄榄手记。
- 支持 Markdown / Word / PDF / 纯文本输入，但非 Markdown 会先归一化成 Markdown。
- 使用主题组件库和通用组件库拼装正文，不是简单套 CSS。
- 强制平台合规：禁 `<style>`、`<script>`、`div`、`class`、`id`、`grid`、`position:fixed/absolute/sticky`、外部字体等。
- 要求文字节点包裹 `<span leaf="">`，以减少粘贴到公众号后样式丢失。
- 提供 `validate_gzh_html.py` 做最终 HTML 合规校验。
- 生成两个产物：干净 HTML 正文片段，以及带“复制到公众号”按钮的预览页。
- 许可证为 **AGPL-3.0**。

这说明它的价值重点不是“Markdown 渲染”，而是：

1. 公众号平台限制经验。
2. 一套可复用的主题组件组织方法。
3. Agent 排版流程。
4. 可验证的产物合规检查。

## 三、和 SnapMD 当前状态的匹配度

SnapMD 当前已经具备的底盘：

- `Tauri 2 + Vue 3 + TypeScript`
- `markdown-it + highlight.js + DOMPurify`
- Markdown / TXT / JSON / CSV / YAML 阅读和轻编辑
- Markdown 图片相对路径处理和 `assets/` 自动落盘
- 阅读 / 编辑 / 分屏模式
- HTML / PDF 导出
- 回归样本和截图验证机制

匹配点：

| 方向 | 匹配度 | 原因 |
|------|--------|------|
| Markdown 源文件读取 | 高 | SnapMD 已经能打开、编辑、保存 Markdown。 |
| 图片资产管理 | 高 | 已有 Markdown 图片按钮、拖入、粘贴并复制到 `assets/`。 |
| 普通 HTML 导出 | 中 | 现有导出是完整 HTML 页面，不是公众号正文片段。 |
| 公众号粘贴 HTML | 中 | 可做，但需要新 renderer，不能直接复用现有预览 HTML。 |
| 主题系统 | 低到中 | SnapMD 目前只有亮/暗主题，不是文章排版主题。 |
| Word/PDF 输入 | 低 | 当前渲染契约暂不支持 Word/PDF。 |
| Agent 自动排版 | 低 | SnapMD 是桌面工具，不是 Agent skill 运行环境。 |

不匹配点：

- SnapMD 的目标是“打开快、阅读稳、轻量可改”；公众号排版更像“发布前制作工具”。
- SnapMD 当前 HTML 使用 class、id、外部 CSS 语义和浏览器页面结构；公众号要求内联 style 和正文片段。
- SnapMD 的 DOMPurify 安全模型是“本地预览安全”；公众号导出模型是“粘贴后样式保真”，两者不是同一个问题。
- `gzh-design-skill` 的 AGPL-3.0 对闭源或商业分发有强约束，不适合在未确认项目开源策略前直接复制主题组件库或脚本。

## 四、是否直接集成

不建议直接集成。原因：

1. **许可证风险高**
   - 该仓库是 AGPL-3.0。
   - 如果复制、修改、分发其代码或组件库，可能要求衍生作品按 AGPL 开源。
   - SnapMD 当前仓库没有明确 LICENSE，未来如果要闭源、商用或混合授权，直接集成会埋雷。

2. **产品边界会被拉大**
   - 公众号排版涉及主题、素材、预览复制、平台规则、标点规范、签名区、文章类型判断。
   - 这会把 SnapMD 从“阅读器/轻编辑器”推向“内容运营发布工具”。

3. **技术实现不是简单 CSS**
   - 公众号 HTML 需要内联样式、禁止 class/id、文字 leaf 包裹。
   - 现有 `renderMarkdown()` 产物是面向应用内预览的 HTML，不能直接变成公众号可粘贴 HTML。

4. **现有主题组件不可直接搬**
   - 主题组件库是该项目核心资产，既有版权也有 AGPL 约束。
   - 更稳妥做法是学习结构和规则，自研少量基础主题。

## 五、可以怎样完善 SnapMD

建议把它转化为 SnapMD 的“发布导出层”，不要变成主编辑器能力。

### 5.1 新增导出适配器架构

当前导出大致是：

```text
Markdown source -> renderDocument -> 应用内 HTML -> buildStandaloneHtml -> 下载 HTML
```

建议逐步抽象为：

```text
Source Document
  -> Preview Renderer       # 应用内阅读
  -> Export Adapter: HTML   # 普通完整网页
  -> Export Adapter: PDF    # 浏览器打印
  -> Export Adapter: GZH    # 公众号正文片段
```

这样公众号导出不会污染现有阅读渲染链。

### 5.2 做自研“公众号 HTML 导出 Beta”

Beta 只做 Markdown，不碰 TXT / JSON / CSV / YAML。

范围建议：

- 输入：当前打开的 Markdown。
- 输出：
  - `{源文件名}_公众号.html`：纯 `<section>...</section>` 正文片段。
  - `{源文件名}_公众号_预览.html`：带复制按钮的预览页。
- 支持元素：
  - `#` 标题
  - `##` 章节标题自动编号
  - 段落
  - 加粗
  - 引用
  - 无序/有序列表
  - 图片
  - 代码块
  - 分割线
- 内置 1 到 2 套自研主题：
  - `Snap Clean`：稳重清爽，适合教程/说明。
  - `Snap Note`：轻手记风，适合观点/复盘。
- 合规规则：
  - 不输出 `<html>/<head>/<body>` 到干净正文文件。
  - 不输出 `class/id/style 标签/div/script`。
  - 样式全部内联。
  - 中文文本尽量包 `<span leaf="">`。
  - 图片使用 `max-width:100%;height:auto;display:block;margin:0 auto`。

### 5.3 增加本地校验脚本

可以参考 `validate_gzh_html.py` 的检查维度，但用自研脚本实现：

```text
tools/validate-gzh-html.mjs 或 tools/validate-gzh-html.py
```

检查项：

- 禁止标签：`style`、`script`、`div`、`link`
- 禁止属性：`class`、`id`
- 禁止 CSS：`position:fixed/absolute/sticky`、`float`、`display:grid`、`@media`、`var(--x)`
- 提醒项：中文半角标点、未 leaf 包裹文本、空图片链接

这件事对 SnapMD 很有用，因为它延续了项目当前“渲染契约 + 样本 + 回归验证”的工程风格。

## 六、是否另做一个编辑器

如果目标只是“偶尔把 Markdown 导出到公众号”，不用另做编辑器，SnapMD 增加导出适配器即可。

如果目标是“专门服务公众号生产”，建议另做一个轻量编辑器或独立模式。判断标准如下：

| 需求信号 | 建议 |
|----------|------|
| 用户只是想把现有 Markdown 粘到公众号 | SnapMD 加导出适配器 |
| 用户需要多主题切换、复制预览、标点检查 | SnapMD 可先做 Beta |
| 用户需要 Word/PDF 转 Markdown、自动分章、主题生成 | 另做独立产品 |
| 用户需要运营素材库、封面图、签名区、账号模板 | 另做独立产品 |
| 用户需要多平台发布：公众号/知乎/小红书/知识星球 | 另做 `Publish` 类产品 |

独立产品建议定位：

```text
SnapGZH：面向微信公众号的 Markdown 排版与粘贴发布工具
```

它可以复用 SnapMD 的经验：

- 文件打开、拖拽、最近记录
- Markdown 编辑 / 分屏
- 图片复制到 `assets/`
- 导出和预览验证
- Tauri 桌面打包

但不要复用 SnapMD 的主界面结构。公众号工具需要更强的“发布台”布局：

```text
左：文章结构 / 素材
中：Markdown 编辑
右：公众号样式预览
顶部：主题 / 导出 / 复制 / 校验
```

## 七、三条路线对比

| 路线 | 做法 | 周期预估 | 收益 | 风险 |
|------|------|----------|------|------|
| A. 不做 | 只把 skill 当外部工具用 | 0 天 | SnapMD 保持极简 | 错过公众号导出需求 |
| B. SnapMD 轻集成 | 自研公众号导出 Beta | 3-6 天 | 快速验证，成本低 | 只能覆盖基础文章 |
| C. 独立编辑器 | 新建 SnapGZH / SnapPub | 3-6 周 | 产品边界清晰，可做深 | 工作量大，需验证需求 |

推荐：

```text
先走 B，再用真实使用反馈决定是否走 C。
```

## 八、分阶段方案

### Phase 0：需求验证与样本准备（0.5-1 天）

产物：

- 新增 `render-fixtures/gzh-basic.md`
- 新增 `render-fixtures/gzh-image-code.md`
- 新增 `render-fixtures/gzh-long-article.md`
- 明确公众号导出支持范围和不支持范围

验收：

- 至少 3 篇真实或拟真公众号文章样本。
- 明确普通 HTML 导出和公众号 HTML 导出的差异。

### Phase 1：公众号导出最小闭环（2-3 天）

产物：

- `src/exporters/gzh.ts`
- 工具栏新增“公众号”或导出菜单新增“公众号 HTML”
- 生成干净正文片段
- 生成带复制按钮的预览页
- 自研基础主题 `Snap Clean`

验收：

- Markdown 标题、段落、引用、列表、图片、代码块可转换。
- 干净正文文件不含 `html/head/body/style/script/div/class/id`。
- 预览页复制按钮可复制正文片段。

### Phase 2：校验与体验打磨（1-2 天）

产物：

- 新增校验脚本
- 导出后显示校验结果
- 支持第二套主题 `Snap Note`
- 增加回归清单

验收：

- 校验 0 ERROR 才提示“可粘贴”。
- 样本导出结果可人工复制到公众号编辑器测试。
- 不影响现有 HTML/PDF 导出。

### Phase 3：决定是否独立产品化（1 周观察）

观察指标：

- 用户是否频繁使用公众号导出。
- 是否频繁要求主题切换。
- 是否需要 Word/PDF 输入。
- 是否需要自动排版或 Agent 辅助。
- 是否愿意围绕公众号工具单独使用一个界面。

如果这些信号强，再启动独立 `SnapGZH`。

## 九、风险预判

1. **许可证风险**
   - 不复制 `gzh-design-skill` 的组件库、主题 HTML、脚本实现。
   - 只参考公开思路，自研实现。
   - 如未来确需深度使用，先确认 SnapMD 是否接受 AGPL 或与作者沟通授权。

2. **粘贴保真风险**
   - 公众号编辑器会过滤很多 HTML/CSS。
   - 必须用真实公众号后台做人工验证，不能只看本地浏览器预览。

3. **功能膨胀风险**
   - 不把主题生成器、Word/PDF 转换、自动排版一次性塞进 SnapMD。
   - 先做导出，不做“公众号工作台”。

4. **渲染链污染风险**
   - 公众号导出必须是独立 exporter。
   - 不要为了公众号限制改现有 `renderMarkdown()`，否则会伤害应用内阅读效果。

5. **用户预期风险**
   - 功能命名要准确：`公众号 HTML Beta`，不要宣传成“一键发布”。
   - 当前只解决“复制到公众号编辑器前的排版片段”，不解决审核、群发、素材库、封面图。

## 十、最终建议

我建议这样拍板：

```text
不直接安装或集成 gzh-design-skill。
吸收它的“组件化主题 + 平台合规校验 + 复制预览页”方法。
在 SnapMD 内先做一个自研的公众号导出 Beta。
如果验证出高频需求，再另开 SnapGZH / SnapPub 独立编辑器。
```

近期最值得做的是 Phase 1：

- 它不破坏 SnapMD 当前“轻量阅读器”的定位。
- 它能复用现有 Markdown、图片、导出底盘。
- 它能快速验证公众号排版是不是用户真实高频需求。
- 它避开 AGPL 直接集成风险。

## 十一、Sources

- [gzh-design-skill README](https://github.com/isjiamu/gzh-design-skill)
- [SKILL.md 工作流说明](https://github.com/isjiamu/gzh-design-skill/blob/main/SKILL.md)
- [主题索引 theme-index.md](https://github.com/isjiamu/gzh-design-skill/blob/main/references/theme-index.md)
- [通用组件 common-components.md](https://github.com/isjiamu/gzh-design-skill/blob/main/references/common-components.md)
- [格式归一化 format-normalize.md](https://github.com/isjiamu/gzh-design-skill/blob/main/references/format-normalize.md)
- [校验脚本 validate_gzh_html.py](https://github.com/isjiamu/gzh-design-skill/blob/main/scripts/validate_gzh_html.py)
- [LICENSE: AGPL-3.0](https://github.com/isjiamu/gzh-design-skill/blob/main/LICENSE)

## 十二、变更记录

| 日期 | 类型 | 内容摘要 |
|------|------|----------|
| 2026-07-07 | 规划新增 | 评估 `gzh-design-skill` 与 SnapMD 的结合方式，结论为不直接集成 AGPL 组件库，建议先自研公众号导出 Beta，再根据需求决定是否另做独立公众号编辑器。 |

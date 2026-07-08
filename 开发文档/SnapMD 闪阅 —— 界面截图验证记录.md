# SnapMD 闪阅 —— 界面截图验证记录

> 验证日期：2026-07-07
> 验证范围：浏览器模式 + Tauri 桌面模式
> 截图目录：`D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07`

## 一、结论

本轮已完成一组可回看的桌面截图留档，覆盖：

- 浏览器模式：阅读 / 编辑 / 分屏
- Tauri 模式：Markdown 基础阅读、CSV 边界样本、YAML 缩进异常样本

本轮截图中，已确认以下点：

1. 顶部工具栏、左侧目录、最近打开、文件信息和正文区布局正常，没有明显重叠。
2. 浏览器模式下阅读、编辑、分屏三种主模式都能稳定显示。
3. Tauri 模式下本地文件路径打开正常，CSV / YAML 的诊断提示、标题状态和正文预览都能正确落在界面上。
4. CSV 聚合诊断和 YAML 语法错误状态在桌面模式下可直观看到，符合当前迭代目标。

## 二、截图清单

### 浏览器模式

- [browser-read.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\browser-read.png)
- [browser-edit.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\browser-edit.png)
- [browser-split.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\browser-split.png)
- [browser-history-topbar-empty.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-08\browser-history-topbar-empty.png)

### Tauri 桌面模式

- [tauri-front-visible.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\tauri-front-visible.png)
- [tauri-csv-visible.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\tauri-csv-visible.png)
- [tauri-yaml-visible.png](D:\GitWork\MMY_SnapMD\verification-shots\2026-07-07\tauri-yaml-visible.png)

## 三、样本对应关系

| 截图 | 样本 | 观察点 |
|------|------|--------|
| `browser-read.png` | 浏览器默认 `basic.md` | 基础阅读布局、目录、信息面板 |
| `browser-edit.png` | 浏览器默认 `basic.md` | 编辑态高亮层与工具栏状态 |
| `browser-split.png` | 浏览器默认 `basic.md` | 分屏比例、双栏显示、顶部按钮状态 |
| `browser-history-topbar-empty.png` | 浏览器默认 `basic.md` | 顶部最近按钮空记录禁用状态、左侧目录不再被最近打开列表挤占 |
| `tauri-front-visible.png` | `MMY_SnapMD/render-fixtures/basic.md` | 桌面模式下基础阅读、最近打开和文件信息 |
| `tauri-csv-visible.png` | `MMY_SnapMD/render-fixtures/csv-header-issues.csv` | CSV 聚合诊断、表头质量提示、表格渲染 |
| `tauri-yaml-visible.png` | `MMY_SnapMD/render-fixtures/yaml-indent-edge.yml` | YAML 语法错误状态、缩进诊断、结构目录 |

## 四、关键观察

### 4.1 浏览器模式

1. 阅读模式下正文宽度、目录层级和信息面板密度正常。
2. 编辑模式下源码区可以保持结构可辨识，不是完全“白板文本”。
3. 分屏模式下左编右预览结构清晰，工具栏状态也能保持稳定。

### 4.2 Tauri 模式

1. `basic.md` 在桌面模式下能稳定显示顶部工具栏、目录、最近打开和底部文件信息。
2. `csv-header-issues.csv` 的 3 类问题都能在同一屏内被看到：
   - 列数不一致
   - 空列名
   - 重复列名
3. `yaml-indent-edge.yml` 的缩进异常和 Tab 缩进都能在界面顶部直接看到，右上角也出现了 `YAML 语法错误` 状态提示。

## 五、本轮留档边界

本轮截图留档优先覆盖“当前最容易回归出问题”的几类界面：

- 模式切换
- 目录 / 信息区布局
- CSV 诊断展示
- YAML 诊断展示
- 桌面模式本地文件打开

图片拖入、剪贴板粘贴、保存冲突操作条等交互项，本轮以功能测试通过为主，后续若需要可单独补一轮交互截图。

## 六、变更记录

| 日期 | 类型 | 内容摘要 |
|------|------|----------|
| 2026-07-08 | 更新 | 补充顶部历史下拉改造后的浏览器截图，确认空记录状态下顶栏“最近”按钮禁用，左侧栏只保留目录与文档信息。 |
| 2026-07-07 | 新增 | 首版界面截图验证记录，统一留档浏览器与 Tauri 两侧关键界面截图，并标注样本对应关系与关键观察点。 |

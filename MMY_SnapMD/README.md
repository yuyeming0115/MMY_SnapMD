# SnapMD 闪阅

SnapMD 是一个以“本地文本类文档秒开阅读”为核心的轻量桌面工具。当前仓库先落地 Markdown / TXT / JSON / CSV / YAML 阅读与轻量编辑底盘，并预留 Tauri 2 桌面壳。

## 当前能力

- 打开本地 `.md` / `.markdown` / `.txt` / `.json` / `.csv` / `.yaml` / `.yml` 文件
- 支持拖拽打开
- Tauri 桌面模式支持拖入系统文件路径直接打开
- Tauri 桌面模式支持通过启动参数打开文件
- 最近打开记录，支持点击历史文件重新预览
- Tauri 桌面模式支持当前文件变更自动刷新预览
- 顶部水平工具条，支持打开、保存、阅读/编辑/分屏模式切换、主题与导出
- CommonMark + GFM 常用语法渲染
- 任务列表、脚注、标题锚点与目录
- 代码高亮
- Markdown 相对路径图片渲染，Tauri 桌面模式会基于当前文档目录解析本地图片
- Markdown 编辑/分屏模式支持选择图片，自动复制到当前文档同目录 `assets/` 并插入相对路径
- TXT 纯文本预览，保留换行、缩进和普通文本符号
- JSON 格式化预览、结构目录与语法错误提示
- CSV 表格预览、列目录、表头质量提示与列数诊断
- YAML/YML 结构目录、源码预览、基础缩进诊断与问题行提示
- Tauri 桌面模式支持轻量源文本编辑并手动保存
- 快捷键：`Ctrl+O` 打开、`Ctrl+S` 保存、`Ctrl+E` 切换编辑
- 内容字号调节
- JSON 编辑模式下支持手动格式化
- Markdown 编辑模式提供轻量源码高亮，区分标题、列表、引用、代码和链接
- 侧栏和分屏比例支持拖拽调整，并自动记忆
- 明暗主题切换
- 浏览器打印导出 PDF
- 导出 PDF / HTML 时默认使用源文件基名
- `render-fixtures/` 渲染样本集

图片测试样本：

```text
render-fixtures/image-gallery.md
render-fixtures/csv-sales.csv
render-fixtures/csv-header-issues.csv
render-fixtures/csv-quoted-multiline.csv
render-fixtures/yaml-config.yaml
render-fixtures/yaml-diagnostics.yml
render-fixtures/yaml-nested-ops.yaml
render-fixtures/yaml-indent-edge.yml
```

## 开发命令

```bash
npm install
npm run dev
```

Tauri 桌面壳需要先安装 Rust/Cargo：

```bash
npm run tauri dev
```

安装 Rust 后，可以用启动参数验证文件直开：

```bash
npm run tauri dev -- render-fixtures/basic.md
npm run tauri dev -- render-fixtures/csv-sales.csv
npm run tauri dev -- render-fixtures/yaml-config.yaml
```

也可以直接启动边界样本：

```powershell
npm run tauri:dev:csv:edge
npm run tauri:dev:yaml:edge
```

## 回归清单

固定回归步骤见：

```text
开发文档/SnapMD 闪阅 —— 回归验证清单.md
```

界面截图留档见：

```text
开发文档/SnapMD 闪阅 —— 界面截图验证记录.md
verification-shots/2026-07-07/
```

## 品牌资产

- 应用图标：`src-tauri/icons/icon.ico`
- macOS 图标：`src-tauri/icons/icon.icns`
- 图标 PNG：`assets/brand/snapmd-icon-512.png`
- 横版 Logo：`assets/brand/snapmd-logo.svg`
- 横版 Logo PNG：`assets/brand/snapmd-logo.png`

## 单文件 exe

在仓库根目录生成免安装便携版 exe：

```powershell
npm run tauri:build:portable
```

当前发布产物会复制到：

```text
..\releases\SnapMD-0.1.0-x64.exe
```

如需只生成 Tauri 原始 release 程序本体，不复制到 `releases/`：

```bash
npm run tauri build --no-bundle
```

如需生成 Windows 安装包：

```bash
npm run tauri build
```

当前 Windows 会输出 MSI 与 NSIS 安装包。WiX MSI 语言已配置为 `zh-CN`，以支持中文产品名。

## macOS 打包

在 macOS 终端里，可以直接执行仓库根目录的一键脚本：

```bash
./build-mac.sh
```

也可以只走命令链路：

```bash
npm run tauri:build:mac
```

当前 macOS 打包会自动完成两件事：

- 生成 Tauri 原始 `.app` / `.dmg` 产物
- 归档到仓库根目录 `../releases/`

归档文件名统一为：

```text
../releases/SnapMD-0.1.0-macos-arm64.dmg
../releases/SnapMD-0.1.0-macos-arm64.app.zip
```

其中架构后缀会根据机器自动变为 `arm64` 或 `x64`。

项目已补齐 `src-tauri/icons/icon.icns`，并新增 `src-tauri/tauri.macos.conf.json`，默认使用 ad-hoc 签名，方便本地测试与 Release 附件分发；如果后续要走正式 Developer ID 签名，可在 macOS 构建环境覆盖该配置。

## 阶段边界

本阶段优先验证“打开快、阅读稳、轻量可改”的桌面工具底盘。云分享、账号体系、主题市场、插件系统不进入当前 MVP。

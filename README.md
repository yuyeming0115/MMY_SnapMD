# MMY_SnapMD

SnapMD（闪阅）是一款主打“快速打开、轻量阅读、必要时直接微调”的文本类文档阅读器。

当前重点支持：

- Markdown：渲染预览、目录、代码高亮、相对路径图片、图片快速插入、HTML/PDF 导出
- TXT：纯文本阅读，保留换行、缩进与普通文本符号
- JSON：格式化预览、结构目录、语法错误提示
- CSV：表格预览、列目录、表头质量提示、列数诊断
- YAML/YML：结构目录、源码预览、基础缩进诊断与问题行提示
- 轻量编辑：阅读/编辑/分屏模式、手动保存、图片插入、未保存状态保护

图片测试样本：

```text
MMY_SnapMD/render-fixtures/image-gallery.md
MMY_SnapMD/render-fixtures/csv-sales.csv
MMY_SnapMD/render-fixtures/csv-header-issues.csv
MMY_SnapMD/render-fixtures/csv-quoted-multiline.csv
MMY_SnapMD/render-fixtures/yaml-config.yaml
MMY_SnapMD/render-fixtures/yaml-nested-ops.yaml
MMY_SnapMD/render-fixtures/yaml-indent-edge.yml
```

常用命令需在应用目录 `MMY_SnapMD/` 内执行（该目录含 `package.json`）：

```powershell
cd MMY_SnapMD
npm run dev          # 启动前端开发服务器（仅预览 UI）
npm run build        # 前端类型检查 + 构建（vue-tsc + vite）
npm run tauri dev    # 启动带桌面前端的开发模式
npm run tauri build  # 打包桌面应用，产物在 src-tauri/target/release/bundle/
```

也可以进入应用目录执行原始命令：

```powershell
cd MMY_SnapMD
npm run tauri dev -- render-fixtures/image-gallery.md
```

固定回归清单见：

```text
开发文档/SnapMD 闪阅 —— 回归验证清单.md
```

界面截图留档见：

```text
开发文档/SnapMD 闪阅 —— 界面截图验证记录.md
verification-shots/2026-07-07/
```

跨平台打包与发布：

- 一键脚本（推荐）：
  - Windows：`build-win.bat` 或 `build-win.ps1`，打包后自动把安装包复制到 `releases/`
  - macOS：`./build-mac.sh`（仅限 macOS 环境运行），打包后自动归档到 `releases/`
- 手动打包（必须在 `MMY_SnapMD/` 目录内执行）：`npm run tauri build`
  - Windows 产物：`src-tauri/target/release/bundle/{msi,nsis}/`
  - macOS 产物：`src-tauri/target/release/bundle/{dmg,macos}/`
- 发布新版本流程：
  1. 同步版本号：`MMY_SnapMD/package.json`、`MMY_SnapMD/src-tauri/Cargo.toml`、`MMY_SnapMD/src-tauri/tauri.conf.json` 三处 `version` 必须一致
  2. 提交改动并打 tag：`git tag -a vX.Y.Z -m "..."`，再 `git push origin main --tags`
  3. 本地打包后，用 GitHub CLI 创建 Release 并上传安装包：
     `gh release create vX.Y.Z --title "SnapMD 闪阅 vX.Y.Z" -F 说明.md "<msi 路径>" "<exe 路径>"`

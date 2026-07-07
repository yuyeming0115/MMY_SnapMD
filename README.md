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

常用命令可在仓库根目录执行：

```powershell
npm run build
npm run cargo:check
npm run tauri:dev:image
npm run tauri:dev:csv
npm run tauri:dev:csv:edge
npm run tauri:dev:yaml
npm run tauri:dev:yaml:edge
npm run tauri:build:portable
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

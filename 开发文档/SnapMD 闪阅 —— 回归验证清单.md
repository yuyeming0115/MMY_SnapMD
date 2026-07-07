# SnapMD 闪阅 —— 回归验证清单

> 适用阶段：多格式阅读与轻量编辑底盘
> 最近更新：2026-07-07

## 一、基础构建

1. 在仓库根目录执行 `npm run build`
2. 执行 `npm run cargo:check`
3. 如需桌面端完整验证，执行 `npm run tauri -- build --no-bundle`

验收：

- 前端构建通过
- Rust 校验通过
- Tauri release 构建通过

## 二、Markdown 回归

样本：

- `MMY_SnapMD/render-fixtures/basic.md`
- `MMY_SnapMD/render-fixtures/image-gallery.md`

检查项：

1. 阅读模式正常显示标题、列表、代码块和图片
2. 编辑模式可输入，可保存
3. 分屏模式预览实时更新
4. “图片”按钮可插入本地图片
5. 图片拖入和剪贴板粘贴可写入 `assets/`

## 三、JSON 回归

样本：

- `MMY_SnapMD/render-fixtures/json-valid.json`
- `MMY_SnapMD/render-fixtures/json-invalid.json`

检查项：

1. 合法 JSON 有结构目录和格式化预览
2. 非法 JSON 有错误提示，且仍可编辑
3. 编辑模式下“格式化”按钮仅在 JSON 可用

## 四、CSV 回归

样本：

- `MMY_SnapMD/render-fixtures/csv-sales.csv`
- `MMY_SnapMD/render-fixtures/csv-header-issues.csv`
- `MMY_SnapMD/render-fixtures/csv-quoted-multiline.csv`

检查项：

1. 正常 CSV 可显示表格和列目录
2. `csv-header-issues.csv` 能提示：
   - 空列名
   - 重复列名
   - 列数不一致
3. 编辑模式下异常行有高亮提示
4. `csv-quoted-multiline.csv` 可正确保留引号、逗号和多行字段

## 五、YAML 回归

样本：

- `MMY_SnapMD/render-fixtures/yaml-config.yaml`
- `MMY_SnapMD/render-fixtures/yaml-nested-ops.yaml`
- `MMY_SnapMD/render-fixtures/yaml-indent-edge.yml`

检查项：

1. 正常 YAML 有结构目录和源码预览
2. 嵌套 YAML 的目录层级正常
3. `yaml-indent-edge.yml` 能提示：
   - Tab 缩进
   - 奇数空格缩进
4. 编辑模式下问题行有高亮提示

## 六、导出与桌面行为

检查项：

1. PDF / HTML 默认文件名与源文件基名一致
2. 最近打开记录可重开、移除、清空
3. 外部修改文件后：
   - 未保存时提示冲突
   - 已保存时可自动刷新
4. 便携版 exe 可直接启动并打开本地文件

## 七、变更记录

| 日期 | 类型 | 内容摘要 |
|------|------|----------|
| 2026-07-07 | 新增 | 首版回归验证清单，覆盖 Markdown / JSON / CSV / YAML / 导出 / 桌面行为，并绑定固定样本。 |

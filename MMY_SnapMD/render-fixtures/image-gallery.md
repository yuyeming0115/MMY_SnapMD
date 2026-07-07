# 图片渲染测试

这个样本用于验证 Markdown 图片在 SnapMD 中的显示效果，重点看相对路径、本地 PNG/SVG、宽图缩放和缺失图片降级。

## SVG 相对路径

![SVG fixture](./assets/sample.svg)

## PNG 图标

![SnapMD icon](./assets/snapmd-icon.png)

## PNG Logo

![SnapMD logo](./assets/snapmd-logo.png)

## 宽图缩放

下面这张图比正文区域宽，应该自动缩放到容器宽度内，不应该撑破页面或出现横向溢出。

![Wide banner](./assets/wide-banner.svg)

## 缺失图片

下面这张图故意不存在，用于确认缺失资源不会导致页面白屏。

![Missing image placeholder](./assets/missing-image.png)

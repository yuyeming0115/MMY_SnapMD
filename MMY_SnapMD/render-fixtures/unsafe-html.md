# 不可信 HTML

下面这段 HTML 在 MVP 中不应被执行：

<script>alert('xss')</script>

<img src=x onerror="alert('xss')" />

SnapMD 当前策略：Markdown 原始 HTML 默认关闭，并通过 sanitize 再做一道清洗。

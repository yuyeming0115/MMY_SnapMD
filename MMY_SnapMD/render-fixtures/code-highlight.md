# 代码高亮

```ts
type RenderContract = {
  markdown: string;
  allowRawHtml: false;
  exportTargets: Array<'html' | 'pdf'>;
};

export function preview(input: RenderContract) {
  return input.markdown.trim();
}
```

```rust
fn main() {
    println!("SnapMD");
}
```

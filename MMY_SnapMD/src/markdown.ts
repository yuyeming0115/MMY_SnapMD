import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import DOMPurify from 'dompurify';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdownLanguage from 'highlight.js/lib/languages/markdown';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { footnote } from '@mdit/plugin-footnote';
import { tasklist } from '@mdit/plugin-tasklist';

export type RenderResult = {
  html: string;
  headings: Array<{ id: string; level: number; text: string }>;
};

export type MarkdownRenderOptions = {
  baseDir?: string;
};

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdownLanguage);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);

const markdown: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, language): string {
    const normalized = language?.trim().toLowerCase();

    if (normalized && hljs.getLanguage(normalized)) {
      const highlighted = hljs.highlight(code, {
        language: normalized,
        ignoreIllegals: true
      }).value;

      return `<pre class="hljs"><code class="language-${normalized}">${highlighted}</code></pre>`;
    }

    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  }
})
  .use(tasklist, { enabled: false })
  .use(footnote)
  .use(anchor, {
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'after',
      class: 'heading-anchor',
      ariaHidden: true
    })
  });

const defaultImageRenderer = markdown.renderer.rules.image;

markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const src = token.attrGet('src');
  const resolvedSrc = resolveImageSrc(src, (env as MarkdownRenderOptions | undefined)?.baseDir);

  if (resolvedSrc) {
    token.attrSet('src', resolvedSrc);
  }
  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');

  if (defaultImageRenderer) {
    return defaultImageRenderer(tokens, index, options, env, self);
  }

  return self.renderToken(tokens, index, options);
};

export function renderMarkdown(source: string, renderOptions: MarkdownRenderOptions = {}): RenderResult {
  const rawHtml = markdown.render(source, renderOptions);
  const html = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'loading', 'decoding']
  });

  const headings = extractHeadings(html);

  return { html, headings };
}

function resolveImageSrc(src: string | null, baseDir?: string) {
  if (!src) return src;

  if (isTauri()) {
    if (isWindowsAbsolutePath(src) || isUncPath(src)) {
      return convertFileSrc(src);
    }
    if (isExternalOrRootedResource(src)) return src;
    if (!baseDir) return src;

    const { pathPart, suffix } = splitResourceSuffix(src);
    return `${convertFileSrc(joinFilePath(baseDir, pathPart))}${suffix}`;
  }

  if (!baseDir) return src;
  if (isExternalOrRootedResource(src)) return src;

  const { pathPart, suffix } = splitResourceSuffix(src);
  return `${joinUrlPath(baseDir, pathPart)}${suffix}`;
}

function isExternalOrRootedResource(value: string) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(value);
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isUncPath(value: string) {
  return /^\\\\/.test(value);
}

function splitResourceSuffix(value: string) {
  const suffixIndex = value.search(/[?#]/);
  if (suffixIndex === -1) {
    return { pathPart: value, suffix: '' };
  }

  return {
    pathPart: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex)
  };
}

function joinFilePath(baseDir: string, relativePath: string) {
  const separator = baseDir.includes('\\') ? '\\' : '/';
  const baseParts = baseDir.replace(/[\\/]+$/, '').split(/[\\/]+/);
  const relativeParts = decodePathPart(relativePath).split(/[\\/]+/);
  const parts = [...baseParts];

  for (const part of relativeParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join(separator);
}

function joinUrlPath(baseDir: string, relativePath: string) {
  const baseParts = baseDir.replace(/\/+$/, '').split('/');
  const relativeParts = decodePathPart(relativePath).split(/[\\/]+/);
  const parts = [...baseParts];

  for (const part of relativeParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(encodeURIComponent(part));
  }

  return parts.join('/').replace(/%2F/g, '/');
}

function decodePathPart(value: string) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function extractHeadings(html: string): RenderResult['headings'] {
  const document = new DOMParser().parseFromString(html, 'text/html');

  return [...document.querySelectorAll('h1[id], h2[id], h3[id]')].map((heading) => {
    heading.querySelector('.heading-anchor')?.remove();

    return {
      id: heading.id,
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent?.trim() ?? ''
    };
  });
}

export function buildStandaloneHtml(title: string, bodyHtml: string, theme: 'light' | 'dark') {
  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: ${theme === 'dark' ? '#14161a' : '#f6f7f9'}; color: ${theme === 'dark' ? '#e8eaee' : '#20242a'}; }
    main { max-width: 880px; margin: 0 auto; padding: 48px 28px 72px; line-height: 1.72; }
    pre { overflow: auto; padding: 16px; border-radius: 8px; background: #111827; color: #e5e7eb; }
    code { font-family: "Cascadia Code", Consolas, monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${theme === 'dark' ? '#333946' : '#d8dde6'}; padding: 8px 10px; }
    blockquote { border-left: 4px solid #6d7dfc; margin: 1.2em 0; padding: 0.2em 1em; color: ${theme === 'dark' ? '#c6cad4' : '#4a5160'}; }
    img { max-width: 100%; }
    a { color: #4f6df5; }
    @media print { body { background: #fff; color: #111; } main { padding: 20mm 16mm; } }
  </style>
</head>
<body>
  <main>${bodyHtml}</main>
</body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

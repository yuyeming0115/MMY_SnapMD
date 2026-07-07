import hljs from 'highlight.js/lib/core';
import { escapeHtml, renderMarkdown, type RenderResult } from './markdown';

export type DocumentKind = 'markdown' | 'txt' | 'json' | 'csv' | 'yaml';

export type DocumentDiagnostic = {
  type: 'error' | 'warning';
  message: string;
};

export type DocumentRenderResult = RenderResult & {
  diagnostics: DocumentDiagnostic[];
};

type OutlineItem = {
  id: string;
  level: number;
  text: string;
};

const DOCUMENT_EXTENSION_PATTERN = /\.(md|markdown|txt|json|csv|ya?ml)$/i;
const JSON_OUTLINE_MAX_DEPTH = 3;
const JSON_OUTLINE_MAX_ITEMS = 120;
const CSV_PREVIEW_MAX_ROWS = 500;
const CSV_OUTLINE_MAX_COLUMNS = 80;
const YAML_OUTLINE_MAX_ITEMS = 120;

export function isSupportedDocument(path: string) {
  return DOCUMENT_EXTENSION_PATTERN.test(path);
}

export function detectDocumentKind(path: string): DocumentKind {
  if (/\.json$/i.test(path)) return 'json';
  if (/\.csv$/i.test(path)) return 'csv';
  if (/\.ya?ml$/i.test(path)) return 'yaml';
  if (/\.txt$/i.test(path)) return 'txt';
  return 'markdown';
}

export function documentKindLabel(kind: DocumentKind) {
  if (kind === 'json') return 'JSON';
  if (kind === 'csv') return 'CSV';
  if (kind === 'yaml') return 'YAML';
  if (kind === 'txt') return 'TXT';
  return 'Markdown';
}

export function renderDocument(source: string, kind: DocumentKind, baseDir = ''): DocumentRenderResult {
  if (kind === 'json') return renderJson(source);
  if (kind === 'csv') return renderCsv(source);
  if (kind === 'yaml') return renderYaml(source);
  if (kind === 'txt') return renderPlainText(source);

  return {
    ...renderMarkdown(source, { baseDir }),
    diagnostics: []
  };
}

export function renderSourceHighlight(source: string, kind: DocumentKind) {
  if (kind === 'json') return wrapHighlightedLines(highlightJson(source), 'source-line');
  if (kind === 'yaml') return renderYamlSourceHighlight(source);
  if (kind === 'csv') return renderCsvSourceHighlight(source);
  if (kind === 'txt') return wrapPlainLines(source, 'source-line');

  return renderMarkdownSourceHighlight(source);
}

export function stripKnownExtension(name: string) {
  return name.replace(DOCUMENT_EXTENSION_PATTERN, '');
}

function renderPlainText(source: string): DocumentRenderResult {
  return {
    html: `<pre class="plain-text-body">${escapeHtml(source)}</pre>`,
    headings: [],
    diagnostics: []
  };
}

function renderJson(source: string): DocumentRenderResult {
  try {
    const parsedValue = JSON.parse(source);
    const formattedJson = JSON.stringify(parsedValue, null, 2);
    const highlightedJson = highlightJson(formattedJson);
    const outline = buildJsonOutline(parsedValue);

    return {
      html: `${renderJsonStructure(outline)}<pre class="hljs json-code-block"><code class="language-json">${highlightedJson}</code></pre>`,
      headings: outline,
      diagnostics: []
    };
  } catch (error) {
    return {
      html: `<pre class="hljs json-code-block"><code class="language-json">${escapeHtml(source)}</code></pre>`,
      headings: [],
      diagnostics: [
        {
          type: 'error',
          message: `JSON 语法错误：${getErrorMessage(error)}`
        }
      ]
    };
  }
}

function renderCsv(source: string): DocumentRenderResult {
  const result = parseCsv(source);
  const rows = result.rows;
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const previewRows = dataRows.slice(0, CSV_PREVIEW_MAX_ROWS);
  const diagnostics = [...result.diagnostics, ...buildCsvShapeDiagnostics(rows)];
  const outline = buildCsvOutline(headers, rows.length, columnCount);

  if (rows.length === 0 || columnCount === 0) {
    return {
      html: '<section class="data-summary"><h1 id="csv-summary">CSV</h1><p>当前 CSV 没有可显示的数据。</p></section>',
      headings: outline,
      diagnostics
    };
  }

  return {
    html: `${renderCsvSummary(rows.length, dataRows.length, columnCount, previewRows.length)}${renderCsvTable(headers, previewRows, columnCount)}`,
    headings: outline,
    diagnostics
  };
}

function renderYaml(source: string): DocumentRenderResult {
  const { outline, diagnostics } = buildYamlOutline(source);
  const highlightedYaml = renderYamlSourceHighlight(source);
  const structure = renderYamlStructure(outline);

  return {
    html: `${structure}<pre class="hljs yaml-code-block"><code class="language-yaml">${highlightedYaml}</code></pre>`,
    headings: outline.length > 0 ? outline : [{ id: 'yaml-root', level: 1, text: 'YAML' }],
    diagnostics
  };
}

function highlightJson(source: string) {
  if (hljs.getLanguage('json')) {
    return hljs.highlight(source, {
      language: 'json',
      ignoreIllegals: true
    }).value;
  }

  return escapeHtml(source);
}

function renderCsvSourceHighlight(source: string) {
  return source
    .split(/\r\n|\r|\n/)
    .map((line, index) => {
      const className = index === 0 ? 'source-line csv-header-line' : 'source-line csv-row-line';
      return `<span class="${className}">${escapeHtml(line) || '&nbsp;'}</span>`;
    })
    .join('');
}

function renderYamlSourceHighlight(source: string) {
  return source
    .split(/\r\n|\r|\n/)
    .map((line) => {
      const classes = ['source-line'];
      const trimmedLine = line.trimStart();
      let highlightedLine = escapeHtml(line);

      if (!trimmedLine) {
        highlightedLine = '&nbsp;';
      } else if (trimmedLine.startsWith('#')) {
        classes.push('yaml-comment-line');
      } else if (/^-\s+/.test(trimmedLine)) {
        classes.push('yaml-list-line');
      } else if (/^[^'"#][^:]*:\s*/.test(trimmedLine) || /^['"][^'"]+['"]:\s*/.test(trimmedLine)) {
        classes.push('yaml-key-line');
      }

      highlightedLine = highlightedLine.replace(/^(\s*)(-?\s*)([^:#\n]+:)/, '$1$2<span class="yaml-key-token">$3</span>');
      return `<span class="${classes.join(' ')}">${highlightedLine}</span>`;
    })
    .join('');
}

function renderMarkdownSourceHighlight(source: string) {
  const lines = source.split(/\r\n|\r|\n/);
  let inCodeBlock = false;

  return lines
    .map((line) => {
      const classes = ['source-line'];
      const trimmedLine = line.trimStart();
      const escapedLine = escapeHtml(line);
      let highlightedLine = highlightMarkdownInline(escapedLine);

      if (/^```/.test(trimmedLine) || /^~~~/.test(trimmedLine)) {
        classes.push('md-code-fence');
        inCodeBlock = !inCodeBlock;
      } else if (inCodeBlock) {
        classes.push('md-code-line');
      } else if (/^#{1,6}\s/.test(trimmedLine)) {
        classes.push('md-heading-line');
      } else if (/^- \[[ xX]\]\s+/.test(trimmedLine)) {
        classes.push('md-task-line');
      } else if (/^>\s?/.test(trimmedLine)) {
        classes.push('md-quote-line');
      } else if (/^[-*+]\s+/.test(trimmedLine) || /^\d+\.\s+/.test(trimmedLine)) {
        classes.push('md-list-line');
      }

      highlightedLine = highlightedLine || '&nbsp;';
      return `<span class="${classes.join(' ')}">${highlightedLine}</span>`;
    })
    .join('');
}

function highlightMarkdownInline(escapedLine: string) {
  return escapedLine
    .replace(/(`[^`]+`)/g, '<span class="md-inline-code">$1</span>')
    .replace(/(\*\*[^*]+\*\*)/g, '<span class="md-strong-token">$1</span>')
    .replace(/(__[^_]+__)/g, '<span class="md-strong-token">$1</span>')
    .replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="md-link-token">$1</span>');
}

function wrapPlainLines(source: string, className: string) {
  return source
    .split(/\r\n|\r|\n/)
    .map((line) => `<span class="${className}">${escapeHtml(line) || '&nbsp;'}</span>`)
    .join('');
}

function wrapHighlightedLines(html: string, className: string) {
  return html
    .split(/\r\n|\r|\n/)
    .map((line) => `<span class="${className}">${line || '&nbsp;'}</span>`)
    .join('');
}

function renderJsonStructure(outline: OutlineItem[]) {
  if (outline.length === 0) {
    return '<section class="json-structure"><h1 id="json-root">JSON</h1><p>当前 JSON 没有可展开的对象或数组结构。</p></section>';
  }

  const items = outline
    .map((item) => {
      const tagName = item.level === 1 ? 'h1' : item.level === 2 ? 'h2' : 'h3';
      return `<${tagName} id="${item.id}">${escapeHtml(item.text)}</${tagName}>`;
    })
    .join('');

  return `<section class="json-structure">${items}</section>`;
}

function renderYamlStructure(outline: OutlineItem[]) {
  if (outline.length === 0) {
    return '<section class="data-summary yaml-summary"><h1 id="yaml-root">YAML</h1><p>当前 YAML 暂无可提取的结构。</p></section>';
  }

  const items = outline
    .map((item) => {
      const tagName = item.level === 1 ? 'h1' : item.level === 2 ? 'h2' : 'h3';
      return `<${tagName} id="${item.id}">${escapeHtml(item.text)}</${tagName}>`;
    })
    .join('');

  return `<section class="data-summary yaml-summary"><p>识别到 ${outline.length} 个结构节点。</p>${items}</section>`;
}

function buildJsonOutline(value: unknown) {
  const outline: OutlineItem[] = [];
  let count = 0;

  function walk(node: unknown, label: string, path: string[], depth: number) {
    if (count >= JSON_OUTLINE_MAX_ITEMS || depth > JSON_OUTLINE_MAX_DEPTH) return;
    if (!isJsonContainer(node)) return;

    const id = `json-${slugify(path.join('-') || 'root')}`;
    const suffix = Array.isArray(node) ? `Array(${node.length})` : `Object(${Object.keys(node).length})`;
    outline.push({
      id,
      level: Math.min(depth + 1, 3),
      text: `${label} · ${suffix}`
    });
    count += 1;

    if (Array.isArray(node)) {
      node.slice(0, 20).forEach((child, index) => {
        walk(child, `[${index}]`, [...path, String(index)], depth + 1);
      });
      return;
    }

    Object.entries(node)
      .slice(0, 40)
      .forEach(([key, child]) => {
        walk(child, key, [...path, key], depth + 1);
      });
  }

  walk(value, 'JSON Root', ['root'], 0);

  if (count >= JSON_OUTLINE_MAX_ITEMS) {
    outline.push({
      id: 'json-outline-limited',
      level: 3,
      text: `结构目录已限制为前 ${JSON_OUTLINE_MAX_ITEMS} 项`
    });
  }

  return outline;
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length === 0) {
        inQuotes = true;
      } else {
        field += character;
      }
      continue;
    }

    if (character === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (character === '\r') {
      if (nextCharacter === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    diagnostics.push({
      type: 'error',
      message: 'CSV 语法错误：存在未闭合的双引号字段。'
    });
  }

  if (field.length > 0 || row.length > 0 || source.endsWith(',')) {
    row.push(field);
    rows.push(row);
  }

  return {
    rows: rows.filter((item) => !(item.length === 1 && item[0] === '')),
    diagnostics
  };
}

function buildCsvShapeDiagnostics(rows: string[][]): DocumentDiagnostic[] {
  if (rows.length <= 1) return [];

  const expectedColumns = rows[0].length;
  const diagnostics: DocumentDiagnostic[] = [];

  rows.slice(1).forEach((row, index) => {
    if (diagnostics.length >= 5) return;
    if (row.length !== expectedColumns) {
      diagnostics.push({
        type: 'warning',
        message: `CSV 第 ${index + 2} 行列数为 ${row.length}，与表头 ${expectedColumns} 列不一致。`
      });
    }
  });

  return diagnostics;
}

function buildCsvOutline(headers: string[], rowCount: number, columnCount: number): OutlineItem[] {
  const outline: OutlineItem[] = [
    {
      id: 'csv-summary',
      level: 1,
      text: `CSV · ${Math.max(0, rowCount - 1)} 行 · ${columnCount} 列`
    }
  ];

  headers.slice(0, CSV_OUTLINE_MAX_COLUMNS).forEach((header, index) => {
    outline.push({
      id: `csv-column-${index + 1}-${slugify(header || `column-${index + 1}`)}`,
      level: 2,
      text: header ? `${index + 1}. ${header}` : `${index + 1}. 未命名列`
    });
  });

  return outline;
}

function renderCsvSummary(totalRows: number, dataRows: number, columnCount: number, previewRows: number) {
  const limitedLabel = dataRows > previewRows ? `，当前预览前 ${previewRows} 行` : '';
  return `<section class="data-summary csv-summary"><h1 id="csv-summary">CSV 表格</h1><p>${dataRows} 行数据，${columnCount} 列${limitedLabel}。</p></section>`;
}

function renderCsvTable(headers: string[], rows: string[][], columnCount: number) {
  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headers[index] || `列 ${index + 1}`);
  const thead = normalizedHeaders
    .map((header, index) => `<th id="csv-column-${index + 1}-${slugify(header || `column-${index + 1}`)}">${escapeHtml(header)}</th>`)
    .join('');
  const tbody = rows
    .map((row) => {
      const cells = Array.from({ length: columnCount }, (_, index) => `<td>${escapeHtml(row[index] ?? '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<div class="data-table-scroll"><table class="data-table csv-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

function buildYamlOutline(source: string) {
  const outline: OutlineItem[] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  const usedIds = new Map<string, number>();

  source.split(/\r\n|\r|\n/).forEach((line, index) => {
    if (outline.length >= YAML_OUTLINE_MAX_ITEMS) return;
    if (/^\t+/.test(line)) {
      diagnostics.push({
        type: 'error',
        message: `YAML 第 ${index + 1} 行使用了 Tab 缩进，建议改为空格。`
      });
    }

    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    const indent = line.match(/^ */)?.[0].length ?? 0;
    const listMatch = trimmedLine.match(/^-\s+(.+)$/);
    const keyMatch = (listMatch?.[1] ?? trimmedLine).match(/^(['"]?)([^:'"]+)\1\s*:\s*(.*)$/);

    if (keyMatch) {
      const key = keyMatch[2].trim();
      const value = keyMatch[3].trim();
      const level = Math.min(Math.floor(indent / 2) + 1, 3);
      const id = uniqueId(`yaml-${slugify(`${index + 1}-${key}`)}`, usedIds);
      outline.push({
        id,
        level,
        text: value ? `${key} · ${truncateText(value, 36)}` : key
      });
      return;
    }

    if (listMatch && indent <= 4) {
      const value = listMatch[1].trim();
      outline.push({
        id: uniqueId(`yaml-item-${index + 1}`, usedIds),
        level: Math.min(Math.floor(indent / 2) + 1, 3),
        text: `- ${truncateText(value, 48)}`
      });
    }
  });

  if (outline.length >= YAML_OUTLINE_MAX_ITEMS) {
    diagnostics.push({
      type: 'warning',
      message: `YAML 结构目录已限制为前 ${YAML_OUTLINE_MAX_ITEMS} 项。`
    });
  }

  return { outline, diagnostics };
}

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'node';
}

function uniqueId(baseId: string, usedIds: Map<string, number>) {
  const count = usedIds.get(baseId) ?? 0;
  usedIds.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}-${count + 1}`;
}

function truncateText(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

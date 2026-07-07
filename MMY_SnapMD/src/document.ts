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

type CsvRowInfo = {
  values: string[];
  line: number;
};

type CsvAnalysis = {
  rows: string[][];
  rowInfos: CsvRowInfo[];
  columnCount: number;
  headers: string[];
  diagnostics: DocumentDiagnostic[];
  inconsistentLines: Set<number>;
  namedHeaderCount: number;
  unnamedHeaderIndexes: number[];
  duplicateHeaders: Array<{ name: string; indexes: number[] }>;
};

type YamlAnalysis = {
  outline: OutlineItem[];
  diagnostics: DocumentDiagnostic[];
  warningLines: Set<number>;
  errorLines: Set<number>;
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
  const lines = source.split(/\r\n|\r|\n/);
  const html = lines
    .map(
      (line, index) =>
        `<span id="txt-line-${index + 1}" class="plain-text-line"><span class="plain-text-gutter">${index + 1}</span><span class="plain-text-content">${escapeHtml(line) || '&nbsp;'}</span></span>`
    )
    .join('');

  return {
    html: `<pre class="plain-text-body line-numbered">${html}</pre>`,
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
  const analysis = analyzeCsv(source);
  const rows = analysis.rows;
  const columnCount = analysis.columnCount;
  const headers = analysis.headers;
  const dataRows = rows.slice(1);
  const previewRows = dataRows.slice(0, CSV_PREVIEW_MAX_ROWS);
  const diagnostics = analysis.diagnostics;
  const outline = buildCsvOutline(headers, rows.length, columnCount);

  if (rows.length === 0 || columnCount === 0) {
    return {
      html: '<section class="data-summary"><h1 id="csv-summary">CSV</h1><p>当前 CSV 没有可显示的数据。</p></section>',
      headings: outline,
      diagnostics
    };
  }

  return {
    html: `${renderCsvSummary(analysis, previewRows.length)}${renderCsvTable(headers, previewRows, columnCount)}`,
    headings: outline,
    diagnostics
  };
}

function renderYaml(source: string): DocumentRenderResult {
  const { outline, diagnostics } = analyzeYaml(source);
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
  const analysis = analyzeCsv(source);
  const errorLines = new Set<number>();
  analysis.diagnostics.forEach((diagnostic) => {
    const matchedLine = diagnostic.message.match(/第\s*(\d+)\s*行/);
    if (diagnostic.type === 'error' && matchedLine) {
      errorLines.add(Number(matchedLine[1]));
    }
  });

  return source
    .split(/\r\n|\r|\n/)
    .map((line, index) => {
      const lineNumber = index + 1;
      const classes = [index === 0 ? 'source-line csv-header-line' : 'source-line csv-row-line'];
      if (analysis.inconsistentLines.has(lineNumber)) {
        classes.push('source-line-warning');
      }
      if (errorLines.has(lineNumber)) {
        classes.push('source-line-error');
      }
      return `<span class="${classes.join(' ')}">${escapeHtml(line) || '&nbsp;'}</span>`;
    })
    .join('');
}

function renderYamlSourceHighlight(source: string) {
  const analysis = analyzeYaml(source);
  return source
    .split(/\r\n|\r|\n/)
    .map((line, index) => {
      const classes = ['source-line'];
      const trimmedLine = line.trimStart();
      let highlightedLine = escapeHtml(line);
      const lineNumber = index + 1;

      if (!trimmedLine) {
        highlightedLine = '&nbsp;';
      } else if (trimmedLine.startsWith('#')) {
        classes.push('yaml-comment-line');
      } else if (/^-\s+/.test(trimmedLine)) {
        classes.push('yaml-list-line');
      } else if (/^[^'"#][^:]*:\s*/.test(trimmedLine) || /^['"][^'"]+['"]:\s*/.test(trimmedLine)) {
        classes.push('yaml-key-line');
      }

      if (analysis.warningLines.has(lineNumber)) {
        classes.push('source-line-warning');
      }
      if (analysis.errorLines.has(lineNumber)) {
        classes.push('source-line-error');
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
  const rowInfos: CsvRowInfo[] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let currentLine = 1;
  let rowStartLine = 1;
  let quotedFieldStartLine: number | null = null;

  function pushCurrentRow() {
    rowInfos.push({
      values: row,
      line: rowStartLine
    });
    row = [];
    field = '';
    rowStartLine = currentLine;
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        quotedFieldStartLine = null;
      } else if (character === '\n') {
        field += character;
        currentLine += 1;
      } else if (character === '\r') {
        if (nextCharacter === '\n') {
          field += '\n';
          index += 1;
        } else {
          field += '\n';
        }
        currentLine += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length === 0) {
        inQuotes = true;
        quotedFieldStartLine = currentLine;
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
      pushCurrentRow();
      currentLine += 1;
      rowStartLine = currentLine;
      continue;
    }

    if (character === '\r') {
      if (nextCharacter === '\n') index += 1;
      row.push(field);
      pushCurrentRow();
      currentLine += 1;
      rowStartLine = currentLine;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    diagnostics.push({
      type: 'error',
      message: `CSV 语法错误：第 ${quotedFieldStartLine ?? rowStartLine} 行存在未闭合的双引号字段。`
    });
  }

  if (field.length > 0 || row.length > 0 || source.endsWith(',')) {
    row.push(field);
    rowInfos.push({
      values: row,
      line: rowStartLine
    });
  }

  return {
    rowInfos: rowInfos.filter((item) => !(item.values.length === 1 && item.values[0] === '')),
    diagnostics
  };
}

function analyzeCsv(source: string): CsvAnalysis {
  const parsed = parseCsv(source);
  const rowInfos = parsed.rowInfos;
  const rows = rowInfos.map((item) => item.values);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = rows[0] ?? [];
  const diagnostics = [...parsed.diagnostics];
  const inconsistentLines = new Set<number>();
  const unnamedHeaderIndexes: number[] = [];
  const duplicateHeaders = collectDuplicateHeaders(headers);
  const namedHeaderCount = headers.filter((value) => value.trim().length > 0).length;

  headers.forEach((header, index) => {
    if (!header.trim()) {
      unnamedHeaderIndexes.push(index + 1);
    }
  });

  if (rows.length > 1) {
    const expectedColumns = headers.length;
    const mismatchedRows = rowInfos
      .slice(1)
      .filter((item) => item.values.length !== expectedColumns);

    mismatchedRows.forEach((item) => {
      inconsistentLines.add(item.line);
    });

    if (mismatchedRows.length > 0) {
      const preview = mismatchedRows
        .slice(0, 3)
        .map((item) => `第 ${item.line} 行 ${item.values.length} 列`)
        .join('，');
      const suffix = mismatchedRows.length > 3 ? ` 等 ${mismatchedRows.length} 行` : '';
      diagnostics.push({
        type: 'warning',
        message: `CSV 列数不一致：${preview}${suffix}，表头为 ${expectedColumns} 列。`
      });
    }
  }

  if (unnamedHeaderIndexes.length > 0) {
    const preview = unnamedHeaderIndexes.slice(0, 6).map((index) => `第 ${index} 列`).join('，');
    const suffix = unnamedHeaderIndexes.length > 6 ? ' 等列' : '';
    diagnostics.push({
      type: 'warning',
      message: `CSV 表头存在空列名：${preview}${suffix}。建议补齐首行列名，编辑和导出会更清晰。`
    });
  }

  if (duplicateHeaders.length > 0) {
    const preview = duplicateHeaders
      .slice(0, 3)
      .map((item) => `${item.name}（第 ${item.indexes.join(' / ')} 列）`)
      .join('，');
    const suffix = duplicateHeaders.length > 3 ? ' 等重复列名' : '';
    diagnostics.push({
      type: 'warning',
      message: `CSV 表头存在重复列名：${preview}${suffix}。`
    });
  }

  return {
    rows,
    rowInfos,
    columnCount,
    headers,
    diagnostics,
    inconsistentLines,
    namedHeaderCount,
    unnamedHeaderIndexes,
    duplicateHeaders
  };
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

function renderCsvSummary(analysis: CsvAnalysis, previewRows: number) {
  const totalRows = analysis.rows.length;
  const dataRows = Math.max(0, totalRows - 1);
  const limitedLabel = dataRows > previewRows ? `，当前预览前 ${previewRows} 行` : '';
  const headerSummary =
    analysis.headers.length === 0
      ? '首行暂无可识别表头。'
      : `首行按表头解析，${analysis.namedHeaderCount}/${analysis.columnCount} 列已有名称。`;
  const extraNotes = [
    analysis.unnamedHeaderIndexes.length > 0 ? `${analysis.unnamedHeaderIndexes.length} 列未命名` : '',
    analysis.duplicateHeaders.length > 0 ? `${analysis.duplicateHeaders.length} 组重名表头` : ''
  ]
    .filter(Boolean)
    .join('，');
  const noteLabel = extraNotes ? ` 当前发现：${extraNotes}。` : '';

  return `<section class="data-summary csv-summary"><h1 id="csv-summary">CSV 表格</h1><p>${dataRows} 行数据，${analysis.columnCount} 列${limitedLabel}。</p><p>${headerSummary}${noteLabel}</p></section>`;
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

function analyzeYaml(source: string): YamlAnalysis {
  const outline: OutlineItem[] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  const usedIds = new Map<string, number>();
  const warningLines = new Set<number>();
  const errorLines = new Set<number>();
  let looseIndentWarnings = 0;

  source.split(/\r\n|\r|\n/).forEach((line, index) => {
    if (outline.length >= YAML_OUTLINE_MAX_ITEMS) return;
    const lineNumber = index + 1;
    const indentToken = line.match(/^[\t ]*/)?.[0] ?? '';
    if (indentToken.includes('\t')) {
      diagnostics.push({
        type: 'error',
        message: `YAML 第 ${lineNumber} 行使用了 Tab 缩进，建议改为空格。`
      });
      errorLines.add(lineNumber);
    }

    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent % 2 !== 0 && looseIndentWarnings < 5) {
      diagnostics.push({
        type: 'warning',
        message: `YAML 第 ${lineNumber} 行缩进为 ${indent} 个空格，不是常见的 2 空格层级。`
      });
      warningLines.add(lineNumber);
      looseIndentWarnings += 1;
    }

    const listMatch = trimmedLine.match(/^-\s+(.+)$/);
    const keyMatch = (listMatch?.[1] ?? trimmedLine).match(/^(['"]?)([^:'"]+)\1\s*:\s*(.*)$/);

    if (keyMatch) {
      const key = keyMatch[2].trim();
      const value = keyMatch[3].trim();
      const level = Math.min(Math.floor(indent / 2) + 1, 3);
      const id = uniqueId(`yaml-${slugify(`${lineNumber}-${key}`)}`, usedIds);
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
        id: uniqueId(`yaml-item-${lineNumber}`, usedIds),
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

  return { outline, diagnostics, warningLines, errorLines };
}

function collectDuplicateHeaders(headers: string[]) {
  const positions = new Map<string, number[]>();

  headers.forEach((header, index) => {
    const normalized = header.trim();
    if (!normalized) return;
    positions.set(normalized, [...(positions.get(normalized) ?? []), index + 1]);
  });

  return Array.from(positions.entries())
    .filter(([, indexes]) => indexes.length > 1)
    .map(([name, indexes]) => ({ name, indexes }));
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

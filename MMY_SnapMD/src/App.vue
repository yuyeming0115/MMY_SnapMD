<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  detectDocumentKind,
  documentKindLabel,
  isSupportedDocument,
  renderDocument,
  renderSourceHighlight,
  stripKnownExtension,
  type DocumentKind
} from './document';
import { buildStandaloneHtml } from './markdown';
import sample from '../render-fixtures/basic.md?raw';

type Theme = 'light' | 'dark';
type ViewMode = 'read' | 'edit' | 'split';
type OpenedDocument = {
  path: string;
  name: string;
  content: string;
  baseDir?: string;
  kind?: DocumentKind | string;
  modifiedAtMs?: number | null;
};
type DocumentFileState = {
  modifiedAtMs?: number | null;
};
type SavedImageAsset = {
  path: string;
  name: string;
  relativePath: string;
};
type PhysicalPosition = {
  x: number;
  y: number;
};
type RecentDocument = {
  path: string;
  name: string;
  openedAt: string;
  kind?: DocumentKind;
};

const RECENT_DOCUMENTS_KEY = 'snapmd.recentDocuments';
const CONTENT_FONT_SIZE_KEY = 'snapmd.contentFontSize';
const SIDEBAR_WIDTH_KEY = 'snapmd.sidebarWidth';
const SPLIT_RATIO_KEY = 'snapmd.splitEditorRatio';
const MAX_RECENT_DOCUMENTS = 8;
const FILE_WATCH_INTERVAL_MS = 1600;
const SUPPORTED_DOCUMENT_ACCEPT = '.md,.markdown,.txt,.json,.csv,.yaml,.yml';
const SUPPORTED_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg';
const MIN_CONTENT_FONT_SIZE = 13;
const MAX_CONTENT_FONT_SIZE = 20;
const DEFAULT_CONTENT_FONT_SIZE = 16;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 300;
const META_SINGLE_COLUMN_WIDTH = 270;
const MIN_SPLIT_RATIO = 0.28;
const MAX_SPLIT_RATIO = 0.72;
const DEFAULT_SPLIT_RATIO = 0.5;

type ResizeState =
  | { mode: 'sidebar'; startX: number; startSidebarWidth: number }
  | { mode: 'split'; containerLeft: number; containerWidth: number };

const source = ref(sample);
const savedSource = ref(sample);
const fileName = ref('basic.md');
const filePath = ref('');
const fileBaseDir = ref('');
const fileKind = ref<DocumentKind>('markdown');
const theme = ref<Theme>('dark');
const viewMode = ref<ViewMode>('read');
const isDragging = ref(false);
const isSaving = ref(false);
const isInsertingImage = ref(false);
const lastOpenedAt = ref(new Date());
const lastSavedAt = ref<Date | null>(null);
const openError = ref('');
const saveError = ref('');
const watchError = ref('');
const currentModifiedAtMs = ref<number | null>(null);
const autoReloadedAt = ref<Date | null>(null);
const externalChangeDetected = ref(false);
const externalChangeNoticeDismissed = ref(false);
const contentFontSize = ref(DEFAULT_CONTENT_FONT_SIZE);
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const splitEditorRatio = ref(DEFAULT_SPLIT_RATIO);
const recentDocuments = ref<RecentDocument[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const sourceEditorRef = ref<HTMLTextAreaElement | null>(null);
let unlistenDesktopDrop: (() => void) | undefined;
let removeBrowserDropHandlers: (() => void) | undefined;
let removeBeforeUnloadHandler: (() => void) | undefined;
let removeKeyboardShortcutHandler: (() => void) | undefined;
let resizeState: ResizeState | null = null;
let fileWatchTimer: number | undefined;
let fileWatchRequestId = 0;
let isCheckingFileState = false;
let browserDragDepth = 0;
let desktopDragPaths: string[] = [];

const rendered = computed(() => renderDocument(source.value, fileKind.value, fileBaseDir.value));
const highlightedSource = computed(() => renderSourceHighlight(source.value, fileKind.value));
const wordCount = computed(() => source.value.trim().split(/\s+/).filter(Boolean).length);
const lineCount = computed(() => source.value.split(/\r\n|\r|\n/).length);
const characterCount = computed(() => source.value.length);
const canExport = computed(() => source.value.trim().length > 0);
const canPrint = computed(() => canExport.value && viewMode.value !== 'edit');
const canSave = computed(() => isTauri() && !!filePath.value && isDirty.value && !isSaving.value);
const canFormatJson = computed(() => fileKind.value === 'json' && viewMode.value !== 'read');
const canShowImageInsert = computed(() => fileKind.value === 'markdown' && viewMode.value !== 'read');
const canInsertImageAsset = computed(
  () => canShowImageInsert.value && isTauri() && !!filePath.value && !externalChangeDetected.value && !isInsertingImage.value
);
const currentFileLabel = computed(() => filePath.value || fileName.value);
const currentKindLabel = computed(() => documentKindLabel(fileKind.value));
const exportBaseName = computed(() => stripKnownExtension(fileName.value) || 'snapmd');
const hasRecentDocuments = computed(() => recentDocuments.value.length > 0);
const isDirty = computed(() => source.value !== savedSource.value);
const hasDiagnostics = computed(() => rendered.value.diagnostics.length > 0);
const hasErrorDiagnostics = computed(() => rendered.value.diagnostics.some((diagnostic) => diagnostic.type === 'error'));
const hasWarningDiagnostics = computed(() => rendered.value.diagnostics.some((diagnostic) => diagnostic.type === 'warning'));
const browserImageNotices = computed(() => {
  if (isTauri() || fileKind.value !== 'markdown') return [];

  const imageSources = extractMarkdownImageSources(source.value);
  if (imageSources.length === 0) return [];

  const notices: string[] = [];
  if (imageSources.some(isLocalDiskImagePath)) {
    notices.push('浏览器预览无法读取 E:\\...、\\\\server\\... 或 file:// 这类本地图片路径；请用桌面模式打开，或改为与文档同目录的相对路径。');
  }
  if (!fileBaseDir.value && imageSources.some(isRelativeImagePath)) {
    notices.push('浏览器模式通过“打开”读取单个 Markdown 时拿不到相邻图片目录，普通相对图片可能不可见；桌面模式可按文档所在目录解析。');
  }

  return notices;
});
const hasBrowserImageNotices = computed(() => browserImageNotices.value.length > 0);
const isSidebarNarrow = computed(() => sidebarWidth.value < META_SINGLE_COLUMN_WIDTH);
const tocTitle = computed(() => (fileKind.value === 'json' || fileKind.value === 'yaml' ? '结构' : fileKind.value === 'csv' ? '表格' : '目录'));
const externalChangeMessage = computed(() => {
  if (!externalChangeDetected.value) return '';
  if (isDirty.value) {
    return '检测到外部文件已变更。你当前还有未保存修改：重新载入会丢弃当前编辑，继续保存会覆盖外部版本。';
  }
  return '检测到外部文件已变更，可以重新载入最新内容。';
});
const emptyTocLabel = computed(() => {
  if (fileKind.value === 'json') return hasDiagnostics.value ? 'JSON 解析失败，暂无结构' : '当前 JSON 暂无结构';
  if (fileKind.value === 'yaml') return hasDiagnostics.value ? 'YAML 存在诊断，暂无结构' : '当前 YAML 暂无结构';
  if (fileKind.value === 'csv') return '当前 CSV 暂无表格';
  if (fileKind.value === 'txt') return 'TXT 暂无目录';
  return '当前文档暂无标题';
});
const fileWatchLabel = computed(() => {
  if (externalChangeDetected.value) return '外部已变更';
  if (watchError.value) return watchError.value;
  if (!filePath.value) return '未关联本地路径';
  if (autoReloadedAt.value) return `已刷新 ${autoReloadedAt.value.toLocaleTimeString()}`;
  return '监听中';
});
const fileWatchCompactLabel = computed(() => {
  if (!filePath.value) return '未关联';
  return fileWatchLabel.value;
});
const statusLabel = computed(() => {
  if (saveError.value) return saveError.value;
  if (isSaving.value) return '保存中';
  if (isInsertingImage.value) return '插入图片中';
  if (externalChangeDetected.value) return '外部已变更';
  if (isDirty.value && hasErrorDiagnostics.value) return `未保存 · ${currentKindLabel.value} 语法错误`;
  if (isDirty.value) return '未保存';
  if (hasErrorDiagnostics.value) return `${currentKindLabel.value} 语法错误`;
  if (hasWarningDiagnostics.value) return `${currentKindLabel.value} 有提示`;
  if (lastSavedAt.value) return `已保存 ${lastSavedAt.value.toLocaleTimeString()}`;
  return fileWatchLabel.value;
});
const documentBodyClass = computed(() => [
  'document-body',
  `${fileKind.value}-document-body`
]);
const contentStyle = computed(() => ({
  '--content-font-size': `${contentFontSize.value}px`
}));
const workspaceStyle = computed(() => ({
  '--sidebar-width': `${sidebarWidth.value}px`
}));
const splitSurfaceStyle = computed(() => ({
  '--split-editor-width': `${Math.round(splitEditorRatio.value * 1000) / 10}%`
}));

watch(theme, (value) => {
  document.documentElement.dataset.theme = value;
  localStorage.setItem('snapmd.theme', value);
});

watch(contentFontSize, (value) => {
  localStorage.setItem(CONTENT_FONT_SIZE_KEY, String(value));
});

watch(sidebarWidth, (value) => {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(value));
});

watch(splitEditorRatio, (value) => {
  localStorage.setItem(SPLIT_RATIO_KEY, String(value));
});

onMounted(() => {
  const savedTheme = localStorage.getItem('snapmd.theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme;
  }
  document.documentElement.dataset.theme = theme.value;
  const savedFontSize = Number(localStorage.getItem(CONTENT_FONT_SIZE_KEY));
  if (Number.isFinite(savedFontSize)) {
    contentFontSize.value = clampContentFontSize(savedFontSize);
  }
  const savedSidebarWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (Number.isFinite(savedSidebarWidth)) {
    sidebarWidth.value = clampSidebarWidth(savedSidebarWidth);
  }
  const savedSplitRatio = Number(localStorage.getItem(SPLIT_RATIO_KEY));
  if (Number.isFinite(savedSplitRatio)) {
    splitEditorRatio.value = clampSplitRatio(savedSplitRatio);
  }
  recentDocuments.value = loadRecentDocuments();

  removeBrowserDropHandlers = setupBrowserDropHandlers();
  removeBeforeUnloadHandler = setupBeforeUnloadHandler();
  removeKeyboardShortcutHandler = setupKeyboardShortcutHandler();

  if (isTauri()) {
    void setupDesktopOpenHandlers();
  }
});

onBeforeUnmount(() => {
  unlistenDesktopDrop?.();
  removeBrowserDropHandlers?.();
  removeBeforeUnloadHandler?.();
  removeKeyboardShortcutHandler?.();
  stopResize();
  stopCurrentFileWatcher();
});

async function openFile(file: File) {
  if (!confirmDiscardUnsavedChanges()) return;

  if (!isSupportedDocument(file.name)) {
    showOpenError('仅支持 .md、.markdown、.txt、.json、.csv、.yaml、.yml 文件');
    return;
  }

  const content = await file.text();
  source.value = content;
  savedSource.value = content;
  fileName.value = file.name;
  filePath.value = '';
  fileBaseDir.value = getBrowserFixtureBaseDir(file.name);
  fileKind.value = detectDocumentKind(file.name);
  viewMode.value = 'read';
  currentModifiedAtMs.value = null;
  autoReloadedAt.value = null;
  externalChangeDetected.value = false;
  externalChangeNoticeDismissed.value = false;
  watchError.value = '';
  saveError.value = '';
  lastSavedAt.value = null;
  lastOpenedAt.value = new Date();
  openError.value = '';
  stopCurrentFileWatcher();
}

async function openFilePath(path: string) {
  if (!confirmDiscardUnsavedChanges()) return;

  if (!isSupportedDocument(path)) {
    showOpenError('仅支持 .md、.markdown、.txt、.json、.csv、.yaml、.yml 文件');
    return;
  }

  try {
    const document = await invoke<OpenedDocument>('read_document_file', { path });
    applyOpenedDocument(document);
    rememberRecentDocument(document);
    startCurrentFileWatcher();
  } catch (error) {
    showOpenError(getErrorMessage(error));
  }
}

function applyOpenedDocument(document: OpenedDocument) {
  const kind = normalizeDocumentKind(document.kind, document.name);
  source.value = document.content;
  savedSource.value = document.content;
  fileName.value = document.name;
  filePath.value = document.path;
  fileBaseDir.value = document.baseDir ?? '';
  fileKind.value = kind;
  viewMode.value = 'read';
  currentModifiedAtMs.value = document.modifiedAtMs ?? null;
  autoReloadedAt.value = null;
  externalChangeDetected.value = false;
  externalChangeNoticeDismissed.value = false;
  watchError.value = '';
  saveError.value = '';
  lastSavedAt.value = null;
  lastOpenedAt.value = new Date();
  openError.value = '';
}

function applySavedDocument(document: OpenedDocument) {
  const kind = normalizeDocumentKind(document.kind, document.name);
  source.value = document.content;
  savedSource.value = document.content;
  fileName.value = document.name;
  filePath.value = document.path;
  fileBaseDir.value = document.baseDir ?? '';
  fileKind.value = kind;
  currentModifiedAtMs.value = document.modifiedAtMs ?? null;
  autoReloadedAt.value = null;
  externalChangeDetected.value = false;
  externalChangeNoticeDismissed.value = false;
  watchError.value = '';
  saveError.value = '';
  lastSavedAt.value = new Date();
  openError.value = '';
}

function startCurrentFileWatcher() {
  stopCurrentFileWatcher();

  if (!isTauri() || !filePath.value) return;

  fileWatchRequestId += 1;
  fileWatchTimer = window.setInterval(() => {
    void refreshCurrentFileIfChanged(fileWatchRequestId);
  }, FILE_WATCH_INTERVAL_MS);
}

function stopCurrentFileWatcher() {
  if (fileWatchTimer !== undefined) {
    window.clearInterval(fileWatchTimer);
    fileWatchTimer = undefined;
  }

  fileWatchRequestId += 1;
  watchError.value = '';
}

async function refreshCurrentFileIfChanged(requestId: number) {
  if (!filePath.value || isCheckingFileState) return;

  const watchedPath = filePath.value;
  isCheckingFileState = true;

  try {
    const state = await invoke<DocumentFileState>('document_file_state', { path: watchedPath });
    if (requestId !== fileWatchRequestId || watchedPath !== filePath.value) return;

    const nextModifiedAtMs = state.modifiedAtMs ?? null;
    if (nextModifiedAtMs === null) {
      currentModifiedAtMs.value = null;
      watchError.value = '';
      return;
    }

    if (currentModifiedAtMs.value === null) {
      currentModifiedAtMs.value = nextModifiedAtMs;
      watchError.value = '';
      return;
    }

    if (nextModifiedAtMs !== currentModifiedAtMs.value) {
      if (isDirty.value) {
        currentModifiedAtMs.value = nextModifiedAtMs;
        externalChangeDetected.value = true;
        externalChangeNoticeDismissed.value = false;
        watchError.value = '外部文件已变更';
        return;
      }

      const document = await invoke<OpenedDocument>('read_document_file', { path: watchedPath });
      if (requestId !== fileWatchRequestId || watchedPath !== filePath.value) return;

      applyOpenedDocument(document);
      autoReloadedAt.value = new Date();
    }

    watchError.value = '';
  } catch (error) {
    if (requestId === fileWatchRequestId && watchedPath === filePath.value) {
      watchError.value = `自动刷新失败：${getErrorMessage(error)}`;
    }
  } finally {
    isCheckingFileState = false;
  }
}

async function saveCurrentDocument(options?: { skipExternalConfirm?: boolean; skipInvalidConfirm?: boolean }) {
  if (!isDirty.value) return;

  if (!filePath.value || !isTauri()) {
    showOpenError('当前环境暂不支持写回本地文件');
    return;
  }

  if (externalChangeDetected.value && !options?.skipExternalConfirm) {
    const shouldOverwrite = window.confirm('当前文件在外部已变更。继续保存会覆盖外部修改，确定保存吗？');
    if (!shouldOverwrite) return;
  }

  if (hasErrorDiagnostics.value && !options?.skipInvalidConfirm) {
    const shouldSaveInvalidDocument = window.confirm(`当前 ${currentKindLabel.value} 存在语法错误，仍然保存吗？`);
    if (!shouldSaveInvalidDocument) return;
  }

  isSaving.value = true;
  saveError.value = '';

  try {
    const document = await invoke<OpenedDocument>('save_document_file', {
      path: filePath.value,
      content: source.value
    });
    applySavedDocument(document);
  } catch (error) {
    saveError.value = `保存失败：${getErrorMessage(error)}`;
  } finally {
    isSaving.value = false;
  }
}

function handleSaveButtonClick() {
  void saveCurrentDocument();
}

async function reloadCurrentDocumentFromDisk() {
  if (!filePath.value || !isTauri()) {
    showOpenError('当前环境暂不支持重新载入本地文件');
    return;
  }

  if (isDirty.value) {
    const shouldReload = window.confirm('重新载入会丢弃当前未保存修改，确定继续吗？');
    if (!shouldReload) return;
  }

  try {
    const previousViewMode = viewMode.value;
    const document = await invoke<OpenedDocument>('read_document_file', { path: filePath.value });
    applyOpenedDocument(document);
    viewMode.value = previousViewMode;
    autoReloadedAt.value = new Date();
  } catch (error) {
    showOpenError(`重新载入失败：${getErrorMessage(error)}`);
  }
}

function dismissExternalChangeNotice() {
  externalChangeNoticeDismissed.value = true;
}

function loadRecentDocuments() {
  try {
    const rawValue = localStorage.getItem(RECENT_DOCUMENTS_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .filter(isRecentDocument)
      .filter((document) => isSupportedDocument(document.path))
      .slice(0, MAX_RECENT_DOCUMENTS);
  } catch {
    return [];
  }
}

function rememberRecentDocument(document: OpenedDocument) {
  const openedAt = new Date().toISOString();
  const nextDocuments = [
    {
      path: document.path,
      name: document.name,
      openedAt,
      kind: normalizeDocumentKind(document.kind, document.name)
    },
    ...recentDocuments.value.filter((item) => item.path !== document.path)
  ].slice(0, MAX_RECENT_DOCUMENTS);

  recentDocuments.value = nextDocuments;
  saveRecentDocuments(nextDocuments);
}

function removeRecentDocument(path: string) {
  const nextDocuments = recentDocuments.value.filter((document) => document.path !== path);
  recentDocuments.value = nextDocuments;
  saveRecentDocuments(nextDocuments);
}

function clearRecentDocuments() {
  recentDocuments.value = [];
  localStorage.removeItem(RECENT_DOCUMENTS_KEY);
}

function saveRecentDocuments(documents: RecentDocument[]) {
  localStorage.setItem(RECENT_DOCUMENTS_KEY, JSON.stringify(documents));
}

function isRecentDocument(value: unknown): value is RecentDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<RecentDocument>;
  return (
    typeof document.path === 'string' &&
    typeof document.name === 'string' &&
    typeof document.openedAt === 'string' &&
    (document.kind === undefined ||
      document.kind === 'markdown' ||
      document.kind === 'txt' ||
      document.kind === 'json' ||
      document.kind === 'csv' ||
      document.kind === 'yaml')
  );
}

function formatRecentTime(openedAt: string) {
  const date = new Date(openedAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function setupDesktopOpenHandlers() {
  try {
    const [launchPaths, webviewApi] = await Promise.all([
      invoke<string[]>('launch_files'),
      import('@tauri-apps/api/webview')
    ]);

    const launchPath = launchPaths.find(isSupportedDocument);
    if (launchPath) {
      await openFilePath(launchPath);
    }

    unlistenDesktopDrop = await webviewApi.getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'enter') {
        desktopDragPaths = event.payload.paths || [];
        isDragging.value = shouldShowDocumentDropMask(desktopDragPaths, event.payload.position);
        return;
      }

      if (event.payload.type === 'over') {
        isDragging.value = shouldShowDocumentDropMask(desktopDragPaths, event.payload.position);
        return;
      }

      if (event.payload.type === 'drop') {
        isDragging.value = false;
        desktopDragPaths = event.payload.paths || desktopDragPaths;
        if (shouldHandleDesktopImageDrop(desktopDragPaths, event.payload.position)) {
          void handleDesktopImageDrop(desktopDragPaths);
        } else {
          openFilePathFromCandidates(desktopDragPaths);
        }
        desktopDragPaths = [];
        return;
      }

      desktopDragPaths = [];
      isDragging.value = false;
    });
  } catch (error) {
    console.error('[SnapMD] Failed to initialize desktop file drop:', error);
    showOpenError(`拖拽初始化失败：${getErrorMessage(error)}`);
  }
}

function setupBrowserDropHandlers() {
  const onDragEnter = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    if (shouldHandleEditorImageTransfer(event)) return;
    browserDragDepth += 1;
    isDragging.value = true;
  };

  const onDragOver = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    if (shouldHandleEditorImageTransfer(event)) return;
    isDragging.value = true;
  };

  const onDragLeave = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    if (shouldHandleEditorImageTransfer(event)) return;
    browserDragDepth = Math.max(0, browserDragDepth - 1);
    if (browserDragDepth === 0) {
      isDragging.value = false;
    }
  };

  const onWindowDrop = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    browserDragDepth = 0;
    if (shouldHandleEditorImageTransfer(event)) {
      void handleEditorImageTransfer(event);
      return;
    }
    onDrop(event);
  };

  window.addEventListener('dragenter', onDragEnter, true);
  window.addEventListener('dragover', onDragOver, true);
  window.addEventListener('dragleave', onDragLeave, true);
  window.addEventListener('drop', onWindowDrop, true);

  return () => {
    window.removeEventListener('dragenter', onDragEnter, true);
    window.removeEventListener('dragover', onDragOver, true);
    window.removeEventListener('dragleave', onDragLeave, true);
    window.removeEventListener('drop', onWindowDrop, true);
  };
}

function setupBeforeUnloadHandler() {
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!isDirty.value) return;

    event.preventDefault();
    event.returnValue = '';
  };

  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}

function setupKeyboardShortcutHandler() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const isCommand = event.ctrlKey || event.metaKey;
    if (!isCommand) return;

    const key = event.key.toLowerCase();
    if (key === 'o') {
      event.preventDefault();
      triggerOpenFile();
      return;
    }

    if (key === 's') {
      event.preventDefault();
      void saveCurrentDocument();
      return;
    }

    if (key === 'e') {
      event.preventDefault();
      toggleEditMode();
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
  };
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void openFile(file);
  }
  input.value = '';
}

function onImageInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void insertImageFile(file);
  }
  input.value = '';
}

function onEditorPaste(event: ClipboardEvent) {
  const file = extractImageFileFromClipboard(event.clipboardData);
  if (!file) return;

  event.preventDefault();
  void insertImageFile(file);
}

function syncEditorScroll(event: Event) {
  const editor = event.currentTarget as HTMLTextAreaElement;
  const highlightLayer = editor.previousElementSibling as HTMLElement | null;
  if (!highlightLayer?.classList.contains('source-highlight')) return;

  highlightLayer.scrollTop = editor.scrollTop;
  highlightLayer.scrollLeft = editor.scrollLeft;
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  browserDragDepth = 0;
  const file = findSupportedFile(event.dataTransfer?.files);
  if (file) {
    void openFile(file);
  } else {
    showOpenError('请拖入 .md、.markdown、.txt、.json、.csv、.yaml 或 .yml 文件');
  }
}

function showOpenError(message: string) {
  openError.value = message;
  window.setTimeout(() => {
    if (openError.value === message) {
      openError.value = '';
    }
  }, 3600);
}

function triggerOpenFile() {
  fileInputRef.value?.click();
}

function triggerInsertImage() {
  if (!canShowImageInsert.value) return;
  if (!isTauri() || !filePath.value) {
    showOpenError('插入图片需要在桌面模式下打开已保存的 Markdown 文件');
    return;
  }
  if (externalChangeDetected.value) {
    showOpenError('当前文件有外部变更，请先处理后再插入图片');
    return;
  }

  imageInputRef.value?.click();
}

async function insertImageFile(file: File) {
  if (!canShowImageInsert.value || isInsertingImage.value) return;
  if (!isSupportedImageFile(file)) {
    showOpenError('仅支持 png、jpg、jpeg、gif、webp、svg 图片');
    return;
  }
  if (!isTauri() || !filePath.value) {
    showOpenError('插入图片需要在桌面模式下打开已保存的 Markdown 文件');
    return;
  }
  if (externalChangeDetected.value) {
    showOpenError('当前文件有外部变更，请先处理后再插入图片');
    return;
  }

  isInsertingImage.value = true;
  saveError.value = '';

  try {
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const asset = await invoke<SavedImageAsset>('save_image_asset', {
      documentPath: filePath.value,
      originalName: file.name,
      bytes
    });

    await insertMarkdownImageAtCursor(asset);
  } catch (error) {
    showOpenError(`插入图片失败：${getErrorMessage(error)}`);
  } finally {
    isInsertingImage.value = false;
  }
}

async function insertImagePath(imagePath: string) {
  if (!canShowImageInsert.value || isInsertingImage.value) return;
  if (!isSupportedImagePath(imagePath)) {
    showOpenError('仅支持 png、jpg、jpeg、gif、webp、svg 图片');
    return;
  }
  if (!isTauri() || !filePath.value) {
    showOpenError('插入图片需要在桌面模式下打开已保存的 Markdown 文件');
    return;
  }
  if (externalChangeDetected.value) {
    showOpenError('当前文件有外部变更，请先处理后再插入图片');
    return;
  }

  isInsertingImage.value = true;
  saveError.value = '';

  try {
    const asset = await invoke<SavedImageAsset>('save_image_asset_from_path', {
      documentPath: filePath.value,
      imagePath
    });

    await insertMarkdownImageAtCursor(asset);
  } catch (error) {
    showOpenError(`插入图片失败：${getErrorMessage(error)}`);
  } finally {
    isInsertingImage.value = false;
  }
}

async function insertMarkdownImageAtCursor(asset: SavedImageAsset) {
  const editor = sourceEditorRef.value;
  const start = editor?.selectionStart ?? source.value.length;
  const end = editor?.selectionEnd ?? start;
  const selectedText = source.value.slice(start, end).trim();
  const altText = sanitizeImageAltText(selectedText || stripImageExtension(asset.name));
  const snippet = `![${altText}](${asset.relativePath})`;
  const insertion = buildBlockInsertion(source.value, start, end, snippet);

  source.value = insertion.value;
  await nextTick();

  const nextEditor = sourceEditorRef.value;
  if (!nextEditor) return;

  nextEditor.focus();
  nextEditor.selectionStart = insertion.cursor;
  nextEditor.selectionEnd = insertion.cursor;
}

function buildBlockInsertion(value: string, start: number, end: number, snippet: string) {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const prefix = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const insertedText = `${prefix}${snippet}${suffix}`;

  return {
    value: `${before}${insertedText}${after}`,
    cursor: before.length + prefix.length + snippet.length
  };
}

function openFilePathFromCandidates(paths: string[]) {
  const path = paths.find(isSupportedDocument);
  if (path) {
    void openFilePath(path);
  } else if (paths.some(isSupportedImagePath)) {
    return;
  } else {
    showOpenError('请拖入 .md、.markdown、.txt、.json、.csv、.yaml 或 .yml 文件');
  }
}

function findSupportedFile(files: FileList | null | undefined) {
  return Array.from(files ?? []).find((file) => isSupportedDocument(file.name));
}

function hasDraggedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function shouldHandleEditorImageTransfer(event: DragEvent) {
  if (!canShowImageInsert.value) return false;
  if (!isEventInsideEditor(event.target)) return false;
  return !!extractImageFileFromFileList(event.dataTransfer?.files);
}

async function handleEditorImageTransfer(event: DragEvent) {
  const file = extractImageFileFromFileList(event.dataTransfer?.files);
  if (!file) return;
  isDragging.value = false;
  browserDragDepth = 0;
  await insertImageFile(file);
}

function shouldHandleDesktopImageDrop(paths: string[], position: PhysicalPosition) {
  if (!canInsertImageAsset.value) return false;
  if (!paths.some(isSupportedImagePath)) return false;
  return isPhysicalPositionInsideEditor(position);
}

async function handleDesktopImageDrop(paths: string[]) {
  const imagePath = paths.find(isSupportedImagePath);
  if (!imagePath) return;
  await insertImagePath(imagePath);
}

function isSupportedImageFile(file: File) {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
}

function isSupportedImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
}

function extractImageFileFromFileList(files: FileList | null | undefined) {
  return Array.from(files ?? []).find(isSupportedImageFile);
}

function extractImageFileFromClipboard(clipboardData: DataTransfer | null | undefined) {
  const clipboardFiles = extractImageFileFromFileList(clipboardData?.files);
  if (clipboardFiles) return clipboardFiles;

  for (const item of Array.from(clipboardData?.items ?? [])) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
}

function isEventInsideEditor(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  const element = target instanceof HTMLElement ? target : target.parentElement;
  return !!element?.closest('.editor-surface');
}

function shouldShowDocumentDropMask(paths: string[], position: PhysicalPosition) {
  if (shouldHandleDesktopImageDrop(paths, position)) return false;
  return paths.some(isSupportedDocument);
}

function isPhysicalPositionInsideEditor(position: PhysicalPosition) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  const scale = window.devicePixelRatio || 1;
  const element = document.elementFromPoint(position.x / scale, position.y / scale);
  return isEventInsideEditor(element);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function extractMarkdownImageSources(markdown: string) {
  const inlineImagePattern = /!\[[^\]]*]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
  return Array.from(markdown.matchAll(inlineImagePattern))
    .map((match) => match[1]?.trim().replace(/^<|>$/g, '') ?? '')
    .filter(Boolean);
}

function isLocalDiskImagePath(src: string) {
  return /^[a-zA-Z]:[\\/]/.test(src) || /^\\\\/.test(src) || /^file:/i.test(src);
}

function isRelativeImagePath(src: string) {
  if (isLocalDiskImagePath(src)) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(src);
}

function stripImageExtension(name: string) {
  return name.replace(/\.(png|jpe?g|gif|webp|svg)$/i, '');
}

function sanitizeImageAltText(value: string) {
  return value.replace(/[\r\n[\]]+/g, ' ').trim() || 'image';
}

function normalizeDocumentKind(kind: OpenedDocument['kind'], path: string): DocumentKind {
  if (kind === 'markdown' || kind === 'txt' || kind === 'json' || kind === 'csv' || kind === 'yaml') return kind;
  return detectDocumentKind(path);
}

function confirmDiscardUnsavedChanges() {
  if (!isDirty.value) return true;
  return window.confirm('当前文档有未保存修改，继续会丢弃修改。确定继续吗？');
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
}

function toggleEditMode() {
  viewMode.value = viewMode.value === 'edit' ? 'read' : 'edit';
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
}

function decreaseContentFontSize() {
  contentFontSize.value = clampContentFontSize(contentFontSize.value - 1);
}

function increaseContentFontSize() {
  contentFontSize.value = clampContentFontSize(contentFontSize.value + 1);
}

function clampContentFontSize(value: number) {
  return Math.min(MAX_CONTENT_FONT_SIZE, Math.max(MIN_CONTENT_FONT_SIZE, Math.round(value)));
}

function startSidebarResize(event: PointerEvent) {
  if (window.innerWidth <= 860) return;
  event.preventDefault();
  resizeState = {
    mode: 'sidebar',
    startX: event.clientX,
    startSidebarWidth: sidebarWidth.value
  };
  startResizeListeners();
}

function startSplitResize(event: PointerEvent) {
  const splitSurface = (event.currentTarget as HTMLElement).closest('.split-surface');
  const rect = splitSurface?.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;

  event.preventDefault();
  resizeState = {
    mode: 'split',
    containerLeft: rect.left,
    containerWidth: rect.width
  };
  startResizeListeners();
}

function startResizeListeners() {
  document.body.classList.add('is-resizing-layout');
  window.addEventListener('pointermove', onResizePointerMove);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
}

function onResizePointerMove(event: PointerEvent) {
  if (!resizeState) return;

  if (resizeState.mode === 'sidebar') {
    const nextWidth = resizeState.startSidebarWidth + event.clientX - resizeState.startX;
    sidebarWidth.value = clampSidebarWidth(nextWidth);
    return;
  }

  const nextRatio = (event.clientX - resizeState.containerLeft) / resizeState.containerWidth;
  splitEditorRatio.value = clampSplitRatio(nextRatio);
}

function stopResize() {
  if (!resizeState) return;

  resizeState = null;
  document.body.classList.remove('is-resizing-layout');
  window.removeEventListener('pointermove', onResizePointerMove);
  window.removeEventListener('pointerup', stopResize);
  window.removeEventListener('pointercancel', stopResize);
}

function clampSidebarWidth(value: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
}

function clampSplitRatio(value: number) {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

function getBrowserFixtureBaseDir(name: string) {
  if (isTauri()) return '';
  if (name === 'image-gallery.md' || name === 'image-relative-path.md') {
    return '/render-fixtures';
  }
  return '';
}

function formatJsonSource() {
  if (!canFormatJson.value) return;

  let formattedJson = '';
  try {
    formattedJson = JSON.stringify(JSON.parse(source.value), null, 2);
  } catch (error) {
    showOpenError(`JSON 语法错误，无法格式化：${getErrorMessage(error)}`);
    return;
  }

  if (formattedJson === source.value) return;
  const shouldFormat = window.confirm('格式化 JSON 会改写当前编辑区的缩进和换行。确定继续吗？');
  if (!shouldFormat) return;

  source.value = formattedJson;
}

function printPdf() {
  if (!canPrint.value) return;
  const previousTitle = document.title;
  const restoreTitle = () => {
    document.title = previousTitle;
  };

  document.title = exportBaseName.value;
  window.addEventListener('afterprint', restoreTitle, { once: true });
  window.print();
  window.setTimeout(restoreTitle, 1200);
}

function exportHtml() {
  if (!canExport.value) return;

  const html = buildStandaloneHtml(exportBaseName.value, rendered.value.html, theme.value);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${exportBaseName.value}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main
    class="app-shell"
    :class="{ 'is-dragging': isDragging }"
  >
    <header class="topbar">
      <div class="brand compact-brand">
        <div class="brand-mark">S</div>
        <div>
          <h1>SnapMD 闪阅</h1>
          <p :title="currentFileLabel">{{ fileName }} · {{ currentKindLabel }}</p>
        </div>
      </div>

      <div class="topbar-actions" aria-label="文档操作">
        <label class="tool-button primary-tool">
          <input ref="fileInputRef" type="file" :accept="SUPPORTED_DOCUMENT_ACCEPT" @change="onFileInput" />
          打开
        </label>
        <button type="button" class="tool-button" :disabled="!canSave" @click="handleSaveButtonClick">
          保存
        </button>
      </div>

      <div class="segmented-control" aria-label="视图模式">
        <button type="button" :class="{ 'is-active': viewMode === 'read' }" @click="setViewMode('read')">
          阅读
        </button>
        <button type="button" :class="{ 'is-active': viewMode === 'edit' }" @click="setViewMode('edit')">
          编辑
        </button>
        <button type="button" :class="{ 'is-active': viewMode === 'split' }" @click="setViewMode('split')">
          分屏
        </button>
      </div>

      <div class="topbar-actions" aria-label="导出与外观">
        <button
          v-if="canShowImageInsert"
          type="button"
          class="tool-button"
          :disabled="!canInsertImageAsset"
          :title="canInsertImageAsset ? '选择图片并插入到光标位置' : '请先在桌面模式打开已保存 Markdown 文件，并处理外部变更'"
          @click="triggerInsertImage"
        >
          图片
        </button>
        <input
          ref="imageInputRef"
          hidden
          type="file"
          :accept="SUPPORTED_IMAGE_ACCEPT"
          @change="onImageInput"
        />
        <button v-if="fileKind === 'json'" type="button" class="tool-button" :disabled="!canFormatJson" @click="formatJsonSource">
          格式化
        </button>
        <button
          type="button"
          class="tool-button compact-tool"
          :disabled="contentFontSize <= MIN_CONTENT_FONT_SIZE"
          :title="`当前字号 ${contentFontSize}px`"
          @click="decreaseContentFontSize"
        >
          A-
        </button>
        <button
          type="button"
          class="tool-button compact-tool"
          :disabled="contentFontSize >= MAX_CONTENT_FONT_SIZE"
          :title="`当前字号 ${contentFontSize}px`"
          @click="increaseContentFontSize"
        >
          A+
        </button>
        <button type="button" class="tool-button" @click="toggleTheme">
          {{ theme === 'dark' ? '亮色' : '暗色' }}
        </button>
        <button type="button" class="tool-button" :disabled="!canPrint" @click="printPdf">PDF</button>
        <button type="button" class="tool-button" :disabled="!canExport" @click="exportHtml">HTML</button>
      </div>

      <div
        class="topbar-status"
        :class="{
          'is-warning': isDirty || externalChangeDetected || hasWarningDiagnostics,
          'is-danger': !!saveError || hasErrorDiagnostics
        }"
        :title="statusLabel"
      >
        {{ statusLabel }}
      </div>
    </header>

    <div class="workspace-shell" :style="workspaceStyle">
      <aside class="sidebar">
        <nav class="toc" :aria-label="tocTitle">
          <h2>{{ tocTitle }}</h2>
          <a
            v-for="heading in rendered.headings"
            :key="heading.id"
            :class="`level-${heading.level}`"
            :href="`#${heading.id}`"
          >
            {{ heading.text }}
          </a>
          <p v-if="rendered.headings.length === 0">{{ emptyTocLabel }}</p>
        </nav>

        <section class="recent-panel" aria-label="最近打开">
          <div class="panel-heading">
            <h2>最近打开</h2>
            <button
              v-if="hasRecentDocuments"
              type="button"
              @click="clearRecentDocuments"
            >
              清空
            </button>
          </div>
          <div v-if="hasRecentDocuments" class="recent-list">
            <div
              v-for="document in recentDocuments"
              :key="document.path"
              class="recent-item"
              :class="{ 'is-current': document.path === filePath }"
            >
              <button
                type="button"
                class="recent-open"
                :title="document.path"
                @click="openFilePath(document.path)"
              >
                <span>{{ document.name }}</span>
                <small>{{ formatRecentTime(document.openedAt) }}</small>
              </button>
              <button
                type="button"
                class="recent-remove"
                :aria-label="`移除 ${document.name}`"
                @click="removeRecentDocument(document.path)"
              >
                ×
              </button>
            </div>
          </div>
          <p v-else>暂无记录</p>
        </section>

        <section class="meta-panel" :class="{ 'is-single-column': isSidebarNarrow }" aria-label="文档信息">
          <div>
            <span>文件</span>
            <strong :title="currentFileLabel">{{ currentFileLabel }}</strong>
          </div>
          <div>
            <span>类型</span>
            <strong>{{ currentKindLabel }}</strong>
          </div>
          <div>
            <span>行数</span>
            <strong>{{ lineCount }}</strong>
          </div>
          <div>
            <span>字符</span>
            <strong>{{ characterCount }}</strong>
          </div>
          <div>
            <span>词数</span>
            <strong>{{ wordCount }}</strong>
          </div>
          <div>
            <span>打开</span>
            <strong>{{ lastOpenedAt.toLocaleTimeString() }}</strong>
          </div>
          <div>
            <span>监听</span>
            <strong :title="fileWatchLabel">{{ fileWatchCompactLabel }}</strong>
          </div>
        </section>

        <p v-if="openError" class="open-error" role="status">{{ openError }}</p>
      </aside>

      <button
        type="button"
        class="workspace-resize-handle"
        aria-label="调整侧栏宽度"
        title="拖拽调整侧栏宽度"
        @pointerdown="startSidebarResize"
      ></button>

      <section
        class="content-pane"
        :class="{
          'is-edit-mode': viewMode === 'edit',
          'is-split-mode': viewMode === 'split'
        }"
        :style="contentStyle"
        aria-label="文档内容"
      >
        <div v-if="hasBrowserImageNotices" class="diagnostic-banner image-path-banner" role="status">
          <p v-for="notice in browserImageNotices" :key="notice">
            {{ notice }}
          </p>
        </div>

        <div v-if="saveError" class="action-banner is-danger" role="status">
          <div class="action-banner-copy">
            <strong>保存失败</strong>
            <p>{{ saveError }}</p>
          </div>
          <div class="action-banner-actions">
            <button type="button" class="tool-button" :disabled="isSaving || !canSave" @click="saveCurrentDocument({ skipExternalConfirm: true })">
              重试保存
            </button>
          </div>
        </div>

        <div v-if="externalChangeDetected && !externalChangeNoticeDismissed" class="action-banner is-warning" role="status">
          <div class="action-banner-copy">
            <strong>检测到外部变更</strong>
            <p>{{ externalChangeMessage }}</p>
          </div>
          <div class="action-banner-actions">
            <button type="button" class="tool-button" @click="reloadCurrentDocumentFromDisk">
              重新载入
            </button>
            <button
              v-if="isDirty"
              type="button"
              class="tool-button"
              :disabled="isSaving"
              @click="saveCurrentDocument({ skipExternalConfirm: true })"
            >
              覆盖保存
            </button>
            <button type="button" class="tool-button" @click="dismissExternalChangeNotice">
              稍后处理
            </button>
          </div>
        </div>

        <div v-if="hasDiagnostics" class="diagnostic-banner" role="status">
          <p v-for="diagnostic in rendered.diagnostics" :key="diagnostic.message">
            {{ diagnostic.message }}
          </p>
        </div>

        <div v-if="viewMode === 'read'" class="document-surface">
          <article :class="documentBodyClass" v-html="rendered.html"></article>
        </div>

        <div v-else-if="viewMode === 'edit'" class="editor-surface">
          <pre class="source-highlight" aria-hidden="true" v-html="highlightedSource"></pre>
          <textarea
            ref="sourceEditorRef"
            v-model="source"
            class="source-editor"
            :spellcheck="fileKind === 'txt'"
            :aria-label="`${currentKindLabel} 源文本编辑器`"
            @scroll="syncEditorScroll"
            @dragover.prevent
            @paste="onEditorPaste"
          ></textarea>
        </div>

        <div v-else class="split-surface" :style="splitSurfaceStyle">
          <div class="editor-surface split-editor">
            <pre class="source-highlight" aria-hidden="true" v-html="highlightedSource"></pre>
            <textarea
              ref="sourceEditorRef"
              v-model="source"
              class="source-editor"
              :spellcheck="fileKind === 'txt'"
              :aria-label="`${currentKindLabel} 源文本编辑器`"
              @scroll="syncEditorScroll"
              @dragover.prevent
              @paste="onEditorPaste"
            ></textarea>
          </div>
          <button
            type="button"
            class="split-resize-handle"
            aria-label="调整分屏宽度"
            title="拖拽调整编辑和预览宽度"
            @pointerdown="startSplitResize"
          ></button>
          <div class="document-surface split-preview">
            <article :class="documentBodyClass" v-html="rendered.html"></article>
          </div>
        </div>
      </section>
    </div>

    <div class="drop-mask">
      <div>松开以打开文档</div>
    </div>
  </main>
</template>

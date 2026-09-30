/**
 * OfficeWorkspace — 試算表 + 文檔的整合工作區。
 *
 * 使用者看到的：分頁（表格 / 文檔）→ 自訂工具列 → Univer 編輯區 → 狀態列
 *
 * 內部重點：
 *  1. 兩種編輯器各自一個 Univer 實例，第一次切到該分頁才建立（lazy），
 *     之後用 hidden 切換而不銷毀，保留 undo 歷史與選取狀態。
 *  2. Univer 的容器 div 由 Univer 完全接管，React 不在裡面放任何子節點，
 *     否則 Univer 設定 innerHTML 時會和 React 的 reconciliation 打架。
 *     載入中的提示放在容器外面，用絕對定位疊上去。
 *  3. 外掛選單的動作一律讀 ref，避免選單安裝當下的 state 被永久鎖住（stale closure）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandType } from '@univerjs/presets';
import { createDocsInstance, createSheetsInstance, type OfficeInstance } from './univer-factory';
import { installOfficeMenus } from './menus';
import { DOC_TEMPLATES, SHEET_TEMPLATES, insertSheetFromTemplate, findDocTemplate, type FacadeLike } from './templates';
import * as io from './io';
import { TemplateMenu } from './components/TemplateMenu';
import { AUTOSAVE_INTERVAL_MS } from './constants';
import type {
  DocumentKind,
  OfficeDocumentDetail,
  OfficeDocumentMeta,
  OfficeDocumentVersion,
  OfficeKitHandlers,
  SavePayload,
  TemplateContext,
} from './types';
import './styles.css';

export interface OfficeWorkspaceProps {
  defaultKind?: DocumentKind;
  initialDocument?: OfficeDocumentDetail | null;
  handlers?: OfficeKitHandlers;
  templateContext?: TemplateContext;
  readOnly?: boolean;
  className?: string;
  onDocumentChange?: (info: { id?: string; title: string; kind: DocumentKind }) => void;
}

type Notice = { type: 'info' | 'error' | 'warn'; text: string } | null;

const KIND_LABEL: Record<DocumentKind, string> = { sheet: '表格', doc: '文檔' };

export function OfficeWorkspace({
  defaultKind = 'sheet',
  initialDocument = null,
  handlers,
  templateContext,
  readOnly = false,
  className,
  onDocumentChange,
}: OfficeWorkspaceProps) {
  /* ---------------- state ---------------- */
  const [kind, setKind] = useState<DocumentKind>(initialDocument?.kind ?? defaultKind);
  const [documentId, setDocumentId] = useState<string | undefined>(initialDocument?.id);
  const [title, setTitle] = useState(
    initialDocument?.title ?? (defaultKind === 'sheet' ? '未命名試算表' : '未命名文件'),
  );
  const [templateKey, setTemplateKey] = useState<string | null>(initialDocument?.templateKey ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialDocument?.updatedAt ?? null);
  const [versions, setVersions] = useState<OfficeDocumentVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [documents, setDocuments] = useState<OfficeDocumentMeta[]>([]);
  const [instancesReady, setInstancesReady] = useState({ sheet: false, doc: false });

  /* ---------------- refs ---------------- */
  const sheetHostRef = useRef<HTMLDivElement>(null);
  const docHostRef = useRef<HTMLDivElement>(null);
  const sheetInstanceRef = useRef<OfficeInstance | null>(null);
  const docInstanceRef = useRef<OfficeInstance | null>(null);
  const initialDocumentRef = useRef(initialDocument);
  const mountedRef = useRef(true);
  const saveRef = useRef<(asNewVersion: boolean) => Promise<void>>(async () => {});

  /**
   * handlers 用 ref 保存。
   * 呼叫端常常是 inline 物件（每次 render 都是新的），如果把它放進 useCallback 的
   * 依賴陣列，refreshDocuments 會每次 render 都變，然後觸發 effect 再抓一次 → 無限迴圈。
   */
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const notify = useCallback((next: Notice) => {
    setNotice(next);
    if (next?.type === 'error') console.error('[office-kit]', next.text);
  }, []);

  const run = useCallback(
    async (label: string, fn: () => void | Promise<void>) => {
      setBusy(label);
      try {
        await fn();
      } catch (err) {
        notify({ type: 'error', text: `${label}失敗：${err instanceof Error ? err.message : String(err)}` });
      } finally {
        if (mountedRef.current) setBusy(null);
      }
    },
    [notify],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getInstance = useCallback(
    (targetKind: DocumentKind) => (targetKind === 'sheet' ? sheetInstanceRef.current : docInstanceRef.current),
    [],
  );

  const getUnit = useCallback(
    (targetKind: DocumentKind) => {
      const inst = getInstance(targetKind);
      if (!inst) return null;
      return targetKind === 'sheet' ? inst.univerAPI.getActiveWorkbook() : inst.univerAPI.getActiveDocument();
    },
    [getInstance],
  );

  const canSave = Boolean(handlers?.saveDocument || handlers?.saveVersion) && !readOnly;

  /* ---------------- 存檔（先定義，外掛選單透過 ref 呼叫） ---------------- */

  const handleSave = useCallback(
    async (asNewVersion: boolean) => {
      const h = handlersRef.current;
      const handler = asNewVersion ? h?.saveVersion : h?.saveDocument;
      if (!handler) {
        notify({ type: 'warn', text: '尚未連接後端存檔功能，請先用「⬇ 備份」下載 JSON 保存。' });
        return;
      }
      const unit = getUnit(kind);
      if (!unit) {
        notify({ type: 'warn', text: '目前沒有開啟的內容。' });
        return;
      }

      const payload: SavePayload = {
        id: documentId,
        title: title.trim() || '未命名',
        kind,
        templateKey,
        content: io.snapshotToJson(unit),
        note: asNewVersion ? `於 ${new Date().toLocaleString('zh-TW')} 手動建立` : undefined,
      };

      const meta = await handler(payload);
      if (!mountedRef.current) return;

      setDocumentId(meta.id);
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
      notify({ type: 'info', text: asNewVersion ? `已建立新版本 v${meta.currentVersion}` : '已存檔' });

      const listVersions = handlersRef.current?.listVersions;
      if (listVersions) {
        const list = await listVersions(meta.id).catch(() => [] as OfficeDocumentVersion[]);
        if (mountedRef.current) setVersions(list);
      }
    },
    [getUnit, documentId, title, kind, templateKey, notify],
  );

  saveRef.current = handleSave;

  /* ---------------- 外掛選單 ---------------- */

  const installMenus = useCallback(
    (api: unknown, targetKind: DocumentKind) => {
      installOfficeMenus(api, {
        title: 'ろかいずみ Office',
        separatorsBefore: [`office.save-as-version.${targetKind}`],
        onError: (err) => notify({ type: 'error', text: err instanceof Error ? err.message : String(err) }),
        actions: [
          {
            id: `office.download-backup.${targetKind}`,
            title: '下載備份檔（JSON，可完整還原）',
            run: () => {
              const unit = getUnit(targetKind);
              if (!unit) throw new Error('目前沒有開啟的內容');
              io.exportSnapshotAsJson(unit, title);
            },
          },
          {
            id: `office.save.${targetKind}`,
            title: '存檔',
            isEnabled: () => canSave,
            run: () => saveRef.current(false),
          },
          {
            id: `office.save-as-version.${targetKind}`,
            title: '另存為新版本',
            isEnabled: () => canSave,
            run: () => saveRef.current(true),
          },
        ],
      });
    },
    [canSave, getUnit, notify, title],
  );

  /* ---------------- 建立實例 ---------------- */

  const ensureInstance = useCallback(
    (targetKind: DocumentKind): OfficeInstance | null => {
      const existing = targetKind === 'sheet' ? sheetInstanceRef.current : docInstanceRef.current;
      if (existing) return existing;

      const host = targetKind === 'sheet' ? sheetHostRef.current : docHostRef.current;
      if (!host) return null;

      host.innerHTML = '';
      const inst = targetKind === 'sheet' ? createSheetsInstance(host) : createDocsInstance(host);
      const initial = initialDocumentRef.current;
      const snapshot = initial && initial.kind === targetKind ? initial.content : null;

      try {
        if (targetKind === 'sheet') inst.univerAPI.createWorkbook((snapshot as object) ?? { name: title });
        else inst.univerAPI.createDocument((snapshot as object) ?? { title });
      } catch (err) {
        console.warn('[office-kit] 快照載入失敗，改用空白內容', err);
        notify({ type: 'warn', text: '這份存檔的格式無法載入（可能來自舊版），已用空白內容開啟。' });
        if (targetKind === 'sheet') inst.univerAPI.createWorkbook({ name: title });
        else inst.univerAPI.createDocument({ title });
      }

      if (targetKind === 'sheet') sheetInstanceRef.current = inst;
      else docInstanceRef.current = inst;

      installMenus(inst.univerAPI, targetKind);
      // 快照只用一次，避免之後換文件又被套用
      initialDocumentRef.current = null;

      setInstancesReady((prev) => (prev[targetKind] ? prev : { ...prev, [targetKind]: true }));
      return inst;
    },
    [installMenus, notify, title],
  );

  useEffect(() => {
    ensureInstance(kind);
  }, [kind, ensureInstance]);

  useEffect(
    () => () => {
      sheetInstanceRef.current?.dispose();
      docInstanceRef.current?.dispose();
      sheetInstanceRef.current = null;
      docInstanceRef.current = null;
    },
    [],
  );

  useEffect(() => {
    onDocumentChange?.({ id: documentId, title, kind });
  }, [documentId, title, kind, onDocumentChange]);

  /* ---------------- 變更追蹤 ---------------- */

  useEffect(() => {
    if (!instancesReady[kind]) return;
    const unit = getUnit(kind);
    const disposable = unit?.onCommandExecuted?.((command: { type?: number }) => {
      if (command?.type === CommandType.MUTATION) setDirty(true);
    });

    // 文檔的 Facade 沒有 onCommandExecuted，改用輸入事件判斷
    const host = kind === 'sheet' ? sheetHostRef.current : docHostRef.current;
    const markDirty = () => setDirty(true);
    if (kind === 'doc' && host) {
      host.addEventListener('keydown', markDirty);
      host.addEventListener('paste', markDirty);
      host.addEventListener('cut', markDirty);
    }

    return () => {
      try {
        disposable?.dispose?.();
      } catch {
        /* 已釋放 */
      }
      if (kind === 'doc' && host) {
        host.removeEventListener('keydown', markDirty);
        host.removeEventListener('paste', markDirty);
        host.removeEventListener('cut', markDirty);
      }
    };
  }, [instancesReady, kind, getUnit]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!canSave) return;
    const timer = setInterval(() => {
      if (dirty && mountedRef.current) void saveRef.current(false);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [canSave, dirty]);

  /* ---------------- 單位替換（開啟其他文件 / 套範本 / 開新檔） ---------------- */

  const replaceUnit = useCallback(
    (targetKind: DocumentKind, create: (api: any) => void) => {
      const inst = ensureInstance(targetKind);
      if (!inst) throw new Error('編輯器尚未就緒');

      const current = targetKind === 'sheet' ? inst.univerAPI.getActiveWorkbook() : inst.univerAPI.getActiveDocument();
      const currentId = current?.getId?.();
      if (currentId) {
        try {
          inst.univerAPI.disposeUnit(currentId);
        } catch {
          /* 已經不存在 */
        }
      }
      create(inst.univerAPI);
    },
    [ensureInstance],
  );

  /* ---------------- 範本 ---------------- */

  const applyTemplate = useCallback(
    async (key: string) => {
      if (kind === 'sheet') {
        const tpl = SHEET_TEMPLATES.find((t) => t.key === key);
        if (!tpl) throw new Error('找不到這個範本');
        const api = getInstance('sheet')?.univerAPI as unknown as FacadeLike | undefined;
        if (!api) throw new Error('編輯器尚未就緒');

        const result = insertSheetFromTemplate(api, tpl, templateContext ?? undefined);
        setTemplateKey(key);
        setDirty(true);
        notify({
          type: 'info',
          text: `已插入範本「${tpl.name}」${result ? `（新增工作表：${result.sheetName}）` : ''}`,
        });
        return;
      }

      const tpl = findDocTemplate(key);
      if (!tpl) throw new Error('找不到這個範本');

      replaceUnit('doc', (api: any) => {
        api.createDocument({ title: tpl.name });
        const doc = api.getActiveDocument();
        if (!doc) throw new Error('無法建立文件');
        tpl.build(templateContext ?? undefined).forEach((text: string) => doc.appendParagraph(text));
        const paragraphs = doc.getParagraphs?.() ?? [];
        (tpl.centeredIndexes ?? []).forEach((index: number) => {
          try {
            paragraphs[index]?.setStyle?.({ horizontalAlign: 1 });
          } catch {
            /* 樣式非必要 */
          }
        });
      });

      setTemplateKey(key);
      setTitle(tpl.name);
      setDirty(true);
      notify({ type: 'info', text: `已套用範本「${tpl.name}」` });
    },
    [kind, getInstance, templateContext, notify, replaceUnit],
  );

  /* ---------------- 匯入 / 匯出 ---------------- */

  const handleImport = useCallback(async () => {
    if (kind === 'sheet') {
      const wb = getUnit('sheet');
      if (!wb) throw new Error('編輯器尚未就緒');

      const result = await io.importXlsxIntoWorkbook(wb, { replaceActiveSheet: false });
      if (result) {
        setDirty(true);
        notify({
          type: 'info',
          text: `已從 ${result.source} 匯入 ${result.sheets.length} 張工作表、共 ${result.totalRows} 列`,
        });
        return;
      }

      const csv = await io.importCsvIntoSheet(wb.getActiveSheet());
      if (csv) {
        setDirty(true);
        notify({ type: 'info', text: `已從 ${csv.source} 匯入 ${csv.rows} 列到目前工作表` });
      }
      return;
    }

    const doc = getUnit('doc');
    if (!doc) throw new Error('編輯器尚未就緒');
    const result = await io.importDocxIntoDocument(doc);
    if (result) {
      setDirty(true);
      notify({
        type: 'info',
        text: `已從 ${result.source} 匯入 ${result.paragraphs} 段文字（僅還原文字，圖片與字型不支援）`,
      });
    }
  }, [kind, getUnit, notify]);

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx' | 'docx' | 'txt' | 'json') => {
      const unit = getUnit(kind);
      if (!unit) throw new Error('目前沒有開啟的內容');

      if (format === 'json') {
        // 快照存的是整個活頁簿 / 整份文件
        io.exportSnapshotAsJson(unit, title);
      } else if (kind === 'sheet') {
        // CSV / Excel 匯出的對象是「目前作用中的工作表」，不是活頁簿
        const sheet = unit.getActiveSheet?.();
        if (!sheet) throw new Error('目前沒有作用中的工作表');
        if (format === 'csv') io.exportSheetAsCsv(sheet, title);
        else if (format === 'xlsx') await io.exportSheetAsXlsx(sheet, title);
        else throw new Error('表格不支援這個格式');
      } else if (format === 'docx') await io.exportDocumentAsDocx(unit, title);
      else if (format === 'txt') await io.exportDocumentAsText(unit, title);
      else throw new Error('文檔不支援這個格式');

      notify({ type: 'info', text: `已匯出 ${format.toUpperCase()} 檔` });
    },
    [kind, getUnit, title, notify],
  );

  /* ---------------- 文件清單 / 版本 ---------------- */

  const refreshDocuments = useCallback(async () => {
    const listDocuments = handlersRef.current?.listDocuments;
    if (!listDocuments) return;
    const list = await listDocuments();
    if (mountedRef.current) setDocuments(list);
  }, []);

  useEffect(() => {
    void refreshDocuments().catch(() => undefined);
  }, [refreshDocuments]);

  const openDocument = useCallback(
    async (id: string) => {
      const h = handlersRef.current;
      if (!h?.loadDocument) return;
      const detail = await h.loadDocument(id);
      if (!detail) throw new Error('找不到這份文件');

      setKind(detail.kind);
      setDocumentId(detail.id);
      setTitle(detail.title);
      setTemplateKey(detail.templateKey ?? null);

      replaceUnit(detail.kind, (api: any) => {
        if (detail.kind === 'sheet') api.createWorkbook(detail.content);
        else api.createDocument(detail.content);
      });

      setDirty(false);
      setNotice(null);
      const listVersions = handlersRef.current?.listVersions;
      if (listVersions) {
        const list = await listVersions(detail.id).catch(() => [] as OfficeDocumentVersion[]);
        if (mountedRef.current) setVersions(list);
      }
    },
    [replaceUnit],
  );

  const restoreVersion = useCallback(
    async (version: number) => {
      const h = handlersRef.current;
      if (!h?.restoreVersion || !documentId) return;
      const detail = await h.restoreVersion(documentId, version);

      setKind(detail.kind);
      setTitle(detail.title);
      replaceUnit(detail.kind, (api: any) => {
        if (detail.kind === 'sheet') api.createWorkbook(detail.content);
        else api.createDocument(detail.content);
      });

      setDirty(true);
      notify({ type: 'info', text: `已還原到 v${version}，請記得存檔以保留還原結果` });
    },
    [documentId, replaceUnit, notify],
  );

  const newBlank = useCallback(() => {
    const blankTitle = kind === 'sheet' ? '未命名試算表' : '未命名文件';
    replaceUnit(kind, (api: any) => {
      if (kind === 'sheet') api.createWorkbook({ name: blankTitle });
      else api.createDocument({ title: blankTitle });
    });
    setDocumentId(undefined);
    setTemplateKey(null);
    setTitle(blankTitle);
    setDirty(false);
    setVersions([]);
    setNotice(null);
  }, [kind, replaceUnit]);

  /* ---------------- 畫面 ---------------- */

  const templateItems = useMemo(
    () =>
      (kind === 'sheet' ? SHEET_TEMPLATES : DOC_TEMPLATES).map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
      })),
    [kind],
  );

  const backendConnected = Boolean(handlers?.saveDocument || handlers?.saveVersion);
  const loadingCurrent = !instancesReady[kind];

  return (
    <div className={['office-workspace', className ?? ''].join(' ')}>
      {/* 分頁 + 文件切換 */}
      <div className="flex flex-wrap items-center gap-1 px-3 pt-2 border-b border-slate-200 bg-white">
        {(['sheet', 'doc'] as DocumentKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              'px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors ' +
              (kind === k
                ? 'border-[#0ABAB5] text-[#0ABAB5] font-semibold bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800')
            }
          >
            {k === 'sheet' ? '📊 表格' : '📄 文檔'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 pb-2">
          {documents.length > 0 && (
            <select
              value={documentId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void run('開啟文件', () => openDocument(id));
              }}
              className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white max-w-[240px]"
            >
              <option value="">— 開啟已存文件 —</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  [{KIND_LABEL[d.kind]}] {d.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={newBlank}
            className="text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            ＋ 新文件
          </button>
        </div>
      </div>

      {/* 工具列 */}
      <div className="office-toolbar">
        <input
          className="office-title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          aria-label="文件名稱"
        />

        <TemplateMenu
          label="插入範本"
          items={templateItems}
          onPick={(key) => void run('套用範本', () => applyTemplate(key))}
          disabled={readOnly}
          hint={kind === 'sheet' ? '會新增一張套好格式與公式的工作表' : '會以範本內容取代目前文件'}
        />

        <button
          type="button"
          onClick={() => void run('匯入', handleImport)}
          disabled={readOnly}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          ⬆ 匯入{kind === 'sheet' ? ' Excel / CSV' : ' Word'}
        </button>

        {kind === 'sheet' ? (
          <>
            <button
              type="button"
              onClick={() => void run('匯出 CSV', () => handleExport('csv'))}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              ⬇ CSV
            </button>
            <button
              type="button"
              onClick={() => void run('匯出 Excel', () => handleExport('xlsx'))}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              ⬇ Excel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void run('匯出 Word', () => handleExport('docx'))}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              ⬇ Word
            </button>
            <button
              type="button"
              onClick={() => void run('匯出文字', () => handleExport('txt'))}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              ⬇ TXT
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => void run('下載備份', () => handleExport('json'))}
          title="下載 Univer 快照（含公式），可完整還原"
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
        >
          ⬇ 備份
        </button>

        <div className="spacer" />

        {documentId && handlers?.listVersions && (
          <button
            type="button"
            onClick={() =>
              void run('載入版本', async () => {
                if (!documentId) return;
                setVersions(await handlers.listVersions!(documentId));
                setShowVersions((v) => !v);
              })
            }
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            🕘 版本（{versions.length}）
          </button>
        )}

        <button
          type="button"
          onClick={() => void run('存檔', () => handleSave(false))}
          disabled={!canSave || busy !== null}
          title={canSave ? undefined : '尚未連接後端存檔功能'}
          className="px-3 py-1.5 text-sm rounded-md bg-[#0ABAB5] text-white font-medium hover:brightness-95 disabled:opacity-50"
        >
          {dirty ? '● 存檔' : '存檔'}
        </button>
        <button
          type="button"
          onClick={() => void run('另存新版本', () => handleSave(true))}
          disabled={!canSave || busy !== null}
          className="px-3 py-1.5 text-sm rounded-md border border-[#0ABAB5] text-[#0ABAB5] hover:bg-teal-50 disabled:opacity-50"
        >
          另存版本
        </button>
      </div>

      {notice && <div className={`office-banner ${notice.type}`}>{notice.text}</div>}
      {!backendConnected && (
        <div className="office-banner info">
          目前未連接後端存檔。編輯內容可以用「⬇ 備份」下載保存；連上後端後即可存檔並保留版本紀錄。
        </div>
      )}
      {readOnly && <div className="office-banner warn">目前為唯讀模式，編輯與存檔已停用。</div>}

      {showVersions && (
        <div className="mx-3 mt-3 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">版本紀錄</span>
            <button type="button" className="text-xs text-slate-500" onClick={() => setShowVersions(false)}>
              關閉
            </button>
          </div>
          <div className="office-version-list p-2">
            {versions.length === 0 && (
              <div className="px-2 py-3 text-xs text-slate-500">還沒有版本紀錄，按「另存版本」就會建立。</div>
            )}
            {versions.map((v) => (
              <div
                key={`${v.id}-${v.version}`}
                className="flex items-center gap-3 px-2 py-2 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-semibold text-slate-700 w-12">v{v.version}</span>
                <span className="text-xs text-slate-500 flex-1">
                  {v.createdAt ? new Date(v.createdAt).toLocaleString('zh-TW') : '—'}
                  {v.note ? `・${v.note}` : ''}
                  {typeof v.sizeBytes === 'number' ? `・${(v.sizeBytes / 1024).toFixed(1)} KB` : ''}
                </span>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                  onClick={() => void run(`還原 v${v.version}`, () => restoreVersion(v.version))}
                >
                  還原
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        編輯區：這兩個 div 由 Univer 接管，React 不放任何子節點進去。
        載入提示疊在外面，避免 Univer 設定 innerHTML 時把 React 的節點清掉。
      */}
      <div className="relative">
        <div ref={sheetHostRef} className="office-canvas" hidden={kind !== 'sheet'} />
        <div ref={docHostRef} className="office-canvas" hidden={kind !== 'doc'} />
        {loadingCurrent && (
          <div className="office-loading absolute inset-0 bg-white z-10">
            <span className="office-spinner" />
            正在載入{kind === 'sheet' ? '表格' : '文檔'}引擎…
          </div>
        )}
      </div>

      {/* 狀態列 */}
      <div className="office-statusbar">
        <span>{KIND_LABEL[kind]}模式</span>
        <span>{dirty ? '● 有未存的變更' : '○ 已同步'}</span>
        {lastSavedAt && <span>上次存檔：{new Date(lastSavedAt).toLocaleString('zh-TW')}</span>}
        {busy && (
          <span className="flex items-center gap-1 text-[#0ABAB5]">
            <span className="office-spinner" />
            {busy}中…
          </span>
        )}
        <span className="ml-auto">範本 / 工具列 / 右鍵選單：Univer Office Kit</span>
      </div>
    </div>
  );
}

export default OfficeWorkspace;

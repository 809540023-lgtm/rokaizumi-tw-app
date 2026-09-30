import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileSpreadsheet, FileText, RotateCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  buildOfficeEditorSrc,
  OFFICE_EDITOR_DEFAULT_URL,
  type OfficeEditorMode,
} from '@shared/office-editor';

/**
 * 內嵌 Univer Office 編輯器（試算表／文檔）。
 *
 * 編輯器是獨立的靜態站（預設 https://univer-office.onrender.com，可用
 * VITE_UNIVER_OFFICE_URL 覆寫），這裡用 iframe + `embed=1` 只顯示編輯器本體。
 * 內容自動存在「使用者自己的瀏覽器」（localStorage），要長期保存請用編輯器
 * 工具列的「下載 JSON」，或接收 postMessage 的快照存進後端。
 */
export type OfficeMode = OfficeEditorMode;

const EDITOR_BASE = (
  import.meta.env.VITE_UNIVER_OFFICE_URL || OFFICE_EDITOR_DEFAULT_URL
).replace(/\/+$/, '');

type Lang = 'zh' | 'cn' | 'en' | 'ja';

const TEXT: Record<Lang, Record<string, string>> = {
  zh: {
    sheets: '試算表',
    docs: '文檔',
    reload: '重新載入',
    openNew: '另開視窗',
    ready: '編輯器已就緒',
    changed: '內容已變更（自動存在此瀏覽器）',
    saved: '已儲存到此瀏覽器',
    loading: '載入編輯器中…',
    notice: '內容自動存在這台電腦的瀏覽器，換裝置或換瀏覽器不會同步；要保存請用編輯器內的「下載 JSON」。',
  },
  cn: {
    sheets: '试算表',
    docs: '文档',
    reload: '重新载入',
    openNew: '另开视窗',
    ready: '编辑器已就绪',
    changed: '内容已变更（自动存在此浏览器）',
    saved: '已储存到此浏览器',
    loading: '载入编辑器中…',
    notice: '内容自动存在这台电脑的浏览器，换装置或换浏览器不会同步；要保存请用编辑器内的「下载 JSON」。',
  },
  en: {
    sheets: 'Spreadsheet',
    docs: 'Document',
    reload: 'Reload',
    openNew: 'Open in new tab',
    ready: 'Editor ready',
    changed: 'Changed (autosaved in this browser)',
    saved: 'Saved in this browser',
    loading: 'Loading editor…',
    notice: 'Content is autosaved in this browser only; it will not sync across devices. Use “Download JSON” in the editor to keep a copy.',
  },
  ja: {
    sheets: 'スプレッドシート',
    docs: 'ドキュメント',
    reload: '再読み込み',
    openNew: '新しいタブで開く',
    ready: 'エディタ準備完了',
    changed: '変更あり（このブラウザに自動保存）',
    saved: 'このブラウザに保存しました',
    loading: 'エディタを読み込み中…',
    notice: '内容はこのブラウザにのみ自動保存されます。端末間で同期されません。保存するにはエディタ内の「JSON をダウンロード」をご利用ください。',
  },
};

interface OfficeIframeMessage {
  source?: string;
  type?: string;
  mode?: OfficeMode;
}

export default function UniverOfficeFrame() {
  const { language } = useLanguage();
  const lang = (language as Lang) ?? 'zh';
  const t = (key: string) => TEXT[lang]?.[key] ?? TEXT.zh[key] ?? key;

  const [mode, setMode] = useState<OfficeMode>('sheets');
  const [status, setStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // iframe 只在掛載與「重新載入」時換 src；切換模式走 postMessage，
  // 這樣兩個編輯器都留在記憶體裡，切換不會丟掉未輸出的內容。
  const src = useMemo(() => {
    try {
      return buildOfficeEditorSrc(EDITOR_BASE, mode, window.location.origin);
    } catch (error) {
      console.error('[Office 編輯器] 網址設定有誤', error);
      return EDITOR_BASE;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as OfficeIframeMessage | undefined;
      if (!data || data.source !== 'univer-office') return;

      if (data.type === 'ready') setStatus(t('ready'));
      else if (data.type === 'changed') setStatus(t('changed'));
      else if (data.type === 'saved') setStatus(t('saved'));
      else if (data.type === 'error') setStatus(String((data as { message?: string }).message ?? ''));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lang]);

  const switchMode = useCallback((next: OfficeMode) => {
    setMode(next);
    iframeRef.current?.contentWindow?.postMessage({ type: 'setMode', mode: next }, EDITOR_BASE);
  }, []);

  const openInNewTab = useCallback(() => {
    window.open(`${EDITOR_BASE}/?mode=${mode}`, '_blank', 'noopener');
  }, [mode]);

  const reload = useCallback(() => {
    setStatus(t('loading'));
    setReloadKey((k) => k + 1);
  }, [lang]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'sheets' ? 'default' : 'ghost'}
            onClick={() => switchMode('sheets')}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            {t('sheets')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'docs' ? 'default' : 'ghost'}
            onClick={() => switchMode('docs')}
          >
            <FileText className="w-4 h-4 mr-1" />
            {t('docs')}
          </Button>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={reload}>
          <RotateCw className="w-4 h-4 mr-1" />
          {t('reload')}
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={openInNewTab}>
          <ExternalLink className="w-4 h-4 mr-1" />
          {t('openNew')}
        </Button>

        <span className="text-sm text-gray-500">{status}</span>
      </div>

      <p className="text-xs text-gray-500">{t('notice')}</p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          title="Univer Office"
          src={src}
          onLoad={() => setStatus(t('loading'))}
          className="h-[70vh] min-h-[560px] w-full"
        />
      </div>
    </div>
  );
}

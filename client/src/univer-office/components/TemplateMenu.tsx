/**
 * 範本挑選下拉選單。
 *
 * 刻意手寫而不沿用專案裡的 radix DropdownMenu：
 * 這個元件會被塞進 Univer 工具列旁邊，需要完全掌控點擊外部關閉與 z-index，
 * 少一層依賴也少一個在編輯器裡出錯的機會。
 */

import { useEffect, useRef, useState } from 'react';

export interface TemplateMenuItem {
  key: string;
  name: string;
  description: string;
}

interface TemplateMenuProps {
  label: string;
  items: TemplateMenuItem[];
  onPick: (key: string) => void;
  disabled?: boolean;
  hint?: string;
}

export function TemplateMenu({ label, items, onPick, disabled, hint }: TemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>📋</span>
        {label}
        <span className="text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl z-[60]">
          {hint && <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">{hint}</div>}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(item.key);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-slate-50 last:border-0"
            >
              <div className="text-sm font-medium text-slate-800">{item.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

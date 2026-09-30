/**
 * 建立 Univer 實例。
 *
 * 重要設計決定：表格與文檔各自使用「獨立的 Univer 實例」。
 *
 * 原因是 UniverSheetsCorePreset 與 UniverDocsCorePreset 都會註冊 UniverUIPlugin，
 * 但兩者的容器設定不同；createUniver 會依 pluginName 去重（後者覆蓋前者），
 * 因此把兩個 preset 塞進同一個實例時，只有一個 UI 會正確掛載。
 * 分成兩個實例後，兩邊都能正常渲染，而且各自的 undo/redo 歷史互不干擾。
 *
 * 公式引擎採「主執行緒」模式（不傳 workerURL）。
 * 官方文件 (skills/univer-integrate/references/worker-setup.md) 明確指出
 * 不傳 workerURL 就是最小、最穩定的設定，等實際量測到卡頓再改 Worker 即可。
 */

import { createUniver, LocaleType, mergeLocales, defaultTheme } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import SheetsZhTw from '@univerjs/preset-sheets-core/locales/zh-TW';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import DocsZhTw from '@univerjs/preset-docs-core/locales/zh-TW';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-docs-core/lib/index.css';

import { OfficeKitPlugin, type OfficeKitPluginConfig } from './plugin/office-kit.plugin';

export interface OfficeInstance {
  univer: any;
  univerAPI: any;
  dispose: () => void;
}

function mount(container: HTMLElement | string): HTMLElement | string {
  return container;
}

/** 建立試算表實例 */
export function createSheetsInstance(
  container: HTMLElement | string,
  pluginConfig: OfficeKitPluginConfig = {},
): OfficeInstance {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_TW,
    locales: { [LocaleType.ZH_TW]: mergeLocales(SheetsZhTw, DocsZhTw) },
    theme: defaultTheme,
    presets: [UniverSheetsCorePreset({ container: mount(container) })],
    plugins: [[OfficeKitPlugin, pluginConfig] as never],
  });

  return {
    univer,
    univerAPI,
    dispose: () => {
      try {
        univer.dispose();
      } catch {
        /* 已經銷毀 */
      }
    },
  };
}

/** 建立文檔實例 */
export function createDocsInstance(
  container: HTMLElement | string,
  pluginConfig: OfficeKitPluginConfig = {},
): OfficeInstance {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_TW,
    locales: { [LocaleType.ZH_TW]: mergeLocales(DocsZhTw, SheetsZhTw) },
    theme: defaultTheme,
    presets: [UniverDocsCorePreset({ container: mount(container) })],
    plugins: [[OfficeKitPlugin, pluginConfig] as never],
  });

  return {
    univer,
    univerAPI,
    dispose: () => {
      try {
        univer.dispose();
      } catch {
        /* 已經銷毀 */
      }
    },
  };
}

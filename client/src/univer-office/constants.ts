/**
 * Univer Office Kit — 常數
 */

/**
 * 必須與 package.json 裡的 @univerjs/* 版本完全一致。
 *
 * Univer 的 PluginService 會比對外掛回報的版本與 core 版本，
 * 不一致時會在 console 印出 "Plugin version mismatch" 警告。
 * 升級 Univer 時請一併更新這個數字（package.json 的三個 @univerjs 套件是精確版本）。
 */
export const UNIVER_VERSION = '1.0.3';

export const OFFICE_KIT_PLUGIN_NAME = 'ROKAIZUMI_OFFICE_KIT_PLUGIN';
export const OFFICE_KIT_PACKAGE_NAME = 'univer-office-kit';
export const OFFICE_KIT_VERSION = '1.0.0';

/** 自訂選單在 Univer 裡的位置 */
export const MENU_POSITION = {
  RIBBON_START: 'ribbon.start',
  RIBBON_OTHERS: 'ribbon.others',
  CONTEXT_MENU_OTHERS: 'contextMenu.others',
  CONTEXT_MENU_MAIN: 'contextMenu.mainArea',
} as const;

export const STORAGE_KEY_PREFIX = 'rokaizumi-office:';
export const AUTOSAVE_INTERVAL_MS = 60_000;

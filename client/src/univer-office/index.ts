/**
 * Univer Office Kit — 對外出口
 *
 * 用法（React）：
 *   import { OfficeWorkspace } from '@/univer-office';
 *   <OfficeWorkspace handlers={{ saveDocument, listDocuments, ... }} />
 *
 * 用法（不用 React，自己接 Facade）：
 *   import { createSheetsInstance, SHEET_TEMPLATES, insertSheetFromTemplate } from '@/univer-office';
 */

export { OfficeWorkspace, default as OfficeWorkspaceDefault } from './OfficeWorkspace';
export type { OfficeWorkspaceProps } from './OfficeWorkspace';

export { createSheetsInstance, createDocsInstance } from './univer-factory';
export type { OfficeInstance } from './univer-factory';

export { OfficeKitPlugin, officeKitPluginInfo } from './plugin/office-kit.plugin';
export type { OfficeKitPluginConfig } from './plugin/office-kit.plugin';

export { installOfficeMenus, resetMenuRegistry } from './menus';
export type { OfficeMenuAction, InstallMenuOptions } from './menus';

export {
  SHEET_TEMPLATES,
  DOC_TEMPLATES,
  findSheetTemplate,
  findDocTemplate,
  insertSheetFromTemplate,
  createSheetFromTemplate,
  createDocFromTemplate,
  fillSheet,
} from './templates';
export type { FacadeLike } from './templates';

export * from './types';
export * from './io';
export { columnIndexToLetter, letterToColumnIndex, toA1, toRange, parseRange } from './cell-utils';
export { UNIVER_VERSION, OFFICE_KIT_VERSION, MENU_POSITION } from './constants';

/**
 * 自訂工具列與右鍵選單。
 *
 * 用 Univer 官方 Facade 的 createMenu / createSubmenu / appendTo，
 * 而不是直接操作 MenuManagerService。Facade 是對應用層保證的介面，
 * 內部 service token 改名時這裡不會壞。
 *
 * 位置（已於 @univerjs/ui 的 RibbonPosition / MenuManagerPosition 確認）：
 *   ribbon.start          功能區「開始」分頁
 *   contextMenu.others    右鍵選單的「其他」區塊
 */

import { MENU_POSITION } from './constants';

export interface OfficeMenuAction {
  /** 必須全域唯一，建議加前綴 */
  id: string;
  title: string;
  run: () => void | Promise<void>;
  /** 動態決定是否停用 */
  isEnabled?: () => boolean;
}

export interface InstallMenuOptions {
  /** 子選單名稱，例如「ろかいずみ Office」 */
  title: string;
  actions: OfficeMenuAction[];
  /** 要掛到哪些位置，預設功能區 + 右鍵選單 */
  positions?: string[];
  /** 每個動作前面是否加分隔線（依 id 指定） */
  separatorsBefore?: string[];
  onError?: (error: unknown, action: OfficeMenuAction) => void;
  /** 每次開啟選單時重新計算可用性 */
  refreshOnOpen?: boolean;
}

const installed = new Set<string>();

/**
 * 安裝自訂選單。重複呼叫同一組 id 時會直接跳過，
 * 避免 React 嚴格模式或分頁切換造成選單重複出現。
 */
export function installOfficeMenus(api: any, options: InstallMenuOptions): boolean {
  const positions = options.positions ?? [MENU_POSITION.RIBBON_START, MENU_POSITION.CONTEXT_MENU_OTHERS];
  const key = `${options.title}:${options.actions.map((a) => a.id).join(',')}`;
  if (installed.has(key)) return false;

  if (typeof api?.createSubmenu !== 'function' || typeof api?.createMenu !== 'function') {
    return false;
  }

  const runSafely = (action: OfficeMenuAction) => {
    try {
      const result = action.run();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((err) => options.onError?.(err, action));
      }
    } catch (err) {
      options.onError?.(err, action);
    }
  };

  try {
    const submenu = api.createSubmenu({
      id: `${options.title}-root`,
      title: options.title,
    });

    options.actions.forEach((action) => {
      if (options.separatorsBefore?.includes(action.id)) submenu.addSeparator();

      submenu.addSubmenu(
        api.createMenu({
          id: action.id,
          title: action.title,
          action: () => {
            if (action.isEnabled && !action.isEnabled()) return;
            runSafely(action);
          },
        }),
      );
    });

    submenu.appendTo(positions);
    installed.add(key);
    return true;
  } catch {
    // 選單掛載失敗（例如 Univer 版本差異）不應該讓編輯器無法使用
    return false;
  }
}

/** 測試或換頁時清除已安裝紀錄 */
export function resetMenuRegistry(): void {
  installed.clear();
}

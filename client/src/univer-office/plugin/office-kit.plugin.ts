/**
 * Univer Office Kit 的 Univer 外掛。
 *
 * 這個類別是整個套件掛進 Univer 外掛系統的進入點，負責兩件事：
 *   1. 回報套件身分與版本，讓 Univer 的 PluginService 能正確註冊與檢查版本
 *   2. 在 `onReady`（單位已建立、UI 已就緒）時，把控制權交回給呼叫端
 *
 * 為什麼實際功能走 Facade API 而不是在這個類別裡註冊指令？
 *
 * Univer 官方的外掛範例用 `@Inject(...)` 建構子注入來取得 service，
 * 那需要 `experimentalDecorators`。本專案的 tsconfig 沒有開啟該選項，
 * 而開啟它會影響整個專案的編譯行為。Univer 官方文件也指出
 * Facade API（`univerAPI.createMenu()` 等）是對應用層的穩定介面，
 * 因此這裡刻意採用「外掛負責生命週期、Facade 負責功能」的分工，
 * 不需要 decorator，也不會因為 Univer 內部 service token 改名而壞掉。
 */

import { Injector, Plugin, UniverInstanceType } from '@univerjs/presets';
import {
  OFFICE_KIT_PACKAGE_NAME,
  OFFICE_KIT_PLUGIN_NAME,
  OFFICE_KIT_VERSION,
  UNIVER_VERSION,
} from '../constants';

export interface OfficeKitPluginConfig {
  /** 單位建立完成後呼叫（等同 onReady 的掛勾） */
  onReady?: () => void;
  onRendered?: () => void;
  /** 用來追蹤問題：外掛生命週期會透過這個 callback 回報 */
  onLifecycle?: (stage: 'starting' | 'ready' | 'rendered' | 'steady') => void;
}

export class OfficeKitPlugin extends Plugin {
  static override pluginName = OFFICE_KIT_PLUGIN_NAME;
  static override packageName = OFFICE_KIT_PACKAGE_NAME;
  /** 與 @univerjs/core 相同版本，避免 PluginService 發出 mismatch 警告 */
  static override version = UNIVER_VERSION;
  static override type = UniverInstanceType.UNIVER_UNKNOWN;

  /**
   * Univer 的 DI 會注入這個成員，本套件不需要用到它。
   * 基底類別將它宣告為 abstract，所以子類別必須實作；
   * 用 `declare` 就不會產生多餘的執行期欄位，也不需要建構子參數。
   */
  declare protected _injector: Injector;

  constructor(private readonly _config: OfficeKitPluginConfig = {}) {
    super();
  }

  override onStarting(): void {
    this._config.onLifecycle?.('starting');
  }

  override onReady(): void {
    this._config.onLifecycle?.('ready');
    this._config.onReady?.();
  }

  override onRendered(): void {
    this._config.onLifecycle?.('rendered');
    this._config.onRendered?.();
  }

  override onSteady(): void {
    this._config.onLifecycle?.('steady');
  }
}

/** 給除錯用的外掛資訊 */
export const officeKitPluginInfo = {
  pluginName: OFFICE_KIT_PLUGIN_NAME,
  packageName: OFFICE_KIT_PACKAGE_NAME,
  version: UNIVER_VERSION,
  kitVersion: OFFICE_KIT_VERSION,
};

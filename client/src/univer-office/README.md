# Univer Office Kit

把 [Univer Office SDK](https://univer.ai)（試算表 + 文檔）變成可以在任何 React 內部網站直接用的一套積木。

**它解決的問題**：Univer 本身很強大，但要能真的拿來辦公，你還需要「範本、匯入匯出、存檔與版本、自訂工具列」這些東西。這包就是那些東西。

- 版本：Univer **1.0.3**（`@univerjs/*` 三個套件精確鎖版）
- 依賴：React 18/19、`rxjs`（Univer 的 peer dependency）
- 可選：`xlsx`（Excel 匯入匯出）、`docx`（Word 匯出）— 都是**動態載入**，沒用到不會下載

---

## 功能

| 功能 | 說明 |
|---|---|
| 🗂 **雙編輯器** | 表格（試算表）與文檔（Word 式）分頁切換，各自獨立的 undo 歷史 |
| 📋 **範本一鍵插入** | 報價單、進貨單、庫存盤點、成本毛利試算、工作日誌 / 公司函文、報價說明函、會議記錄、簽呈、出貨通知 |
| 🧰 **自訂工具列與右鍵選單** | 用官方 Facade API 掛進 Univer 的功能區與右鍵選單（「ろかいずみ Office」子選單） |
| ⬆⬇ **匯入匯出** | Excel（.xlsx，多工作表）、CSV（含 BOM，Excel 不亂碼）、Word（.docx）、純文字、JSON 快照 |
| 💾 **存檔與版本** | 存檔（autosave）與「另存新版本」分開，可列出與還原歷史版本 |
| 🔌 **程式化 API** | 直接用 Facade 操作 workbook / document，可以塞資料、跑報表 |

---

## 安裝

```bash
npm install @univerjs/presets@1.0.3 @univerjs/preset-sheets-core@1.0.3 @univerjs/preset-docs-core@1.0.3 rxjs
npm install xlsx docx        # 選用：Excel / Word 匯出匯入
```

> ⚠️ 所有 `@univerjs/*` 必須**完全同版本**。版本不一致時 Univer 會在 console 發出
> `Plugin version mismatch` 警告，功能也可能異常。

---

## 最快用法（React）

```tsx
import { OfficeWorkspace } from '@/univer-office';

export default function Page() {
  return (
    <OfficeWorkspace
      defaultKind="sheet"
      templateContext={{ company: '我的公司', operator: '王小明' }}
      handlers={{
        listDocuments: () => api.office.list(),
        loadDocument: (id) => api.office.get(id),
        saveDocument: (payload) => api.office.save(payload),
        saveVersion: (payload) => api.office.saveVersion(payload),
        listVersions: (id) => api.office.versions(id),
        restoreVersion: (id, version) => api.office.restore(id, version),
      }}
    />
  );
}
```

`handlers` 全部是選用的：

- 只給讀取相關的 → 變成「只能看」的檢視器
- 都不給 → 變成「只能用範本與匯出」的離線編輯器（畫面會提示尚未連接後端）

---

## 不用 React 也行

核心邏輯沒有依賴 React，可以自己接 Facade：

```ts
import {
  createSheetsInstance,
  SHEET_TEMPLATES,
  insertSheetFromTemplate,
  readSheetMatrix,
  matrixToCsv,
} from '@/univer-office';

// 1. 建立 Univer 實例（container 是 HTMLElement 或 element id）
const { univerAPI, univer } = createSheetsInstance(document.getElementById('sheet-host')!);
univerAPI.createWorkbook({ name: '我的表' });

// 2. 插入範本
const template = SHEET_TEMPLATES.find((t) => t.key === 'quotation')!;
insertSheetFromTemplate(univerAPI, template, { company: '我的公司' });

// 3. 讀資料出來自己用
const sheet = univerAPI.getActiveWorkbook().getActiveSheet();
const rows = readSheetMatrix(sheet);
const csv = matrixToCsv(rows);

// 4. 收工
univer.dispose();
```

---

## 目錄結構

```
univer-office/
├── OfficeWorkspace.tsx      主要 UI（分頁 / 工具列 / 狀態列 / 版本面板）
├── univer-factory.ts        建立 Univer 實例（試算表 / 文檔各一）
├── menus.ts                 自訂工具列與右鍵選單（Facade createMenu / createSubmenu）
├── constants.ts             版本常數與選單位置
├── types.ts                 型別與 handlers 介面
├── cell-utils.ts            A1 座標換算、CSV 逸出
├── components/
│   └── TemplateMenu.tsx     範本下拉選單
├── plugin/
│   └── office-kit.plugin.ts Univer Plugin（生命週期掛勾）
├── templates/
│   ├── index.ts             範本套用邏輯（Facade 寫入 + 樣式 + 合併 + 凍結）
│   ├── sheet-templates.ts   表格範本定義
│   └── doc-templates.ts     文檔範本定義
├── io/
│   ├── index.ts             高階匯入匯出
│   ├── csv.ts               CSV 讀寫（引號、換行、BOM、分隔符偵測）
│   ├── xlsx.ts              Excel（動態載入 xlsx）
│   ├── docx-export.ts       Word 匯出（動態載入 docx）
│   ├── docx-import.ts       Word 匯入（零依賴 ZIP + OOXML 解析）
│   └── download.ts          下載、選檔、檔名處理
└── styles.css               容器高度與疊層 UI 樣式
```

---

## 幾個刻意的設計決定（踩過的雷）

### 1. 表格與文檔是兩個獨立的 Univer 實例

`UniverSheetsCorePreset` 與 `UniverDocsCorePreset` 都會註冊 `UniverUIPlugin`，但帶不同的 `container`。
`createUniver` 會依 `pluginName` 去重（後註冊的覆蓋前面的），所以把兩個 preset 塞進**同一個**實例時，
只會有一邊的 UI 正確掛載（實測：表格的 canvas 不會出現）。

分成兩個實例後兩邊都正常，而且 undo/redo 歷史互不干擾。

### 2. 公式引擎先用主執行緒，不開 worker

Univer 官方 skill 文件寫得很清楚：不傳 `workerURL` 就是最小、最穩定的設定，
等真的量測到卡頓再改 Worker。開 worker 會多一個「main 與 worker 兩邊的 preset 必須成對註冊」的失敗模式。

要升級成 worker 的話：

```ts
// main
UniverSheetsCorePreset({
  container,
  workerURL: new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
})

// worker.ts
createUniver({ locale, locales, presets: [UniverSheetsCoreWorkerPreset()] });
```

### 3. Univer 的容器 div 不給 React 放子節點

Univer 建立實例時會設定容器的 `innerHTML`。如果 React 在裡面渲染了節點，兩邊會互相搶 DOM，
輕則出現 React 的 `removeChild` 錯誤，重則整個編輯器空白。載入提示一律放在容器**外面**用絕對定位疊上去。

### 4. 外掛類別不使用 decorator

Univer 官方外掛範例用 `@Inject(...)` 建構子注入，那需要 `experimentalDecorators`。
本套件的宿主專案 tsconfig 沒開這個選項，而開啟它會影響整個專案的編譯行為。

因此這裡的分工是：**外掛負責生命週期，Facade API 負責功能**。
`OfficeKitPlugin` 回報身分與版本，並在 `onReady` 把控制權交回呼叫端；
所有 UI 功能走 `univerAPI.createMenu()` / `createSubmenu()` 等官方 Facade 介面，
不碰內部 service token，Univer 內部改名時不會壞。

### 5. 手寫 Word 匯入，不用 mammoth

`mammoth` 會拉進 Node 專用模組（`fs`、`argparse`），在瀏覽器打包時是不必要的風險。
`.docx` 本來就是 ZIP + `word/document.xml`，用瀏覽器原生的 `DecompressionStream('deflate-raw')`
自己解開就好，約 100 行、零依賴、可測試。

**限制**：只還原文字，圖片、表格框線、字型與顏色不會帶入（UI 上有明確告知）。

### 6. `handlers` 用 ref 保存，避免無限迴圈

`OfficeWorkspace` 掛載時會呼叫 `listDocuments()`。如果呼叫端每次 render 都傳新的物件，
把 `handlers` 放進 `useCallback` 依賴陣列會讓 `refreshDocuments` 每次 render 都變，
effect 就會反覆觸發變成無限抓取。所以內部用 ref 讀取，對外只暴露穩定的包裝函式。

### 7. 不要用 `manualChunks` 把 Univer 綁成固定 chunk

實測踩到的雷：把 `@univerjs/*` 指定成 `manualChunks: univer-vendor` 之後，
Rollup 會讓**入口 chunk 也去 import 那個 chunk**，結果首頁就被迫下載約 2.7MB gzip 的 Univer。

交給 Rollup 自然分割時，因為 `/mom` 是 lazy route，Univer 只會在使用者真的打開它時才下載
（入口 chunk 對 univer 的引用數 = 0）。

---

## 已知限制

1. **Word 匯入只還原文字** — 圖片、表格、字型、顏色不支援。
2. **Excel 匯入只還原值** — 公式與樣式不還原。要完整保留請用「JSON 快照」格式存檔（那是本套件的主要存檔格式，公式與樣式都在）。
3. **Excel 匯出只輸出目前工作表** — 需要多工作表請分別匯出，或改用快照。
4. **Univer 開源版不含協同編輯與部分進階功能** — 那些在 `@univerjs-pro/*`（需授權）。
5. **首次載入較重** — 單獨測試時 Univer 打包約 1.7MB gzip。務必讓它落在 lazy route 上。
6. **文檔的變更偵測靠 DOM 事件** — 文檔 Facade 沒有 `onCommandExecuted`，所以 dirty 狀態是用
   `keydown` / `paste` / `cut` 判斷，直接呼叫 Facade 改內容不會自動變 dirty（記得手動標記）。

---

## 開發與測試

```bash
# 型別檢查
npx tsc --noEmit

# 打包
pnpm build

# 端到端測試（真實瀏覽器）
node test.mjs http://localhost:5300
```

測試涵蓋：編輯器渲染、自訂選單掛載、範本套用結果、CSV 內容、Excel 可被 `xlsx` 解析、
Word 匯出→再匯入的文字往返、存檔快照送到後端、版本號遞增、`.docx` 匯入。

---

## 授權

MIT。Univer 本身為 Apache-2.0。

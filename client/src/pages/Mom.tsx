/**
 * /mom — 線上表格與文檔編輯
 *
 * 把 Univer Office Kit 接到本專案的 tRPC 後端：
 *   office.list / office.get / office.save / office.saveVersion /
 *   office.versions / office.restore
 *
 * 這裡刻意把 handlers 做成「身分穩定」的物件。
 * OfficeWorkspace 內部會在掛載時呼叫 listDocuments()，如果 handlers 每次 render
 * 都是新物件，會造成 effect 反覆觸發。做法是用 ref 保存最新的 mutation 函式，
 * 對外只暴露一組固定的包裝函式。
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { FileSpreadsheet, FileText, Lock, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { OfficeWorkspace, type OfficeKitHandlers } from "@/univer-office";

const A = trpc as any;

/**
 * 呼叫 tRPC 的 query 程序。
 *
 * 不同的 @trpc/react-query 版本對「在 hook 之外呼叫 query」有三種寫法，
 * 這裡依序嘗試，避免升級套件時整頁壞掉。
 */
async function callQuery(utils: any, path: string, input: unknown): Promise<any> {
  const pick = (root: any) => path.split(".").reduce((node, key) => node?.[key], root);

  const procedure = pick(utils);
  if (procedure?.fetch) return procedure.fetch(input);
  if (procedure?.query) return procedure.query(input);

  const clientProcedure = pick(utils?.client);
  if (clientProcedure?.query) return clientProcedure.query(input);

  throw new Error(`無法呼叫 ${path}：目前的 tRPC 客戶端不支援這種用法`);
}

export default function Mom() {
  const { user, loading } = useAuth() as any;
  const utils = trpc.useUtils() as any;
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const saveMutation = A.office.save.useMutation();
  const saveVersionMutation = A.office.saveVersion.useMutation();
  const restoreMutation = A.office.restore.useMutation();

  // mutation 函式放進 ref，讓 handlers 的參考永遠不變
  const mutatorsRef = useRef({ saveMutation, saveVersionMutation, restoreMutation });
  mutatorsRef.current = { saveMutation, saveVersionMutation, restoreMutation };

  const handlers = useMemo<OfficeKitHandlers>(
    () => ({
      listDocuments: () => callQuery(utils, "office.list", undefined),
      loadDocument: (id: string) => callQuery(utils, "office.get", { id }),
      saveDocument: (payload) => mutatorsRef.current.saveMutation.mutateAsync(payload as any),
      saveVersion: (payload) => mutatorsRef.current.saveVersionMutation.mutateAsync(payload as any),
      listVersions: (documentId: string) => callQuery(utils, "office.versions", { documentId }),
      restoreVersion: (documentId: string, version: number) =>
        mutatorsRef.current.restoreMutation.mutateAsync({ documentId, version }) as any,
    }),
    [utils],
  );

  const templateContext = useMemo(
    () => ({
      company: "ろかいずみ",
      operator: (user?.name as string | undefined) ?? undefined,
      today: new Date().toLocaleDateString("zh-TW"),
    }),
    [user?.name],
  );

  const handleDocumentChange = useCallback((info: { title: string }) => {
    setSavedHint(info.title);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center text-gray-500">載入中…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="max-w-lg mx-auto px-4 py-20">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <Lock className="w-10 h-10 mx-auto text-[#0ABAB5] mb-4" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">需要登入才能使用線上 Office</h1>
            <p className="text-sm text-gray-500 mb-6">
              表格與文檔會存進你的帳號，因此需要先登入。登入後就能使用範本、匯入匯出與版本紀錄。
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-lg bg-[#0ABAB5] text-white font-medium hover:brightness-95"
            >
              前往登入
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      <SiteHeader />

      <div className="max-w-[1500px] mx-auto px-4 py-6">
        {/* 標題 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-6 h-6 text-[#0ABAB5]" />
            <FileText className="w-6 h-6 text-[#0ABAB5]" />
            <h1 className="text-2xl font-bold text-gray-800">線上 Office</h1>
          </div>
          <p className="text-sm text-gray-500">
            直接在瀏覽器做表格與文書。內建報價單、進貨單、庫存盤點、成本試算、公司函文、簽呈等範本，
            可匯入匯出 Excel / CSV / Word，並保留版本紀錄。
          </p>
        </div>

        {/* 快速說明 */}
        <div className="grid md:grid-cols-3 gap-3 mb-5">
          <Hint
            icon={<Sparkles className="w-4 h-4" />}
            title="要範本？"
            body="按「插入範本」，選報價單或簽呈等，格式與公式會自動套好。"
          />
          <Hint
            icon={<FileSpreadsheet className="w-4 h-4" />}
            title="有現成 Excel？"
            body="按「⬆ 匯入」直接讀進來（多工作表會各自變成一個分頁）。"
          />
          <Hint
            icon={<FileText className="w-4 h-4" />}
            title="要給客戶 Word？"
            body="文檔分頁按「⬇ Word」匯出 .docx，可直接用 Word 開啟。"
          />
        </div>

        <OfficeWorkspace
          defaultKind="sheet"
          handlers={handlers}
          templateContext={templateContext}
          onDocumentChange={handleDocumentChange}
        />

        <p className="text-xs text-gray-400 mt-3">
          目前編輯：{savedHint || "未命名"}
          　·　快捷鍵：Ctrl/Cmd + Z 復原、Ctrl/Cmd + S 存檔（由 Univer 提供）
          　·　右鍵選單也可找到「ろかいずみ Office」的自訂功能
        </p>
      </div>
    </div>
  );
}

function Hint({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-[#0ABAB5] font-semibold text-sm mb-1">
        {icon}
        {title}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
    </div>
  );
}

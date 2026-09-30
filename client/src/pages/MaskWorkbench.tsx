/**
 * 面膜作業工作台（/mask，僅管理員）。
 *
 * 這個頁面把「日本拍照 → 上架成可賣商品」的每個環節攤開給人看與修改：
 *   照片 → AI 辨識結果 → 法遵檢核 → 文案 → 定價 → 上架
 *
 * 每個區塊都可以人工覆寫。系統的定位是「先做完 90%，人只負責確認與補缺」，
 * 不是黑箱自動上架——尤其法遵與標示，錯了會被罰。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductImage } from "@/components/ProductImage";

const A = trpc as any;

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "待處理", cls: "bg-gray-100 text-gray-600" },
  analyzed: { text: "已辨識", cls: "bg-blue-50 text-blue-600" },
  compliance_blocked: { text: "法遵卡關", cls: "bg-red-50 text-red-600" },
  ready: { text: "可上架", cls: "bg-amber-50 text-amber-700" },
  published: { text: "已上架", cls: "bg-emerald-50 text-emerald-700" },
  archived: { text: "已封存", cls: "bg-gray-100 text-gray-400" },
};

const COMPLIANCE_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "未檢核", cls: "bg-gray-100 text-gray-500" },
  pass: { text: "通過", cls: "bg-emerald-50 text-emerald-700" },
  warn: { text: "待補件", cls: "bg-amber-50 text-amber-700" },
  blocked: { text: "違規", cls: "bg-red-50 text-red-600" },
};

function badge(map: Record<string, { text: string; cls: string }>, key: string) {
  const item = map[key] ?? { text: key, cls: "bg-gray-100 text-gray-500" };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${item.cls}`}>{item.text}</span>;
}

const money = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : `NT$${Number(v).toLocaleString()}`);

/** 檔案轉 base64（去掉 data URL 前綴，後端會自己處理） */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("讀取檔案失敗"));
    reader.readAsDataURL(file);
  });
}

export default function MaskWorkbench() {
  const { user, loading } = useAuth() as any;
  const utils = A.useUtils();

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";

  const listQuery = A.mask.list.useQuery(undefined, { enabled: !!isAdmin, retry: false });
  const statsQuery = A.mask.stats.useQuery(undefined, { enabled: !!isAdmin, retry: false });
  const detailQuery = A.mask.get.useQuery({ id: selected ?? "" }, { enabled: !!selected && !!isAdmin, retry: false });
  const tasksQuery = A.mask.tasks.useQuery(undefined, { enabled: !!isAdmin, retry: false });

  const runMutation = A.mask.run.useMutation();
  const publishMutation = A.mask.publish.useMutation();
  const unpublishMutation = A.mask.unpublish.useMutation();
  const updateMutation = A.mask.update.useMutation();
  const uploadMutation = A.mask.uploadPhotos.useMutation();
  const deletePhotoMutation = A.mask.deletePhoto.useMutation();
  const removeMutation = A.mask.remove.useMutation();
  const syncTasksMutation = A.mask.syncTasks.useMutation();
  const completeTaskMutation = A.mask.completeTask.useMutation();

  const detail = detailQuery.data as any;
  const maskRow = detail?.mask;

  /** 把伺服器資料灌進表單（切換品項時重置） */
  useEffect(() => {
    if (!maskRow) return;
    setForm({
      nameZh: maskRow.nameZh ?? "",
      nameJa: maskRow.nameJa ?? "",
      brand: maskRow.brand ?? "",
      series: maskRow.series ?? "",
      barcode: maskRow.barcode ?? "",
      volumeMl: maskRow.volumeMl ?? "",
      sheetsPerPack: maskRow.sheetsPerPack ?? "",
      piecesPerBox: maskRow.piecesPerBox ?? "",
      shelfLifeMonths: maskRow.shelfLifeMonths ?? "",
      supplierJpy: maskRow.supplierJpy ?? "",
      moq: maskRow.moq ?? "",
      stock: maskRow.stock ?? "",
      regulatoryType: maskRow.regulatoryType ?? "general",
      registrationNo: maskRow.registrationNo ?? "",
      manufactureDate: maskRow.manufactureDate ?? "",
      importerInfo: maskRow.importerInfo ?? "",
      retailTwd: maskRow.retailTwd ?? "",
      wholesaleTwd: maskRow.wholesaleTwd ?? "",
    });
  }, [maskRow]);

  const refreshAll = useCallback(async () => {
    await Promise.all([listQuery.refetch(), statsQuery.refetch(), detailQuery.refetch()]);
  }, [listQuery, statsQuery, detailQuery]);

  const withBusy = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setBusy(label);
      try {
        await fn();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const runPipeline = useCallback(
    (refreshVision: boolean) =>
      withBusy(refreshVision ? "重新辨識並跑流程" : "執行流程", async () => {
        if (!selected) return;
        const result = await runMutation.mutateAsync({
          id: selected,
          refreshVision,
          hint: undefined,
        });
        const failed = (result?.stages ?? []).filter((s: any) => s.status === "failed");
        if (failed.length > 0) {
          toast.warning(`流程完成但有步驟失敗：${failed.map((f: any) => `${f.stage}（${f.error}）`).join("、")}`);
        } else {
          toast.success(`流程完成：${result?.summary?.name ?? ""}｜法遵 ${result?.complianceStatus ?? ""}`);
        }
        await refreshAll();
      }),
    [selected, runMutation, refreshAll, withBusy, deletePhotoMutation],
  );

  const saveForm = useCallback(
    () =>
      withBusy("儲存", async () => {
        if (!selected) return;
        const toNumber = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
        await updateMutation.mutateAsync({
          id: selected,
          nameZh: String(form.nameZh ?? ""),
          nameJa: String(form.nameJa ?? "") || null,
          brand: String(form.brand ?? "") || null,
          series: String(form.series ?? "") || null,
          barcode: String(form.barcode ?? "") || null,
          volumeMl: toNumber(form.volumeMl),
          sheetsPerPack: toNumber(form.sheetsPerPack),
          piecesPerBox: toNumber(form.piecesPerBox),
          shelfLifeMonths: toNumber(form.shelfLifeMonths),
          supplierJpy: toNumber(form.supplierJpy),
          moq: toNumber(form.moq),
          stock: toNumber(form.stock),
          regulatoryType: form.regulatoryType === "specific_purpose" ? "specific_purpose" : "general",
          registrationNo: String(form.registrationNo ?? "") || null,
          manufactureDate: String(form.manufactureDate ?? "") || null,
          importerInfo: String(form.importerInfo ?? "") || null,
          retailTwd: toNumber(form.retailTwd),
          wholesaleTwd: toNumber(form.wholesaleTwd),
        });
        toast.success("已儲存");
        await refreshAll();
      }),
    [selected, form, updateMutation, refreshAll, withBusy],
  );

  const uploadPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !selected) return;
      setUploading(true);
      try {
        const photos = await Promise.all(
          Array.from(files).map(async (file, index) => ({
            name: file.name,
            role: index === 0 ? "front" : "back",
            mimeType: file.type || "image/jpeg",
            base64: await fileToBase64(file),
          })),
        );
        const result = await uploadMutation.mutateAsync({ id: selected, photos });
        toast.success(`已上傳 ${result.saved} 張照片${result.failed.length ? `，${result.failed.length} 張失敗` : ""}`);
        await refreshAll();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [selected, uploadMutation, refreshAll],
  );

  const publish = useCallback(
    (force: boolean) =>
      withBusy("上架", async () => {
        if (!selected) return;
        const result = await publishMutation.mutateAsync({ id: selected, force });
        if (result?.productId) {
          toast.success(`已上架，商品編號 ${result.productId}（${result.photoCount} 張圖）`);
        } else {
          toast.warning("已上架，但沒有取得商品編號，請到商品管理確認。");
        }
        await refreshAll();
      }),
    [selected, publishMutation, refreshAll, withBusy],
  );

  const report = (maskRow?.complianceReport ?? null) as any;
  const copy = (maskRow?.websiteCopy ?? null) as any;
  const wholesaleCopy = (maskRow?.wholesaleCopy ?? null) as any;
  const costBreakdown = (maskRow?.costBreakdown ?? null) as any;
  const attributes = (maskRow?.attributes ?? null) as any;
  const photos = (detail?.photos ?? []) as any[];
  const runs = (detail?.runs ?? []) as any[];

  const tasks = (tasksQuery.data ?? []) as any[];
  const list = (listQuery.data ?? []) as any[];
  const stats = statsQuery.data as any;

  /* ---------------- 權限 ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-20 text-center text-gray-500">載入中…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[#0ABAB5]" />
            <h1 className="mb-2 text-xl font-bold text-gray-800">需要登入</h1>
            <p className="mb-6 text-sm text-gray-500">面膜作業涉及商店商品與成本，請先登入。</p>
            <Link href="/login" className="inline-block rounded-lg bg-[#0ABAB5] px-6 py-2.5 font-medium text-white">
              前往登入
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
            <h1 className="mb-2 text-xl font-bold text-gray-800">需要管理員權限</h1>
            <p className="text-sm text-gray-500">
              這個功能可以直接建立前台可購買的商品，因此只開放給管理員。
              請管理員到「會員管理」把你的角色設為管理員。
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- 畫面 ---------------- */

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      <SiteHeader />

      <div className="mx-auto max-w-[1500px] px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <Camera className="h-6 w-6 text-[#0ABAB5]" />
              面膜作業
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              照片從 Google 雲端同步進來 → AI 辨識 → 法遵檢核 → 中文文案 → 成本定價 → 上架成前台商品
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                withBusy("重新載入", async () => {
                  await refreshAll();
                  toast.success("已重新載入");
                })
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> 重新載入
            </button>
          </div>
        </div>

        {/* 統計 */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="總品項" value={stats?.total ?? 0} />
          <StatCard label="待處理" value={stats?.draft ?? 0} />
          <StatCard label="可上架" value={stats?.ready ?? 0} tone="amber" />
          <StatCard label="法遵卡關" value={stats?.blocked ?? 0} tone="red" />
          <StatCard label="已上架" value={stats?.published ?? 0} tone="emerald" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          {/* 左：清單 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">品項清單</h2>
              <span className="text-xs text-gray-400">{list.length} 筆</span>
            </div>

            {list.length === 0 && (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                <p className="mb-2 font-bold">還沒有任何面膜品項</p>
                <p className="mb-3">照片放進 Google 雲端資料夾後，在你電腦上執行本機代理就會同步進來：</p>
                <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
{`cd ~/maskbridge-platform
node scripts/mask-agent.mjs --folder "面膜/2026-09-30"`}
                </pre>
              </div>
            )}

            <div className="max-h-[70vh] space-y-2 overflow-y-auto">
              {list.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selected === m.id ? "border-[#0ABAB5] bg-teal-50/50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-gray-800">{m.nameZh || "(未命名)"}</span>
                    {badge(STATUS_LABEL, m.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono">{m.sku}</span>
                    {m.brand && <span>{m.brand}</span>}
                    <span>{money(m.retailTwd)}</span>
                    {badge(COMPLIANCE_LABEL, m.complianceStatus)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 右：詳情 */}
          <div className="space-y-4">
            {!selected && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
                從左邊選一個品項，或等本機代理把雲端照片同步進來。
              </div>
            )}

            {selected && detailQuery.isLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500">載入中…</div>
            )}

            {maskRow && (
              <>
                {/* 動作列 */}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4">
                  <button
                    type="button"
                    onClick={() => runPipeline(false)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0ABAB5] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy === "執行流程" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    執行流程
                  </button>
                  <button
                    type="button"
                    onClick={() => runPipeline(true)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" /> 重新辨識
                  </button>
                  <button
                    type="button"
                    onClick={saveForm}
                    disabled={busy !== null}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
                  >
                    儲存修改
                  </button>

                  <div className="ml-auto flex flex-wrap gap-2">
                    {maskRow.status === "published" ? (
                      <>
                        {maskRow.productId && (
                          <Link
                            href={`/product/${maskRow.productId}`}
                            target="_blank"
                            className="flex items-center gap-1.5 rounded-lg border border-[#0ABAB5] px-4 py-2 text-sm font-bold text-[#0ABAB5]"
                          >
                            <ExternalLink className="h-4 w-4" /> 看前台商品
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            withBusy("下架", async () => {
                              await unpublishMutation.mutateAsync({ id: selected });
                              toast.success("已下架");
                              await refreshAll();
                            })
                          }
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700"
                        >
                          下架
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => publish(false)}
                        disabled={busy !== null || maskRow.complianceStatus === "blocked"}
                        title={maskRow.complianceStatus === "blocked" ? "法遵未通過，無法上架" : undefined}
                        className="rounded-lg bg-[#E26D5C] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        上架到商店
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        withBusy("刪除", async () => {
                          if (!window.confirm(`確定要刪除 ${maskRow.sku}？照片與流程紀錄也會一併刪除。`)) return;
                          await removeMutation.mutateAsync({ id: selected, removeProduct: true });
                          toast.success("已刪除");
                          setSelected(null);
                          await refreshAll();
                        })
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {busy && (
                  <div className="flex items-center gap-2 rounded-xl bg-[#0ABAB5]/10 px-4 py-3 text-sm font-bold text-[#087F7B]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {busy}中…（AI 辨識需要 20–40 秒）
                  </div>
                )}

                {/* 照片 */}
                <Section title="照片" icon={<Camera className="h-4 w-4" />}>
                  <div className="flex flex-wrap items-center gap-3">
                    {photos.map((p) => (
                      <div key={p.id} className="w-32">
                        <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                          <ProductImage src={p.url} alt={p.role} className="h-full w-full object-contain" />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                          <span>{p.role}</span>
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-600"
                            onClick={() =>
                              withBusy("刪除照片", async () => {
                                await deletePhotoMutation.mutateAsync({ photoId: p.id });
                                await refreshAll();
                              })
                            }
                          >
                            刪除
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400">{(p.byteSize / 1024).toFixed(0)} KB</div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-[#0ABAB5] hover:text-[#0ABAB5]"
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      上傳照片
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => uploadPhotos(e.target.files)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    第一張會當作商品主圖。建議依「正面 → 背面成分 → 外盒 → 質地」的順序上傳。
                  </p>
                </Section>

                {/* 基本資料 */}
                <Section title="商品資料（AI 讀到的可以自己改）" icon={<FileText className="h-4 w-4" />}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="中文品名" value={form.nameZh} onChange={(v) => setForm({ ...form, nameZh: v })} />
                    <Field label="日文品名" value={form.nameJa} onChange={(v) => setForm({ ...form, nameJa: v })} />
                    <Field label="品牌" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
                    <Field label="JAN 條碼" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
                    <Field
                      label="日圓進貨單價 ¥"
                      value={form.supplierJpy}
                      onChange={(v) => setForm({ ...form, supplierJpy: v })}
                      hint="沒填就用照片上的定價推估（不可靠）"
                    />
                    <Field label="一次進貨量" value={form.moq} onChange={(v) => setForm({ ...form, moq: v })} hint="影響運費攤提" />
                    <Field label="可上架庫存" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} />
                    <Field label="每包片數" value={form.sheetsPerPack} onChange={(v) => setForm({ ...form, sheetsPerPack: v })} />
                    <Field label="每盒入數" value={form.piecesPerBox} onChange={(v) => setForm({ ...form, piecesPerBox: v })} />
                    <Field label="容量 mL" value={form.volumeMl} onChange={(v) => setForm({ ...form, volumeMl: v })} />
                    <Field
                      label="保存期限（月）"
                      value={form.shelfLifeMonths}
                      onChange={(v) => setForm({ ...form, shelfLifeMonths: v })}
                    />
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-500">法規類型</span>
                      <select
                        value={String(form.regulatoryType ?? "general")}
                        onChange={(e) => setForm({ ...form, regulatoryType: e.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="general">一般化粧品（產品登錄）</option>
                        <option value="specific_purpose">特定用途化粧品（需查驗登記）</option>
                      </select>
                    </label>

                    <Field
                      label="許可／登錄字號"
                      value={form.registrationNo}
                      onChange={(v) => setForm({ ...form, registrationNo: v })}
                      hint="特定用途一定要有，否則不能上架"
                    />
                    <Field
                      label="製造日期／批號"
                      value={form.manufactureDate}
                      onChange={(v) => setForm({ ...form, manufactureDate: v })}
                      hint="收貨時抄，用於中文標示第 6 項"
                    />
                    <Field
                      label="在台進口商（名稱/地址/電話）"
                      value={form.importerInfo}
                      onChange={(v) => setForm({ ...form, importerInfo: v })}
                      hint="中文標示第 8 項，通常整批一樣"
                    />
                  </div>

                  {attributes?.confidence !== undefined && (
                    <p className="mt-3 text-xs text-gray-500">
                      AI 辨識信心度 {(Number(attributes.confidence) * 100).toFixed(0)}%
                      {attributes.uncertainFields?.length ? `　需複核：${attributes.uncertainFields.join("、")}` : ""}
                      {attributes.model ? `　模型：${attributes.model}` : ""}
                    </p>
                  )}
                  {Array.isArray(maskRow.ingredients) && maskRow.ingredients.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-gray-500">
                        全成分（{maskRow.ingredients.length} 項）
                      </summary>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600">{maskRow.ingredients.join("、")}</p>
                    </details>
                  )}
                </Section>

                {/* 法遵 */}
                <Section
                  title="法遵檢核"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  extra={badge(COMPLIANCE_LABEL, maskRow.complianceStatus)}
                >
                  {!report && <p className="text-sm text-gray-500">尚未檢核，執行流程後會產生報告。</p>}

                  {report && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span>阻擋級問題：<b className={report.blockingCount ? "text-red-600" : "text-emerald-600"}>{report.blockingCount}</b></span>
                        <span>提醒：<b>{report.warningCount}</b></span>
                        <span>
                          可公開販售：
                          <b className={report.readyForSale ? "text-emerald-600" : "text-amber-600"}>
                            {report.readyForSale ? "是" : "否（尚缺標示）"}
                          </b>
                        </span>
                      </div>

                      {report.registrationMissing && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                          這是特定用途化粧品（美白／防曬等），但沒有查驗登記字號。依法不得販售與宣稱功效，
                          系統已阻止上架。
                        </div>
                      )}

                      {/* 11 項標示 */}
                      <div>
                        <div className="mb-1 text-xs font-bold text-gray-500">中文標示 11 項法定要素</div>
                        <div className="grid gap-1 md:grid-cols-2">
                          {(report.labels ?? []).map((l: any) => (
                            <div key={l.key} className="flex items-center gap-2 text-xs">
                              {l.ok ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              ) : (
                                <XCircle className={`h-3.5 w-3.5 shrink-0 ${l.blocking ? "text-red-500" : "text-amber-500"}`} />
                              )}
                              <span className={l.ok ? "text-gray-600" : "font-bold text-gray-800"}>{l.label}</span>
                              {!l.ok && <span className="text-gray-400">{l.blocking ? "（必填）" : ""}</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 違規用語 */}
                      {(report.findings ?? []).length > 0 && (
                        <div>
                          <div className="mb-1 text-xs font-bold text-gray-500">
                            發現的用語問題（{(report.findings ?? []).length} 筆）
                          </div>
                          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                  <th className="px-2 py-1 text-left">來源</th>
                                  <th className="px-2 py-1 text-left">用語</th>
                                  <th className="px-2 py-1 text-left">類別</th>
                                  <th className="px-2 py-1 text-left">建議改寫</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(report.findings ?? []).slice(0, 60).map((f: any, i: number) => (
                                  <tr key={`${f.ruleId}-${i}`} className="border-t border-gray-50">
                                    <td className="px-2 py-1 text-gray-500">{f.source}</td>
                                    <td className="px-2 py-1 font-bold text-red-600">{f.matched}</td>
                                    <td className="px-2 py-1">{f.category}</td>
                                    <td className="px-2 py-1 text-emerald-700">
                                      {f.suggestions?.length ? f.suggestions.join("／") : "（建議刪除）"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 系統自動改寫紀錄 */}
                      {copy?.compliance?.replacements?.length > 0 && (
                        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                          <b>系統已自動改寫文案：</b>
                          {copy.compliance.replacements.map((r: any) => `${r.from} → ${r.to || "(刪除)"}`).join("；")}
                        </div>
                      )}

                      <p className="text-[11px] leading-relaxed text-gray-400">{report.disclaimer}</p>
                    </div>
                  )}
                </Section>

                {/* 文案 */}
                <Section title="中文文案（已過法遵）" icon={<FileText className="h-4 w-4" />}>
                  {!copy && <p className="text-sm text-gray-500">尚未產生，執行流程後會自動生成。</p>}
                  {copy && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-bold text-gray-500">商品名稱</div>
                        <div className="text-sm text-gray-800">{copy.name}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-500">商品說明（前台顯示）</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{copy.description}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-500">規格</div>
                        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                          {copy.specifications}
                        </pre>
                      </div>
                      {copy.features?.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-gray-500">賣點</div>
                          <ul className="list-inside list-disc text-sm text-gray-700">
                            {copy.features.map((f: string, i: number) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {wholesaleCopy?.caption && (
                        <div>
                          <div className="text-xs font-bold text-gray-500">批發群貼文</div>
                          <pre className="whitespace-pre-wrap rounded-lg bg-teal-50 p-3 text-xs text-teal-900">
                            {wholesaleCopy.caption}
                          </pre>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        {copy.generated ? `AI 產生（${copy.model ?? "—"}）` : "使用模板產生（AI 未啟用或失敗）"}
                        {copy.error ? `　原因：${copy.error}` : ""}
                      </p>
                    </div>
                  )}
                </Section>

                {/* 定價 */}
                <Section title="成本與定價" icon={<DollarSign className="h-4 w-4" />}>
                  <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniStat label="單件到岸成本" value={money(maskRow.unitCostTwd)} />
                    <MiniStat label="建議批發價" value={money(maskRow.wholesaleTwd)} />
                    <MiniStat label="零售價" value={money(maskRow.retailTwd)} />
                    <MiniStat
                      label="零售毛利"
                      value={maskRow.grossMarginPct ? `${Number(maskRow.grossMarginPct).toFixed(1)}%` : "—"}
                      tone={Number(maskRow.grossMarginPct) >= 40 ? "emerald" : "amber"}
                    />
                  </div>

                  <div className="mb-3 flex flex-wrap gap-3">
                    <Field
                      label="手動覆寫零售價"
                      value={form.retailTwd}
                      onChange={(v) => setForm({ ...form, retailTwd: v })}
                      hint="留空則用系統計算值"
                    />
                    <Field
                      label="手動覆寫批發價"
                      value={form.wholesaleTwd}
                      onChange={(v) => setForm({ ...form, wholesaleTwd: v })}
                    />
                  </div>

                  {costBreakdown?.landed && (
                    <details>
                      <summary className="cursor-pointer text-xs text-gray-500">成本拆解（整批 → 單件）</summary>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-bold text-gray-500">單件明細</div>
                          <table className="w-full text-xs">
                            <tbody>
                              {Object.entries(costBreakdown.landed.perUnit ?? {}).map(([k, v]) => (
                                <tr key={k} className="border-b border-gray-50">
                                  <td className="py-0.5 text-gray-500">{k}</td>
                                  <td className="py-0.5 text-right">{money(v)}</td>
                                </tr>
                              ))}
                              <tr className="font-bold">
                                <td className="py-1">單件成本</td>
                                <td className="py-1 text-right">{money(costBreakdown.landed.unitCostTwd)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-500">匯率與規模</div>
                          <table className="w-full text-xs">
                            <tbody>
                              <tr className="border-b border-gray-50">
                                <td className="py-0.5 text-gray-500">匯率（含緩衝）</td>
                                <td className="py-0.5 text-right">{costBreakdown.landed.fxRate}</td>
                              </tr>
                              <tr className="border-b border-gray-50">
                                <td className="py-0.5 text-gray-500">貨源</td>
                                <td className="py-0.5 text-right">{costBreakdown.fx?.source ?? "—"}</td>
                              </tr>
                              <tr className="border-b border-gray-50">
                                <td className="py-0.5 text-gray-500">進貨量</td>
                                <td className="py-0.5 text-right">{costBreakdown.landed.qty}</td>
                              </tr>
                              <tr className="border-b border-gray-50">
                                <td className="py-0.5 text-gray-500">計費重量</td>
                                <td className="py-0.5 text-right">{costBreakdown.landed.chargeableKg} kg</td>
                              </tr>
                            </tbody>
                          </table>
                          <p className="mt-2 text-[11px] text-gray-400">
                            關稅與稅率為預設值（關稅 {costBreakdown.landed.dutyRatePct}%、營業稅{" "}
                            {costBreakdown.landed.businessTaxPct}%），請與報關行確認實際稅則。
                          </p>
                        </div>
                      </div>
                    </details>
                  )}
                </Section>

                {/* 執行紀錄 */}
                <Section title="流程紀錄" icon={<RefreshCw className="h-4 w-4" />}>
                  {runs.length === 0 && <p className="text-sm text-gray-500">還沒有執行紀錄。</p>}
                  {runs.length > 0 && (
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-2 py-1 text-left">時間</th>
                            <th className="px-2 py-1 text-left">階段</th>
                            <th className="px-2 py-1 text-left">結果</th>
                            <th className="px-2 py-1 text-left">耗時</th>
                            <th className="px-2 py-1 text-left">訊息</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs.map((r) => (
                            <tr key={r.id} className="border-t border-gray-50">
                              <td className="px-2 py-1 text-gray-500">
                                {new Date(r.createdAt).toLocaleString("zh-TW")}
                              </td>
                              <td className="px-2 py-1 font-mono">{r.stage}</td>
                              <td className="px-2 py-1">
                                {r.status === "success" ? (
                                  <span className="text-emerald-600">成功</span>
                                ) : r.status === "skipped" ? (
                                  <span className="text-gray-400">略過</span>
                                ) : (
                                  <span className="text-red-600">失敗</span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-gray-500">{r.durationMs}ms</td>
                              <td className="px-2 py-1 text-gray-600">{r.error ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>

        {/* 待辦 */}
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">階段待辦提醒</h2>
            <button
              type="button"
              onClick={() =>
                withBusy("同步待辦", async () => {
                  const result = await syncTasksMutation.mutateAsync();
                  toast.success(`已同步，新增 ${result.created} 筆`);
                  await tasksQuery.refetch();
                })
              }
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700"
            >
              同步待辦
            </button>
          </div>
          {tasks.length === 0 && (
            <p className="text-sm text-gray-500">還沒有待辦。按「同步待辦」會依取貨、集貨、報關、法遵月檢等排程產生。</p>
          )}
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                <input
                  type="checkbox"
                  checked={t.status === "done"}
                  onChange={async () => {
                    await completeTaskMutation.mutateAsync({ id: t.id });
                    await tasksQuery.refetch();
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-bold ${t.status === "done" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                      {t.title}
                    </span>
                    <span className="text-xs text-gray-400">{t.owner}</span>
                    {t.dueAt && (
                      <span className="text-xs text-gray-400">
                        到期 {new Date(t.dueAt).toLocaleDateString("zh-TW")}
                      </span>
                    )}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{t.detail}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 小元件                                                              */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" | "emerald" }) {
  const cls =
    tone === "red" && value > 0
      ? "text-red-600"
      : tone === "amber" && value > 0
        ? "text-amber-600"
        : tone === "emerald" && value > 0
          ? "text-emerald-600"
          : "text-gray-800";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-gray-800";
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  extra,
  children,
}: {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-[#0ABAB5]">{icon}</span>
        <span className="font-bold text-gray-800">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {extra}
          <ChevronLeft className={`h-4 w-4 text-gray-400 transition-transform ${open ? "-rotate-90" : "rotate-0"}`} />
        </span>
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}

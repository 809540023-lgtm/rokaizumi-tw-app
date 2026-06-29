import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import { Package, ClipboardList, Users, BarChart3, Pencil, Trash2, Search, Plus, X, ShieldCheck } from "lucide-react";

const A = trpc as any;

const PRODUCT_STATUS = [
  { v: "available", label: "上架（販售中）" },
  { v: "reserved", label: "預訂" },
  { v: "sold", label: "下架（停售）" },
];
const ORDER_STATUS = [
  { v: "pending", label: "處理中" },
  { v: "paid", label: "已付款" },
  { v: "shipped", label: "已出貨" },
  { v: "completed", label: "已完成" },
  { v: "cancelled", label: "已取消" },
];
const orderLabel = (s: string) => ORDER_STATUS.find((o) => o.v === s)?.label || s;

export default function AdminManage() {
  const { user } = useAuth() as any;
  const [tab, setTab] = useState("products");

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-gray-600">
          {!user ? "請先登入管理員帳號。" : "需要管理員權限才能進入後台。"}
        </div>
      </div>
    );
  }

  const TABS = [
    { k: "products", label: "商品管理", icon: Package },
    { k: "orders", label: "訂單管理", icon: ClipboardList },
    { k: "users", label: "會員管理", icon: Users },
    { k: "report", label: "銷售報表", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl font-bold mb-4">後台管理</h1>
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={
                  "px-4 py-2 text-sm font-bold border-b-2 -mb-px whitespace-nowrap " +
                  (tab === t.k ? "border-[#0ABAB5] text-[#0ABAB5]" : "border-transparent text-gray-500")
                }
              >
                <Icon className="w-4 h-4 inline mr-1" />
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === "products" && <ProductsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "users" && <UsersTab meId={user.id} />}
        {tab === "report" && <ReportTab />}
      </div>
    </div>
  );
}

function ProductsTab() {
  const { data: products = [], isLoading, refetch } = trpc.products.list.useQuery();
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any>(null);

  const catName = (id: number) => (categories as any[]).find((c) => c.id === id)?.name || "—";
  const list = (products as any[]).filter((p) => !q || (p.name || "").toLowerCase().includes(q.toLowerCase())).slice(0, 300);

  const updateMut = trpc.products.update.useMutation();
  const stockMut = trpc.products.updateStock.useMutation();
  const delMut = trpc.products.delete.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e: any) => toast.error(e.message || "刪除失敗"),
  });

  async function saveEdit(form: any) {
    try {
      await updateMut.mutateAsync({
        id: editing.id, name: form.name, description: editing.description || "",
        price: Number(form.price), categoryId: Number(form.categoryId),
        imageUrl: editing.imageUrl || "", images: editing.images || [],
        status: form.status, specifications: editing.specifications || "",
      } as any);
      if (Number(form.stock) !== (editing.stock ?? 0)) {
        await stockMut.mutateAsync({ id: editing.id, stock: Number(form.stock) } as any);
      }
      toast.success("已更新");
      setEditing(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "更新失敗");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋商品名稱" className="flex-1 outline-none text-sm bg-transparent" />
        </div>
        <Link href="/selection" className="px-3 py-2 rounded-lg bg-[#0ABAB5] text-white text-sm font-bold flex items-center gap-1">
          <Plus className="w-4 h-4" /> 新增商品
        </Link>
        <span className="text-sm text-gray-500 ml-auto">共 {(products as any[]).length} 件</span>
      </div>

      {isLoading ? <div className="text-center py-10 text-gray-400">載入中...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500"><tr>
                <th className="text-left p-3 font-medium">商品</th><th className="text-left p-3 font-medium">分類</th>
                <th className="text-right p-3 font-medium">售價</th><th className="text-right p-3 font-medium">庫存</th>
                <th className="text-center p-3 font-medium">狀態</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="p-3"><div className="flex items-center gap-2">
                      {p.imageUrl ? <img src={p.imageUrl} className="w-10 h-10 object-cover rounded border border-gray-100" /> : <div className="w-10 h-10 bg-gray-100 rounded" />}
                      <span className="line-clamp-2 max-w-xs">{p.name}</span>
                    </div></td>
                    <td className="p-3 text-gray-600">{catName(p.categoryId)}</td>
                    <td className="p-3 text-right">NT$ {Number(p.price).toLocaleString()}</td>
                    <td className="p-3 text-right">{p.stock ?? 0}</td>
                    <td className="p-3 text-center">
                      <span className={"text-xs px-2 py-0.5 rounded-full " + (p.status === "available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {PRODUCT_STATUS.find((s) => s.v === p.status)?.label || p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(p)} className="text-[#0ABAB5] px-2" title="編輯"><Pencil className="w-4 h-4 inline" /></button>
                      <button onClick={() => { if (confirm("確定刪除「" + p.name + "」？")) delMut.mutate({ id: p.id } as any); }} className="text-red-500 px-2" title="刪除"><Trash2 className="w-4 h-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <EditModal product={editing} categories={categories} onClose={() => setEditing(null)} onSave={saveEdit} saving={updateMut.isPending || stockMut.isPending} />}
    </div>
  );
}

function EditModal({ product, categories, onClose, onSave, saving }: any) {
  const [form, setForm] = useState({
    name: product.name || "", price: String(product.price ?? ""), stock: String(product.stock ?? 0),
    categoryId: String(product.categoryId || ""), status: product.status || "available",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title="編輯商品" onClose={onClose}>
      <div className="space-y-3">
        <Field label="名稱"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="售價 NT$"><input value={form.price} onChange={(e) => set("price", e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></Field>
          <Field label="庫存"><input value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></Field>
        </div>
        <Field label="分類">
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            {(categories as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="狀態">
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            {PRODUCT_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-bold">取消</button>
        <button onClick={() => onSave(form)} disabled={saving} className="flex-1 py-2 rounded-lg bg-[#0ABAB5] text-white text-sm font-bold disabled:opacity-60">{saving ? "儲存中..." : "儲存"}</button>
      </div>
    </Modal>
  );
}

function OrdersTab() {
  const { data: orders = [], isLoading, error, refetch } = A.admin.orders.useQuery(undefined, { retry: false });
  const [detailId, setDetailId] = useState<number | null>(null);
  const updateStatus = A.admin.updateOrderStatus.useMutation({
    onSuccess: () => { toast.success("狀態已更新"); refetch(); },
    onError: (e: any) => toast.error(e.message || "更新失敗"),
  });
  const fmt = (n: number) => "¥" + Number(n || 0).toLocaleString();
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("zh-TW"); } catch { return ""; } };
  const list = [...((orders as any[]) || [])].sort((a, b) => b.id - a.id);

  if (error) return <div className="text-center py-10 text-gray-400">無法載入訂單（請確認管理員權限）。</div>;
  return isLoading ? <div className="text-center py-10 text-gray-400">載入中...</div> : (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr>
              <th className="text-left p-3 font-medium">訂單</th><th className="text-left p-3 font-medium">日期</th>
              <th className="text-left p-3 font-medium">收件人</th><th className="text-right p-3 font-medium">金額</th>
              <th className="text-left p-3 font-medium">狀態</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {list.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-gray-400">目前沒有訂單</td></tr> :
                list.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="p-3 font-bold">#{o.id}</td>
                    <td className="p-3 text-gray-600">{fmtDate(o.createdAt)}</td>
                    <td className="p-3 text-gray-600">{o.contactName || "—"}</td>
                    <td className="p-3 text-right">{fmt(o.totalAmount)}</td>
                    <td className="p-3">
                      <select value={o.status} onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white">
                        {ORDER_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-right"><button onClick={() => setDetailId(o.id)} className="text-[#0ABAB5] text-xs font-bold">明細</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {detailId != null && <OrderDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function OrderDetailModal({ id, onClose }: any) {
  const { data: o, isLoading } = A.admin.orderById.useQuery({ id }, { retry: false });
  const fmt = (n: number) => "¥" + Number(n || 0).toLocaleString();
  return (
    <Modal title={"訂單 #" + id + " 明細"} onClose={onClose}>
      {isLoading || !o ? <div className="py-8 text-center text-gray-400">載入中...</div> : (
        <div className="space-y-4 text-sm">
          <div className="bg-[#FEF9F3] rounded-lg p-3 space-y-1">
            <div><span className="text-gray-500">收件人：</span>{o.contactName}　{o.contactPhone}</div>
            <div><span className="text-gray-500">地址：</span>{o.shippingAddress}</div>
            {o.contactEmail && <div><span className="text-gray-500">Email：</span>{o.contactEmail}</div>}
            {o.notes && <div><span className="text-gray-500">備註：</span>{o.notes}</div>}
            <div><span className="text-gray-500">狀態：</span>{orderLabel(o.status)}</div>
          </div>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500"><tr>
                <th className="text-left p-2 font-medium">商品</th><th className="text-center p-2 font-medium">數量</th>
                <th className="text-right p-2 font-medium">單價</th><th className="text-right p-2 font-medium">小計</th>
              </tr></thead>
              <tbody>
                {(o.items || []).map((it: any) => (
                  <tr key={it.id} className="border-t border-gray-100">
                    <td className="p-2"><span className="line-clamp-2">{it.productName}</span></td>
                    <td className="p-2 text-center">{it.quantity}</td>
                    <td className="p-2 text-right">{fmt(it.productPrice)}</td>
                    <td className="p-2 text-right">{fmt(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between font-bold"><span>合計</span><span className="text-[#E26D5C]">{fmt(o.totalAmount)}</span></div>
        </div>
      )}
    </Modal>
  );
}

function UsersTab({ meId }: any) {
  const { data: users = [], isLoading, error, refetch } = A.admin.users.useQuery(undefined, { retry: false });
  const setRole = A.admin.setUserRole.useMutation({
    onSuccess: () => { toast.success("已更新權限"); refetch(); },
    onError: (e: any) => toast.error(e.message || "更新失敗"),
  });
  if (error) return <div className="text-center py-10 text-gray-400">無法載入會員（可能後端尚在部署，稍候再試）。</div>;
  const list = [...((users as any[]) || [])].sort((a, b) => a.id - b.id);
  return isLoading ? <div className="text-center py-10 text-gray-400">載入中...</div> : (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500"><tr>
            <th className="text-left p-3 font-medium">ID</th><th className="text-left p-3 font-medium">名稱</th>
            <th className="text-left p-3 font-medium">Email</th><th className="text-center p-3 font-medium">權限</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {list.map((u) => {
              const isAdmin = u.role === "admin";
              return (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="p-3 text-gray-500">{u.id}</td>
                  <td className="p-3">{u.name || "—"}</td>
                  <td className="p-3 text-gray-600 break-all">{u.email}</td>
                  <td className="p-3 text-center">
                    <span className={"text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 " + (isAdmin ? "bg-[#0ABAB5]/10 text-[#0ABAB5]" : "bg-gray-100 text-gray-500")}>
                      {isAdmin && <ShieldCheck className="w-3 h-3" />}{isAdmin ? "管理員" : "一般會員"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {u.id === meId ? <span className="text-xs text-gray-400">（你自己）</span> :
                      <button onClick={() => setRole.mutate({ userId: u.id, role: isAdmin ? "user" : "admin" })} className={"text-xs font-bold px-2 py-1 rounded " + (isAdmin ? "text-red-500" : "text-[#0ABAB5]")}>
                        {isAdmin ? "取消管理員" : "設為管理員"}
                      </button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportTab() {
  const { data: today } = A.admin.todayRevenue.useQuery(undefined, { retry: false });
  const { data: month } = A.admin.monthRevenue.useQuery(undefined, { retry: false });
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: orders = [] } = A.admin.orders.useQuery(undefined, { retry: false });
  const card = (label: string, value: any, sub?: string) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
  const usd = (n: any) => "US$ " + Number(n || 0).toLocaleString();
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {card("今日訂單", (today?.count ?? 0) + " 筆", "營收 " + usd(today?.totalUSD))}
      {card("本月訂單", (month?.count ?? 0) + " 筆", "營收 " + usd(month?.totalUSD))}
      {card("總訂單數", ((orders as any[])?.length ?? 0) + " 筆")}
      {card("商品總數", (products as any[]).length + " 件")}
      {card("上架中商品", (products as any[]).filter((p) => p.status === "available").length + " 件")}
      {card("管理員可在各分頁操作", "商品 / 訂單 / 會員")}
    </div>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}

import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Package, ChevronRight } from "lucide-react";

const STATUS_MAP: Record<string, string> = {
  pending: "處理中",
  paid: "已付款",
  confirmed: "已確認",
  processing: "處理中",
  shipped: "已出貨",
  delivered: "已送達",
  completed: "已完成",
  cancelled: "已取消",
  canceled: "已取消",
  refunded: "已退款",
};

export default function Orders() {
  const { user } = useAuth() as any;
  const { data: orders = [], isLoading } = trpc.orders.list.useQuery(undefined as any, {
    enabled: !!user,
  });

  const fmt = (n: number) => "¥" + Number(n || 0).toLocaleString();
  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("zh-TW");
    } catch (e) {
      return "";
    }
  };

  const list = [...(orders as any[])].sort((a, b) => b.id - a.id);

  return (
    <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl w-full">
        <h1 className="text-2xl font-bold mb-6">我的訂單</h1>

        {!user ? (
          <div className="bg-white rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">🔐</div>
            <p className="text-gray-600 mb-4">請先登入以查看您的訂單</p>
            <Link
              href="/login"
              className="inline-block px-5 py-2.5 rounded-lg bg-[#0ABAB5] text-white font-bold text-sm"
            >
              前往登入
            </Link>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20 text-gray-400">載入中...</div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-600 mb-4">您目前還沒有訂單</p>
            <Link
              href="/products"
              className="inline-block px-5 py-2.5 rounded-lg bg-[#0ABAB5] text-white font-bold text-sm"
            >
              去逛逛商品
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((o) => (
              <Link
                key={o.id}
                href={"/order-confirmation?orderId=" + o.id}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-[#0ABAB5] transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-[#0ABAB5]/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-[#0ABAB5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">訂單 #{o.id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {STATUS_MAP[o.status] || o.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{fmtDate(o.createdAt)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-[#E26D5C]">{fmt(o.totalAmount)}</div>
                  <div className="text-xs text-gray-400 flex items-center justify-end gap-0.5">
                    查看明細 <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

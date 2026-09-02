import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, PackageSearch, Search } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { trpc } from "@/lib/trpc";

type AgProduct = {
  id: number | string;
  barcode: string;
  catalog?: string | null;
  nameJa: string;
  nameEn?: string | null;
  countryOrigin?: string | null;
  retailPriceTwd: number;
  imageUrl?: string | null;
  images?: string[] | null;
  size?: string | null;
  capacity?: string | null;
  material?: string | null;
  assortment?: string | null;
  status: "available" | "discontinued";
  sortOrder: number;
};

const PAGE_SIZE = 24;

export default function Ag() {
  const [staticProducts, setStaticProducts] = useState<AgProduct[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data: databaseProducts } = trpc.agProducts.list.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    fetch("/ag-products.json")
      .then((response) => {
        if (!response.ok) throw new Error("商品資料載入失敗");
        return response.json();
      })
      .then((rows: AgProduct[]) => setStaticProducts(rows))
      .catch(() => setStaticProducts([]));
  }, []);

  const products = (databaseProducts?.length ? databaseProducts : staticProducts) as AgProduct[];
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return products;
    return products.filter((product) =>
      [product.nameJa, product.nameEn, product.catalog, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(keyword))
    );
  }, [products, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [query]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <div className="min-h-screen bg-[#FEF9F3] text-gray-900">
      <SiteHeader />
      <main>
        <section className="overflow-hidden border-b border-[#0ABAB5]/15 bg-gradient-to-br from-white via-[#F2FFFD] to-[#FFF2EA]">
          <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-[#0ABAB5]/10 px-3 py-1 text-sm font-bold text-[#087F7B]">
                山田化學生活選品
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                實用日本生活小物，<span className="text-[#E26D5C]">單件 NT$22</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
                本頁商品採固定售價，已停售品項不會顯示。可用商品名稱、型號或條碼快速搜尋。
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex w-full max-w-xl items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <Search className="mr-3 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="sr-only">搜尋山田化學商品</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋名稱、型號或條碼"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <p className="text-sm text-gray-500" aria-live="polite">
              共 {filtered.length} 件商品
            </p>
          </div>

          {visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {visible.map((product) => (
                <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-square bg-gray-50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.nameJa}
                        loading="lazy"
                        className="h-full w-full object-contain p-3"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300">
                        <PackageSearch className="h-10 w-10" aria-hidden="true" />
                        <span className="text-xs">圖片整理中</span>
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-[#E26D5C] px-2.5 py-1 text-xs font-black text-white shadow-sm">
                      NT$22
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <div className="mb-1 text-[11px] font-bold tracking-wide text-[#087F7B]">
                      {product.catalog ? `型號 ${product.catalog}` : `JAN ${product.barcode}`}
                    </div>
                    <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 sm:text-base">
                      {product.nameJa}
                    </h2>
                    {product.nameEn && (
                      <p className="mt-1 line-clamp-2 text-xs leading-4 text-gray-500">{product.nameEn}</p>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                      <div>
                        <div className="text-xs text-gray-400">定價</div>
                        <div className="text-xl font-black text-[#E26D5C]">NT$22</div>
                      </div>
                      <a
                        href="https://line.me/R/ti/p/@rokaizumi"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#0ABAB5] px-2.5 py-2 text-xs font-bold text-white hover:bg-[#089B96]"
                        aria-label={`透過 LINE 詢問 ${product.nameJa}`}
                      >
                        LINE 詢問 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-gray-500">
              <PackageSearch className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
              {products.length ? "找不到符合條件的商品。" : "商品資料載入中，請稍候。"}
            </div>
          )}

          {pageCount > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="商品分頁">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> 上一頁
              </button>
              <span className="min-w-20 text-center text-sm text-gray-500">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={page === pageCount}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一頁 <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

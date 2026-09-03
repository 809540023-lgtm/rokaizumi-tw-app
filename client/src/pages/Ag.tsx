import { useEffect, useMemo, useState } from "react";
import { BadgeInfo, ChevronLeft, ChevronRight, ExternalLink, Globe2, PackageSearch, Search, X } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { LINE_ADD_FRIEND_URL } from "@/lib/line";
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
  officialMatched?: boolean;
  officialProductNumber?: string | null;
  officialQuantity?: string | null;
  officialPackageSize?: string | null;
  officialCaseSize?: string | null;
  officialSourceUrl?: string | null;
  status: "available" | "discontinued";
  sortOrder: number;
};

const PAGE_SIZE = 24;

export default function Ag() {
  const [staticProducts, setStaticProducts] = useState<AgProduct[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<AgProduct | null>(null);
  const { data: databaseProducts } = trpc.agProducts.list.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    fetch("/ag-products.json?v=20260903-complete-catalog")
      .then((response) => {
        if (!response.ok) throw new Error("商品資料載入失敗");
        return response.json();
      })
      .then((rows: AgProduct[]) => setStaticProducts(rows))
      .catch(() => setStaticProducts([]));
  }, []);

  const products = useMemo(() => {
    if (!databaseProducts?.length) return staticProducts;
    const databaseByBarcode = new Map(databaseProducts.map((product) => [product.barcode, product]));
    const staticBarcodes = new Set(staticProducts.map((product) => product.barcode));
    const mergedStaticProducts = staticProducts.map((product) => ({
      ...product,
      ...databaseByBarcode.get(product.barcode),
    }));
    const databaseOnlyProducts = databaseProducts.filter((product) => !staticBarcodes.has(product.barcode));
    return [...mergedStaticProducts, ...databaseOnlyProducts] as AgProduct[];
  }, [databaseProducts, staticProducts]);
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
  useEffect(() => {
    if (!selectedProduct) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProduct(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedProduct]);

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
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="group relative aspect-square bg-gray-50 text-left"
                    aria-label={`查看 ${product.nameJa} 官方商品資訊`}
                  >
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
                    <span className="absolute inset-x-3 bottom-3 translate-y-2 rounded-lg bg-gray-900/80 px-3 py-2 text-center text-xs font-bold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                      查看官方資料
                    </span>
                  </button>
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
                    <div className="mt-auto pt-4">
                      <div className="mb-3 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-400">定價</div>
                        <div className="text-xl font-black text-[#E26D5C]">NT$22</div>
                      </div>
                        {product.officialMatched && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#087F7B]">
                            <BadgeInfo className="h-3.5 w-3.5" /> 官網資料
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="rounded-lg border border-[#0ABAB5] px-2 py-2 text-xs font-bold text-[#087F7B] hover:bg-[#0ABAB5]/5"
                        >
                          官方資訊
                        </button>
                      <a
                        href={LINE_ADD_FRIEND_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0ABAB5] px-2 py-2 text-xs font-bold text-white hover:bg-[#089B96]"
                        aria-label={`透過 LINE 詢問 ${product.nameJa}`}
                      >
                        LINE 詢問 <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      </div>
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
      {selectedProduct && (
        <OfficialProductModal
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <SiteFooter />
    </div>
  );
}

function OfficialProductModal({ product, onClose }: { product: AgProduct; onClose: () => void }) {
  const images = (product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []).filter(Boolean) as string[];
  const [activeImage, setActiveImage] = useState(0);
  const specs = [
    ["官方品番", product.officialProductNumber ? `No.${product.officialProductNumber}` : product.catalog],
    ["JAN 條碼", product.barcode],
    ["商品尺寸", product.size],
    ["容量", product.capacity],
    ["材質", product.material],
    ["顏色／組合", product.assortment],
    ["產地", product.countryOrigin],
    ["官網包裝數量", product.officialQuantity],
    ["包裝尺寸", product.officialPackageSize],
    ["外箱尺寸", product.officialCaseSize],
  ].filter(([, value]) => value);
  const introduction = [
    `「${product.nameJa}」是山田化學的生活用品。`,
    product.size ? `商品尺寸為 ${product.size}。` : null,
    product.capacity ? `容量為 ${product.capacity}。` : null,
    product.material ? `材質為 ${product.material}。` : null,
    product.assortment ? `顏色／組合：${product.assortment}。` : null,
    product.countryOrigin ? `產地為 ${product.countryOrigin}。` : null,
  ]
    .filter(Boolean)
    .join("");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ag-official-product-title"
    >
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-gray-500 shadow hover:text-gray-900"
          aria-label="關閉官方商品資訊"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="bg-[#F6F7F7] p-5 sm:p-8">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wide text-[#087F7B]">
              <Globe2 className="h-4 w-4" /> 山田化學官方商品資料
            </div>
            <div className="aspect-square overflow-hidden rounded-xl bg-white">
              {images.length ? (
                <img src={images[activeImage]} alt={product.nameJa} className="h-full w-full object-contain p-4" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300">
                  <PackageSearch className="h-12 w-12" />
                  <span className="text-sm">官網目前沒有對應圖片</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    type="button"
                    key={image}
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${activeImage === index ? "border-[#0ABAB5]" : "border-transparent"}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-8">
            <p className="text-sm font-bold text-[#087F7B]">
              {product.officialProductNumber ? `No.${product.officialProductNumber}` : product.catalog || "山田化學"}
            </p>
            <h2 id="ag-official-product-title" className="mt-2 pr-10 text-2xl font-black leading-tight">
              {product.nameJa}
            </h2>
            {product.nameEn && <p className="mt-2 text-sm text-gray-500">{product.nameEn}</p>}

            <div className="mt-5 rounded-xl bg-[#FFF4EE] px-4 py-3">
              <span className="text-sm text-gray-500">本站定價</span>
              <span className="ml-3 text-2xl font-black text-[#E26D5C]">NT$22</span>
            </div>

            <section className="mt-5 rounded-xl border border-[#0ABAB5]/15 bg-[#F2FFFD] p-4">
              <h3 className="font-bold text-[#087F7B]">商品介紹</h3>
              <p className="mt-2 text-sm leading-6 text-gray-700">{introduction}</p>
            </section>

            <dl className="mt-5 divide-y divide-gray-100 border-y border-gray-100 text-sm">
              {specs.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7rem_1fr] gap-3 py-2.5">
                  <dt className="font-medium text-gray-500">{label}</dt>
                  <dd className="break-words text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>

            {!product.officialMatched && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                這件商品尚未在目前的官方目錄中對到完整規格，請至官網以 JAN 條碼查詢。
              </p>
            )}

            <div className="mt-6">
              <a
                href={LINE_ADD_FRIEND_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0ABAB5] px-4 py-3 text-sm font-bold text-white hover:bg-[#089B96]"
              >
                LINE 詢問此商品 <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-400">
              商品規格整理自山田化學官方目錄；最新內容仍以原廠網站為準。本站不顯示原廠批發報價。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

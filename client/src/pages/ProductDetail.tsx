import { useRoute, useLocation, Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ProductCard } from '@/components/ProductCard';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { Star, ShoppingCart, Zap, ShieldCheck, Truck, Package, Check, ChevronRight, ImageOff } from 'lucide-react';

export default function ProductDetail() {
  const [, params] = useRoute('/product/:productId');
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);

  const productId = params?.productId ? Number(params.productId) : 0;
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });
  const { data: allProducts = [] } = trpc.products.list.useQuery();
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => toast.success('已加入購物車'),
    onError: (e: any) => toast.error(e.message || '加入購物車失敗'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-gray-400">読み込み中...</div>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-gray-600">找不到此商品</p>
          <button onClick={() => setLocation('/products')} className="mt-4 text-[#0ABAB5] font-bold text-sm">查看全部商品 →</button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const p: any = product;
  const price = Number(p.price) || 0;
  const orig = Number(p.originalPrice) || 0;
  const hasDiscount = orig > price && orig > 0;
  const rating = Number(p.rating) || 0;
  const reviewCount = p.reviewCount || 0;
  const stock = p.stock ?? 0;
  const inStock = stock > 0;
  const category = categories.find((c: any) => c.id === p.categoryId);

  const highlights = String(p.name || '')
    .split(/[\s,，、／/|【】\[\]()（）]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 24)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 6);

  const related = (allProducts as any[])
    .filter((x) => x.categoryId === p.categoryId && x.id !== p.id)
    .slice(0, 5);

  const fmt = (n: number) => '¥' + n.toLocaleString();

  const handleAdd = () => addToCart.mutate({ productId: p.id, quantity });
  const handleBuyNow = () =>
    addToCart.mutate({ productId: p.id, quantity }, { onSuccess: () => setLocation('/cart') });

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader />

      <div className="container mx-auto px-4 py-3 text-xs text-gray-500 flex items-center gap-1 flex-wrap">
        <Link href="/" className="hover:text-[#0ABAB5]">首頁</Link>
        <ChevronRight className="w-3 h-3" />
        {category && (
          <>
            <Link href={'/products/' + category.id} className="hover:text-[#0ABAB5]">{category.name}</Link>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-gray-700 line-clamp-1 max-w-[60%]">{p.name}</span>
      </div>

      <div className="container mx-auto px-4 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* image */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4 lg:sticky lg:top-24">
              <div className="aspect-square w-full flex items-center justify-center overflow-hidden">
                {p.imageUrl && !imgError ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    onError={() => setImgError(true)}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-300">
                    <ImageOff className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* title + highlights */}
          <div className="lg:col-span-4">
            <h1 className="text-xl md:text-2xl font-bold leading-snug text-gray-900">{p.name}</h1>
            {p.brand && <div className="mt-1.5 text-sm font-medium text-[#0ABAB5]">{p.brand}</div>}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={'w-4 h-4 ' + (i <= Math.round(rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-300')} />
                ))}
              </div>
              <span className="text-xs text-gray-500">{reviewCount > 0 ? reviewCount + ' 則評論' : '尚無評論'}</span>
            </div>

            <hr className="my-4 border-gray-100" />

            <h2 className="text-sm font-bold mb-2.5 text-gray-900">商品特色</h2>
            <ul className="space-y-2">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-[#0ABAB5] mt-0.5 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* buy box */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-24">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl font-bold text-[#E26D5C]">{fmt(price)}</span>
                {hasDiscount && <span className="text-sm text-gray-400 line-through">{fmt(orig)}</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1">{p.isTaxExempt ? '免關稅・含稅價' : '含稅價'}</div>

              <div className={'mt-3 text-sm font-bold flex items-center gap-1 ' + (inStock ? 'text-green-600' : 'text-gray-400')}>
                <Check className="w-4 h-4" />
                {inStock ? '庫存充足' : '補貨中'}
              </div>

              <div className="flex items-center gap-3 mt-4">
                <span className="text-sm text-gray-600">數量</span>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-1 text-lg text-gray-600">−</button>
                  <span className="px-3 text-sm w-8 text-center">{quantity}</span>
                  <button onClick={() => setQuantity((q) => q + 1)} className="px-3 py-1 text-lg text-gray-600">+</button>
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={addToCart.isPending || !inStock}
                className="w-full mt-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ShoppingCart className="w-4 h-4" /> 加入購物車
              </button>
              <button
                onClick={handleBuyNow}
                disabled={addToCart.isPending || !inStock}
                className="w-full mt-2 py-2.5 rounded-lg bg-[#E26D5C] hover:opacity-90 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Zap className="w-4 h-4" /> 立即購買
              </button>

              <div className="mt-5 pt-4 border-t border-gray-100 space-y-2.5 text-xs text-gray-600">
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#0ABAB5] shrink-0" /> 大阪倉庫直送・原廠正品</div>
                <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-[#0ABAB5] shrink-0" /> 7 個工作天到貨</div>
                <div className="flex items-center gap-2"><Package className="w-4 h-4 text-[#0ABAB5] shrink-0" /> 3 年保固</div>
              </div>
            </div>
          </div>
        </div>

        {/* description + specs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold mb-3 text-gray-900">商品說明</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.description || p.name}</p>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold mb-3 text-gray-900">規格</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100"><td className="py-2 text-gray-500 w-20 align-top">品牌</td><td className="py-2 text-gray-800">{p.brand || '—'}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 text-gray-500 align-top">型號</td><td className="py-2 text-gray-800 break-all">{p.sku || '—'}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 text-gray-500 align-top">分類</td><td className="py-2 text-gray-800">{category?.name || '—'}</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 text-gray-500 align-top">庫存</td><td className="py-2 text-gray-800">{stock} 件</td></tr>
                  <tr><td className="py-2 text-gray-500 align-top">關稅</td><td className="py-2 text-gray-800">{p.isTaxExempt ? '免關稅' : '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* related */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold mb-4 text-gray-900">同類商品推薦</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {related.map((x: any) => (
                <ProductCard
                  key={x.id}
                  product={x}
                  language={language}
                  quantity={1}
                  onQuantityChange={() => {}}
                  onAddToCart={() => addToCart.mutate({ productId: x.id, quantity: 1 })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

import { Link, useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { useAuth } from '../_core/hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { useState } from 'react';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';

function formatPrice(price: number, language: 'zh' | 'en' | 'ja'): string {
  if (language === 'zh') return `NT$ ${Math.round(price).toLocaleString()}`;
  if (language === 'ja') return `¥ ${Math.round(price * 4.5).toLocaleString()}`;
  return `$ ${(price * 0.031).toFixed(2)}`;
}

export default function Cart() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: cartItems = [], refetch } = trpc.cart.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => toast.error(e.message || '更新失敗'),
  });
  const removeMutation = trpc.cart.remove.useMutation({
    onSuccess: () => { toast.success('已移除'); refetch(); },
  });

  const handleQuantityChange = (itemId: number, current: number, delta: number) => {
    const next = Math.max(1, current + delta);
    updateMutation.mutate({ id: itemId, quantity: next });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="text-7xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-3">請先登入查看購物車</h1>
          <p className="text-gray-600 mb-6">登入後您的購物車內容會自動帶入</p>
          <button onClick={() => setLocation('/login')}
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold transition-colors">
            前往登入
          </button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + (item.price ?? item.product?.price ?? 0) * item.quantity, 0);
  const shipping = subtotal >= 3000 ? 0 : 250;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />

      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="text-xs text-gray-400 mb-2">首頁 / 購物車</div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-7 h-7" /> 購物車 ({cartItems.length})
          </h1>
        </div>
      </div>

      {cartItems.length === 0 ? (
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="text-7xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2">購物車是空的</h2>
          <p className="text-gray-600 mb-6">逛逛我們的 220 件嚴選日本介護用品</p>
          <Link href="/products">
            <a className="inline-block bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold transition-colors">
              開始選購 →
            </a>
          </Link>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            {/* 商品列表 */}
            <div className="space-y-3">
              {cartItems.map((item: any) => (
                <div key={item.id} className="bg-white rounded-2xl p-4 flex gap-4 shadow-sm">
                  <Link href={`/product/${item.productId}`}>
                    <a className="block w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                      {item.imageUrl || item.product?.imageUrl ? (
                        <img src={item.imageUrl || item.product?.imageUrl} alt={item.name || item.product?.name}
                          className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
                      )}
                    </a>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.productId}`}>
                      <a className="block font-bold text-sm leading-snug line-clamp-2 hover:text-[#0ABAB5] transition-colors">
                        {item.name || item.product?.name || '商品'}
                      </a>
                    </Link>
                    <div className="text-[#DC2626] font-black text-lg mt-1">
                      {formatPrice(item.price ?? item.product?.price ?? 0, language)}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button onClick={() => removeMutation.mutate({ id: item.id })}
                        className="text-gray-400 hover:text-[#DC2626] p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <Link href="/products">
                <a className="block text-center mt-4 text-[#0ABAB5] hover:text-[#089B96] font-bold text-sm">
                  ← 繼續選購其他商品
                </a>
              </Link>
            </div>

            {/* 結帳摘要 */}
            <aside className="bg-white rounded-2xl p-6 h-fit lg:sticky lg:top-24 shadow-sm">
              <h3 className="font-bold text-lg mb-4">訂單摘要</h3>

              <div className="space-y-2 text-sm mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">商品小計</span>
                  <span className="font-bold">{formatPrice(subtotal, language)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">運費</span>
                  <span className="font-bold">{shipping === 0 ? '免運' : formatPrice(shipping, language)}</span>
                </div>
                {subtotal < 3000 && (
                  <div className="text-xs text-amber-600 mt-1">
                    再加 {formatPrice(3000 - subtotal, language)} 即可享免運
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline mb-5">
                <span className="font-bold">總計</span>
                <span className="text-[#DC2626] font-black text-2xl">
                  {formatPrice(total, language)}
                </span>
              </div>

              <button onClick={() => setLocation('/checkout')}
                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                前往結帳 <ArrowRight className="w-4 h-4" />
              </button>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                <span>✓ 7 天到貨</span>
                <span>✓ 免關稅</span>
                <span>✓ 3 年保固</span>
              </div>
            </aside>
          </div>
        </div>
      )}

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

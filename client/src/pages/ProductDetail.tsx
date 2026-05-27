import { useRoute, useLocation, Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ShoppingCart, Heart, Minus, Plus, Truck, Shield, Award, MessageCircle, ChevronLeft, Star,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ProductCard } from '@/components/ProductCard';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';

function formatPrice(price: number, language: 'zh' | 'en' | 'ja'): string {
  if (language === 'zh') return `NT$ ${Math.round(price).toLocaleString()}`;
  if (language === 'ja') return `¥ ${Math.round(price * 4.5).toLocaleString()}`;
  return `$ ${(price * 0.031).toFixed(2)}`;
}

export default function ProductDetail() {
  const [, params] = useRoute('/product/:productId');
  const productId = Number(params?.productId);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'spec' | 'reviews' | 'shipping'>('desc');

  const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });
  const { data: allProducts = [] } = trpc.products.list.useQuery();
  const aggReviews = (trpc as any).reviews?.getAggregated?.useQuery?.({ productId });

  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => toast.success('已加入購物車'),
    onError: (e: any) => toast.error(e.message || '失敗'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FEF9F3] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#0ABAB5] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="text-7xl mb-4">😢</div>
          <h1 className="text-2xl font-bold mb-3">找不到此商品</h1>
          <Link href="/products">
            <a className="inline-block mt-4 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold">
              看其他商品
            </a>
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const p: any = product;
  const discount = p.originalPrice && p.originalPrice > p.price
    ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
  const rating = aggReviews?.data?.average ?? p.rating ?? 0;
  const reviewCount = aggReviews?.data?.count ?? p.reviewCount ?? 0;

  // 相關商品（同分類前 4 件）
  const related = allProducts.filter((rp: any) => rp.categoryId === p.categoryId && rp.id !== p.id).slice(0, 4);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error('請先登入');
      setLocation('/login');
      return;
    }
    addToCartMutation.mutate({ productId: p.id, quantity });
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />

      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
          <Link href="/"><a className="hover:text-[#0ABAB5]">首頁</a></Link>
          <span>/</span>
          <Link href="/products"><a className="hover:text-[#0ABAB5]">商品</a></Link>
          <span>/</span>
          <span className="text-gray-600">{p.categoryName || '介護用品'}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12">
          {/* 圖片區 */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden aspect-square relative">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-[#E0F7F6] flex items-center justify-center text-9xl">📦</div>
              )}
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-[#DC2626] text-white px-3 py-1.5 rounded-full text-sm font-bold">
                  -{discount}%
                </div>
              )}
              {p.isTaxExempt === 1 && (
                <div className="absolute top-4 right-4 bg-[#16A34A] text-white px-3 py-1.5 rounded-full text-xs font-bold">
                  非課税 免關稅
                </div>
              )}
            </div>

            {/* 縮圖列（如果有多張圖，這裡可擴充） */}
            <div className="flex gap-2 mt-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-20 h-20 bg-white rounded-lg overflow-hidden border-2 border-transparent hover:border-[#0ABAB5] cursor-pointer flex items-center justify-center text-3xl">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : '📦'}
                </div>
              ))}
            </div>
          </div>

          {/* 資訊區 */}
          <div>
            <Link href="/products">
              <a className="inline-flex items-center text-sm text-gray-600 hover:text-[#0ABAB5] mb-3">
                <ChevronLeft className="w-4 h-4" /> 返回商品列表
              </a>
            </Link>

            {p.brand && <div className="text-sm font-bold text-[#089B96] mb-2">{p.brand}</div>}
            <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3">{p.name}</h1>

            {rating > 0 && (
              <div className="flex items-center gap-2 mb-4 text-sm">
                <div className="flex text-[#F59E0B]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4" fill={i < Math.round(rating) ? '#F59E0B' : 'none'} stroke="#F59E0B" />
                  ))}
                </div>
                <span className="font-bold">{rating.toFixed(1)}</span>
                <span className="text-gray-400">({reviewCount} 則評論)</span>
              </div>
            )}

            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-black text-[#DC2626]">{formatPrice(p.price, language)}</span>
              {p.originalPrice && p.originalPrice > p.price && (
                <span className="text-gray-400 line-through">{formatPrice(p.originalPrice, language)}</span>
              )}
            </div>

            {/* 規格、品牌、SKU 資訊區 */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              {p.brand && <Info label="品牌">{p.brand}</Info>}
              {p.sku && <Info label="型號">{p.sku}</Info>}
              {p.categoryName && <Info label="分類">{p.categoryName}</Info>}
              <Info label="出貨地">日本 ・ 大阪倉庫</Info>
            </div>

            {/* 加入購物車區 */}
            <div className="bg-white rounded-2xl p-5 mb-5">
              <label className="text-sm font-bold block mb-2">數量</label>
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-bold">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-600">總計 {formatPrice(p.price * quantity, language)}</span>
              </div>

              <div className="flex gap-2">
                <button onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-6 py-4 rounded-xl font-bold transition-colors">
                  <ShoppingCart className="w-5 h-5" /> 加入購物車
                </button>
                <button className="flex items-center justify-center w-14 h-14 border-2 border-gray-200 hover:border-[#DC2626] hover:text-[#DC2626] text-gray-400 rounded-xl transition-colors">
                  <Heart className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 信任徽章 */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Badge icon={<Truck className="w-4 h-4" />} text="7 天到貨" />
              <Badge icon={<Shield className="w-4 h-4" />} text="3 年保固" />
              <Badge icon={<Award className="w-4 h-4" />} text="日本正品" />
            </div>

            <a href="https://line.me/R/ti/p/@rokaizumi" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#06C755] hover:bg-[#05a847] text-white px-6 py-3 rounded-xl font-bold transition-colors">
              <MessageCircle className="w-4 h-4" /> 不會挑？LINE 客服為您推薦
            </a>
          </div>
        </div>

        {/* 詳細資訊 Tabs */}
        <div className="mt-12 bg-white rounded-2xl overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {([
              ['desc', '商品詳情'], ['spec', '規格說明'], ['reviews', `評論 ${reviewCount}`], ['shipping', '配送 & 保固'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`px-6 py-4 font-bold whitespace-nowrap transition-colors ${
                  activeTab === key ? 'text-[#0ABAB5] border-b-2 border-[#0ABAB5]' : 'text-gray-500 hover:text-gray-800'
                }`}>{label}</button>
            ))}
          </div>
          <div className="p-6 md:p-8">
            {activeTab === 'desc' && (
              <div className="prose max-w-none text-gray-700">
                <p>{p.description || `${p.name} 是 ろかいずみ 嚴選的日本介護用品，由日本廠商直接供貨，符合日本厚生労働省介護用品標準。`}</p>
                <h4 className="font-bold mt-4 mb-2">產品特色</h4>
                <ul className="space-y-1">
                  <li>✓ 大阪倉庫直送、原廠正品</li>
                  <li>✓ 7 個工作天到貨，逾時全額退費</li>
                  <li>✓ 3 年原廠保固，免費更換故障零件</li>
                  <li>✓ 中日雙語客服協助選品</li>
                </ul>
              </div>
            )}
            {activeTab === 'spec' && (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <SpecRow label="商品名稱">{p.name}</SpecRow>
                {p.brand && <SpecRow label="品牌">{p.brand}</SpecRow>}
                {p.sku && <SpecRow label="型號 SKU">{p.sku}</SpecRow>}
                <SpecRow label="出貨地">日本 ・ 大阪</SpecRow>
                <SpecRow label="保固">3 年原廠保固</SpecRow>
                <SpecRow label="退換貨">7 日鑑賞期</SpecRow>
                {p.isTaxExempt === 1 && <SpecRow label="課税">非課税（免關稅）</SpecRow>}
                {p.specifications && <SpecRow label="規格">{p.specifications}</SpecRow>}
              </div>
            )}
            {activeTab === 'reviews' && (
              <div>
                {reviewCount === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">⭐</div>
                    <p className="text-gray-600">尚無評論，購買後歡迎留下您的使用心得</p>
                  </div>
                ) : (
                  <div className="text-gray-600">已收集 {reviewCount} 則評論，平均 {rating.toFixed(1)} 星。完整評論列表開發中。</div>
                )}
              </div>
            )}
            {activeTab === 'shipping' && (
              <div className="space-y-4 text-gray-700 text-sm">
                <div>
                  <h4 className="font-bold mb-1">🚚 配送說明</h4>
                  <p>從日本大阪倉庫直接出貨，全程冷鏈／防撞包裝，平均 7 個工作天送達台灣家門口。大型商品（介護床等）約 10-14 天。逾時無法準時配送全額退費。</p>
                </div>
                <div>
                  <h4 className="font-bold mb-1">🛡 保固政策</h4>
                  <p>所有商品享 3 年原廠保固，故障零件免費更換、運費由我們負擔。屬人為損壞酌收材料費。</p>
                </div>
                <div>
                  <h4 className="font-bold mb-1">🔁 退換貨</h4>
                  <p>收貨 7 日內未拆封未使用可申請退貨（運費自付）。原廠瑕疵全額退費 + 來回運費全包。</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 相關商品 */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">同類熱銷商品</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map((rp: any) => (
                <ProductCard
                  key={rp.id}
                  product={rp}
                  language={language}
                  quantity={1}
                  onQuantityChange={() => {}}
                  onAddToCart={() => addToCartMutation.mutate({ productId: rp.id, quantity: 1 })}
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

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg px-3 py-2">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="font-bold text-sm">{children}</div>
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-700">
      <span className="text-[#0ABAB5]">{icon}</span> {text}
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-gray-100 py-2">
      <span className="w-28 text-gray-400 flex-shrink-0">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

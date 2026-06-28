import { Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocation as useWouterLocation } from 'wouter';

import { SiteHeader } from '@/components/SiteHeader';
import { MarqueeBar } from '@/components/MarqueeBar';
import { HeroSection } from '@/components/HeroSection';
import { TrustRow } from '@/components/TrustRow';
import { CategoryGrid } from '@/components/CategoryGrid';
import { ProductCard } from '@/components/ProductCard';
import { WhyUs } from '@/components/WhyUs';
import { B2BBanner } from '@/components/B2BBanner';
import { VideoStrip } from '@/components/VideoStrip';
import { Testimonials } from '@/components/Testimonials';
import { FAQ } from '@/components/FAQ';
import { Newsletter } from '@/components/Newsletter';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';

/**
 * 新版首頁 v3
 * - 整合 A 版（多語、後台、tRPC）+ B 版（220 件商品、11 細分類、品牌定位）
 * - 結構：公告跑馬燈 → Header → Hero → 信任徽章 → 11 分類 → 熱銷 → 新品
 *        → 為何選我們 → B2B → 影片 → 評價 → FAQ → 電子報 → Footer
 */
export default function Home() {
  const [, setLocation] = useWouterLocation();
  const { isAuthenticated } = useAuth();
  const { language, t } = useLanguage();

  /* ----- queries ----- */
  const { data: latestVideos = [] } = trpc.tripVideos.getLatest.useQuery({ limit: 5 });
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: announcements = [] } = trpc.announcements.active.useQuery();

  /* ----- local state ----- */
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isMarqueeVisible, setIsMarqueeVisible] = useState(true);

  /* ----- mutations ----- */
  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => toast.success(t('cart.addSuccess') || '已加入購物車'),
    onError: (e: any) => toast.error(e.message || '加入購物車失敗'),
  });

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast.error(language === 'zh' ? '請先登入' : language === 'ja' ? 'ログインしてください' : 'Please log in first');
      setLocation('/login');
      return;
    }
    const quantity = quantities[productId] || 1;
    addToCartMutation.mutate({ productId, quantity });
    setQuantities(prev => ({ ...prev, [productId]: 1 }));
  };

  /* ----- derived data ----- */
  // 熱銷 TOP 8：按 sales desc，沒有 sales 就退到 createdAt
  const hotProducts = useMemo(() => {
    return [...products]
      .sort((a: any, b: any) => (b.salesCount ?? 0) - (a.salesCount ?? 0))
      .slice(0, 4);
  }, [products]);

  // 本週新品：取最近 4 件
  const newProducts = useMemo(() => {
    return [...products]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [products]);

  // 每個分類的商品數
  const categoriesWithCount = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      count: products.filter(p => p.categoryId === cat.id).length,
    }));
  }, [categories, products]);

  /* ----- search submit ----- */
  const handleSearch = () => {
    if (searchQuery.trim()) {
      setLocation(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  /* ----- scroll restore on mount ----- */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      {/* 1. 跑馬燈公告 */}
      {isMarqueeVisible && announcements.length > 0 && (
        <MarqueeBar
          announcements={announcements}
          language={language}
          onClose={() => setIsMarqueeVisible(false)}
        />
      )}

      {/* 2. Header */}
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
      />

      {/* 3. Hero */}
      <HeroSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearch}
      />

      {/* 4. 信任徽章 */}
      {/* TrustRow 已移除（待替換）*/}

      {/* 5. 11 大分類 */}
      <section id="categories" className="py-16">
        <div className="container mx-auto px-4">
          <SectionHead
            eyebrow="11 大專業分類"
            title={
              <>
                從拐杖到電動床，
                <br />
                每一個生活場景都備妥
              </>
            }
            subtitle="覆蓋移動、入浴、如廁、睡眠、餐食 5 大照護情境，220 件嚴選商品。"
          />
          <CategoryGrid categories={categoriesWithCount} />
        </div>
      </section>

      {/* 6. 本月熱銷 */}
      <section id="products" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              本月熱銷
              <span className="text-xs bg-[#DC2626] text-white px-3 py-0.5 rounded-full font-bold">
                HOT
              </span>
            </h2>
            <Link href="/products?sort=hot">
              <a className="text-[#DC2626] font-bold text-sm hover:text-[#B91C1C]">
                看全部熱銷 →
              </a>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {hotProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                language={language}
                quantity={quantities[p.id] || 1}
                onQuantityChange={(q) =>
                  setQuantities(prev => ({ ...prev, [p.id]: q }))
                }
                onAddToCart={() => handleAddToCart(p.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 7. 本週新品 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              本週新品
              <span className="text-xs bg-[#16A34A] text-white px-3 py-0.5 rounded-full font-bold">
                NEW
              </span>
            </h2>
            <Link href="/products?sort=new">
              <a className="text-[#DC2626] font-bold text-sm hover:text-[#B91C1C]">
                看全部新品 →
              </a>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {newProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                language={language}
                quantity={quantities[p.id] || 1}
                onQuantityChange={(q) =>
                  setQuantities(prev => ({ ...prev, [p.id]: q }))
                }
                onAddToCart={() => handleAddToCart(p.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 8. 為什麼選我們 */}
      <WhyUs />

      {/* 9. B2B */}
      <B2BBanner />

      {/* 10. 最新影片 */}
      {latestVideos.length > 0 && <VideoStrip videos={latestVideos} />}

      {/* 11. 客戶評價 */}
      <Testimonials />

      {/* 12. FAQ */}
      {/* FAQ 已移除（待替換）*/}

      {/* 13. 電子報訂閱 */}
      <Newsletter />

      {/* 14. Footer */}
      <SiteFooter />

      {/* 15. 手機底部固定 CTA */}
      <MobileStickyCTA />
    </div>
  );
}

/* ============ 小元件：區塊標頭 ============ */
function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="text-center mb-12">
      <span className="inline-block text-[#0ABAB5] font-bold text-sm tracking-widest uppercase mb-3">
        {eyebrow}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900">{title}</h2>
      {subtitle && (
        <p className="text-gray-600 text-base max-w-2xl mx-auto">{subtitle}</p>
      )}
    </div>
  );
}

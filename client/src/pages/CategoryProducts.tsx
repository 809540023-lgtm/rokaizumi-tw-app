import { useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { ProductCard } from '@/components/ProductCard';

export default function CategoryProducts() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/products/:categoryId');
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const categoryId = params?.categoryId ? Number(params.categoryId) : null;

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  const category = useMemo(
    () => categories.find((c: any) => c.id === categoryId),
    [categories, categoryId]
  );

  const filtered = useMemo(
    () => products.filter((p: any) => p.categoryId === categoryId),
    [products, categoryId]
  );

  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => toast.success('已加入購物車'),
    onError: (e: any) => toast.error(e.message || '加入購物車失敗'),
  });

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast.error('請先登入');
      setLocation('/login');
      return;
    }
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery="" onSearchChange={() => {}} onSearchSubmit={() => {}} />

      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="text-xs text-gray-400 mb-2">
            首頁 / {category?.name || '商品分類'}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">{category?.name || '商品分類'}</h1>
            <span className="text-sm text-gray-600">共 {filtered.length} 件商品</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-600">此分類目前沒有商品</p>
            <button
              onClick={() => setLocation('/products')}
              className="mt-4 text-[#0ABAB5] font-bold text-sm"
            >
              查看全部商品 →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filtered.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                language={language}
                quantity={1}
                onQuantityChange={() => {}}
                onAddToCart={() => handleAddToCart(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

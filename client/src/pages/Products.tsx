import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { ProductCard } from '@/components/ProductCard';
import { SlidersHorizontal, X } from 'lucide-react';

export default function Products() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();

  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'newest'>('popular');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const u = new URL(window.location.href);
    setSearchQuery(u.searchParams.get('q') || '');
    const sortParam = u.searchParams.get('sort');
    if (sortParam === 'hot') setSortBy('popular');
    if (sortParam === 'new') setSortBy('newest');
  }, []);

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

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedCat !== null) list = list.filter((p: any) => p.categoryId === selectedCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p: any) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      );
    }
    list = list.filter((p: any) => p.price >= priceRange[0] && p.price <= priceRange[1]);
    switch (sortBy) {
      case 'price-asc': list.sort((a: any, b: any) => a.price - b.price); break;
      case 'price-desc': list.sort((a: any, b: any) => b.price - a.price); break;
      case 'newest':
        list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      default:
        list.sort((a: any, b: any) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
    }
    return list;
  }, [products, selectedCat, searchQuery, sortBy, priceRange]);

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />

      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="text-xs text-gray-400 mb-2">首頁 / 全部商品</div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">
              {selectedCat === null ? '全部商品' : categories.find((c: any) => c.id === selectedCat)?.name || '商品分類'}
            </h1>
            <span className="text-sm text-gray-600">共 {filtered.length} 件商品</span>
          </div>
        </div>
      </div>

      <div className="sticky top-[72px] bg-white border-b border-gray-200 z-30 overflow-x-auto">
        <div className="container mx-auto px-4 py-3 flex gap-2 whitespace-nowrap">
          <CategoryChip active={selectedCat === null} onClick={() => setSelectedCat(null)}>全部</CategoryChip>
          {categories.map((c: any) => (
            <CategoryChip key={c.id} active={selectedCat === c.id} onClick={() => setSelectedCat(c.id)}>
              {c.name}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold"
        >
          <SlidersHorizontal className="w-4 h-4" /> 篩選
        </button>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="ml-auto px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#0ABAB5]"
        >
          <option value="popular">熱銷排序</option>
          <option value="newest">最新上架</option>
          <option value="price-asc">價格低到高</option>
          <option value="price-desc">價格高到低</option>
        </select>
      </div>

      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          <aside className={`${showFilters ? 'block' : 'hidden'} md:block bg-white rounded-2xl p-5 h-fit md:sticky md:top-[160px]`}>
            <div className="flex items-center justify-between mb-4 md:hidden">
              <h3 className="font-bold">篩選</h3>
              <button onClick={() => setShowFilters(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <h4 className="font-bold mb-3 text-sm">價格區間（NT$）</h4>
            <div className="flex items-center gap-2 mb-2">
              <input type="number" value={priceRange[0]} onChange={e => setPriceRange([+e.target.value || 0, priceRange[1]])}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm" placeholder="最低" />
              <span className="text-gray-400">-</span>
              <input type="number" value={priceRange[1]} onChange={e => setPriceRange([priceRange[0], +e.target.value || 0])}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm" placeholder="最高" />
            </div>
            <div className="flex gap-1.5 flex-wrap mt-3">
              {[[0,5000,'5,000 以下'],[5000,20000,'5K - 2 萬'],[20000,50000,'2 - 5 萬'],[50000,500000,'5 萬以上']].map(([lo,hi,label]) => (
                <button key={label as string} onClick={() => setPriceRange([lo as number, hi as number])}
                  className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-[#E0F7F6] text-xs">{label}</button>
              ))}
            </div>
            <button onClick={() => { setPriceRange([0, 500000]); setSelectedCat(null); }}
              className="w-full mt-5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100">
              清除全部篩選
            </button>
          </aside>

          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-gray-600">{searchQuery ? `找不到「${searchQuery}」相關商品` : '此分類目前沒有商品'}</p>
                <button onClick={() => { setSearchQuery(''); setSelectedCat(null); setPriceRange([0, 500000]); }}
                  className="mt-4 text-[#0ABAB5] font-bold text-sm">清除所有篩選 →</button>
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
        </div>
      </div>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

function CategoryChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
        active ? 'bg-[#0ABAB5] text-white' : 'bg-gray-100 text-gray-700 hover:bg-[#E0F7F6]'
      }`}
    >
      {children}
    </button>
  );
}

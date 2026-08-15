import { Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Globe, Settings, ShoppingCart, X, Search } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useLocation as useWouterLocation } from 'wouter';
import { MobileMenu } from '@/components/MobileMenu';
import { HeroSection } from '@/components/HeroSection';
import { useProductsFallback } from '../hooks/useProductsFallback';
import { useCart } from '../hooks/useCart';
import { ProductImage } from '@/components/ProductImage';

export default function HomePage() {
  const [location, setLocation] = useWouterLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: latestVideos } = trpc.tripVideos.getLatest.useQuery({ limit: 5 });

  // 使用回退機制加載產品和分類
  const { products: fallbackProducts, categories: fallbackCategories, isFallback } = useProductsFallback();

  // 嘗試從 API 加載，否則使用回退數據
  const { data: apiCategories = [] } = trpc.categories.list.useQuery();
  const { data: apiProducts = [] } = trpc.products.list.useQuery();

  const categories = apiCategories.length > 0 ? apiCategories : fallbackCategories;
  const products = apiProducts.length > 0 ? apiProducts : fallbackProducts;

  const { language, setLanguage, t } = useLanguage();

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<'hundred' | 'care' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isMarqueeVisible, setIsMarqueeVisible] = useState(true);

  // 查詢活躍公告
  const { data: announcements = [] } = trpc.announcements.active.useQuery();
  const { data: searchResults = [], refetch: refetchSearch, isFetching: isSearchFetching } = trpc.products.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 && isSearching }
  );

  const { add: addToCart } = useCart();

  const handleAddToCart = (product: { id: number; name: string; price: number; imageUrl?: string }) => {
    const quantity = quantities[product.id] || 1;
    addToCart(
      { productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl },
      quantity
    );
    toast.success(t('cart.addSuccess') || '已加入購物車');
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      refetchSearch();
    }
  };

  const toggleLanguage = () => {
    if ((language === 'zh' || language === 'cn')) {
      setLanguage('en');
    } else if (language === 'en') {
      setLanguage('ja');
    } else {
      setLanguage('zh');
    }
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'zh': return '中文';
      case 'en': return 'EN';
      case 'ja': return '日本語';
      default: return '中文';
    }
  };

  // 分組分類 - 簡化為兩個主要類別
  const japaneseCategories = categories.filter(cat =>
    cat.name === '日本精美小商品' ||
    ['日用百貨', '廚房用品', '收納用品', '文具用品', '清潔用品', '玩具雜貨', '美妝保養', '食品零食'].includes(cat.name) ||
    ['廚房用品', '洗衣用品', '衛浴用品', '清潔用品', '文具用品', '收納用品'].includes(cat.name) ||
    ['Daily Necessities', 'Kitchen Items', 'Storage', 'Stationery', 'Cleaning Supplies', 'Toys', 'Beauty Products', 'Food/Snacks'].includes(cat.name) ||
    ['日用雑貨', 'キッチン用品', '収納用品', '文房具', '清掃用品', 'おもちゃ雑貨', '美容・スキンケア', '食品・お菓子'].includes(cat.name)
  );

  const elderlyCareCategories = categories.filter(cat =>
    cat.name === '銀髮生活品質加乘輔具' ||
    ['健康監測', '安全監控', '床邊照護', '復健器材', '行動輔助', '衛浴安全', '護理用品', '生活輔具'].includes(cat.name) ||
    ['拐杖', '助行器', '介護鞋', '輪椅移位', '入浴用品', '如廁照護', '成人紙尿褲', '介護床寢具', '防褥瘡', '安全扶手', '餐具圍兜'].includes(cat.name) ||
    ['Health Monitoring', 'Safety Monitoring', 'Bedside Care', 'Rehabilitation', 'Mobility Aids', 'Bathroom Safety', 'Nursing Supplies', 'Daily Living Aids'].includes(cat.name) ||
    ['健康モニタリング', '安全監視', 'ベッドサイドケア', 'リハビリ機器', '移動補助', '浴室安全', '介護用品', '生活補助具'].includes(cat.name)
  );

  // 篩選產品 - 支援API和fallback products兩種結構
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];

    const relevantCategories = selectedCategory === 'hundred' ? japaneseCategories : elderlyCareCategories;

    // 支援兩種產品結構：API products (categoryId) 和 fallback products (category)
    return products.filter(product => {
      if (product.categoryId !== undefined) {
        // API products - 使用 categoryId
        const categoryIds = relevantCategories.map(cat => cat.id);
        return categoryIds.includes(product.categoryId);
      } else if (product.category) {
        // Fallback products - 使用 category 名稱
        const categoryNames = relevantCategories.map(cat => cat.name);
        return categoryNames.includes(product.category);
      }
      return false;
    });
  }, [selectedCategory, products, japaneseCategories, elderlyCareCategories]);

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Hero Section with Badges */}
      <HeroSection
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  ろ
                </div>
                <span className="text-2xl font-bold text-[#0ABAB5]">
                  {t('home.company')}
                </span>
              </Link>
            <div className="flex items-center justify-between flex-1 ml-4">
              <nav className="hidden md:flex gap-6">
                <Link href="/" className="text-[#0ABAB5] font-semibold">{t('nav.home')}</Link>
                <Link href="/videos" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.videos')}</Link>
                <Link href="/cart" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.cart')}</Link>
              </nav>
              <div className="flex items-center gap-2 md:gap-3">
                <MobileMenu />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 md:gap-2 order-2 md:order-1"
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden md:inline">{getLanguageLabel()}</span>
                  <span className="md:hidden text-xs">{(language === 'zh' || language === 'cn') ? '中' : language === 'ja' ? '日' : 'EN'}</span>
                </Button>
                {user?.role === 'admin' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setLocation('/admin-panel')}
                    className="flex items-center gap-1 md:gap-2 bg-[#0ABAB5] hover:bg-[#089B96] order-3"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden md:inline">{(language === 'zh' || language === 'cn') ? '管理後台' : language === 'ja' ? '管理画面' : 'Admin'}</span>
                  </Button>
                )}
                {!user && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.location.href = getLoginUrl()}
                    className="flex items-center gap-1 md:gap-2 bg-[#0ABAB5] hover:bg-[#089B96] order-3"
                  >
                    <span className="hidden md:inline">{(language === 'zh' || language === 'cn') ? '登入' : language === 'ja' ? 'ログイン' : 'Login'}</span>
                    <span className="md:hidden text-xs">{(language === 'zh' || language === 'cn') ? '登' : language === 'ja' ? 'ログ' : 'Log'}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 跑馬燈 */}
      {isMarqueeVisible && announcements.length > 0 && (
        <div className="bg-gradient-to-r from-[#0ABAB5] to-[#089B96] text-white py-2 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap pr-12">
            {announcements.map((announcement, index) => {
              const content = (language === 'zh' || language === 'cn')
                ? announcement.contentZh
                : language === 'ja'
                  ? (announcement.contentJa || announcement.contentZh)
                  : (announcement.contentEn || announcement.contentZh);
              return (
                <span key={`${announcement.id}-${index}`} className="mx-8">
                  {content}
                </span>
              );
            })}
            {announcements.map((announcement, index) => {
              const content = (language === 'zh' || language === 'cn')
                ? announcement.contentZh
                : language === 'ja'
                  ? (announcement.contentJa || announcement.contentZh)
                  : (announcement.contentEn || announcement.contentZh);
              return (
                <span key={`${announcement.id}-repeat-${index}`} className="mx-8">
                  {content}
                </span>
              );
            })}
          </div>
          <button
            onClick={() => setIsMarqueeVisible(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
            title={(language === 'zh' || language === 'cn') ? '關閉公告' : language === 'ja' ? 'お知らせを閉じる' : 'Close announcement'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 產品展示區域 */}
      {!isSearching && !selectedCategory ? (
        <main className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* 日本精美小商品卡片 */}
            <button
              onClick={() => setSelectedCategory('hundred')}
              className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-shadow cursor-pointer text-left"
            >
              <div className="text-4xl mb-4">🛍️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {(language === 'zh' || language === 'cn') ? '日本精美小商品' : language === 'ja' ? '日本の美しい小商品' : 'Japanese Everyday Products'}
              </h2>
              <p className="text-gray-600 mb-4">
                {(language === 'zh' || language === 'cn') ? '精選日本百貨、廚房、文具等生活用品' : language === 'ja' ? '日本の厳選された日用品、キッチン、文房具など' : 'Carefully selected Japanese daily necessities, kitchen, and stationery'}
              </p>
              <span className="text-[#0ABAB5] font-semibold">
                {(language === 'zh' || language === 'cn') ? '瀏覽商品 →' : language === 'ja' ? '商品を見る →' : 'Browse Products →'}
              </span>
            </button>

            {/* 銀髮生活品質加乘輔具卡片 */}
            <button
              onClick={() => setSelectedCategory('care')}
              className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-shadow cursor-pointer text-left"
            >
              <div className="text-4xl mb-4">🏥</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {(language === 'zh' || language === 'cn') ? '銀髮生活品質加乘輔具' : language === 'ja' ? 'シニアライフ支援用具' : 'Elderly Care Aids'}
              </h2>
              <p className="text-gray-600 mb-4">
                {(language === 'zh' || language === 'cn') ? '日本精選介護用品、輔助器材、健康監測' : language === 'ja' ? '日本厳選の介護用品、補助器具、健康監視' : 'Premium Japanese nursing supplies and health monitoring'}
              </p>
              <span className="text-[#0ABAB5] font-semibold">
                {(language === 'zh' || language === 'cn') ? '瀏覽商品 →' : language === 'ja' ? '商品を見る →' : 'Browse Products →'}
              </span>
            </button>
          </div>
        </main>
      ) : isSearching ? (
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">
              {(language === 'zh' || language === 'cn') ? `搜尋結果："${searchQuery}"` : language === 'ja' ? `検索結果："${searchQuery}"` : `Search Results: "${searchQuery}"`}
            </h1>
            <Button
              variant="outline"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {(language === 'zh' || language === 'cn') ? '返回' : language === 'ja' ? '戻る' : 'Back'}
            </Button>
          </div>

          {isSearchFetching ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0ABAB5] mx-auto"></div>
              <p className="text-gray-600 mt-4">{(language === 'zh' || language === 'cn') ? '搜尋中...' : language === 'ja' ? '検索中...' : 'Searching...'}</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(product => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/product/${product.id}`} className="block">
                      <div className="w-full h-48 overflow-hidden">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    </Link>
                  <div className="p-4">
                    <Link href={`/product/${product.id}`} className="block">
                        <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 hover:text-[#0ABAB5] transition-colors cursor-pointer">
                          {product.name}
                        </h3>
                      </Link>
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-[#0ABAB5]">
                        {(language === 'zh' || language === 'cn') ? `NT$${Math.round(product.price)}` :
                         language === 'ja' ? `¥${Math.round(product.price * 4.5)}` :
                         `$${(product.price * 0.031).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={quantities[product.id] || 1}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [product.id]: Math.max(1, parseInt(e.target.value) || 1)
                        }))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {t('products.addToCart') || '加入購物車'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                {(language === 'zh' || language === 'cn') ? `找不到符合 "${searchQuery}" 的產品` : language === 'ja' ? `"${searchQuery}" に一致する商品が見つかりません` : `No products found for "${searchQuery}"`}
              </p>
            </div>
          )}
        </main>
      ) : selectedCategory ? (
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">
              {selectedCategory === 'hundred'
                ? ((language === 'zh' || language === 'cn') ? '日本精美小商品' : language === 'ja' ? '日本の美しい小商品' : 'Japanese Everyday Products')
                : ((language === 'zh' || language === 'cn') ? '銀髮生活品質加乘輔具' : language === 'ja' ? 'シニアライフ支援用具' : 'Elderly Care Aids')}
            </h1>
            <Button
              variant="outline"
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {(language === 'zh' || language === 'cn') ? '返回' : language === 'ja' ? '戻る' : 'Back'}
            </Button>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/product/${product.id}`} className="block">
                      <div className="w-full h-48 overflow-hidden">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    </Link>
                  <div className="p-4">
                    <Link href={`/product/${product.id}`} className="block">
                        <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 hover:text-[#0ABAB5] transition-colors cursor-pointer">
                          {product.name}
                        </h3>
                      </Link>
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-[#0ABAB5]">
                        {(language === 'zh' || language === 'cn') ? `NT$${Math.round(product.price)}` :
                         language === 'ja' ? `¥${Math.round(product.price * 4.5)}` :
                         `$${(product.price * 0.031).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={quantities[product.id] || 1}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [product.id]: Math.max(1, parseInt(e.target.value) || 1)
                        }))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {t('products.addToCart') || '加入購物車'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                {(language === 'zh' || language === 'cn') ? '此分類暫無商品' : language === 'ja' ? 'このカテゴリーに商品がありません' : 'No products in this category'}
              </p>
            </div>
          )}
        </main>
      ) : null}
    </div>
  );
}

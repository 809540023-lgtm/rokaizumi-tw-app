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

export default function Home() {
  const [location, setLocation] = useWouterLocation();
  const { user, isAuthenticated } = useAuth();
  const { data: latestVideos } = trpc.tripVideos.getLatest.useQuery({ limit: 5 });
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
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

  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success(t('cart.addSuccess') || '已加入購物車');
    },
    onError: (error: any) => {
      toast.error(error.message || '加入購物車失敗');
    },
  });

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast.error((language === 'zh' || language === 'cn') ? '請先登入' : 'Please log in first');
      setLocation('/login');
      return;
    }
    const quantity = quantities[productId] || 1;
    addToCartMutation.mutate({ productId, quantity });
    setQuantities(prev => ({ ...prev, [productId]: 1 }));
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
    ['Daily Necessities', 'Kitchen Items', 'Storage', 'Stationery', 'Cleaning Supplies', 'Toys', 'Beauty Products', 'Food/Snacks'].includes(cat.name) ||
    ['日用雑貨', 'キッチン用品', '収納用品', '文房具', '清掃用品', 'おもちゃ雑貨', '美容・スキンケア', '食品・お菓子'].includes(cat.name)
  );
  
  const elderlyCareCategories = categories.filter(cat => 
    cat.name === '銀髮生活品質加乘輔具' ||
    ['健康監測', '安全監控', '床邊照護', '復健器材', '行動輔助', '衛浴安全', '護理用品', '生活輔具'].includes(cat.name) ||
    ['Health Monitoring', 'Safety Monitoring', 'Bedside Care', 'Rehabilitation', 'Mobility Aids', 'Bathroom Safety', 'Nursing Supplies', 'Daily Living Aids'].includes(cat.name) ||
    ['健康モニタリング', '安全監視', 'ベッドサイドケア', 'リハビリ機器', '移動補助', '浴室安全', '介護用品', '生活補助具'].includes(cat.name)
  );

  // 篩選產品
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    
    const relevantCategories = selectedCategory === 'hundred' ? japaneseCategories : elderlyCareCategories;
    const categoryIds = relevantCategories.map(cat => cat.id);
    
    return products.filter(product => categoryIds.includes(product.categoryId));
  }, [selectedCategory, products, japaneseCategories, elderlyCareCategories]);

  return (
    <div className="min-h-screen bg-[#fef9f3]">
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

      {/* 跑馬燈 - 支援多語言和關閉按鈕 */}
      {isMarqueeVisible && announcements.length > 0 && (
        <div className="bg-gradient-to-r from-[#0ABAB5] to-[#089B96] text-white py-2 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap pr-12">
            {announcements.map((announcement, index) => {
              // 根據當前語言選擇內容
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
            {/* 重複一次以實現無縫滾動 */}
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
          {/* 關閉按鈕 */}
          <button
            onClick={() => setIsMarqueeVisible(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
            title={(language === 'zh' || language === 'cn') ? '關閉公告' : language === 'ja' ? 'お知らせを閉じる' : 'Close announcement'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 如果正在搜尋，顯示搜尋結果 */}
      {isSearching ? (
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

          {/* 搜尋結果網格 */}
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
                      {product.imageUrl && (
                        <div className="w-full h-48 bg-gray-200 overflow-hidden">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
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
                        onClick={() => handleAddToCart(product.id)}
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
              {selectedCategory === 'hundred' ? t('home.hundredYenProducts') || '日本精美小商品' : t('home.careEquipment') || '銀髮生活品質加乘輔具'}
            </h1>
            <Button
              variant="outline"
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {t('products.back') || '返回'}
            </Button>
          </div>

          {/* 產品網格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* 產品圖片 */}
                <Link href={`/product/${product.id}`} className="block">
                    {product.imageUrl && (
                      <div className="w-full h-48 bg-gray-200 overflow-hidden">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                  </Link>
                
                {/* 產品信息 */}
                <div className="p-4">
                  {/* 產品名稱 - 可點擊連結到詳情頁 */}
                  <Link href={`/product/${product.id}`} className="block">
                      <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 hover:text-[#0ABAB5] transition-colors cursor-pointer">
                        {product.name}
                      </h3>
                    </Link>
                  
                  {/* 價格 - 根據語言顯示不同幣別 */}
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-[#0ABAB5]">
                      {(language === 'zh' || language === 'cn') ? `NT$${Math.round(product.price)}` : 
                       language === 'ja' ? `¥${Math.round(product.price * 4.5)}` : 
                       `$${(product.price * 0.031).toFixed(2)}`}
                    </span>
                  </div>

                  {/* 加入購物車按鈕 */}
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
                      onClick={() => handleAddToCart(product.id)}
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

          {/* 空狀態 */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">{t('products.noProducts') || '沒有找到商品'}</p>
            </div>
          )}
        </main>
      ) : (
        <>
          {/* Hero Section */}
          <section className="relative bg-gradient-to-br from-cyan-50 to-teal-100 py-20">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center">
                <div className="text-3xl font-bold text-[#0ABAB5] mb-4">
                  {t('home.company')}
                </div>
                <h1 className="text-5xl font-bold text-gray-900 mb-6">
                  {t('home.title')}
                </h1>
                <p className="text-xl text-gray-700 mb-10 leading-relaxed">
                  {t('home.subtitle')}
                </p>
                {/* 搜尋框 */}
                <div className="max-w-xl mx-auto mb-8">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={(language === 'zh' || language === 'cn') ? '搜尋產品...' : language === 'ja' ? '商品を検索...' : 'Search products...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                          setIsSearching(true);
                        }
                      }}
                      className="w-full px-6 py-4 pr-14 text-lg border-2 border-[#0ABAB5] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] focus:border-transparent shadow-lg"
                    />
                    <button
                      onClick={() => {
                        if (searchQuery.trim()) {
                          setIsSearching(true);
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0ABAB5] text-white p-3 rounded-full hover:bg-[#089B96] transition-colors"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button
                    onClick={() => setSelectedCategory('hundred')}
                    className="bg-[#DC2626] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#B91C1C] transition-colors shadow-lg"
                  >
                    🛒 {t('home.browseProducts')}
                  </Button>
                  <Link href="/videos" className="bg-[#0ABAB5] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#089B96] transition-colors shadow-lg inline-block">
                      🇯🇵 {t('home.japanConnection')}
                    </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Product Categories Section */}
          <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                {t('home.productCategories')}
              </h2>
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
                  {/* Elderly Care Equipment - Left */}
                  <div
                    onClick={() => setLocation('/products/elderly')}
                    className="group cursor-pointer bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
                  >
                    <div className="text-6xl mb-4 text-center">♿</div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 text-center">
                      {t('home.careEquipment')}
                    </h3>
                    <p className="text-gray-600 text-center mb-4">
                      {t('home.careEquipmentDesc')}
                    </p>
                    <div className="text-center">
                      <span className="inline-block bg-[#DC2626] text-white px-6 py-2 rounded-lg font-semibold group-hover:bg-[#B91C1C] transition-colors">
                        {t('home.browseProducts')} →
                      </span>
                    </div>
                  </div>

                  {/* 百元批發 Badge - Center */}
                  <div className="flex justify-center">
                    <div
                      onClick={() => setLocation('/koku')}
                      className="w-48 h-48 bg-gradient-to-br from-[#DC2626] to-[#991B1B] rounded-full flex flex-col items-center justify-center text-white shadow-2xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group"
                    >
                      <div className="text-center z-10">
                        <div className="font-bold text-sm mb-2">日本直購</div>
                        <div className="text-3xl font-bold mb-1">百元批發</div>
                        <div className="text-xs opacity-90 mb-1">KOKUBO</div>
                        <div className="text-sm font-bold opacity-90">1,463品</div>
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-white/30 group-hover:border-white/50 transition-colors"></div>
                    </div>
                  </div>

                  {/* Japanese 100 Yen Products - Right */}
                  <div
                    onClick={() => setLocation('/products/japanese')}
                    className="group cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
                  >
                    <div className="text-6xl mb-4 text-center">🛍️</div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 text-center">
                      {t('home.hundredYenProducts')}
                    </h3>
                    <p className="text-gray-600 text-center mb-4">
                      {t('home.hundredYenProductsDesc')}
                    </p>
                    <div className="text-center">
                      <span className="inline-block bg-[#DC2626] text-white px-6 py-2 rounded-lg font-semibold group-hover:bg-[#B91C1C] transition-colors">
                        {t('home.browseProducts')} →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Latest Videos Section */}
          {latestVideos && latestVideos.length > 0 && (
            <section className="py-16 bg-[#fef9f3]">
              <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold text-gray-900">
                    🎬 {t('home.latestVideos')}
                  </h2>
                  <Link href="/videos" className="text-[#DC2626] hover:text-[#B91C1C] font-semibold">
                      {t('home.viewAll')} →
                    </Link>
                </div>
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {latestVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group cursor-pointer bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                    >
                      {video.thumbnailUrl && (
                        <div className="w-full h-32 bg-gray-200 overflow-hidden">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-[#0ABAB5]">
                          {video.title}
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="bg-gray-100 py-8 text-center text-gray-600 text-sm">
            <div className="max-w-6xl mx-auto px-4">
              <div className="mb-4 pb-4 border-b border-gray-300">
                <h3 className="font-semibold text-gray-800 mb-2">ろかいずみ合同会社</h3>
                <p className="text-xs leading-relaxed">
                  大阪市淀川区西中島六丁目10番1の502<br />
                  532-0011<br />
                  ストークマンション西中島
                </p>
              </div>
              <p className="text-xs">Made with Manus</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Globe, ShoppingCart, Plus, X, Menu, User, LogOut } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useLocation as useWouterLocation } from 'wouter';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCart } from '@/hooks/useCart';
import { useProductsFallback } from '@/hooks/useProductsFallback';
import { ProductImage } from '@/components/ProductImage';

export default function Products() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useWouterLocation();
  const { language, setLanguage, t } = useLanguage();
  // API 掛掉時退回靜態 products.json，否則整頁會是空的
  const { data: apiCategories = [] } = trpc.categories.list.useQuery();
  const { data: apiProducts = [] } = trpc.products.list.useQuery();
  const { products: fallbackProducts, categories: fallbackCategories } = useProductsFallback();

  const categories = apiCategories.length > 0 ? apiCategories : fallbackCategories;
  const products = apiProducts.length > 0 ? apiProducts : fallbackProducts;
  
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  
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

  // 根據 URL 參數獲取主分類
  const getMainCategoryFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    if (category === 'care') return 'elderly';
    if (category === 'hundred') return 'japanese';
    return null;
  };

  const mainCategory = getMainCategoryFromUrl();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  // 分組分類
  const japaneseCategories = categories.filter(cat => 
    ['日用百貨', '廚房用品', '收納用品', '文具用品', '清潔用品', '玩具雜貨', '美妝保養', '食品零食'].includes(cat.name) ||
    ['廚房用品', '洗衣用品', '衛浴用品', '清潔用品', '文具用品', '收納用品', '居家生活', '美妝保養', '禮品包裝', '銀髮親子'].includes(cat.name) ||
    ['Daily Necessities', 'Kitchen Items', 'Storage', 'Stationery', 'Cleaning Supplies', 'Toys', 'Beauty Products', 'Food/Snacks'].includes(cat.name) ||
    ['日用雑貨', 'キッチン用品', '収納用品', '文房具', '清掃用品', 'おもちゃ雑貨', '美容・スキンケア', '食品・お菓子'].includes(cat.name)
  );
  
  const elderlyCareCategories = categories.filter(cat => 
    ['健康監測', '安全監控', '床邊照護', '復健器材', '行動輔助', '衛浴安全', '護理用品', '生活輔具'].includes(cat.name) ||
    ['拐杖', '助行器', '介護鞋', '輪椅移位', '入浴用品', '如廁照護', '成人紙尿褲', '介護床寢具', '防褥瘡', '安全扶手', '餐具圍兜'].includes(cat.name) ||
    ['Health Monitoring', 'Safety Monitoring', 'Bedside Care', 'Rehabilitation', 'Mobility Aids', 'Bathroom Safety', 'Nursing Supplies', 'Daily Living Aids'].includes(cat.name) ||
    ['健康モニタリング', '安全監視', 'ベッドサイドケア', 'リハビリ機器', '移動補助', '浴室安全', '介護用品', '生活補助具'].includes(cat.name)
  );

  // 根據主分類篩選產品
  const filteredProducts = useMemo(() => {
    if (!mainCategory) {
      return products;
    }

    const relevantCategories = mainCategory === 'japanese' ? japaneseCategories : elderlyCareCategories;
    // API 商品用 categoryId(數字)，靜態回退商品用 category(字串)，兩種都要能對上
    const allowed = selectedCategories.length > 0
      ? relevantCategories.filter(cat => selectedCategories.includes(cat.id))
      : relevantCategories;
    const allowedIds = allowed.map(cat => cat.id);
    const allowedNames = allowed.map(cat => cat.name);

    return products.filter((product: any) =>
      product.categoryId !== undefined
        ? allowedIds.includes(product.categoryId)
        : allowedNames.includes(product.category)
    );
  }, [products, mainCategory, selectedCategories, japaneseCategories, elderlyCareCategories]);

  // 切換分類選擇
  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // 重置篩選
  const resetFilters = () => {
    setSelectedCategories([]);
    setLocation('/products');
  };

  // 獲取當前主分類的子分類
  const currentSubcategories = mainCategory === 'japanese' ? japaneseCategories : elderlyCareCategories;

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  ろ
                </div>
                <span className="text-lg md:text-2xl font-bold text-[#0ABAB5] hidden sm:inline">
                  {t('home.company') || 'ろかいずみ合同会社'}
                </span>
              </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <nav className="flex gap-6">
                <Link href="/" className="text-gray-700 hover:text-[#0ABAB5] text-sm">{t('nav.home') || '首頁'}</Link>
                <Link href="/products" className="text-[#0ABAB5] font-semibold text-sm">{t('nav.products') || '產品'}</Link>
                <Link href="/videos" className="text-gray-700 hover:text-[#0ABAB5] text-sm">{t('nav.videos') || '影片'}</Link>
                <Link href="/cart" className="text-gray-700 hover:text-[#0ABAB5] flex items-center gap-1 text-sm">
                    <ShoppingCart className="w-4 h-4" />
                    {t('nav.cart') || '購物車'}
                  </Link>
              </nav>
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{user.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocation('/api/auth/logout');
                    }}
                    className="text-gray-700"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Link href="/login" className="text-gray-700 hover:text-[#0ABAB5] text-sm flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {t('nav.login') || '登入'}
                  </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLanguage((language === 'zh' || language === 'cn') ? 'en' : 'zh')}
                className="p-2"
              >
                <Globe className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden border-t border-gray-200 mt-3 pt-3 pb-2">
              <nav className="flex flex-col gap-2">
                <Link href="/" className="text-gray-700 hover:text-[#0ABAB5] block py-2 px-2 text-sm">{t('nav.home') || '首頁'}</Link>
                <Link href="/products" className="text-[#0ABAB5] font-semibold block py-2 px-2 text-sm">{t('nav.products') || '產品'}</Link>
                <Link href="/videos" className="text-gray-700 hover:text-[#0ABAB5] block py-2 px-2 text-sm">{t('nav.videos') || '影片'}</Link>
                <Link href="/cart" className="text-gray-700 hover:text-[#0ABAB5] flex items-center gap-2 py-2 px-2 text-sm">
                    <ShoppingCart className="w-4 h-4" />
                    {t('nav.cart') || '購物車'}
                  </Link>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {mainCategory === 'japanese' ? t('home.category1') || '日本精美小商品' : mainCategory === 'elderly' ? t('home.category2') || '銀髮生活品質加乘輔具' : t('products.allProducts') || '全部商品'}
          </h1>
          <p className="text-gray-600">
            {mainCategory ? `${filteredProducts.length} ${t('products.products') || '件商品'}` : t('products.allProductsDesc') || '瀏覽我們所有的優質商品'}
          </p>
        </div>

        {/* 返回按鈕 */}
        {mainCategory && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {t('products.back') || '返回'}
            </Button>
          </div>
        )}

        {/* 子分類篩選 */}
        {mainCategory && currentSubcategories.length > 0 && (
          <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">{t('products.categories') || '分類'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {currentSubcategories.map(category => (
                <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <span className="text-sm text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 產品網格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
              {/* 產品圖片 */}
              <Link href={`/product/${product.id}`} className="block">
                  <div className="w-full aspect-square bg-white overflow-hidden p-3">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain hover:scale-105 transition-transform"
                    />
                  </div>
                </Link>
              
              {/* 產品信息 */}
              <div className="p-4 flex flex-col flex-1">
                {/* 產品名稱 - 可點擊連結到詳情頁 */}
                <Link href={`/product/${product.id}`} className="block">
                    <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 min-h-[2.75rem] hover:text-[#0ABAB5] transition-colors cursor-pointer">
                      {product.name}
                    </h3>
                  </Link>
                
                {/* 價格 - 根據語言顯示不同幣別 */}
                <div className="mb-4 mt-auto">
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

        {/* 空狀態 */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">{t('products.noProducts') || '沒有找到商品'}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 mt-12 py-6 text-center text-gray-600 text-sm">
        <p>Made with Manus</p>
      </footer>
    </div>
  );
}

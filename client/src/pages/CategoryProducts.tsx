import { Link, useRoute, useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, ArrowLeft, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { useMemo } from 'react';

// 定義分類映射
const ELDERLY_SUBCATEGORIES = ['健康監測', '安全監控', '床邊照護', '復健器材', '行動輔助', '衛浴安全', '護理用品', '生活輔具'];
const JAPANESE_SUBCATEGORIES = ['日用百貨', '廚房用品', '收納用品', '文具用品', '清潔用品', '玩具雜貨', '美妝保養', '食品零食'];
const ELDERLY_MAIN_CATEGORY = '銀髮生活品質加乘輔具';
const JAPANESE_MAIN_CATEGORY = '日本精美小商品';

export default function CategoryProducts() {
  const [match, params] = useRoute('/products/:categoryId');
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  
  const categoryType = params?.categoryId; // 'elderly' or 'japanese'
  
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  
  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success(t('cart.addSuccess') || '已加入購物車');
    },
    onError: (error: any) => {
      toast.error(error.message || '加入購物車失敗');
    },
  });

  const toggleLanguage = () => {
    if (language === 'zh') {
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

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast.error('請先登入');
      return;
    }
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  // 根據 categoryType 獲取所有相關分類 ID（包含主分類和子分類）
  const relevantCategoryIds = useMemo(() => {
    const ids: number[] = [];
    
    if (categoryType === 'elderly') {
      // 添加主分類 ID
      const mainCategory = categories.find(cat => cat.name === ELDERLY_MAIN_CATEGORY);
      if (mainCategory) ids.push(mainCategory.id);
      
      // 添加子分類 ID
      categories.forEach(cat => {
        if (ELDERLY_SUBCATEGORIES.includes(cat.name)) {
          ids.push(cat.id);
        }
      });
    } else if (categoryType === 'japanese') {
      // 添加主分類 ID
      const mainCategory = categories.find(cat => cat.name === JAPANESE_MAIN_CATEGORY);
      if (mainCategory) ids.push(mainCategory.id);
      
      // 添加子分類 ID
      categories.forEach(cat => {
        if (JAPANESE_SUBCATEGORIES.includes(cat.name)) {
          ids.push(cat.id);
        }
      });
    }
    
    return ids;
  }, [categoryType, categories]);

  // 篩選該分類下的所有商品
  const filteredProducts = useMemo(() => {
    if (relevantCategoryIds.length === 0) return [];
    return products.filter(product => relevantCategoryIds.includes(product.categoryId));
  }, [relevantCategoryIds, products]);

  // 獲取分類標題
  const getCategoryTitle = () => {
    if (categoryType === 'elderly') {
      return t('home.careEquipment') || '銀髮生活品質加乘輔具';
    } else if (categoryType === 'japanese') {
      return t('home.hundredYenProducts') || '日本精美小商品';
    }
    return '商品列表';
  };

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  ろ
                </div>
                <span className="text-2xl font-bold text-[#0ABAB5]">
                  {t('home.company')}
                </span>
              </a>
            </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <Link href="/">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.home')}</a>
                </Link>
                <Link href="/videos">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.videos')}</a>
                </Link>
                <Link href="/cart">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.cart')}</a>
                </Link>
              </nav>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {getLanguageLabel()}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => setLocation('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('products.back') || '返回首頁'}
        </Button>

        {/* Category Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {getCategoryTitle()}
          </h1>
          <p className="text-xl text-gray-600">
            {categoryType === 'elderly' ? t('home.careEquipmentDesc') || '專業銀髮生活輔具，提升生活品質' : t('home.hundredYenProductsDesc') || '精選日本優質小商品'}
          </p>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">{t('products.noProducts') || '沒有找到商品'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product: any) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <Link href={`/product/${product.id}`}>
                  <a className="block">
                    <div className="relative">
                      <img
                        src={product.imageUrl || 'https://placehold.co/400x300?text=Product'}
                        alt={product.name}
                        className="w-full h-48 object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  </a>
                </Link>
                <div className="p-4">
                  <Link href={`/product/${product.id}`}>
                    <a className="block">
                      <h3 className="text-lg font-bold text-gray-800 mb-3 hover:text-[#0ABAB5] transition-colors cursor-pointer line-clamp-2">
                        {product.name}
                      </h3>
                    </a>
                  </Link>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-[#DC2626]">
                      {language === 'zh' ? `NT$${Math.round(product.price).toLocaleString()}` : 
                       language === 'ja' ? `¥${Math.round(product.price * 4.5).toLocaleString()}` : 
                       `$${(product.price * 0.031).toFixed(2)}`}
                    </span>
                    <Button
                      onClick={() => handleAddToCart(product.id)}
                      disabled={addToCartMutation.isPending}
                      className="bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {t('products.addToCart') || '加入購物車'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

import { Link, useRoute, useLocation } from 'wouter';
import { formatPrice } from '@/lib/price';
import { useLanguage } from '../contexts/LanguageContext';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { useCart } from '@/hooks/useCart';
import { ProductImage } from '@/components/ProductImage';
import { SiteHeader } from '@/components/SiteHeader';

// 定義分類映射
const ELDERLY_SUBCATEGORIES = ['健康監測', '安全監控', '床邊照護', '復健器材', '行動輔助', '衛浴安全', '護理用品', '生活輔具'];
const JAPANESE_SUBCATEGORIES = ['日用百貨', '廚房用品', '收納用品', '文具用品', '清潔用品', '玩具雜貨', '美妝保養', '食品零食'];
const ELDERLY_MAIN_CATEGORY = '銀髮生活品質加乘輔具';
const JAPANESE_MAIN_CATEGORY = '日本精美小商品';

export default function CategoryProducts() {
  const [, params] = useRoute('/products/:categoryId');
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const { add: addToCart } = useCart();
  
  const categoryType = params?.categoryId; // 'elderly' or 'japanese'
  
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  
  const handleAddToCart = (product: { id: number; name: string; price: number; imageUrl?: string | null }) => {
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl || undefined,
    });
    toast.success(t('cart.addSuccess') || '已加入購物車');
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
    return products.filter(product => product.categoryId != null && relevantCategoryIds.includes(product.categoryId));
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
      <SiteHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
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
          <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:text-4xl">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product: any) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <Link href={`/product/${product.id}`} className="block">
                    <div className="relative">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full aspect-square bg-white object-contain p-3 hover:scale-105 transition-transform"
                      />
                    </div>
                  </Link>
                <div className="p-3 sm:p-4">
                  <Link href={`/product/${product.id}`} className="block">
                      <h3 className="text-sm sm:text-lg font-bold text-gray-800 mb-3 hover:text-[#0ABAB5] transition-colors cursor-pointer line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-lg sm:text-2xl font-bold text-[#DC2626]">
                      {formatPrice(product.price, language)}
                    </span>
                    <Button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.status !== 'available' || product.stock <= 0}
                      className="w-full bg-[#0ABAB5] hover:bg-[#089B96] text-white sm:w-auto"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {product.status !== 'available' || product.stock <= 0
                        ? ((language === 'zh' || language === 'cn') ? '缺貨' : 'Out of Stock')
                        : (t('products.addToCart') || '加入購物車')}
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

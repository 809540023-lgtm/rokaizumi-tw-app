import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Globe, ArrowLeft, ShoppingCart, Loader2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocation as useWouterLocation } from 'wouter';

interface KokuProduct {
  id: string;
  品番: string;
  商品名: string;
  価格: number;
  image?: string;
  [key: string]: any;
}

export default function Koku() {
  const [location, setLocation] = useWouterLocation();
  const { user, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [products, setProducts] = useState<KokuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchKokuProducts();
  }, []);

  const fetchKokuProducts = async () => {
    try {
      setIsLoading(true);
      // 從外部 Hyakuen API 取得產品
      const response = await fetch('https://hyakuen-wholesale.onrender.com/api/products');
      const data = await response.json();

      // 轉換數據格式並添加品番前綴
      const convertedProducts = (data.products || data || []).map((product: any) => ({
        ...product,
        id: `9${product.品番 || product.id}`,
        品番: `9${product.品番 || product.id}`,
      }));

      setProducts(convertedProducts);
    } catch (error) {
      console.error('Failed to fetch Koku products:', error);
      toast.error(language === 'zh' ? '無法載入百元批發產品' : 'Failed to load wholesale products');
    } finally {
      setIsLoading(false);
    }
  };

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

  const filteredProducts = products.filter(product =>
    product.商品名?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.品番?.toString().includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
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
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-1"
              >
                <Globe className="w-4 h-4" />
                <span>{getLanguageLabel()}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/')}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                {language === 'zh' ? '返回' : language === 'ja' ? '戻る' : 'Back'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {language === 'zh' ? '百元批發商品' : language === 'ja' ? '百円卸売商品' : 'Wholesale Products'}
          </h1>
          <p className="text-gray-600">
            {language === 'zh' ? 'KOKUBO 1,463件の高品質商品' : language === 'ja' ? 'KOKUBO 1,463件の高品質商品' : 'High-quality products from KOKUBO'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder={language === 'zh' ? '搜尋商品...' : language === 'ja' ? '商品を検索...' : 'Search products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-[#0ABAB5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] focus:border-transparent"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Product Image */}
                {product.image && (
                  <div className="w-full h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.商品名}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="p-4">
                  <div className="mb-2">
                    <span className="text-xs text-gray-500">品番: {product.品番}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-3 line-clamp-2 text-sm">
                    {product.商品名}
                  </h3>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-xl font-bold text-[#0ABAB5]">
                      {language === 'zh' ? `NT$${Math.round(product.価格)}` :
                       language === 'ja' ? `¥${Math.round(product.価格)}` :
                       `$${(product.価格 * 0.031).toFixed(2)}`}
                    </span>
                  </div>

                  {/* Add to Cart */}
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
                      className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white text-sm"
                      disabled={!isAuthenticated}
                      onClick={() => {
                        if (!isAuthenticated) {
                          toast.error(language === 'zh' ? '請先登入' : 'Please log in first');
                          setLocation('/login');
                        } else {
                          toast.success(language === 'zh' ? '已加入購物車' : 'Added to cart');
                        }
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-1" />
                      {language === 'zh' ? '加入購物車' : language === 'ja' ? 'カートに追加' : 'Add to Cart'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              {language === 'zh' ? '找不到符合條件的商品' : language === 'ja' ? '該当する商品が見つかりません' : 'No products found'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

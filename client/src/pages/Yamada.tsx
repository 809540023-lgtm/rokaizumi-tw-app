import { useEffect, useState } from 'react';

interface YamadaProduct {
  code: string;
  nameJa: string;
  priceJpy: number;
}

export default function Yamada() {
  const [products, setProducts] = useState<YamadaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchYamadaProducts();
  }, []);

  const fetchYamadaProducts = async () => {
    try {
      // 從 hyakuen-wholesale 的產品數據中過濾出 Yamada 產品
      const response = await fetch('https://hyakuen-wholesale.onrender.com/api/products');
      const allProducts = await response.json();

      // 過濾出品番中包含 'yama' 的產品
      const yamadaProducts = allProducts.filter((p: any) =>
        p.code && p.code.includes('yama')
      );

      setProducts(yamadaProducts);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      // 如果 API 失敗，使用本地 Yamada 產品列表
      setProducts(getLocalYamadaProducts());
    }
    setLoading(false);
  };

  const getLocalYamadaProducts = (): YamadaProduct[] => {
    return [
      { code: '33568yama', nameJa: 'ピッケ 2段ランチボックス フェミニン', priceJpy: 0 },
      { code: '33571yama', nameJa: 'ピッケ はしケースセット18 フェミニン', priceJpy: 0 },
      { code: '33569yama', nameJa: 'ピッケ オーバルランチパック フェミニン', priceJpy: 0 },
      { code: '31800yama', nameJa: 'G&B フタ付きマグカップ ホワイト', priceJpy: 0 },
      { code: '31800yama', nameJa: 'G&B フタ付きマグカップ グレー', priceJpy: 0 },
      { code: '31800yama', nameJa: 'G&B フタ付きマグカップ ペールピンク', priceJpy: 0 },
      { code: '31803yama', nameJa: 'G&B ランチボックス SP付き ホワイト', priceJpy: 0 },
      { code: '31806yama', nameJa: 'G&B オーバルランチパック アソート', priceJpy: 0 },
      { code: '31807yama', nameJa: 'G&B スリムランチパック アソート', priceJpy: 0 },
      { code: '31808yama', nameJa: 'G&B おにぎり2P アソート', priceJpy: 0 },
    ];
  };

  const filteredProducts = products.filter(p =>
    p.nameJa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#A78BFA] to-[#7C3AED] text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">山田化學(Yamada Kagaku)</h1>
          <p className="text-lg opacity-90">日本廚房・生活用品全系列 | {products.length} 商品</p>
        </div>
      </div>

      {/* Search */}
      <div className="container mx-auto px-4 py-8">
        <input
          type="text"
          placeholder="搜尋商品名稱或品番..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A78BFA]"
        />
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">載入中...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">未找到符合條件的商品</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <div
                key={`${product.code}-${index}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="bg-gradient-to-br from-[#A78BFA]/10 to-[#7C3AED]/10 h-40 flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>
                <div className="p-4">
                  <div className="text-sm text-[#7C3AED] font-semibold mb-2">
                    {product.code}
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3 line-clamp-2">
                    {product.nameJa}
                  </h3>
                  {product.priceJpy > 0 && (
                    <div className="text-lg font-bold text-[#7C3AED]">
                      ¥{product.priceJpy.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-gray-100 py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p className="mb-2">山田化學官方網站：<a href="https://yamada-kagaku.com" className="text-[#7C3AED] hover:underline">yamada-kagaku.com</a></p>
          <p className="text-sm">品番格式：3 + 編號 + yama</p>
        </div>
      </div>
    </div>
  );
}

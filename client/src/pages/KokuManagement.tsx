import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Edit2, Search, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface KokuProduct {
  id: string;
  品番: string;
  商品名: string;
  価格: number;
  image?: string;
  在庫?: number;
  [key: string]: any;
}

export default function KokuManagement() {
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<KokuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<KokuProduct>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<KokuProduct>>({
    商品名: '',
    価格: 0,
    在庫: 0,
  });

  useEffect(() => {
    fetchKokuProducts();
  }, []);

  const fetchKokuProducts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://hyakuen-wholesale.onrender.com/api/products');
      const data = await response.json();

      const convertedProducts = (data.products || data || []).map((product: any) => ({
        ...product,
        id: `9${product.品番 || product.id}`,
        品番: `9${product.品番 || product.id}`,
      }));

      setProducts(convertedProducts);
    } catch (error) {
      console.error('Failed to fetch Koku products:', error);
      toast.error(language === 'zh' ? '無法載入百元批發產品' : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: KokuProduct) => {
    setEditingId(product.id);
    setEditData({ ...product });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      // 模擬更新（實際應該調用後端API）
      setProducts(products.map(p => p.id === id ? { ...p, ...editData } : p));
      setEditingId(null);
      toast.success(language === 'zh' ? '已更新' : 'Updated successfully');
    } catch (error) {
      toast.error(language === 'zh' ? '更新失敗' : 'Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(language === 'zh' ? '確定要刪除嗎？' : 'Are you sure?')) {
      try {
        setProducts(products.filter(p => p.id !== id));
        toast.success(language === 'zh' ? '已刪除' : 'Deleted successfully');
      } catch (error) {
        toast.error(language === 'zh' ? '刪除失敗' : 'Delete failed');
      }
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.商品名 || !newProduct.価格) {
      toast.error(language === 'zh' ? '請填寫必要欄位' : 'Please fill in required fields');
      return;
    }

    try {
      const product: KokuProduct = {
        id: `9${Date.now()}`,
        品番: `9${Date.now()}`,
        商品名: newProduct.商品名,
        価格: newProduct.価格 || 0,
        在庫: newProduct.在庫 || 0,
      };

      setProducts([...products, product]);
      setNewProduct({ 商品名: '', 価格: 0, 在庫: 0 });
      setIsAddingNew(false);
      toast.success(language === 'zh' ? '已新增' : 'Added successfully');
    } catch (error) {
      toast.error(language === 'zh' ? '新增失敗' : 'Add failed');
    }
  };

  const filteredProducts = products.filter(product =>
    product.商品名?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.品番?.toString().includes(searchQuery)
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {language === 'zh' ? '百元批發商品管理' : language === 'ja' ? '百円卸売商品管理' : 'Kokubo Wholesale Management'}
          </h2>
          <p className="text-gray-600">
            {language === 'zh' ? '共 {0} 件商品' : language === 'ja' ? '全{0}件の商品' : '{0} products'}
              .replace('{0}', products.length.toString())
          </p>
        </div>
        <Button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="bg-[#0ABAB5] hover:bg-[#089B96] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {language === 'zh' ? '新增商品' : language === 'ja' ? '商品追加' : 'Add Product'}
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="mb-6 p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={language === 'zh' ? '搜尋商品名稱或品番...' : 'Search product name or SKU...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
          />
        </div>
      </Card>

      {/* Add New Product Form */}
      {isAddingNew && (
        <Card className="mb-6 p-6 bg-blue-50 border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {language === 'zh' ? '商品名稱' : 'Product Name'}
              </label>
              <input
                type="text"
                value={newProduct.商品名 || ''}
                onChange={(e) => setNewProduct({ ...newProduct, 商品名: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {language === 'zh' ? '價格' : 'Price'}
              </label>
              <input
                type="number"
                value={newProduct.価格 || 0}
                onChange={(e) => setNewProduct({ ...newProduct, 価格: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {language === 'zh' ? '庫存' : 'Stock'}
              </label>
              <input
                type="number"
                value={newProduct.在庫 || 0}
                onChange={(e) => setNewProduct({ ...newProduct, 在庫: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleAddProduct}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {language === 'zh' ? '保存' : 'Save'}
              </Button>
              <Button
                onClick={() => setIsAddingNew(false)}
                variant="outline"
                className="px-4"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Products Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {language === 'zh' ? '品番' : 'SKU'}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {language === 'zh' ? '商品名稱' : 'Product Name'}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {language === 'zh' ? '價格' : 'Price'}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {language === 'zh' ? '庫存' : 'Stock'}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {language === 'zh' ? '操作' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    {editingId === product.id ? (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{product.品番}</span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editData.商品名 || ''}
                            onChange={(e) => setEditData({ ...editData, 商品名: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={editData.価格 || 0}
                            onChange={(e) => setEditData({ ...editData, 価格: parseFloat(e.target.value) })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={editData.在庫 || 0}
                            onChange={(e) => setEditData({ ...editData, 在庫: parseInt(e.target.value) })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleSaveEdit(product.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => setEditingId(null)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{product.品番}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {product.商品名}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          ¥{product.価格?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            (product.在庫 || 0) > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.在庫 || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleEdit(product)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(product.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-gray-600">
            {language === 'zh' ? '沒有找到商品' : 'No products found'}
          </p>
        </Card>
      )}
    </div>
  );
}

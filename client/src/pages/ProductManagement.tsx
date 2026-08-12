import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  Loader2,
  ChevronDown,
  X,
  Upload,
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  categoryId: number;
  imageUrl?: string | null;
  images?: string[] | null;
  status: 'available' | 'sold' | 'reserved';
  stock: number;
  lowStockThreshold: number;
  costJPY?: string | number | null;
  priceUSD?: string | number | null;
  profitTWD?: string | number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: number;
  name: string;
  parentId?: number | null;
}

export default function ProductManagement() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [editUploadedImages, setEditUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditUploading, setIsEditUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    categoryId: 0,
    stock: 1,
    lowStockThreshold: 5,
    status: 'available' as 'available' | 'sold' | 'reserved',
  });

  const { data: products, isLoading, refetch } = trpc.admin.products.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  
  const uploadImagesMutation = trpc.admin.uploadImages.useMutation();

  const createProductMutation = trpc.admin.createProduct.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddModal(false);
      setUploadedImages([]);
      setNewProduct({
        name: '',
        description: '',
        price: 0,
        categoryId: 0,
        stock: 1,
        lowStockThreshold: 5,
        status: 'available',
      });
    },
  });

  const deleteProductMutation = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => refetch(),
  });
  
  const updateProductMutation = trpc.admin.updateProduct.useMutation({
    onSuccess: () => {
      refetch();
      setEditingProduct(null);
      setEditUploadedImages([]);
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((product: Product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

  const getLanguageLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        'products': '產品管理',
        'search': '搜尋產品...',
        'filter': '篩選狀態',
        'all': '全部',
        'add': '新增產品',
        'name': '產品名稱',
        'price': '價格',
        'stock': '庫存',
        'status': '狀態',
        'action': '操作',
        'edit': '編輯',
        'delete': '刪除',
        'available': '可售',
        'sold': '已售',
        'reserved': '已預留',
        'lowStock': '低庫存',
        'noProducts': '暫無產品',
        'loading': '加載中...',
        'addProduct': '新增產品',
        'description': '產品描述',
        'category': '分類',
        'selectCategory': '選擇分類',
        'imageUrl': '圖片網址',
        'lowStockThreshold': '低庫存警戒值',
        'cancel': '取消',
        'save': '保存',
        'saving': '保存中...',
        'creating': '創建中...',
        'create': '創建',
      },
      en: {
        'products': 'Product Management',
        'search': 'Search products...',
        'filter': 'Filter Status',
        'all': 'All',
        'add': 'Add Product',
        'name': 'Product Name',
        'price': 'Price',
        'stock': 'Stock',
        'status': 'Status',
        'action': 'Action',
        'edit': 'Edit',
        'delete': 'Delete',
        'available': 'Available',
        'sold': 'Sold',
        'reserved': 'Reserved',
        'lowStock': 'Low Stock',
        'noProducts': 'No products',
        'loading': 'Loading...',
        'addProduct': 'Add Product',
        'description': 'Description',
        'category': 'Category',
        'selectCategory': 'Select Category',
        'imageUrl': 'Image URL',
        'lowStockThreshold': 'Low Stock Threshold',
        'cancel': 'Cancel',
        'save': 'Save',
        'saving': 'Saving...',
        'creating': 'Creating...',
        'create': 'Create',
      },
      ja: {
        'products': '商品管理',
        'search': '商品を検索...',
        'filter': 'ステータスフィルター',
        'all': 'すべて',
        'add': '商品を追加',
        'name': '商品名',
        'price': '価格',
        'stock': '在庫',
        'status': 'ステータス',
        'action': 'アクション',
        'edit': '編集',
        'delete': '削除',
        'available': '利用可能',
        'sold': '売却',
        'reserved': '予約済み',
        'lowStock': '在庫不足',
        'noProducts': '商品なし',
        'loading': '読み込み中...',
        'addProduct': '商品を追加',
        'description': '説明',
        'category': 'カテゴリー',
        'selectCategory': 'カテゴリーを選択',
        'imageUrl': '画像URL',
        'lowStockThreshold': '在庫警告閾値',
        'cancel': 'キャンセル',
        'save': '保存',
        'saving': '保存中...',
        'creating': '作成中...',
        'create': '作成',
      },
    };
    return labels[language]?.[key] || key;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'sold':
        return 'bg-gray-100 text-gray-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm(getLanguageLabel('delete') + '?')) {
      await deleteProductMutation.mutateAsync({ id });
    }
  };

  const handleEditChange = (field: string, value: any) => {
    if (editingProduct) {
      setEditingProduct({
        ...editingProduct,
        [field]: value,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (editingProduct) {
      await updateProductMutation.mutateAsync({
        id: editingProduct.id,
        name: editingProduct.name,
        description: editingProduct.description || '',
        price: editingProduct.price,
        categoryId: editingProduct.categoryId,
        stock: editingProduct.stock,
        lowStockThreshold: editingProduct.lowStockThreshold,
        status: editingProduct.status,
        images: editUploadedImages.length > 0 ? editUploadedImages : undefined,
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (uploadedImages.length + files.length > 5) {
      alert(language === 'zh' ? '最多只能上傳 5 張圖片' : 
            language === 'ja' ? '画像は最大5枚までです' : 
            'Maximum 5 images allowed');
      return;
    }
    
    setIsUploading(true);
    try {
      const imagesToUpload = [];
      for (let i = 0; i < files.length && uploadedImages.length + imagesToUpload.length < 5; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/xxx;base64, prefix
          };
          reader.readAsDataURL(file);
        });
        imagesToUpload.push({
          fileName: file.name,
          fileData: base64,
          contentType: file.type,
        });
      }
      
      const result = await uploadImagesMutation.mutateAsync({ images: imagesToUpload });
      setUploadedImages([...uploadedImages, ...result.images.map(img => img.url)]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(language === 'zh' ? '圖片上傳失敗' : 
            language === 'ja' ? '画像のアップロードに失敗しました' : 
            'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (editUploadedImages.length + files.length > 5) {
      alert(language === 'zh' ? '最多只能上傳 5 張圖片' : 
            language === 'ja' ? '画像は最大5枚までです' : 
            'Maximum 5 images allowed');
      return;
    }
    
    setIsEditUploading(true);
    try {
      const imagesToUpload = [];
      for (let i = 0; i < files.length && editUploadedImages.length + imagesToUpload.length < 5; i++) {
        const file = files[i];
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        imagesToUpload.push({
          fileName: file.name,
          fileData: base64,
          contentType: file.type,
        });
      }
      
      const result = await uploadImagesMutation.mutateAsync({ images: imagesToUpload });
      setEditUploadedImages([...editUploadedImages, ...result.images.map(img => img.url)]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(language === 'zh' ? '圖片上傳失敗' : 
            language === 'ja' ? '画像のアップロードに失敗しました' : 
            'Image upload failed');
    } finally {
      setIsEditUploading(false);
    }
  };

  const removeEditImage = (index: number) => {
    setEditUploadedImages(editUploadedImages.filter((_, i) => i !== index));
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.categoryId) {
      alert(language === 'zh' ? '請填寫產品名稱和選擇分類' : 
            language === 'ja' ? '商品名とカテゴリーを入力してください' : 
            'Please fill in product name and select category');
      return;
    }
    
    await createProductMutation.mutateAsync({
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      categoryId: newProduct.categoryId,
      stock: newProduct.stock,
      status: newProduct.status,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {getLanguageLabel('products')}
        </h2>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#089B96]"
        >
          <Plus className="w-4 h-4" />
          {getLanguageLabel('add')}
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={getLanguageLabel('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] appearance-none pr-10"
            >
              <option value="all">{getLanguageLabel('all')}</option>
              <option value="available">{getLanguageLabel('available')}</option>
              <option value="sold">{getLanguageLabel('sold')}</option>
              <option value="reserved">{getLanguageLabel('reserved')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('name')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('price')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('stock')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('status')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product: Product) => (
                  <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {product.imageUrl && (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <p>{product.name}</p>
                          {product.stock <= product.lowStockThreshold && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              {getLanguageLabel('lowStock')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      NT${product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        product.stock <= product.lowStockThreshold
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                        {getLanguageLabel(product.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Initialize edit images with existing product images
                          const existingImages: string[] = [];
                          if (product.imageUrl) existingImages.push(product.imageUrl);
                          if (product.images && Array.isArray(product.images)) {
                            existingImages.push(...product.images);
                          }
                          setEditUploadedImages(existingImages);
                          setEditingProduct(product);
                        }}
                        className="inline-flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        {getLanguageLabel('edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteProductMutation.isPending}
                        className="inline-flex items-center gap-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        {getLanguageLabel('delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <p className="text-gray-500">{getLanguageLabel('noProducts')}</p>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{getLanguageLabel('addProduct')}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLanguageLabel('name')} *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  placeholder={language === 'zh' ? '輸入產品名稱' : language === 'ja' ? '商品名を入力' : 'Enter product name'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLanguageLabel('description')}
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  rows={3}
                  placeholder={language === 'zh' ? '輸入產品描述' : language === 'ja' ? '商品説明を入力' : 'Enter description'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLanguageLabel('category')} *
                </label>
                <select
                  value={newProduct.categoryId}
                  onChange={(e) => setNewProduct({ ...newProduct, categoryId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                >
                  <option value={0}>{getLanguageLabel('selectCategory')}</option>
                  {categories?.filter((cat: Category) => 
                    cat.name === '銀髮生活品質加乘輔具' || cat.name === '日本精美小商品'
                  ).map((cat: Category) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLanguageLabel('price')} (NT$)
                  </label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseInt(e.target.value) || 0 })}
                    step="1"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLanguageLabel('stock')}
                  </label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'zh' ? '產品圖片（最多 5 張）' : language === 'ja' ? '商品画像（最大5枚）' : 'Product Images (Max 5)'}
                </label>
                <div className="space-y-3">
                  {/* 已上傳的圖片預覽 */}
                  {uploadedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((url, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={url} 
                            alt={`Product ${index + 1}`}
                            className={`w-20 h-20 object-cover rounded-lg border-2 ${index === 0 ? 'border-[#0ABAB5]' : 'border-gray-200'}`}
                          />
                          {index === 0 && (
                            <span className="absolute -top-2 -left-2 bg-[#0ABAB5] text-white text-xs px-1.5 py-0.5 rounded">
                              {language === 'zh' ? '主圖' : language === 'ja' ? 'メイン' : 'Main'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 上傳按鈕 */}
                  {uploadedImages.length < 5 && (
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#0ABAB5] hover:bg-gray-50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-[#0ABAB5]" />
                          <span className="text-sm text-gray-600">
                            {language === 'zh' ? '上傳中...' : language === 'ja' ? 'アップロード中...' : 'Uploading...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {language === 'zh' ? `點擊上傳圖片（還可上傳 ${5 - uploadedImages.length} 張）` : 
                             language === 'ja' ? `クリックして画像をアップロード（残り ${5 - uploadedImages.length} 枚）` : 
                             `Click to upload images (${5 - uploadedImages.length} remaining)`}
                          </span>
                        </>
                      )}
                    </label>
                  )}
                  <p className="text-xs text-gray-500">
                    {language === 'zh' ? '第一張圖片將作為主圖顯示' : 
                     language === 'ja' ? '最初の画像がメイン画像として表示されます' : 
                     'The first image will be displayed as the main image'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLanguageLabel('status')}
                </label>
                <select
                  value={newProduct.status}
                  onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value as 'available' | 'sold' | 'reserved' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                >
                  <option value="available">{getLanguageLabel('available')}</option>
                  <option value="sold">{getLanguageLabel('sold')}</option>
                  <option value="reserved">{getLanguageLabel('reserved')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                {getLanguageLabel('cancel')}
              </Button>
              <Button
                onClick={handleCreateProduct}
                disabled={createProductMutation.isPending}
                className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96]"
              >
                {createProductMutation.isPending ? getLanguageLabel('creating') : getLanguageLabel('create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {language === 'zh' ? '編輯產品' : language === 'ja' ? '商品を編集' : 'Edit Product'}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{getLanguageLabel('name')}</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{getLanguageLabel('description')}</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => handleEditChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{getLanguageLabel('price')} (NT$)</label>
                  <input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => handleEditChange('price', parseInt(e.target.value) || 0)}
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{getLanguageLabel('stock')}</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => handleEditChange('stock', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{getLanguageLabel('status')}</label>
                <select
                  value={editingProduct.status}
                  onChange={(e) => handleEditChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                >
                  <option value="available">{getLanguageLabel('available')}</option>
                  <option value="sold">{getLanguageLabel('sold')}</option>
                  <option value="reserved">{getLanguageLabel('reserved')}</option>
                </select>
              </div>

              {/* Image Upload for Edit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'zh' ? '產品圖片（最多 5 張）' : 
                   language === 'ja' ? '商品画像（最大5枚）' : 
                   'Product Images (max 5)'}
                </label>
                
                {/* Current Images Preview */}
                {editUploadedImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {editUploadedImages.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Image ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeEditImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                        {index === 0 && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0ABAB5] text-white text-xs px-1 rounded">
                            {language === 'zh' ? '主圖' : language === 'ja' ? 'メイン' : 'Main'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {editUploadedImages.length < 5 && (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                      {isEditUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {language === 'zh' ? `點擊上傳圖片（還可上傳 ${5 - editUploadedImages.length} 張）` : 
                             language === 'ja' ? `クリックしてアップロード（残り ${5 - editUploadedImages.length} 枚）` : 
                             `Click to upload (${5 - editUploadedImages.length} remaining)`}
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEditImageUpload}
                      className="hidden"
                      disabled={isEditUploading}
                    />
                  </label>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'zh' ? '第一張圖片將作為主圖顯示' : 
                   language === 'ja' ? '最初の画像がメイン画像として表示されます' : 
                   'The first image will be displayed as the main image'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setEditingProduct(null)}
                className="flex-1"
              >
                {getLanguageLabel('cancel')}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateProductMutation.isPending}
                className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96]"
              >
                {updateProductMutation.isPending ? getLanguageLabel('saving') : getLanguageLabel('save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

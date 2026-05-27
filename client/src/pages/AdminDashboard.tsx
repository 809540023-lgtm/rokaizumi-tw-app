import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers' | 'purchases'>('orders');
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);

  // 所有 Hook 必須在條件判斷之前調用
  const { data: orders = [], isLoading: ordersLoading } = trpc.admin.orders.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });
  const { data: suppliers = [], isLoading: suppliersLoading } = trpc.admin.suppliers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });
  const { data: purchases = [], isLoading: purchasesLoading } = trpc.admin.purchases.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const createSupplierMutation = trpc.admin.createSupplier.useMutation({
    onSuccess: () => {
      toast.success(language === 'zh' ? '廠商已添加' : 'Supplier added');
      setShowSupplierForm(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createPurchaseMutation = trpc.admin.createPurchase.useMutation({
    onSuccess: () => {
      toast.success(language === 'zh' ? '進貨記錄已添加' : 'Purchase record added');
      setShowPurchaseForm(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 檢查是否為管理員 - 在所有 Hook 之後進行條件渲染
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {language === 'zh' ? '無權限訪問' : 'Access Denied'}
          </h1>
          <Button onClick={() => setLocation('/')}>
            {language === 'zh' ? '返回首頁' : 'Back to Home'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-[#0ABAB5]">
            {language === 'zh' ? '管理後台' : 'Admin Dashboard'}
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-9">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 items-center">
            <a
              href="/admin/financial"
              className="py-4 px-6 font-semibold text-[#0ABAB5] hover:bg-gray-100 transition-colors"
            >
              {language === 'zh' ? '📊 財務儀表板' : language === 'ja' ? '📊 財務ダッシュボード' : '📊 Financial Dashboard'}
            </a>
            <div className="border-l border-gray-300 h-8"></div>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-[#0ABAB5] text-[#0ABAB5]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {language === 'zh' ? '訂單管理' : 'Orders'} ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
                activeTab === 'suppliers'
                  ? 'border-[#0ABAB5] text-[#0ABAB5]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {language === 'zh' ? '廠商管理' : 'Suppliers'} ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
                activeTab === 'purchases'
                  ? 'border-[#0ABAB5] text-[#0ABAB5]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {language === 'zh' ? '進貨記錄' : 'Purchases'} ({purchases.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 className="text-xl font-bold mb-6">
              {language === 'zh' ? '訂單管理' : 'Order Management'}
            </h2>
            {ordersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {language === 'zh' ? '暫無訂單' : 'No orders'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '訂單號' : 'Order ID'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '客戶' : 'Customer'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '金額' : 'Total'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '狀態' : 'Status'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '日期' : 'Date'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">#{order.id}</td>
                        <td className="border border-gray-300 px-4 py-2">{order.user?.name}</td>
                        <td className="border border-gray-300 px-4 py-2">${order.totalAmount}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span className={`px-2 py-1 rounded text-sm ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {language === 'zh' ? '廠商管理' : 'Supplier Management'}
              </h2>
              <Button
                onClick={() => setShowSupplierForm(!showSupplierForm)}
                className="bg-[#0ABAB5] hover:bg-[#089B96] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {language === 'zh' ? '新增廠商' : 'Add Supplier'}
              </Button>
            </div>

            {suppliersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {language === 'zh' ? '暫無廠商' : 'No suppliers'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {suppliers.map((supplier: any) => (
                  <Card key={supplier.id} className="p-6">
                    <h3 className="font-bold text-lg mb-2">{supplier.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'zh' ? '聯絡人：' : 'Contact: '}{supplier.contactPerson}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'zh' ? '電郵：' : 'Email: '}{supplier.email}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'zh' ? '電話：' : 'Phone: '}{supplier.phone}
                    </p>
                    <p className="text-sm text-gray-600">
                      {language === 'zh' ? '地址：' : 'Address: '}{supplier.address}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {language === 'zh' ? '進貨記錄' : 'Purchase Records'}
              </h2>
              <Button
                onClick={() => setShowPurchaseForm(!showPurchaseForm)}
                className="bg-[#0ABAB5] hover:bg-[#089B96] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {language === 'zh' ? '新增進貨' : 'Add Purchase'}
              </Button>
            </div>

            {purchasesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {language === 'zh' ? '暫無進貨記錄' : 'No purchase records'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '商品' : 'Product'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '廠商' : 'Supplier'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '數量' : 'Quantity'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '進貨價' : 'Unit Price'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '總成本' : 'Total Cost'}
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left">
                        {language === 'zh' ? '進貨日期' : 'Purchase Date'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase: any) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{purchase.product?.name}</td>
                        <td className="border border-gray-300 px-4 py-2">{purchase.supplier?.name}</td>
                        <td className="border border-gray-300 px-4 py-2">{purchase.quantity}</td>
                        <td className="border border-gray-300 px-4 py-2">${purchase.purchasePrice}</td>
                        <td className="border border-gray-300 px-4 py-2">${purchase.totalCost}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(purchase.purchaseDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

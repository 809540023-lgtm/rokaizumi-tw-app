import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Search,
  ChevronDown,
  Eye,
  CheckCircle,
  Clock,
  Truck,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useState as useStateDialog } from 'react';

interface Order {
  id: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  shippingAddress: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: any[];
  user?: any;
  totalUSD?: number;
}

export default function OrderManagement() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');

  // 查詢所有訂單
  const { data: orders, isLoading, refetch } = trpc.admin.orders.useQuery();
  const updateStatusMutation = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => {
      refetch();
      setShowDetailModal(false);
    },
  });

  // 篩選和搜尋訂單
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order: Order) => {
      const matchesSearch =
        order.id.toString().includes(searchTerm) ||
        order.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.contactPhone.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'shipped':
        return <Truck className="w-5 h-5 text-purple-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        pending: '待付款',
        paid: '已付款',
        shipped: '已出貨',
        completed: '已完成',
        cancelled: '已取消',
      },
      en: {
        pending: 'Pending',
        paid: 'Paid',
        shipped: 'Shipped',
        completed: 'Completed',
        cancelled: 'Cancelled',
      },
      ja: {
        pending: '保留中',
        paid: '支払済み',
        shipped: '発送済み',
        completed: '完了',
        cancelled: 'キャンセル',
      },
    };
    return labels[language]?.[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async () => {
    if (selectedOrder && newStatus && newStatus !== selectedOrder.status) {
      await updateStatusMutation.mutateAsync({
        id: selectedOrder.id,
        status: newStatus as any,
      });
    }
  };

  const getLanguageLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        'orders': '訂單管理',
        'search': '搜尋訂單...',
        'filter': '篩選狀態',
        'all': '全部',
        'orderId': '訂單號',
        'customer': '客戶',
        'phone': '電話',
        'amount': '金額',
        'status': '狀態',
        'date': '日期',
        'action': '操作',
        'view': '查看',
        'details': '訂單詳情',
        'address': '收貨地址',
        'email': '郵箱',
        'notes': '備註',
        'items': '商品',
        'quantity': '數量',
        'price': '價格',
        'updateStatus': '更新狀態',
        'cancel': '取消',
        'save': '保存',
        'loading': '加載中...',
        'noOrders': '暫無訂單',
        'newStatus': '新狀態',
      },
      en: {
        'orders': 'Order Management',
        'search': 'Search orders...',
        'filter': 'Filter Status',
        'all': 'All',
        'orderId': 'Order ID',
        'customer': 'Customer',
        'phone': 'Phone',
        'amount': 'Amount',
        'status': 'Status',
        'date': 'Date',
        'action': 'Action',
        'view': 'View',
        'details': 'Order Details',
        'address': 'Shipping Address',
        'email': 'Email',
        'notes': 'Notes',
        'items': 'Items',
        'quantity': 'Quantity',
        'price': 'Price',
        'updateStatus': 'Update Status',
        'cancel': 'Cancel',
        'save': 'Save',
        'loading': 'Loading...',
        'noOrders': 'No orders',
        'newStatus': 'New Status',
      },
      ja: {
        'orders': '注文管理',
        'search': '注文を検索...',
        'filter': 'ステータスフィルター',
        'all': 'すべて',
        'orderId': '注文ID',
        'customer': '顧客',
        'phone': '電話',
        'amount': '金額',
        'status': 'ステータス',
        'date': '日付',
        'action': 'アクション',
        'view': '表示',
        'details': '注文詳細',
        'address': '配送先住所',
        'email': 'メール',
        'notes': '注記',
        'items': 'アイテム',
        'quantity': '数量',
        'price': '価格',
        'updateStatus': 'ステータスを更新',
        'cancel': 'キャンセル',
        'save': '保存',
        'loading': '読み込み中...',
        'noOrders': '注文なし',
        'newStatus': '新しいステータス',
      },
    };
    return labels[language]?.[key] || key;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        {getLanguageLabel('orders')}
      </h2>

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
              <option value="pending">{getStatusLabel('pending')}</option>
              <option value="paid">{getStatusLabel('paid')}</option>
              <option value="shipped">{getStatusLabel('shipped')}</option>
              <option value="completed">{getStatusLabel('completed')}</option>
              <option value="cancelled">{getStatusLabel('cancelled')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('orderId')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('customer')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('phone')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('status')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('date')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order: Order) => (
                  <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {order.contactName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {order.contactPhone}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ${(order.totalUSD || (order.totalAmount || 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(order.createdAt).toLocaleDateString(
                        language === 'zh' ? 'zh-TW' : language === 'ja' ? 'ja-JP' : 'en-US'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status);
                          setShowDetailModal(true);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        {getLanguageLabel('view')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
          <p className="text-gray-500">{getLanguageLabel('noOrders')}</p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {getLanguageLabel('details')} - #{selectedOrder.id}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">{getLanguageLabel('customer')}</p>
                  <p className="font-semibold text-gray-900">{selectedOrder.contactName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{getLanguageLabel('phone')}</p>
                  <p className="font-semibold text-gray-900">{selectedOrder.contactPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{getLanguageLabel('email')}</p>
                  <p className="font-semibold text-gray-900">{selectedOrder.contactEmail || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{getLanguageLabel('amount')}</p>
                  <p className="font-semibold text-gray-900">
                    ${(selectedOrder.totalUSD || (selectedOrder.totalAmount || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-2">{getLanguageLabel('address')}</p>
                <p className="text-gray-900">{selectedOrder.shippingAddress}</p>
              </div>

              {/* Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    {getLanguageLabel('items')}
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.productName} x {item.quantity}
                        </span>
                        <span className="font-semibold text-gray-900">
                          ${(item.subtotal / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-2">{getLanguageLabel('newStatus')}</p>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                >
                  <option value="pending">{getStatusLabel('pending')}</option>
                  <option value="paid">{getStatusLabel('paid')}</option>
                  <option value="shipped">{getStatusLabel('shipped')}</option>
                  <option value="completed">{getStatusLabel('completed')}</option>
                  <option value="cancelled">{getStatusLabel('cancelled')}</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleStatusUpdate}
                  disabled={updateStatusMutation.isPending || newStatus === selectedOrder.status}
                  className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {getLanguageLabel('loading')}
                    </>
                  ) : (
                    getLanguageLabel('updateStatus')
                  )}
                </Button>
                <Button
                  onClick={() => setShowDetailModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  {getLanguageLabel('cancel')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, ShoppingCart, BarChart3, AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';

export default function FinancialDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  const [exchangeRate, setExchangeRate] = useState(30);

  // 檢查是否為管理員
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {language === 'zh' ? '無權限訪問' : language === 'ja' ? 'アクセス拒否' : 'Access Denied'}
          </h1>
          <Button onClick={() => setLocation('/')}>
            {language === 'zh' ? '返回首頁' : language === 'ja' ? 'ホームに戻る' : 'Back to Home'}
          </Button>
        </div>
      </div>
    );
  }

  // 查詢財務數據
  const { data: metrics, isLoading: metricsLoading } = trpc.admin.financialMetrics.useQuery({
    exchangeRateUSDtoTWD: exchangeRate,
  });

  const { data: todayData, isLoading: todayLoading } = trpc.admin.todayRevenue.useQuery();
  const { data: monthData, isLoading: monthLoading } = trpc.admin.monthRevenue.useQuery();
  const { data: allOrders, isLoading: ordersLoading } = trpc.admin.allOrdersWithDetails.useQuery();
  const { data: lowStockProducts } = trpc.admin.lowStockProducts.useQuery();

  // 計算統計數據
  const stats = useMemo(() => {
    if (!metrics) return null;

    return {
      todayOrdersCount: metrics.today.ordersCount,
      todayRevenueUSD: metrics.today.revenueUSD,
      todayRevenueTWD: metrics.today.revenueTWD,
      monthOrdersCount: metrics.month.ordersCount,
      monthRevenueUSD: metrics.month.revenueUSD,
      monthRevenueTWD: metrics.month.revenueTWD,
      totalRevenueUSD: metrics.total.revenueUSD,
      totalRevenueTWD: metrics.total.revenueTWD,
    };
  }, [metrics]);

  const formatCurrency = (value: number, currency: string = 'USD') => {
    if (currency === 'TWD') {
      return `NT$${value.toFixed(2)}`;
    }
    return `$${value.toFixed(2)}`;
  };

  const getLanguageLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        'dashboard': '財務儀表板',
        'today': '今日',
        'month': '本月',
        'total': '累計',
        'orders': '訂單',
        'revenue': '收入',
        'usd': '美元',
        'twd': '台幣',
        'loading': '加載中...',
        'exchangeRate': '匯率 (USD → TWD)',
        'update': '更新',
        'dailyRevenue': '日收入',
        'monthlyRevenue': '月收入',
        'totalRevenue': '累計收入',
        'orderCount': '訂單數',
        'recentOrders': '最近訂單',
        'orderId': '訂單號',
        'customer': '客戶',
        'amount': '金額',
        'status': '狀態',
        'date': '日期',
      },
      en: {
        'dashboard': 'Financial Dashboard',
        'today': 'Today',
        'month': 'This Month',
        'total': 'Total',
        'orders': 'Orders',
        'revenue': 'Revenue',
        'usd': 'USD',
        'twd': 'TWD',
        'loading': 'Loading...',
        'exchangeRate': 'Exchange Rate (USD → TWD)',
        'update': 'Update',
        'dailyRevenue': 'Daily Revenue',
        'monthlyRevenue': 'Monthly Revenue',
        'totalRevenue': 'Total Revenue',
        'orderCount': 'Order Count',
        'recentOrders': 'Recent Orders',
        'orderId': 'Order ID',
        'customer': 'Customer',
        'amount': 'Amount',
        'status': 'Status',
        'date': 'Date',
      },
      ja: {
        'dashboard': '財務ダッシュボード',
        'today': '今日',
        'month': '今月',
        'total': '合計',
        'orders': '注文',
        'revenue': '収益',
        'usd': 'ドル',
        'twd': '台湾ドル',
        'loading': '読み込み中...',
        'exchangeRate': '為替レート (USD → TWD)',
        'update': '更新',
        'dailyRevenue': '日次収益',
        'monthlyRevenue': '月次収益',
        'totalRevenue': '累計収益',
        'orderCount': '注文数',
        'recentOrders': '最近の注文',
        'orderId': '注文ID',
        'customer': '顧客',
        'amount': '金額',
        'status': 'ステータス',
        'date': '日付',
      },
    };
    return labels[language]?.[key] || key;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-[#0ABAB5]">
            {getLanguageLabel('dashboard')}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Low Stock Warning */}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <div className="mb-8 bg-orange-50 border border-orange-200 p-6 rounded-lg">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  {language === 'zh' ? '低庫存警告' : language === 'ja' ? '在庫不足警告' : 'Low Stock Alert'}
                </h3>
                <p className="text-sm text-orange-800 mb-3">
                  {language === 'zh'
                    ? '有商品庫存不足'
                    : language === 'ja'
                    ? '商品の在庫が不足しています'
                    : 'Some products have low stock'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Exchange Rate Control */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-gray-700">
              {getLanguageLabel('exchangeRate')}:
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 30)}
              step="0.1"
              min="1"
              className="border border-gray-300 rounded px-3 py-2 w-24"
            />
            <span className="text-sm text-gray-600">TWD per USD</span>
          </div>
        </div>

        {/* Statistics Cards */}
        {metricsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
          </div>
        ) : stats ? (
          <>
            {/* Today's Revenue */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="p-6 border-l-4 border-l-[#0ABAB5]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {getLanguageLabel('today')} - {getLanguageLabel('orders')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.todayOrdersCount}
                    </p>
                  </div>
                  <ShoppingCart className="w-12 h-12 text-[#0ABAB5] opacity-20" />
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-[#DC2626]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {getLanguageLabel('today')} - {getLanguageLabel('revenue')} (USD)
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      ${stats.todayRevenueUSD.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-[#DC2626] opacity-20" />
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-[#10B981]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {getLanguageLabel('today')} - {getLanguageLabel('revenue')} (TWD)
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      NT${stats.todayRevenueTWD.toFixed(0)}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-[#10B981] opacity-20" />
                </div>
              </Card>

              <Card className="p-6 border-l-4 border-l-[#F59E0B]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {getLanguageLabel('month')} - {getLanguageLabel('orders')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.monthOrdersCount}
                    </p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-[#F59E0B] opacity-20" />
                </div>
              </Card>
            </div>

            {/* Monthly Revenue */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-900">
                  {getLanguageLabel('monthlyRevenue')} (USD)
                </h3>
                <p className="text-4xl font-bold text-[#0ABAB5]">
                  ${stats.monthRevenueUSD.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {stats.monthOrdersCount} {getLanguageLabel('orders')}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-900">
                  {getLanguageLabel('monthlyRevenue')} (TWD)
                </h3>
                <p className="text-4xl font-bold text-[#10B981]">
                  NT${stats.monthRevenueTWD.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {getLanguageLabel('exchangeRate')}: {exchangeRate}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-900">
                  {getLanguageLabel('totalRevenue')}
                </h3>
                <p className="text-2xl font-bold text-[#DC2626] mb-2">
                  ${stats.totalRevenueUSD.toFixed(2)}
                </p>
                <p className="text-2xl font-bold text-[#10B981]">
                  NT${stats.totalRevenueTWD.toFixed(0)}
                </p>
              </Card>
            </div>

            {/* Recent Orders */}
            <div>
              <h2 className="text-xl font-bold mb-6 text-gray-900">
                {getLanguageLabel('recentOrders')}
              </h2>
              {ordersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
                </div>
              ) : allOrders && allOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('orderId')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('customer')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('amount')} (USD)
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('amount')} (TWD)
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('status')}
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          {getLanguageLabel('date')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allOrders.slice(0, 10).map((order: any) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">#{order.id}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            {order.user?.name || order.contactName}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            ${order.totalUSD.toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            NT${(order.totalUSD * exchangeRate).toFixed(0)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded text-sm ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {new Date(order.createdAt).toLocaleDateString(
                              language === 'zh' ? 'zh-TW' : language === 'ja' ? 'ja-JP' : 'en-US'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {language === 'zh' ? '暫無訂單' : language === 'ja' ? '注文がありません' : 'No orders'}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

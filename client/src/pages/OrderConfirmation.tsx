import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Package, Truck, MapPin, Calendar, DollarSign, Globe, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { useState } from 'react';
import { Link } from 'wouter';

export default function OrderConfirmation() {
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [sessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('orderId');
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

  // Query for order details based on session ID
  const { data: order, isLoading } = trpc.orders.getById.useQuery({ id: Number(sessionId) },
    { enabled: !!sessionId }
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">請登入</h1>
          <p className="text-gray-600 mb-6">請先登入以查看訂單詳情</p>
          <Button onClick={() => setLocation('/login')} className="w-full bg-[#0ABAB5] hover:bg-[#089B96]">
            前往登入
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0ABAB5] mx-auto mb-4"></div>
          <p className="text-gray-600">載入訂單詳情中...</p>
        </div>
      </div>
    );
  }

  if (!order) {
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
        </header>

        <main className="container mx-auto px-4 py-12">
          <Card className="p-8 max-w-md mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">訂單未找到</h1>
            <p className="text-gray-600 mb-6">無法找到對應的訂單信息</p>
            <Button onClick={() => setLocation('/')} className="w-full bg-[#0ABAB5] hover:bg-[#089B96]">
              返回首頁
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const totalAmount = (order as any).items?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
  const orderDate = new Date(order.createdAt).toLocaleDateString(language === 'ja' ? 'ja-JP' : language === 'en' ? 'en-US' : 'zh-TW');

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
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Success Message */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {language === 'zh' && '訂單確認'}
            {language === 'en' && 'Order Confirmed'}
            {language === 'ja' && '注文確認'}
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            {language === 'zh' && '感謝您的購買！'}
            {language === 'en' && 'Thank you for your purchase!'}
            {language === 'ja' && 'ご購入ありがとうございます！'}
          </p>
          <p className="text-gray-500">
            {language === 'zh' && '我們已收到您的訂單，將盡快為您處理。'}
            {language === 'en' && 'We have received your order and will process it as soon as possible.'}
            {language === 'ja' && 'ご注文を受け付けました。できるだけ早く処理させていただきます。'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Information */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {language === 'zh' && '訂單信息'}
                {language === 'en' && 'Order Information'}
                {language === 'ja' && '注文情報'}
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">
                    {language === 'zh' && '訂單編號'}
                    {language === 'en' && 'Order Number'}
                    {language === 'ja' && '注文番号'}
                  </div>
                  <div className="font-bold text-lg"># {order.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">
                    {language === 'zh' && '訂單日期'}
                    {language === 'en' && 'Order Date'}
                    {language === 'ja' && '注文日'}
                  </div>
                  <div className="font-bold text-lg">{orderDate}</div>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 rounded-full p-2">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      {language === 'zh' && '訂單狀態'}
                      {language === 'en' && 'Order Status'}
                      {language === 'ja' && '注文ステータス'}
                    </div>
                    <div className="font-bold">
                      {language === 'zh' && '已確認'}
                      {language === 'en' && 'Confirmed'}
                      {language === 'ja' && '確認済み'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full p-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      {language === 'zh' && '預計配送'}
                      {language === 'en' && 'Expected Delivery'}
                      {language === 'ja' && '予定配送'}
                    </div>
                    <div className="font-bold">
                      {language === 'zh' && '3-5 個工作天'}
                      {language === 'en' && '3-5 business days'}
                      {language === 'ja' && '3～5営業日'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Shipping Information */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {language === 'zh' && '配送信息'}
                {language === 'en' && 'Shipping Information'}
                {language === 'ja' && '配送情報'}
              </h2>
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 text-[#0ABAB5] flex-shrink-0 mt-1" />
                <div>
                  <div className="font-bold text-lg mb-2">{order.contactName}</div>
                  <div className="text-gray-600 mb-1">{order.contactPhone}</div>
                  <div className="text-gray-600">{order.shippingAddress}</div>
                  {order.notes && <div className="text-gray-500 mt-2 italic">{order.notes}</div>}
                </div>
              </div>
            </Card>

            {/* Order Items */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {language === 'zh' && '訂單商品'}
                {language === 'en' && 'Order Items'}
                {language === 'ja' && '注文商品'}
              </h2>
              <div className="space-y-4">
                {((order as any).items || []).map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center pb-4 border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="font-semibold">{item.productName}</div>
                      <div className="text-sm text-gray-600">
                        {language === 'zh' && '數量: '}{language === 'en' && 'Qty: '}{language === 'ja' && '数量: '}{item.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#DC2626]">¥{item.subtotal?.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">¥{item.productPrice?.toLocaleString()} × {item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-2xl font-bold mb-6">
                {language === 'zh' && '訂單摘要'}
                {language === 'en' && 'Order Summary'}
                {language === 'ja' && '注文概要'}
              </h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {language === 'zh' && '小計'}
                    {language === 'en' && 'Subtotal'}
                    {language === 'ja' && '小計'}
                  </span>
                  <span className="font-bold">¥{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {language === 'zh' && '運費'}
                    {language === 'en' && 'Shipping'}
                    {language === 'ja' && '送料'}
                  </span>
                  <span className="font-bold">
                    {language === 'zh' && '待定'}
                    {language === 'en' && 'TBD'}
                    {language === 'ja' && '未定'}
                  </span>
                </div>
              </div>
              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>
                    {language === 'zh' && '總計'}
                    {language === 'en' && 'Total'}
                    {language === 'ja' && '合計'}
                  </span>
                  <span className="text-[#DC2626]">¥{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Status */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-700">
                    {language === 'zh' && '支付已完成'}
                    {language === 'en' && 'Payment Completed'}
                    {language === 'ja' && '支払い完了'}
                  </span>
                </div>
                <p className="text-sm text-green-600">
                  {language === 'zh' && '您的支付已成功處理'}
                  {language === 'en' && 'Your payment has been processed successfully'}
                  {language === 'ja' && 'お支払いは正常に処理されました'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => setLocation('/orders')}
                  className="w-full bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {language === 'zh' && '查看所有訂單'}
                  {language === 'en' && 'View All Orders'}
                  {language === 'ja' && 'すべての注文を表示'}
                </Button>
                <Button
                  onClick={() => setLocation('/products')}
                  variant="outline"
                  className="w-full"
                >
                  {language === 'zh' && '繼續購物'}
                  {language === 'en' && 'Continue Shopping'}
                  {language === 'ja' && 'ショッピングを続ける'}
                </Button>
                <Button
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {language === 'zh' && '返回首頁'}
                  {language === 'en' && 'Back to Home'}
                  {language === 'ja' && 'ホームに戻る'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

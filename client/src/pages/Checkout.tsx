import { useLanguage } from '../contexts/LanguageContext';
import { Link, useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, ArrowLeft, CreditCard, Banknote, Smartphone, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { useState } from 'react';

const COOKIE_NAME = 'auth_token';

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  const { data: cartItems = [] } = trpc.cart.list.useQuery();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success('訂單已成功建立！');
      setLocation('/orders');
    },
    onError: (error: any) => {
      toast.error(error.message || '建立訂單失敗');
    },
  });

  const createCheckoutSessionMutation = trpc.payments.createCheckoutSession.useMutation({
    onSuccess: (data: any) => {
      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('正在跳轉到 Stripe 支付頁面...');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || '創建支付會話失敗');
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

  const totalAmount = cartItems.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0);

  const handleSubmitOrder = () => {
    if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
      toast.error('請填寫完整的收件人信息');
      return;
    }

    const items = cartItems.map(item => ({
      productId: item.productId,
      productName: item.product?.name || '',
      productPrice: item.product?.price || 0,
      quantity: item.quantity,
      subtotal: (item.product?.price || 0) * item.quantity,
    }));

    if (paymentMethod === 'stripe') {
      // Create Stripe checkout session
      createCheckoutSessionMutation.mutate({
        items,
        shippingInfo,
      });
    } else {
      // Create order for other payment methods
      createOrderMutation.mutate({
        shippingAddress: shippingInfo.address,
        contactName: shippingInfo.name,
        contactPhone: shippingInfo.phone,
        notes: shippingInfo.notes,
        items,
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">請先登入</h2>
          <p className="text-gray-600 mb-4">您需要登入才能進行結帳</p>
          <Button onClick={() => setLocation('/')}>返回首頁</Button>
        </Card>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">購物車是空的</h2>
          <p className="text-gray-600 mb-4">請先添加商品到購物車</p>
          <Button onClick={() => setLocation('/products')}>瀏覽產品</Button>
        </Card>
      </div>
    );
  }

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
                <Link href="/products">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.products')}</a>
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
        <Button
          variant="outline"
          onClick={() => setLocation('/cart')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回購物車
        </Button>

        <h1 className="text-4xl font-bold text-gray-800 mb-8">結帳</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Shipping Info & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Information */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">收件人信息</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    placeholder="請輸入收件人姓名"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">電話 *</Label>
                  <Input
                    id="phone"
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    placeholder="請輸入聯絡電話"
                  />
                </div>
                <div>
                  <Label htmlFor="address">地址 *</Label>
                  <Input
                    id="address"
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                    placeholder="請輸入收件地址"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">備註</Label>
                  <Input
                    id="notes"
                    value={shippingInfo.notes}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                    placeholder="其他備註（選填）"
                  />
                </div>
              </div>
            </Card>

            {/* Payment Method */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">付款方式</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex items-center gap-3 cursor-pointer flex-1">
                    <CreditCard className="w-5 h-5 text-[#0ABAB5]" />
                    <div>
                      <div className="font-semibold">Stripe 信用卡</div>
                      <div className="text-sm text-gray-600">Visa、Mastercard、American Express</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                  <Label htmlFor="bank_transfer" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Banknote className="w-5 h-5 text-[#0ABAB5]" />
                    <div>
                      <div className="font-semibold">銀行轉帳</div>
                      <div className="text-sm text-gray-600">轉帳後請提供帳號末五碼</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="jko_pay" id="jko_pay" />
                  <Label htmlFor="jko_pay" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Smartphone className="w-5 h-5 text-[#0ABAB5]" />
                    <div>
                      <div className="font-semibold">街口支付</div>
                      <div className="text-sm text-gray-600">使用街口 App 掃碼付款</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="cash_on_delivery" id="cash_on_delivery" />
                  <Label htmlFor="cash_on_delivery" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Smartphone className="w-5 h-5 text-[#0ABAB5]" />
                    <div>
                      <div className="font-semibold">貨到付款</div>
                      <div className="text-sm text-gray-600">收到商品時付款</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </Card>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-2xl font-bold mb-6">訂單摘要</h2>
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold">{item.product?.name}</div>
                      <div className="text-sm text-gray-600">數量: {item.quantity}</div>
                    </div>
                    <div className="font-bold text-[#DC2626]">
                      ${(item.product?.price || 0) * item.quantity}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>總計</span>
                  <span className="text-[#DC2626]">${totalAmount}</span>
                </div>
              </div>
              <Button
                onClick={handleSubmitOrder}
                disabled={createOrderMutation.isPending || createCheckoutSessionMutation.isPending}
                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white text-lg py-6 flex items-center justify-center gap-2"
              >
                {createOrderMutation.isPending || createCheckoutSessionMutation.isPending ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    處理中...
                  </>
                ) : (
                  '確認訂單'
                )}
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

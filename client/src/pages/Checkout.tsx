import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, CreditCard, Banknote, Smartphone, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/price';
import { useAuth } from '@/_core/hooks/useAuth';
import { useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  // 購物車存在瀏覽器本機（見 useCart），這裡必須讀同一份來源
  const { lines: cartItems, total: totalAmount, clear: clearCart } = useCart();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      clearCart();
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
        window.location.assign(data.url);
        toast.success('正在跳轉到 Stripe 支付頁面...');
      } else {
        toast.error('無法建立付款頁面');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || '創建支付會話失敗');
    },
  });

  const handleSubmitOrder = () => {
    if (cartItems.length === 0) {
      toast.error('購物車是空的');
      setLocation('/cart');
      return;
    }

    const normalizedShippingInfo = {
      name: shippingInfo.name.trim(),
      phone: shippingInfo.phone.trim(),
      address: shippingInfo.address.trim(),
      notes: shippingInfo.notes.trim(),
    };

    if (!normalizedShippingInfo.name || !normalizedShippingInfo.phone || !normalizedShippingInfo.address) {
      toast.error('請填寫完整的收件人信息');
      return;
    }

    const items = cartItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    if (paymentMethod === 'stripe') {
      createCheckoutSessionMutation.mutate({
        items,
        shippingInfo: normalizedShippingInfo,
      });
    } else {
      createOrderMutation.mutate({
        shippingAddress: normalizedShippingInfo.address,
        contactName: normalizedShippingInfo.name,
        contactPhone: normalizedShippingInfo.phone,
        notes: normalizedShippingInfo.notes,
        items,
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[#0ABAB5]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">請先登入</h2>
          <p className="text-gray-600 mb-6">您需要登入才能進行結帳，購物車內容會保留。</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setLocation('/login')}>前往登入</Button>
            <Button variant="outline" onClick={() => setLocation('/cart')}>
              回購物車
            </Button>
          </div>
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
      <SiteHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <Button
          variant="outline"
          onClick={() => setLocation('/cart')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回購物車
        </Button>

        <h1 className="mb-8 text-3xl font-bold text-gray-800 sm:text-4xl">結帳</h1>

        <form
          className="grid grid-cols-1 gap-8 lg:grid-cols-3"
          onSubmit={event => {
            event.preventDefault();
            handleSubmitOrder();
          }}
        >
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
                    autoComplete="name"
                    required
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    placeholder="請輸入收件人姓名"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">電話 *</Label>
                  <Input
                    id="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    placeholder="請輸入聯絡電話"
                  />
                </div>
                <div>
                  <Label htmlFor="address">地址 *</Label>
                  <Input
                    id="address"
                    autoComplete="street-address"
                    required
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
                  <div key={item.productId} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-gray-600">數量: {item.quantity}</div>
                    </div>
                    <div className="font-bold text-[#DC2626]">
                      {formatPrice(item.price * item.quantity, language)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 mb-6">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>總計</span>
                  <span className="text-[#DC2626]">{formatPrice(totalAmount, language)}</span>
                </div>
              </div>
              {paymentMethod === 'stripe' && (
                <p className="mb-4 text-sm text-gray-600">
                  {(language === 'zh' || language === 'cn')
                    ? '信用卡將以日圓請款；發卡行將依其匯率換算。'
                    : language === 'ja'
                      ? 'クレジットカードは日本円で請求され、カード会社のレートで換算されます。'
                      : 'Your card will be charged in JPY and converted at your card issuer’s rate.'}
                </p>
              )}
              <Button
                type="submit"
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
          </form>
      </main>
    </div>
  );
}

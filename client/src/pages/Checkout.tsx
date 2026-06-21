import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { useAuth } from '../_core/hooks/useAuth';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Truck, ShieldCheck, ChevronLeft } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

function formatPrice(price: number, language: 'zh' | 'en' | 'ja'): string {
  if (language === 'zh') return `NT$ ${Math.round(price).toLocaleString()}`;
  if (language === 'ja') return `¥ ${Math.round(price * 4.5).toLocaleString()}`;
  return `$ ${(price * 0.031).toFixed(2)}`;
}

const STEPS = ['購物車', '配送資訊', '付款方式', '確認下單'] as const;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 配送 2 付款 3 確認

  const { data: cartItems = [] } = trpc.cart.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [shipping, setShipping] = useState({
    name: user?.name || '',
    phone: '',
    email: user?.email || '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  });

  const [payment, setPayment] = useState<'credit' | 'linepay' | 'cvs'>('credit');

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (order: any) => {
      toast.success('訂單已建立');
      setLocation(`/order-confirmation?orderId=${order.orderId}`);
    },
    onError: (e: any) => toast.error(e.message || '下單失敗'),
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FEF9F3]">
        <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="text-7xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-3">請先登入再結帳</h1>
          <button onClick={() => setLocation('/login')}
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold">
            前往登入
          </button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + (item.price ?? item.product?.price ?? 0) * item.quantity, 0);
  const shippingFee = subtotal >= 3000 ? 0 : 250;
  const total = subtotal + shippingFee;

  const placeOrder = () => {
    if (!shipping.name || !shipping.phone || !shipping.address) {
      toast.error('請填完配送資訊');
      setStep(1);
      return;
    }
    createOrderMutation.mutate({
      shippingAddress: `${shipping.postalCode} ${shipping.city} ${shipping.address}`,
      contactName: shipping.name,
      contactPhone: shipping.phone,
      contactEmail: shipping.email,
      items: cartItems.map((it: any) => ({ productId: it.productId, productName: it.product.name, productPrice: Number(it.product.price), quantity: it.quantity, subtotal: Number(it.product.price) * it.quantity })),
      paymentMethod: payment,
      notes: shipping.notes,
    } as any);
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={() => {}} />

      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <button onClick={() => setLocation('/cart')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-[#0ABAB5] mb-3">
            <ChevronLeft className="w-4 h-4" /> 返回購物車
          </button>
          <h1 className="text-2xl md:text-3xl font-bold mb-4">結帳</h1>

          {/* 進度條 */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {STEPS.map((label, idx) => {
              const idxNum = idx as 0 | 1 | 2 | 3;
              const active = idxNum === step;
              const done = idxNum < step;
              return (
                <div key={label} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    done ? 'bg-[#16A34A] text-white' : active ? 'bg-[#0ABAB5] text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{done ? '✓' : idx}</div>
                  <span className={`text-sm font-medium ${active ? 'text-[#0ABAB5]' : done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                  {idx < STEPS.length - 1 && <div className="w-6 h-px bg-gray-300" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-5">
            {/* Step 1：配送資訊 */}
            <section className={`bg-white rounded-2xl p-6 ${step === 1 ? '' : 'opacity-50'}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#0ABAB5]" /> 1. 配送資訊
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="收件人姓名" required value={shipping.name} onChange={v => setShipping({ ...shipping, name: v })} />
                <Field label="電話" required value={shipping.phone} onChange={v => setShipping({ ...shipping, phone: v })} />
                <Field label="Email" value={shipping.email} onChange={v => setShipping({ ...shipping, email: v })} />
                <Field label="郵遞區號" value={shipping.postalCode} onChange={v => setShipping({ ...shipping, postalCode: v })} />
                <Field label="縣市" value={shipping.city} onChange={v => setShipping({ ...shipping, city: v })} />
                <Field label="詳細地址" required full value={shipping.address} onChange={v => setShipping({ ...shipping, address: v })} />
              </div>
              <label className="block text-sm font-bold mb-1.5 mt-3">備註（選填）</label>
              <textarea value={shipping.notes} onChange={e => setShipping({ ...shipping, notes: e.target.value })}
                rows={2} placeholder="特殊配送需求、上樓服務⋯"
                className="w-full px-4 py-2.5 border-[1.5px] border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0ABAB5]" />
              {step === 1 && (
                <button onClick={() => {
                  if (!shipping.name || !shipping.phone || !shipping.address) { toast.error('請填完必要欄位'); return; }
                  setStep(2);
                }} className="mt-4 bg-[#0ABAB5] hover:bg-[#089B96] text-white px-6 py-3 rounded-xl font-bold">
                  下一步：選擇付款方式 →
                </button>
              )}
            </section>

            {/* Step 2：付款方式 */}
            <section className={`bg-white rounded-2xl p-6 ${step === 2 ? '' : step > 2 ? '' : 'opacity-50 pointer-events-none'}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#0ABAB5]" /> 2. 付款方式
              </h2>
              <div className="space-y-2">
                <PayOption value="credit" current={payment} setCurrent={setPayment} icon="💳" title="信用卡 / 金融卡" desc="VISA、Master、JCB、AMEX，安全結帳由 Stripe 處理" />
                <PayOption value="linepay" current={payment} setCurrent={setPayment} icon="💚" title="LINE Pay" desc="台灣最熱門的行動支付" />
                <PayOption value="cvs" current={payment} setCurrent={setPayment} icon="🏪" title="超商代碼繳費" desc="7-11、全家、萊爾富、OK 皆可，3 天內繳費" />
              </div>
              {step === 2 && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-100">
                    上一步
                  </button>
                  <button onClick={() => setStep(3)}
                    className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white px-6 py-3 rounded-xl font-bold">
                    下一步：確認下單 →
                  </button>
                </div>
              )}
            </section>

            {/* Step 3：確認下單 */}
            <section className={`bg-white rounded-2xl p-6 ${step === 3 ? '' : 'opacity-50 pointer-events-none'}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0ABAB5]" /> 3. 確認資訊與下單
              </h2>
              <div className="space-y-3 text-sm">
                <Row label="收件人">{shipping.name} ・ {shipping.phone}</Row>
                <Row label="配送地址">{shipping.postalCode} {shipping.city} {shipping.address}</Row>
                <Row label="付款方式">{payment === 'credit' ? '信用卡 / 金融卡' : payment === 'linepay' ? 'LINE Pay' : '超商代碼繳費'}</Row>
                {shipping.notes && <Row label="備註">{shipping.notes}</Row>}
              </div>
              {step === 3 && (
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-100">
                    上一步
                  </button>
                  <button onClick={placeOrder} disabled={createOrderMutation.isPending}
                    className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white px-6 py-4 rounded-xl font-bold">
                    {createOrderMutation.isPending ? '處理中…' : `確認下單 ${formatPrice(total, language)}`}
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center mt-3">
                點擊「確認下單」即表示同意我們的服務條款與隱私權政策
              </p>
            </section>
          </div>

          {/* Order summary */}
          <aside className="bg-white rounded-2xl p-6 h-fit lg:sticky lg:top-24 shadow-sm">
            <h3 className="font-bold text-lg mb-4">訂單摘要</h3>
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-200 max-h-72 overflow-y-auto">
              {cartItems.map((item: any) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <div className="text-2xl flex items-center justify-center h-full">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium line-clamp-2 leading-snug">{item.name || item.product?.name}</div>
                    <div className="text-gray-400 text-xs">x {item.quantity}</div>
                  </div>
                  <div className="text-sm font-bold whitespace-nowrap">
                    {formatPrice((item.price ?? item.product?.price ?? 0) * item.quantity, language)}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm mb-4 pb-4 border-b border-gray-200">
              <div className="flex justify-between"><span className="text-gray-600">商品小計</span><span>{formatPrice(subtotal, language)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">運費</span><span>{shippingFee === 0 ? '免運' : formatPrice(shippingFee, language)}</span></div>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-bold">總計</span>
              <span className="text-[#DC2626] font-black text-2xl">{formatPrice(total, language)}</span>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function Field({ label, value, onChange, required, full, type = 'text' }: any) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-bold mb-1.5">
        {label} {required && <span className="text-[#DC2626]">*</span>}
      </label>
      <input type={type} required={required} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border-[1.5px] border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0ABAB5]" />
    </div>
  );
}

function PayOption({ value, current, setCurrent, icon, title, desc }: any) {
  return (
    <label className={`block border-2 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
      current === value ? 'border-[#0ABAB5] bg-[#E0F7F6]/50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <input type="radio" name="payment" value={value} checked={current === value} onChange={() => setCurrent(value)} className="sr-only" />
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">{title}</div>
          <div className="text-xs text-gray-500">{desc}</div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 ${current === value ? 'border-[#0ABAB5]' : 'border-gray-300'} flex items-center justify-center`}>
          {current === value && <div className="w-2.5 h-2.5 rounded-full bg-[#0ABAB5]" />}
        </div>
      </div>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex">
      <span className="w-24 text-gray-400 flex-shrink-0">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

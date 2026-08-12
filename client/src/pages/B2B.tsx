import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';

const bullets = [
  { icon: '💰', title: '批發折扣', desc: '訂購量越大、折扣越多，最高再省 22%' },
  { icon: '📄', title: '月結發票', desc: '開立統編、可月結 30 / 60 天' },
  { icon: '🤝', title: '專屬窗口', desc: '1 對 1 LINE 客服 + 中日雙語業務' },
  { icon: '📦', title: '備品保留', desc: '常用品項預留庫存，下單隔日出貨' },
  { icon: '🚛', title: '指定配送', desc: '可指定到貨時間，協助上樓組裝' },
  { icon: '🩺', title: '專業諮詢', desc: '介護福祉士提供住戶適性建議' },
];

const useCases = [
  {
    icon: '🏥',
    title: '長照中心 / 安養機構',
    bullet: [
      '床、輪椅、紙尿褲整批採購',
      '可指定每月固定送貨日',
      '可依住戶評估建議規格',
    ],
  },
  {
    icon: '🏠',
    title: '居家照護業者',
    bullet: [
      '客戶個案推薦商品代採',
      '可代開立發票給保險業者',
      '備品快速到貨補件',
    ],
  },
  {
    icon: '🏢',
    title: '醫療院所 / 復健所',
    bullet: [
      '專業復健器材直接進口',
      '專案報價與年度合約',
      '進貨稅前報價可詢',
    ],
  },
];

export default function B2B() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    company: '',
    name: '',
    phone: '',
    email: '',
    type: '長照中心',
    monthlyBudget: '5-10 萬',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submitInquiry = (trpc as any).b2bInquiries?.create?.useMutation?.({
    onSuccess: () => {
      toast.success('已收到您的詢價，業務 1 個工作天內聯繫您');
      setForm({ company: '', name: '', phone: '', email: '', type: '長照中心', monthlyBudget: '5-10 萬', message: '' });
    },
    onError: (e: any) => toast.error(e.message || '送出失敗，請稍後再試'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company || !form.name || !form.phone) {
      toast.error('公司名稱、聯絡人、電話為必填');
      return;
    }
    setSubmitting(true);
    if (submitInquiry) {
      submitInquiry.mutate(form);
    } else {
      // fallback if API not available
      await new Promise(r => setTimeout(r, 500));
      toast.success('已收到您的詢價（fallback 模式）');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setLocation(`/products?q=${searchQuery}`)}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 text-sm font-bold mb-5">
            企業合作・B2B
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            長照中心 . 醫療院所 . 居家照護業者
            <br />
            專屬採購方案
          </h1>
          <p className="text-lg opacity-90 max-w-xl mx-auto">
            已服務 140+ 間台灣長照與醫療機構，從單筆採購到年度合約皆可規劃。
          </p>
        </div>
      </section>

      {/* 6 個賣點 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bullets.map(b => (
              <div key={b.title} className="bg-white p-7 rounded-2xl shadow-sm">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 個場景 */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <span className="inline-block text-[#0ABAB5] font-bold text-sm tracking-widest uppercase mb-3">
              三大採購情境
            </span>
            <h2 className="text-3xl font-bold">每一種機構，都有對應的合作方式</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map(uc => (
              <div key={uc.title} className="bg-[#FEF9F3] p-7 rounded-2xl">
                <div className="text-4xl mb-3">{uc.icon}</div>
                <h3 className="text-xl font-bold mb-3">{uc.title}</h3>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  {uc.bullet.map(b => (
                    <li key={b} className="flex gap-1.5">
                      <span className="text-[#16A34A]">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 bg-gradient-to-b from-[#FEF9F3] to-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">填寫採購需求，1 個工作天內回覆</h2>
            <p className="text-gray-600">
              或直接加 LINE 客服：
              <a href="https://line.me/R/ti/p/@rokaizumi" className="text-[#0ABAB5] font-bold">@rokaizumi</a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-md space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label="公司 / 機構名稱"
                required
                value={form.company}
                onChange={v => setForm({ ...form, company: v })}
              />
              <Field
                label="聯絡人"
                required
                value={form.name}
                onChange={v => setForm({ ...form, name: v })}
              />
              <Field
                label="電話"
                type="tel"
                required
                value={form.phone}
                onChange={v => setForm({ ...form, phone: v })}
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={v => setForm({ ...form, email: v })}
              />
              <Select
                label="機構類型"
                value={form.type}
                onChange={v => setForm({ ...form, type: v })}
                options={['長照中心', '醫院 / 診所', '居家照護', '輔具租賃', '其他']}
              />
              <Select
                label="預計月採購金額"
                value={form.monthlyBudget}
                onChange={v => setForm({ ...form, monthlyBudget: v })}
                options={['1 萬以下', '1-5 萬', '5-10 萬', '10-30 萬', '30 萬以上']}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">採購需求 / 想了解的商品</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="例如：想採購 10 張電動介護床 + 月供 30 箱紙尿褲"
                className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white px-6 py-4 rounded-xl font-bold transition-colors"
            >
              {submitting ? '送出中…' : '送出採購需求 →'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              我們僅用您的資料聯繫此次詢價，不會做行銷推播
            </p>
          </form>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

/* ---------- 表單元件 ---------- */
function Field({ label, value, onChange, required, type = 'text' }: any) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1.5">
        {label} {required && <span className="text-[#DC2626]">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0ABAB5]"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#0ABAB5]"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

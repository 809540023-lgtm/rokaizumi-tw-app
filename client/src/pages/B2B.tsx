import { useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { LINE_ADD_FRIEND_URL, LINE_OFFICIAL_ACCOUNT_ID } from '@/lib/line';
import { useLanguage } from '@/contexts/LanguageContext';

const BULLETS = [
  { icon: '💰', key: 'b1' },
  { icon: '📄', key: 'b2' },
  { icon: '🤝', key: 'b3' },
  { icon: '📦', key: 'b4' },
  { icon: '🚛', key: 'b5' },
  { icon: '🩺', key: 'b6' },
];

const USE_CASES = [
  { icon: '🏥', key: 'uc1' },
  { icon: '🏠', key: 'uc2' },
  { icon: '🏢', key: 'uc3' },
];

// 送出的值維持中文（沿用資料庫既有格式），只有畫面文字跟著語系切換
const TYPE_VALUES = ['長照中心', '醫院 / 診所', '居家照護', '輔具租賃', '其他'];
const BUDGET_VALUES = ['1 萬以下', '1-5 萬', '5-10 萬', '10-30 萬', '30 萬以上'];

export default function B2B() {
  const { t } = useLanguage();
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
  const submissionInFlight = useRef(false);

  const submitInquiry = trpc.b2bInquiries.create.useMutation({
    onSuccess: () => {
      toast.success(t('b2b.form.success'));
      setForm({ company: '', name: '', phone: '', email: '', type: '長照中心', monthlyBudget: '5-10 萬', message: '' });
    },
    onError: (e) => toast.error(e.message || t('b2b.form.error')),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlight.current) return;
    if (!form.company.trim() || !form.name.trim() || !form.phone.trim()) {
      toast.error(t('b2b.form.required'));
      return;
    }
    submissionInFlight.current = true;
    setSubmitting(true);
    try {
      await submitInquiry.mutateAsync({
        ...form,
        company: form.company.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
    } catch {
      // onError displays the failure; retain the form for retry.
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setLocation(`/products?q=${encodeURIComponent(searchQuery.trim())}`)}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 text-sm font-bold mb-5">
            {t('b2b.eye')}
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            {t('b2b.title.1')}
            <br />
            {t('b2b.title.2')}
          </h1>
          <p className="text-lg opacity-90 max-w-xl mx-auto">{t('b2b.hero.sub')}</p>
        </div>
      </section>

      {/* 6 個賣點 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BULLETS.map(b => (
              <div key={b.key} className="bg-white p-7 rounded-2xl shadow-sm">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="text-lg font-bold mb-2">{t(`b2b.${b.key}.title`)}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{t(`b2b.${b.key}.desc`)}</p>
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
              {t('b2b.uc.eye')}
            </span>
            <h2 className="text-3xl font-bold">{t('b2b.uc.title')}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {USE_CASES.map(uc => (
              <div key={uc.key} className="bg-[#FEF9F3] p-7 rounded-2xl">
                <div className="text-4xl mb-3">{uc.icon}</div>
                <h3 className="text-xl font-bold mb-3">{t(`b2b.${uc.key}.title`)}</h3>
                <ul className="space-y-1.5 text-sm text-gray-600">
                  {['1', '2', '3'].map(n => (
                    <li key={n} className="flex gap-1.5">
                      <span className="text-[#16A34A]">✓</span>
                      {t(`b2b.${uc.key}.${n}`)}
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
            <h2 className="text-3xl font-bold mb-2">{t('b2b.form.title')}</h2>
            <p className="text-gray-600">
              {t('b2b.form.sub')}
              <a
                href={LINE_ADD_FRIEND_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0ABAB5] font-bold"
              >
                {LINE_OFFICIAL_ACCOUNT_ID}
              </a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-md space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label={t('b2b.form.company')}
                required
                value={form.company}
                onChange={v => setForm({ ...form, company: v })}
              />
              <Field
                label={t('b2b.form.name')}
                required
                value={form.name}
                onChange={v => setForm({ ...form, name: v })}
              />
              <Field
                label={t('b2b.form.phone')}
                type="tel"
                required
                value={form.phone}
                onChange={v => setForm({ ...form, phone: v })}
              />
              <Field
                label={t('b2b.form.email')}
                type="email"
                value={form.email}
                onChange={v => setForm({ ...form, email: v })}
              />
              <Select
                label={t('b2b.form.type')}
                value={form.type}
                onChange={v => setForm({ ...form, type: v })}
                options={TYPE_VALUES.map((v, i) => ({ value: v, label: t(`b2b.type.${i + 1}`) }))}
              />
              <Select
                label={t('b2b.form.budget')}
                value={form.monthlyBudget}
                onChange={v => setForm({ ...form, monthlyBudget: v })}
                options={BUDGET_VALUES.map((v, i) => ({ value: v, label: t(`b2b.budget.${i + 1}`) }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-1.5">{t('b2b.form.message')}</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder={t('b2b.form.messagePlaceholder')}
                className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white px-6 py-4 rounded-xl font-bold transition-colors"
            >
              {submitting ? t('b2b.form.submitting') : t('b2b.form.submit')}
            </button>
            <p className="text-xs text-gray-400 text-center">{t('b2b.form.privacy')}</p>
          </form>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

/* ---------- 表單元件 ---------- */
interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
}

function Field({ label, value, onChange, required, type = 'text' }: FieldProps) {
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

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#0ABAB5]"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

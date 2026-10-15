import { Link } from 'wouter';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';

const DIFF_ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] as const;
const VALUE_KEYS = ['v1', 'v2', 'v3', 'v4'] as const;
const STAT_KEYS = ['1', '2', '3', '4'] as const;

export default function About() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();
  const handleSearch = () => {
    if (searchQuery.trim()) setLocation(`/products?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={handleSearch} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E0F7F6] via-[#FFF5F0] to-[#FFE0E8] py-20 text-center">
        <div className="container mx-auto px-4">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#0ABAB5]/12 text-[#089B96] text-sm font-bold mb-5">
            {t('about.eye')}
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 max-w-3xl mx-auto">
            {t('about.title').split('<br>').map((part, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {part}
              </span>
            ))}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t('about.lead')}</p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-4">{t('about.story.title')}</h2>
          <p className="mb-4">{t('about.story.1')}</p>
          <p className="my-6 px-6 py-5 bg-white border-l-4 border-[#0ABAB5] rounded-r-xl text-xl font-bold">
            {t('about.story.quote')}
          </p>
          <p className="mb-4">{t('about.story.2')}</p>
          <p>{t('about.story.3')}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white py-16">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STAT_KEYS.map(n => (
            <div key={n}>
              <div className="text-4xl md:text-5xl font-black mb-1">{t(`about.stat.${n}.num`)}</div>
              <div className="text-sm opacity-90">{t(`about.stat.${n}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-4">{t('about.mission.title')}</h2>
          <p>{t('about.mission.1')}</p>
          <p>{t('about.mission.2')}</p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-2">{t('about.values.title')}</h2>
          <p className="text-gray-600 mb-8">{t('about.values.sub')}</p>
          <div className="grid md:grid-cols-2 gap-6">
            {VALUE_KEYS.map(v => (
              <div key={v} className="bg-[#FEF9F3] p-7 rounded-2xl border-l-4 border-[#0ABAB5]">
                <h3 className="text-xl font-bold mb-2">{t(`about.${v}.title`)}</h3>
                <p className="text-gray-600">{t(`about.${v}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Difference */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-6">{t('about.diff.title')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
              <thead>
                <tr className="bg-[#FEF9F3]">
                  <th className="p-4 text-left font-bold">{t('about.diff.col1')}</th>
                  <th className="p-4 text-left font-bold">{t('about.diff.col2')}</th>
                  <th className="p-4 text-left font-bold">{t('about.diff.col3')}</th>
                </tr>
              </thead>
              <tbody>
                {DIFF_ROW_KEYS.map(r => (
                  <tr key={r} className="border-t border-gray-200">
                    <td className="p-4 font-medium">{t(`about.diff.${r}.label`)}</td>
                    <td className="p-4 text-gray-400">{t(`about.diff.${r}.bad`)}</td>
                    <td className="p-4 text-[#089B96] font-bold">{t(`about.diff.${r}.good`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-3">{t('about.cta.title')}</h2>
          <p className="opacity-90 max-w-xl mx-auto mb-6">{t('about.cta.sub')}</p>
          <Link href="/products" className="inline-block bg-white text-[#089B96] hover:bg-[#FEF9F3] px-10 py-4 rounded-xl font-bold transition-colors">
              {t('about.cta.btn')}
            </Link>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

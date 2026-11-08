import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { LINE_ADD_FRIEND_URL } from '@/lib/line';
import { useLanguage } from '@/contexts/LanguageContext';

// 標題／摘要等文字放在 LanguageContext 的 guides.gN.* 底下，這裡只留不會變的資料
export const guides = [
  { slug: 'japanese-wheelchair-2026', key: 'g1', cover: '🦽', date: '2026-05-12' },
  { slug: 'electric-care-bed-choose', key: 'g2', cover: '🛏️', date: '2026-05-05' },
  { slug: 'bathroom-safety-checklist', key: 'g3', cover: '🚿', date: '2026-04-28' },
  { slug: 'adult-diaper-guide', key: 'g4', cover: '📦', date: '2026-04-15' },
  { slug: 'ayumi-care-shoes', key: 'g5', cover: '👟', date: '2026-04-08' },
  { slug: 'totalcare-mobility', key: 'g6', cover: '🚶', date: '2026-04-01' },
];

export default function Guides() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setLocation(`/products?q=${encodeURIComponent(searchQuery.trim())}`)}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E0F7F6] via-[#FFF5F0] to-[#FFE0E8] py-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#0ABAB5]/12 text-[#089B96] text-sm font-bold mb-4">
            {t('video.title')}
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            {t('guides.title')}
          </h1>
          <p className="text-lg text-gray-600">{t('guides.sub')}</p>
        </div>
      </section>

      {/* Guides grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map(g => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group bg-white rounded-2xl shadow-sm hover:shadow-[0_8px_24px_rgba(10,186,181,0.14)] hover:-translate-y-1 transition-all overflow-hidden">
                  <div className="aspect-[16/10] bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-7xl">
                    {g.cover}
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-bold text-[#089B96] tracking-wider uppercase">
                      {t(`guides.${g.key}.cat`)}
                    </span>
                    <h3 className="text-lg font-bold mt-2 mb-2 leading-snug group-hover:text-[#0ABAB5]">
                      {t(`guides.${g.key}.title`)}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{t(`guides.${g.key}.excerpt`)}</p>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>{g.date}</span>
                      <span>{t(`guides.${g.key}.readTime`)}{t('guides.readTime')}</span>
                    </div>
                  </div>
                </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl font-bold mb-3">{t('guides.cta.title')}</h2>
          <p className="text-gray-600 mb-6">{t('guides.cta.sub')}</p>
          <a
            href={LINE_ADD_FRIEND_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#0ABAB5] hover:bg-[#089B96] text-white px-10 py-4 rounded-xl font-bold transition-colors"
          >
            {t('guides.cta.btn')}
          </a>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

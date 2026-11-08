import { Link, useRoute, useLocation } from 'wouter';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { LINE_ADD_FRIEND_URL } from '@/lib/line';
import { guides } from './Guides';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GuideDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute('/guides/:slug');
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const guide = guides.find(g => g.slug === params?.slug);

  if (!guide) {
    return (
      <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
        <SiteHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => setLocation(`/products?q=${encodeURIComponent(searchQuery.trim())}`)}
        />
        <div className="flex-1 container mx-auto px-4 py-24 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h1 className="text-2xl font-bold mb-3">{t('guideDetail.notFound.title')}</h1>
          <p className="text-gray-600 mb-8">{t('guideDetail.notFound.desc')}</p>
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#089B96] text-white px-8 py-3 rounded-xl font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('guideDetail.back')}
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const others = guides.filter(g => g.slug !== guide.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setLocation(`/products?q=${encodeURIComponent(searchQuery.trim())}`)}
      />

      <article className="container mx-auto px-4 py-10 max-w-3xl">
        {/* 返回 */}
        <Link
          href="/guides"
          className="inline-flex items-center gap-2 text-[#089B96] hover:text-[#0ABAB5] font-bold mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> {t('guideDetail.back')}
        </Link>

        <header className="mb-8">
          <div className="aspect-[16/7] rounded-2xl bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-8xl mb-6">
            {guide.cover}
          </div>
          <span className="text-xs font-bold text-[#089B96] tracking-wider uppercase">
            {t(`guides.${guide.key}.cat`)}
          </span>
          <h1 className="text-3xl md:text-4xl font-black mt-2 mb-4 leading-tight">{t(`guides.${guide.key}.title`)}</h1>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>{guide.date}</span>
            <span>{t(`guides.${guide.key}.readTime`)}{t('guides.readTime')}</span>
          </div>
        </header>

        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-5">
          <p className="text-lg font-medium text-gray-800">{t(`guides.${guide.key}.excerpt`)}</p>
          <p>{t('guideDetail.body')}</p>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-white rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold mb-3">{t('guides.cta.title')}</h2>
          <p className="text-gray-600 mb-6">{t('guideDetail.cta.sub')}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#0ABAB5] hover:bg-[#089B96] text-white px-8 py-3.5 rounded-xl font-bold transition-colors"
            >
              {t('guides.cta.btn')}
            </a>
            <Link
              href="/products"
              className="inline-block border-2 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors"
            >
              {t('guideDetail.browse')}
            </Link>
          </div>
        </div>

        {/* 其他指南 */}
        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-5">{t('guideDetail.others')}</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {others.map(g => (
                <Link
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-5xl">
                    {g.cover}
                  </div>
                  <div className="p-4">
                    <span className="text-[11px] font-bold text-[#089B96]">{t(`guides.${g.key}.cat`)}</span>
                    <h3 className="text-sm font-bold mt-1 leading-snug group-hover:text-[#0ABAB5] line-clamp-2">
                      {t(`guides.${g.key}.title`)}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

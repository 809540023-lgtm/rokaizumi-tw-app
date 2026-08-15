import { Link, useRoute, useLocation } from 'wouter';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { guides } from './Guides';

export default function GuideDetail() {
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
          onSearchSubmit={() => setLocation(`/products?q=${searchQuery}`)}
        />
        <div className="flex-1 container mx-auto px-4 py-24 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h1 className="text-2xl font-bold mb-3">找不到這篇指南</h1>
          <p className="text-gray-600 mb-8">文章可能已移除或網址有誤。</p>
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#089B96] text-white px-8 py-3 rounded-xl font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 回選品指南
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
        onSearchSubmit={() => setLocation(`/products?q=${searchQuery}`)}
      />

      <article className="container mx-auto px-4 py-10 max-w-3xl">
        {/* 返回 */}
        <Link
          href="/guides"
          className="inline-flex items-center gap-2 text-[#089B96] hover:text-[#0ABAB5] font-bold mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> 回選品指南
        </Link>

        <header className="mb-8">
          <div className="aspect-[16/7] rounded-2xl bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-8xl mb-6">
            {guide.cover}
          </div>
          <span className="text-xs font-bold text-[#089B96] tracking-wider uppercase">
            {guide.cat}
          </span>
          <h1 className="text-3xl md:text-4xl font-black mt-2 mb-4 leading-tight">{guide.title}</h1>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>{guide.date}</span>
            <span>{guide.readTime}閱讀</span>
          </div>
        </header>

        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-5">
          <p className="text-lg font-medium text-gray-800">{guide.excerpt}</p>
          <p>
            這份指南由日本介護福祉士撰寫，針對台灣家庭的居家環境與使用習慣整理。
            完整內容正在編輯中，若您現在就需要建議，歡迎直接透過 LINE 與我們聯繫，
            由專人依長輩的身體狀況與居家空間為您推薦。
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-white rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold mb-3">不確定該買哪一款？</h2>
          <p className="text-gray-600 mb-6">
            加 LINE 客服，由介護福祉士 1 對 1 推薦最適合的款式。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="https://line.me/R/ti/p/@rokaizumi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#0ABAB5] hover:bg-[#089B96] text-white px-8 py-3.5 rounded-xl font-bold transition-colors"
            >
              💬 加 LINE 諮詢
            </a>
            <Link
              href="/products"
              className="inline-block border-2 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors"
            >
              瀏覽商品 →
            </Link>
          </div>
        </div>

        {/* 其他指南 */}
        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-5">其他選品指南</h2>
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
                    <span className="text-[11px] font-bold text-[#089B96]">{g.cat}</span>
                    <h3 className="text-sm font-bold mt-1 leading-snug group-hover:text-[#0ABAB5] line-clamp-2">
                      {g.title}
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

import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';

const guides = [
  {
    slug: 'japanese-wheelchair-2026',
    cat: '輪椅',
    title: '2026 日本介護輪椅完全選購指南',
    excerpt: '10 大熱銷品牌、4 個選購重點，從重量到輪徑一次搞懂。台灣家屬必看。',
    cover: '🦽',
    readTime: '8 分鐘',
    date: '2026-05-12',
  },
  {
    slug: 'electric-care-bed-choose',
    cat: '介護床',
    title: '電動介護床怎麼挑？3 馬達 vs 2 馬達差別',
    excerpt: '從起背、起腳、升降三種馬達，到防褥瘡床墊配對。長期臥床家屬指南。',
    cover: '🛏️',
    readTime: '6 分鐘',
    date: '2026-05-05',
  },
  {
    slug: 'bathroom-safety-checklist',
    cat: '入浴',
    title: '浴室防滑全方位佈置：5 件必備輔具',
    excerpt: '90% 的長輩跌倒發生在浴室。從淋浴椅、扶手到防滑墊，一次到位。',
    cover: '🚿',
    readTime: '5 分鐘',
    date: '2026-04-28',
  },
  {
    slug: 'adult-diaper-guide',
    cat: '紙尿褲',
    title: '成人紙尿褲怎麼算最划算？吸收量、尺寸一次看',
    excerpt: '夜用 vs 日用、ライフリー vs アクティ、整箱買為什麼省 30%。',
    cover: '📦',
    readTime: '5 分鐘',
    date: '2026-04-15',
  },
  {
    slug: 'ayumi-care-shoes',
    cat: '介護鞋',
    title: '徳武産業あゆみ介護鞋怎麼挑？外反母趾與糖尿病足版本',
    excerpt: '從 3E、5E、7E 鞋寬，到單足販售、室內外兩用，每一型號適合誰一目了然。',
    cover: '👟',
    readTime: '7 分鐘',
    date: '2026-04-08',
  },
  {
    slug: 'totalcare-mobility',
    cat: '移動輔具',
    title: '從手杖到電動輪椅：長輩行動能力 5 階段對照',
    excerpt: '怎麼判斷該升級到下一階段？專業介護福祉士幫您做完整評估表。',
    cover: '🚶',
    readTime: '9 分鐘',
    date: '2026-04-01',
  },
];

export default function Guides() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#FEF9F3]">
      <SiteHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setLocation(`/products?q=${searchQuery}`)}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E0F7F6] via-[#FFF5F0] to-[#FFE0E8] py-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#0ABAB5]/12 text-[#089B96] text-sm font-bold mb-4">
            選品指南・採購直擊
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
            買對工具，照護就輕一半。
          </h1>
          <p className="text-lg text-gray-600">
            由日本介護福祉士撰寫，每篇都針對台灣家庭的真實情境。
          </p>
        </div>
      </section>

      {/* Guides grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map(g => (
              <Link key={g.slug} href={`/guides/${g.slug}`}>
                <a className="group bg-white rounded-2xl shadow-sm hover:shadow-[0_8px_24px_rgba(10,186,181,0.14)] hover:-translate-y-1 transition-all overflow-hidden">
                  <div className="aspect-[16/10] bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-7xl">
                    {g.cover}
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-bold text-[#089B96] tracking-wider uppercase">
                      {g.cat}
                    </span>
                    <h3 className="text-lg font-bold mt-2 mb-2 leading-snug group-hover:text-[#0ABAB5]">
                      {g.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{g.excerpt}</p>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>{g.date}</span>
                      <span>{g.readTime}閱讀</span>
                    </div>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl font-bold mb-3">不確定該買哪一款？</h2>
          <p className="text-gray-600 mb-6">
            加 LINE 客服，由介護福祉士為您家中長輩 1 對 1 推薦最適合的款式。
          </p>
          <a
            href="https://line.me/R/ti/p/@rokaizumi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#0ABAB5] hover:bg-[#089B96] text-white px-10 py-4 rounded-xl font-bold transition-colors"
          >
            💬 加 LINE 諮詢
          </a>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

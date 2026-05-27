import { Link } from 'wouter';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { MobileStickyCTA } from '@/components/MobileStickyCTA';
import { useState } from 'react';
import { useLocation } from 'wouter';

const diffRows = [
  ['商品來源', '二、三手', '日本廠商直供'],
  ['到貨速度', '2-4 週', '7 個工作天'],
  ['售後保固', '無 / 30 天', '3 年原廠保固'],
  ['退換貨', '不接受', '7 日鑑賞期'],
  ['客服語言', '多為中文小編', '中日雙語介護士'],
  ['報關稅金', '客戶自付', '免關稅／已內含'],
  ['發票 / B2B', '多無發票', '開立統編、可月結'],
];

const values = [
  { title: '① 正品', desc: '100% 與日本廠商直接訂貨，杜絕水貨、組裝品、改標品。' },
  { title: '② 專業', desc: '客服皆受過日本介護福祉士基礎訓練，能聊規格、能聊使用情境。' },
  { title: '③ 負責', desc: '物流出問題、商品有狀況、家屬不會用，我們先處理、不推託。' },
  { title: '④ 溫度', desc: '我們先是家人、再是賣家。每一張訂單都被當作自己家的訂單。' },
];

export default function About() {
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
            關於我們 ・ Our Story
          </span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 max-w-3xl mx-auto">
            把日本介護用品，
            <br />
            最快、最安心送到台灣家庭手上。
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            創立於大阪 ・ 服務台灣已 8 年 ・ 累積 8,200+ 戶家庭、140+ 間機構信任。
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-4">一個女兒的眼淚，讓我們開始這件事</h2>
          <p className="mb-4">2018 年，創辦人小泉先生在大阪家中照顧 92 歲的祖母時，發現一個無聲的現實：</p>
          <p className="my-6 px-6 py-5 bg-white border-l-4 border-[#0ABAB5] rounded-r-xl text-xl font-bold">
            日本有全世界最先進的介護用品，卻很少人知道台灣家庭也能用得到。
          </p>
          <p className="mb-4">
            當時他用日文幫一位台灣朋友的母親代購一張電動介護床，朋友收到後傳了張照片：母親第一次能自己坐起來吃飯，眼眶含著淚。
          </p>
          <p>
            那一刻，他決定離開原本的貿易公司，與大阪在地物流商共同創立 <strong>ろかいずみ合同会社（Rokaizumi LLC）</strong>，專注做一件事：把日本介護用品，最快、最安心送到台灣家庭手上。
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white py-16">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            ['8,200+', '台灣家庭使用過'],
            ['140+', '合作長照與醫療機構'],
            ['220', '嚴選商品品項'],
            ['8 年', '大阪在地經營'],
          ].map(([num, label]) => (
            <div key={label}>
              <div className="text-4xl md:text-5xl font-black mb-1">{num}</div>
              <div className="text-sm opacity-90">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-4">我們的使命</h2>
          <p>讓每一位需要被照顧的長輩，都能擁有與日本長輩同等的生活品質。</p>
          <p>讓每一位照顧者，都不必再為了「買不到對的工具」而獨自掙扎。</p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-2">四個核心價值</h2>
          <p className="text-gray-600 mb-8">每一張訂單，都被當作自家的訂單。</p>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map(v => (
              <div key={v.title} className="bg-[#FEF9F3] p-7 rounded-2xl border-l-4 border-[#0ABAB5]">
                <h3 className="text-xl font-bold mb-2">{v.title}</h3>
                <p className="text-gray-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Difference */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-[#089B96] mb-6">
            為什麼選 ろかいずみ，不選一般代購？
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
              <thead>
                <tr className="bg-[#FEF9F3]">
                  <th className="p-4 text-left font-bold">比較項</th>
                  <th className="p-4 text-left font-bold">一般代購</th>
                  <th className="p-4 text-left font-bold">ろかいずみ</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map(r => (
                  <tr key={r[0]} className="border-t border-gray-200">
                    <td className="p-4 font-medium">{r[0]}</td>
                    <td className="p-4 text-gray-400">{r[1]}</td>
                    <td className="p-4 text-[#089B96] font-bold">{r[2]}</td>
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
          <h2 className="text-3xl font-bold mb-3">準備為家中長輩，挑一件好東西？</h2>
          <p className="opacity-90 max-w-xl mx-auto mb-6">
            從 220 件嚴選日本介護用品中找到答案，或直接 LINE 我們由介護士為您推薦。
          </p>
          <Link href="/products">
            <a className="inline-block bg-white text-[#089B96] hover:bg-[#FEF9F3] px-10 py-4 rounded-xl font-bold transition-colors">
              立刻看 220 件商品 →
            </a>
          </Link>
        </div>
      </section>

      <SiteFooter />
      <MobileStickyCTA />
    </div>
  );
}

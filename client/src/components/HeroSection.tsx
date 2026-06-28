import { Link } from 'wouter';
import { Search } from 'lucide-react';

interface Props {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
}

const heroProducts: any[] = [];

export function HeroSection({ searchQuery, onSearchChange, onSearchSubmit }: Props) {
  return (
    <section className="bg-gradient-to-br from-[#E0F7F6] via-[#FFF5F0] to-[#FFE0E8] overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center py-12 lg:py-20">
          {/* 左側內容 */}
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0ABAB5]/12 text-[#089B96] text-xs font-bold mb-5">
              🇯🇵 日本大阪直送・服務台灣家庭已 8 年
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.15] tracking-tight mb-5 text-gray-900">
              日本職人嚴選介護用品，
              <br />
              讓長輩生活
              <span className="text-[#0ABAB5]">更自在</span>。
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-xl">
              220 種精選輔具，從日本大阪直送台灣家門口。免關稅、7 天到貨、3 年保固，全中文客服協助選品。
            </p>
            <div className="flex flex-wrap gap-3 mb-7">
              <Link href="/products">
                <a className="inline-flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_4px_14px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 transition-all">
                  立刻選購 →
                </a>
              </Link>
              <Link href="/guides">
                <a className="inline-flex items-center gap-2 bg-transparent border-2 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors">
                  免費索取選品指南
                </a>
              </Link>
            </div>

            {/* Hero 搜尋 */}
            <div className="bg-white p-2 rounded-full shadow-[0_8px_24px_rgba(10,186,181,0.14)] flex items-center gap-2 max-w-lg">
              <input
                type="text"
                placeholder="輸入商品關鍵字，例如「電動介護床」、「輕量輪椅」..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearchSubmit()}
                className="flex-1 border-0 px-4 py-2 text-sm focus:outline-none bg-transparent"
              />
              <button
                onClick={onSearchSubmit}
                className="bg-[#0ABAB5] hover:bg-[#089B96] text-white px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                搜尋
              </button>
            </div>

            <div className="flex flex-wrap gap-5 mt-5 text-sm text-gray-600">
              {['正品保証', '免關稅', '3 年保固', '中日客服'].map(item => (
                <span key={item}>
                  <span className="text-[#16A34A] font-bold">✓</span> {item}
                </span>
              ))}
            </div>
          </div>

          {/* 右側商品卡 */}
          <div className="relative h-[420px] lg:h-[480px] hidden md:block">
            {heroProducts.map((p, i) => (
              <div
                key={i}
                className={`absolute ${p.pos} ${p.width} ${p.rotate} bg-white rounded-2xl shadow-[0_8px_24px_rgba(10,186,181,0.14)] overflow-hidden hover:rotate-0 hover:scale-105 transition-transform duration-300`}
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-[#E0F7F6] to-white flex items-center justify-center text-7xl">
                  {p.emoji}
                </div>
                <div className="px-4 py-3">
                  <div className="text-[11px] text-[#089B96] font-bold">{p.cat}</div>
                  <div className="text-sm font-bold mt-1 text-gray-900">{p.name}</div>
                  <div className="text-base font-black text-[#DC2626] mt-1.5">{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

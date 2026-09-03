import { Link } from 'wouter';
import { Search } from 'lucide-react';

interface Props {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
}

const heroProducts: any[] = [];

// 百元批發站網址（部署後換成正式網址）
const HYAKUEN_URL = 'https://hyakuen-wholesale.onrender.com/';

export function HeroSection({ searchQuery, onSearchChange, onSearchSubmit }: Props) {
  return (
    <section className="relative bg-gradient-to-br from-[#E0F7F6] via-[#FFF5F0] to-[#FFE0E8] overflow-hidden">
      {/* 山田化學百元批發入口 */}
      <Link
        href="/ag"
        title="山田百元批發 — 山田化學商品目錄"
        className="group hidden lg:flex absolute z-30 right-[27.5%] top-[22%] -translate-y-1/2 flex-col items-center justify-center text-center w-36 h-36 rounded-full bg-white shadow-2xl ring-4 ring-[#9EDFDA] hover:scale-105 transition-transform duration-200"
      >
        <span className="text-[11px] font-bold text-[#087F7B] leading-none">山田化學</span>
        <span className="text-2xl font-extrabold text-[#0ABAB5] leading-tight mt-0.5">百元批發</span>
        <span className="mt-1 text-[10px] text-gray-500 leading-tight px-2">710 品項</span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#0ABAB5] px-2 py-0.5 rounded-full group-hover:bg-[#089B96]">前往目錄 →</span>
      </Link>
      {/* 姊妹站入口：日本媽媽省省購（即時拼團直購） */}
      <a
        href="https://nihon-mama-savebuy.onrender.com/"
        target="_blank"
        rel="noreferrer"
        title="日本媽媽省省購 — 即時拼團・代購 0 元"
        className="group hidden lg:flex absolute z-30 right-[20%] top-1/2 -translate-y-1/2 flex-col items-center justify-center text-center w-36 h-36 rounded-full bg-white shadow-2xl ring-4 ring-[#E6C9A0] hover:scale-105 transition-transform duration-200"
      >
        <span className="text-[11px] font-bold text-[#B8895A] leading-none">日本媽媽</span>
        <span className="text-2xl font-extrabold text-[#C49A5E] leading-tight mt-0.5">省省購</span>
        <span className="mt-1 text-[10px] text-gray-500 leading-tight px-2">即時拼團・代購 0 元</span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#D8B98A] px-2 py-0.5 rounded-full group-hover:bg-[#caa874]">前往逛逛 →</span>
      </a>
      {/* 姊妹站入口：百元批發（KOKUBO 商品目錄，供台灣批發商） - 移到中間位置 */}
      <a
        href={HYAKUEN_URL}
        target="_blank"
        rel="noreferrer"
        title="百元批發入口 — 日本 KOKUBO 全商品目錄"
        className="group hidden lg:flex absolute z-30 right-[35%] top-1/2 -translate-y-1/2 flex-col items-center justify-center text-center w-36 h-36 rounded-full bg-white shadow-2xl ring-4 ring-[#F3B4B2] hover:scale-105 transition-transform duration-200"
      >
        <span className="text-[11px] font-bold text-[#C0392B] leading-none">日本直採</span>
        <span className="text-2xl font-extrabold text-[#DC2626] leading-tight mt-0.5">百元批發</span>
        <span className="mt-1 text-[10px] text-gray-500 leading-tight px-2">1,399 品項</span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#DC2626] px-2 py-0.5 rounded-full group-hover:bg-[#B91C1C]">前往目錄 →</span>
      </a>
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center py-8 sm:py-12 lg:py-20">
          {/* 左側內容 */}
          <div>
            <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-[#0ABAB5]/12 text-[#089B96] text-[11px] sm:text-xs font-bold mb-4 sm:mb-5">
              🇯🇵 日本大阪直送・服務台灣家庭已 8 年
            </span>
            <h1 className="text-2xl min-[400px]:text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.25] sm:leading-[1.15] tracking-tight mb-4 sm:mb-5 text-gray-900">
              日本職人嚴選介護用品，
              <br className="hidden sm:block" />
              讓長輩生活
              <span className="text-[#0ABAB5]">更自在</span>。
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 mb-6 sm:mb-8 max-w-xl">
              1,600 種以上日本嚴選商品，從大阪直送台灣家門口。免關稅、7 天到貨、3 年保固，全中文客服協助選品。
            </p>
        {/* 手機版山田化學百元批發入口 */}
        <Link
          href="/ag"
          className="lg:hidden mt-5 flex items-center gap-2.5 sm:gap-3 w-full max-w-md rounded-2xl bg-white ring-2 ring-[#9EDFDA] shadow-md px-3 sm:px-4 py-2.5 sm:py-3 active:scale-[0.98] transition-transform"
        >
          <span className="flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#E7FAF8] ring-1 ring-[#9EDFDA] shrink-0 leading-none">
            <span className="text-[8px] font-bold text-[#087F7B]">山田化學</span>
            <span className="text-[13px] font-extrabold text-[#0ABAB5]">百元批發</span>
          </span>
          <span className="flex-1 min-w-0 text-left leading-tight">
            <span className="block text-[13px] sm:text-sm font-bold text-gray-800">山田百元批發・商品目錄</span>
            <span className="block text-[11px] sm:text-xs text-gray-500">710 品項，單件 NT$22 →</span>
          </span>
        </Link>
        {/* 手機版姊妹站入口（桌機改用右側圓形 logo） */}
        <a
          href="https://nihon-mama-savebuy.onrender.com/"
          target="_blank"
          rel="noreferrer"
          className="lg:hidden mt-3 flex items-center gap-2.5 sm:gap-3 w-full max-w-md rounded-2xl bg-white ring-2 ring-[#E6C9A0] shadow-md px-3 sm:px-4 py-2.5 sm:py-3 active:scale-[0.98] transition-transform"
        >
          <span className="flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#FBF1E4] ring-1 ring-[#E6C9A0] shrink-0 leading-none">
            <span className="text-[8px] font-bold text-[#B8895A]">日本媽媽</span>
            <span className="text-[13px] font-extrabold text-[#C49A5E]">省省購</span>
          </span>
          <span className="flex-1 min-w-0 text-left leading-tight">
            <span className="block text-[13px] sm:text-sm font-bold text-gray-800">日本媽媽省省購・即時拼團</span>
            <span className="block text-[11px] sm:text-xs text-gray-500">代購 0 元，看到好物就開團 →</span>
          </span>
        </a>
        {/* 手機版百元批發入口 */}
        <a
          href={HYAKUEN_URL}
          target="_blank"
          rel="noreferrer"
          className="lg:hidden mt-3 flex items-center gap-2.5 sm:gap-3 w-full max-w-md rounded-2xl bg-white ring-2 ring-[#F3B4B2] shadow-md px-3 sm:px-4 py-2.5 sm:py-3 active:scale-[0.98] transition-transform"
        >
          <span className="flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#FDECEA] ring-1 ring-[#F3B4B2] shrink-0 leading-none">
            <span className="text-[8px] font-bold text-[#C0392B]">日本直採</span>
            <span className="text-[13px] font-extrabold text-[#DC2626]">百元批發</span>
          </span>
          <span className="flex-1 min-w-0 text-left leading-tight">
            <span className="block text-[13px] sm:text-sm font-bold text-gray-800">百元批發入口・KOKUBO 全目錄</span>
            <span className="block text-[11px] sm:text-xs text-gray-500">1,399 品項，整箱直採報價 →</span>
          </span>
        </a>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-7">
              <Link href="/products" className="inline-flex justify-center items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_4px_14px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 transition-all">
                  立刻選購 →
                </Link>
              <Link href="/guides" className="inline-flex justify-center items-center gap-2 bg-transparent border-2 border-[#0ABAB5] text-[#0ABAB5] hover:bg-[#0ABAB5] hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors">
                  免費索取選品指南
                </Link>
            </div>

            {/* Hero 搜尋 */}
            <div className="bg-white p-1.5 sm:p-2 rounded-full shadow-[0_8px_24px_rgba(10,186,181,0.14)] flex items-center gap-1.5 sm:gap-2 max-w-lg">
              <input
                type="text"
                placeholder="搜尋商品，例如「輪椅」"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearchSubmit()}
                className="flex-1 min-w-0 border-0 px-3 sm:px-4 py-2 text-sm focus:outline-none bg-transparent"
              />
              <button
                onClick={onSearchSubmit}
                className="shrink-0 whitespace-nowrap bg-[#0ABAB5] hover:bg-[#089B96] text-white px-4 sm:px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                搜尋
              </button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 sm:mt-5 text-[13px] sm:text-sm text-gray-600">
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

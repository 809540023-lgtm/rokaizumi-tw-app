import { Link } from 'wouter';

const bullets = [
  '批發折扣：訂購量越大、折扣越多，最高再省 22%',
  '月結發票：開立統編，月結 30 / 60 天可談',
  '專屬窗口：1 對 1 LINE 客服 + 中日雙語業務支援',
  '備品保留：常用品項可預留庫存，下單隔日出貨',
];

export function B2BBanner() {
  return (
    <section id="b2b" className="py-16">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0ABAB5] to-[#089B96] text-white rounded-2xl p-8 md:p-12 grid md:grid-cols-[1.4fr_1fr] gap-8 md:gap-10 items-center">
          {/* 裝飾圓圈 */}
          <div className="absolute -right-16 -top-16 w-60 h-60 bg-white/8 rounded-full" />
          <div className="absolute right-16 -bottom-24 w-52 h-52 bg-white/6 rounded-full" />

          <div className="relative z-10">
            <span className="text-xs tracking-[0.15em] uppercase font-bold opacity-85">
              企業 / 機構合作
            </span>
            <h2 className="text-2xl md:text-3xl font-bold mt-3 mb-5 leading-tight">
              長照中心 . 醫療院所 . 居家照護業者
              <br />
              專屬採購方案
            </h2>
            <ul className="flex flex-col gap-2.5">
              {bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-[15px] opacity-95">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 font-black text-sm">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10">
            <Link href="/b2b">
              <a className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#089B96] hover:bg-[#FEF9F3] font-bold text-base px-6 py-4 rounded-xl transition-colors">
                立即洽詢報價 →
              </a>
            </Link>
            <p className="mt-3 text-[13px] opacity-85 text-center">
              已服務 140+ 間台灣長照與醫療機構
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

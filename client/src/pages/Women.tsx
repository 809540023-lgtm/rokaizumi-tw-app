import { Link } from "wouter";
import { Sparkles, BellRing, ArrowRight, Flower2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const PREVIEWS = [
  { image: "/candles/images/candle-01.jpeg", name: "香氛蠟燭・花語系列" },
  { image: "/candles/images/candle-03.jpeg", name: "香氛蠟燭・晨光系列" },
  { image: "/candles/images/candle-05.jpeg", name: "香氛蠟燭・靜謐系列" },
] as const;

export function Women() {
  return (
    <div className="min-h-screen bg-[#fbf6fa]">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#5b1547] via-[#8b2c62] to-[#c96f9b] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              background:
                "radial-gradient(70% 90% at 80% 12%, rgba(255,214,235,0.45) 0%, rgba(255,214,235,0) 65%), radial-gradient(50% 70% at 10% 90%, rgba(255,183,222,0.3) 0%, rgba(255,183,222,0) 70%)",
            }}
          />
          <div className="relative container mx-auto grid items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wider text-pink-100 backdrop-blur sm:text-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                屬於女人的方向
              </span>
              <h1 className="mt-5 text-3xl leading-snug font-extrabold sm:text-4xl lg:text-[2.75rem]">
                女性嚴選商品線
                <br className="hidden sm:block" />
                香氛・生活小物・送禮提案
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-pink-100/90 sm:text-base">
                來自日本的香氛蠟燭與生活美感小物，精選給每一位認真生活、懂得寵愛自己的妳。
                正式商品頁面準備中，敬請期待。
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#8b2c62] shadow-lg shadow-rose-900/20 sm:text-base">
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  即將開賣
                </span>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 sm:text-base"
                >
                  先逛逛介護用品 <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
              <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-rose-950/30">
                <img
                  src="/home/card-women.jpg"
                  alt="屬於女人的方向 — 女性嚴選商品"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <span className="absolute -left-2 top-6 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#8b2c62] shadow-lg sm:text-sm">
                日本直送
              </span>
              <span className="absolute -bottom-3 right-4 rounded-lg bg-[#c96f9b] px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:text-sm">
                香氛嚴選
              </span>
            </div>
          </div>
        </section>

        {/* 預覽 */}
        <section className="container mx-auto px-4 py-12 sm:py-16">
          <div className="flex items-center gap-2 text-slate-800">
            <Flower2 className="h-5 w-5 text-[#c96f9b]" aria-hidden="true" />
            <h2 className="text-xl font-extrabold sm:text-2xl">開賣前搶先看</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">首批香氛蠟燭款式預覽，實際販售商品以開賣頁為準。</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {PREVIEWS.map((p) => (
              <div
                key={p.image}
                className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="aspect-square bg-pink-50">
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <span className="text-sm font-bold text-slate-800">{p.name}</span>
                  <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-bold text-[#8b2c62]">預覽</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default Women;

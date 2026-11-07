import { Link } from "wouter";
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
  PackageCheck,
  HeartHandshake,
  Sparkles,
  Building2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const ENTRIES = [
  {
    label: "山田化學百元批發",
    caption: "山田化學商品目錄・百元精品",
    href: "/ag",
    external: false,
    image: "/home/card-yamada.jpg",
    badge: "山田化學",
    badgeColor: "#0ABAB5",
  },
  {
    label: "日本媽媽省省購",
    caption: "即時拼團・代購 0 元",
    href: "https://nihon-mama-savebuy.onrender.com/",
    external: true,
    image: "/home/card-savebuy.jpg",
    badge: "省省購",
    badgeColor: "#C49A5E",
  },
  {
    label: "百元批發（KOKUBO）",
    caption: "KOKUBO 全商品目錄 1,400+ 品項",
    href: "https://hyakuen-wholesale.onrender.com/",
    external: true,
    image: "/home/card-kokubo.jpg",
    badge: "百元批發",
    badgeColor: "#DC2626",
  },
] as const;

const FEATURES = [
  { icon: Cpu, title: "AI 智慧應用", desc: "提高產業效率" },
  { icon: ShieldCheck, title: "區塊鏈技術", desc: "強化信任與透明" },
  { icon: PackageCheck, title: "日本嚴選品質", desc: "精選優質商品" },
  { icon: HeartHandshake, title: "安心照護支援", desc: "專業・貼心・可靠" },
] as const;

export function PortalHome() {
  return (
    <div className="min-h-screen bg-[#dff7ff] scroll-smooth">
      <main>
        <section
          className="relative mx-auto w-full max-w-[1357px] overflow-hidden bg-white"
          aria-label="ろかいずみ服務入口"
        >
          <img
            src="/home/1793840233965.jpg"
            alt="ろかいずみ首頁：日本精美小商品、批發、介護用品、LINE商店與女人方向服務入口"
            className="block h-auto w-full select-none"
            draggable={false}
            fetchPriority="high"
          />

          {/* 零售頁尚未完成；只開放其餘四個入口，圖上的其他項目保持不可點擊。 */}
          <nav className="absolute inset-0" aria-label="已確認的服務入口">
            <Link
              href="/ag"
              aria-label="日本精美小商品（批發）"
              title="日本精美小商品（批發）"
              className="absolute left-[2.3%] top-[42.0%] h-[12.8%] w-[24.2%] min-h-10 rounded-[1.25rem] outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
            />
            <Link
              href="/products?category=care"
              aria-label="職人嚴選介護用品"
              title="職人嚴選介護用品"
              className="absolute left-[2.3%] top-[56.6%] h-[12.8%] w-[33.8%] min-h-10 rounded-[1.25rem] outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
            />
            <a
              href="/line-shop/"
              aria-label="LINE商店（代購）"
              title="LINE商店（代購）"
              className="absolute right-[2.36%] top-[22.47%] h-[10%] w-[24.61%] rounded-[1.25rem] outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
            />
            <Link
              href="/women"
              aria-label="屬於女人的方向"
              title="屬於女人的方向"
              className="absolute right-[2.3%] top-[72.5%] h-[12.8%] w-[31.0%] min-h-10 rounded-[1.25rem] outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
            />
          </nav>
        </section>
      </main>

      {/* 原圖保留完整導航；既有可操作的網站工具列置於原圖下方。 */}
      <SiteHeader />
      <SiteFooter />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5fafe] scroll-smooth">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#001f52] via-[#013873] to-[#0b6fb3] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(60% 80% at 78% 18%, rgba(35,167,229,0.35) 0%, rgba(35,167,229,0) 70%), radial-gradient(45% 60% at 12% 85%, rgba(96,165,250,0.25) 0%, rgba(96,165,250,0) 70%)",
            }}
          />
          <div className="relative container mx-auto px-4 py-12 sm:py-16 lg:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wider text-sky-100 backdrop-blur sm:text-sm">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  AI × 區塊鏈 × 產業應用
                </span>
                <h1 className="mt-5 text-3xl leading-snug font-extrabold sm:text-4xl lg:text-[2.75rem]">
                  以 AI 與區塊鏈技術
                  <br className="hidden sm:block" />
                  為企業與生活提供智慧化解決方案
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-sky-100/90 sm:text-base">
                  提高效率、透明度與產業價值。以日本優質商品與創新科技，為您創造更安心、便利與高效率的生活與產業方案。
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#014488] shadow-lg shadow-sky-900/30 transition hover:bg-sky-50 sm:text-base"
                  >
                    逛逛日本商品{" "}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <a
                    href="#entries"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 sm:text-base"
                  >
                    三個服務入口
                  </a>
                </div>
              </div>

              <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
                <div className="overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-sky-950/40">
                  <img
                    src="/home/hero-products.jpg"
                    alt="日本介護用品 — 沐浴清潔系列商品"
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
                <span className="absolute -left-2 top-6 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#014488] shadow-lg sm:text-sm">
                  日本嚴選品質
                </span>
                <span className="absolute -bottom-3 right-4 rounded-lg bg-[#0ABAB5] px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:text-sm">
                  大阪直送台灣
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 三個路口 */}
        <section
          id="entries"
          aria-label="服務入口"
          className="container scroll-mt-24 mx-auto px-4 py-12 sm:py-16"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {ENTRIES.map(entry => {
              const inner = (
                <>
                  <div className="relative aspect-[16/10] bg-white">
                    <img
                      src={entry.image}
                      alt={entry.label}
                      className="h-full w-full object-contain p-3"
                      loading="lazy"
                    />
                    <span
                      className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white shadow"
                      style={{ backgroundColor: entry.badgeColor }}
                    >
                      {entry.badge}
                    </span>
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 border-t border-sky-100 p-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                        {entry.label}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                        {entry.caption}
                      </p>
                    </div>
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:translate-x-1"
                      style={{ backgroundColor: entry.badgeColor }}
                    >
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                </>
              );
              const cls =
                "group relative flex flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-sky-900/10";
              return entry.external ? (
                <a
                  key={entry.href}
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cls}
                >
                  {inner}
                </a>
              ) : (
                <Link key={entry.href} href={entry.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/b2b"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-3 text-sm font-bold text-[#014488] transition hover:border-sky-300 hover:bg-sky-50"
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
              企業採購 / B2B 批發洽詢
            </Link>
          </div>
        </section>

        {/* 品牌主張 + 四大特色 */}
        <section className="container mx-auto px-4 pb-14 sm:pb-20">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-sky-100 sm:p-10">
            <p className="mx-auto max-w-3xl text-center text-base leading-relaxed font-bold text-slate-800 sm:text-lg">
              以日本優質商品與創新科技，為客戶創造
              <span className="text-[#014488]">更安心、便利與高效率</span>
              的生活與產業方案。
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(f => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 rounded-2xl bg-[#f0f7fe] p-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#014488] text-white">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 sm:text-base">
                      {f.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default PortalHome;

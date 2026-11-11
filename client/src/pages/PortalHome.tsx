import { Link } from "wouter";
import { PortalNavigation, portalCopy } from "@/components/PortalNavigation";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";
import { PortalCards } from "./PortalDirectory";

export function PortalHome() {
  const { language } = useLanguage();
  const copy = portalCopy[language];
  return (
    <div className="min-h-screen bg-[#dff7ff] scroll-smooth">
      <PortalNavigation />
      <main>
        {language === "zh" ? (
        <section
          className="relative mx-auto w-full max-w-[1357px] overflow-hidden bg-white"
          aria-label="ろかいずみ服務入口"
        >
          <div className="-mt-[4.64%] relative">
          <img
            src="/home/1793840233965.jpg"
            alt="ろかいずみ首頁：日本精美小商品、批發、介護用品、LINE商店與女人方向服務入口"
            className="block h-auto w-full select-none"
            draggable={false}
            fetchPriority="high"
          />

          {/* 零售與大阪不動產投資內頁尚未完成；僅開放已確認的服務入口。 */}
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
              className="absolute left-[2.3%] top-[49.74%] h-[10%] w-[33.1%] rounded-[1.25rem] outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
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
            <Link
              href="/linbo-ai"
              aria-label="深入了解 林博 AI"
              title="深入了解 林博 AI"
              className="absolute left-[39%] top-[52.6%] h-[6.5%] w-[22%] rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-4 focus-visible:ring-yellow-300"
            />
          </nav>
          </div>
        </section>
        ) : (
          <section className="mx-auto max-w-[1357px] bg-gradient-to-br from-[#061a33] to-[#075c87] px-6 py-12 text-white sm:px-10">
            <h1 className="max-w-3xl text-3xl font-bold sm:text-5xl">{copy.hero}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-sky-100">{copy.intro}</p>
            <PortalCards indices={[0, 1, 2, 3, 4, 5]} />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );

}

export default PortalHome;

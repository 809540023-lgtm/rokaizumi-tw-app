import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PortalNavigation, portalCopy } from "@/components/PortalNavigation";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";

const destinations = ["/ag", "/products?category=care", "/line-shop/", "/women", "/linbo-ai", "/b2b", "/guides", "mailto:cia8885@gmail.com"];

export function PortalCards({ indices }: { indices: number[] }) {
  const { language } = useLanguage();
  const copy = portalCopy[language];
  const card = "flex items-center justify-between gap-2 rounded-xl bg-white p-4 font-semibold text-[#073957] shadow-sm hover:bg-sky-50";
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {indices.map(index => {
        const href = destinations[index];
        const label = <>{copy.entries[index]} <ArrowRight className="shrink-0" size={18} aria-hidden="true" /></>;
        return <li key={href}>{index === 2 || index === 7 ? <a href={href} className={card}>{label}</a> : <Link href={href} className={card}>{label}</Link>}</li>;
      })}
    </ul>
  );
}

export default function PortalDirectory() {
  const { language } = useLanguage();
  const [location] = useLocation();
  const copy = portalCopy[language];
  const news = location === "/news";
  const support = location === "/support";
  return (
    <div className="min-h-screen bg-[#edf6fb] text-slate-950">
      <PortalNavigation />
      <main className="mx-auto min-h-[55vh] max-w-6xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold sm:text-4xl">{copy.nav[news ? 4 : support ? 5 : 1]}</h1>
        {news ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {["/linbo-ai", "/products?category=care", "/line-shop/"].map((href, index) => (
              <li key={href} className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold"><a href={href} className="text-sky-800 underline underline-offset-4">{copy.news[index]}</a></h2>
                <p className="mt-3 leading-7 text-slate-700">{copy.details[index]}</p>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-3 leading-7 text-slate-700">{support ? copy.support : copy.intro}</p>
            <PortalCards indices={support ? [6, 7, 2, 5] : [0, 1, 2, 3, 4, 5]} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

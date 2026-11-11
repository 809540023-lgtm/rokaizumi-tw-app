import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export const portalCopy = {
  zh: {
    nav: ["首頁", "產品與服務", "林博 AI（區塊鏈產業）", "關於我們", "最新消息", "支援與資源", "出勤打卡"],
    search: "搜尋商品", login: "登入", language: "語言", hero: "以 AI 與區塊鏈技術，連接日本商品與產業服務",
    intro: "探索日本選品、跨境商務，以及林博 AI 在日本的研發與應用。",
    entries: ["日本小商品批發", "職人嚴選介護用品", "LINE 商店（代購）", "屬於女人的方向", "深入了解林博 AI", "企業合作", "購物指南", "聯絡客服"],
    news: ["ABC_YPCloud 日本研發進度", "日本介護用品選品", "LINE 代購服務"],
    details: ["掌握日本 AI 大腦的研發方向、現階段設計和待驗證項目。", "依分類瀏覽介護鞋、寢具及日常生活輔具。", "從 LINE 商店瀏覽日本商品與代購服務。"],
    support: "購物、代購、企業合作和網站使用問題，可從下方找到對應入口。",
  },
  cn: {
    nav: ["首页", "产品与服务", "林博 AI（区块链产业）", "关于我们", "最新消息", "支持与资源", "考勤打卡"],
    search: "搜索商品", login: "登录", language: "语言", hero: "以 AI 与区块链技术，连接日本商品与产业服务",
    intro: "探索日本选品、跨境商务，以及林博 AI 在日本的研发与应用。",
    entries: ["日本小商品批发", "匠人精选护理用品", "LINE 商店（代购）", "女性生活精选", "深入了解林博 AI", "企业合作", "购物指南", "联系客服"],
    news: ["ABC_YPCloud 日本研发进度", "日本护理用品选品", "LINE 代购服务"],
    details: ["了解日本 AI 大脑的研发方向、现阶段设计和待验证事项。", "按分类浏览护理鞋、寝具和日常生活辅具。", "通过 LINE 商店浏览日本商品与代购服务。"],
    support: "购物、代购、企业合作和网站使用问题，可从下方找到对应入口。",
  },
  ja: {
    nav: ["ホーム", "製品・サービス", "林博AI・ブロックチェーン", "会社概要", "お知らせ", "サポート・資料", "勤怠打刻"],
    search: "商品を検索", login: "ログイン", language: "言語", hero: "日本の商品と産業を、AIとブロックチェーンでつなぐ",
    intro: "日本の厳選商品、越境ビジネス、林博AIの日本での研究開発をご紹介します。",
    entries: ["日本の生活雑貨・卸売", "厳選介護用品", "LINEショップ（購入代行）", "女性向けセレクション", "林博AIについて", "法人のお客様", "お買い物ガイド", "お問い合わせ"],
    news: ["ABC_YPCloud 日本での研究開発", "日本の介護用品", "LINE購入代行サービス"],
    details: ["AIブレインの開発方針、設計の進捗、今後の検証項目をご紹介します。", "介護靴、寝具、日常生活用具をカテゴリー別にご覧いただけます。", "LINEショップで日本の商品と購入代行サービスをご確認ください。"],
    support: "お買い物、購入代行、法人連携に関するご案内はこちらからご覧ください。",
  },
  en: {
    nav: ["Home", "Products & Services", "Linbo AI & Blockchain", "About Us", "News", "Support & Resources", "Attendance"],
    search: "Search products", login: "Sign in", language: "Language", hero: "Japanese products and business services powered by AI",
    intro: "Explore Japanese goods, cross-border commerce, and Linbo AI’s research and applications in Japan.",
    entries: ["Japanese goods wholesale", "Curated care products", "LINE Shop · buying service", "Women’s selection", "Explore Linbo AI", "Business partnerships", "Shopping guides", "Contact support"],
    news: ["ABC_YPCloud research in Japan", "Japanese care products", "LINE buying service"],
    details: ["See the AI brain’s development direction, design progress, and planned validation.", "Browse care footwear, bedding, and aids for daily living.", "Explore Japanese goods and buying services through the LINE shop."],
    support: "Find help with shopping, buying services, business partnerships, and using the site.",
  },
};

export function PortalNavigation() {
  const { language, setLanguage } = useLanguage();
  const [location, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const copy = portalCopy[language];
  const links = ["/", "/services", "/linbo-ai", "/about", "/news", "/support", "/attendance/"];
  return (
    <header className="border-b border-sky-100 bg-white text-[#061a33]">
      <div className="mx-auto flex max-w-[1357px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold">ろかいずみ合同会社</Link>
        <div className="ml-auto flex items-center gap-3">
          <select aria-label={copy.language} value={language} onChange={event => setLanguage(event.target.value as typeof language)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
            <option value="zh">繁體中文</option><option value="cn">简体中文</option>
            <option value="ja">日本語</option><option value="en">English</option>
          </select>
          <Link href="/login" className="rounded-lg bg-[#07556c] px-3 py-2 text-sm font-semibold text-white">{copy.login}</Link>
        </div>
        <nav className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold lg:order-none lg:w-auto" aria-label={copy.nav[0]}>
          {links.map((href, index) => (
            href === "/attendance/" ? (
              <a key={href} href={href} className="rounded px-1 py-2 hover:text-sky-700">{copy.nav[index]}</a>
            ) : (
            <Link key={href} href={href} aria-current={location === href ? "page" : undefined} className="rounded px-1 py-2 hover:text-sky-700 aria-[current=page]:text-sky-700 aria-[current=page]:underline underline-offset-4">{copy.nav[index]}</Link>
            )
          ))}
        </nav>
        <form role="search" className="order-last flex gap-2" onSubmit={event => {
          event.preventDefault();
          if (search.trim()) navigate(`/products?q=${encodeURIComponent(search.trim())}`);
        }}>
          <input type="search" aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)} className="w-32 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <button className="rounded-lg bg-sky-100 px-2 py-2 text-sm font-semibold">{copy.search}</button>
        </form>
      </div>
    </header>
  );
}

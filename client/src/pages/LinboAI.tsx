import { ArrowLeft, ArrowRight, Cpu, Layers3, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { AbpCTrends } from "@/components/AbpCTrends";
import { SiteFooter } from "@/components/SiteFooter";

const strengths = [
  { icon: Layers3, title: "從經營問題出發", body: "三十年跨產業實務，涵蓋金融保險團隊管理、教育資訊化、跨境電商與連鎖門市。從交付時間、人力、庫存及現金流找出瓶頸，再設計 AI 可以接手的流程。" },
  { icon: Cpu, title: "把 AI 當作企業基礎設施", body: "曾任宏碁 eDC 專案經理，參與新竹科學園區資訊系統及機房維運。將可靠性、權限管理、模型路由、Token 配額與使用紀錄納入企業 AI 架構。" },
  { icon: ShieldCheck, title: "兼顧制度、成本與風險", body: "淡江大學經濟學博士，研究證券型代幣監管與制度設計，並具早期區塊鏈算力維運與教育經驗。以成本、責任分工及可追溯性評估技術是否適合導入。" },
];

const projects = [
  ["日本企業資安", "服務驗證版", "AI Shield Japan", "面向日本中小企業，展示經授權的 IT 資安盤點、AI 導入前健檢，以及代理權限和知識來源管理。"],
  ["亞洲跨境商務", "多市場系統規劃", "JBG OS 日本商品跨境營運", "以日本商品為起點，規劃不同市場的商品資料、交易交接與在地營運流程。"],
  ["產品開發", "品牌與供應鏈規劃", "MORI KORI 森冰", "以日本冷泡煎茶為題，整理商品定位、供應商、包裝與上市前驗證。"],
  ["直播與內容製作", "工作台設計", "林博 AI 哈客直播工作台", "串接導播、串流、逐字稿與剪輯流程，讓教學團隊從排程、錄製到精華內容交付都有共同工作台。"],
  ["餐飲營運", "流程規格", "林博 AI 御膳", "以店家主資料為基礎，由四個 AI 角色協作處理菜單、成本、備料、接單、社群文案與交付品管。"],
  ["跨境零售", "商品情報與系統規劃", "日本好物選品與代購", "以日本 Costco、日用品與介護用品為應用場景，規劃商品情報、價格與庫存追蹤、跨境成本估算和 LINE 接單。"],
  ["人才培訓", "日文課程規劃", "Muse 日本商品與房仲課程", "商品銷售線以 52 週教案為骨架，房仲線規劃 12 堂課。練習用自然語言交辦、核對 AI 產出與設計人工覆核。"],
  ["企業治理", "教材與導入方法", "AI Token 成本治理", "從個人使用延伸到團隊治理，包含模型分流、預算配額、快取與使用稽核，讓成本能按部門和任務追蹤。"],
  ["量化研究", "研究工具", "林博股票機器人工廠", "把策略條件組成可回測規則，檢視歷史報酬、回撤與比較基準。作為研究與教學用途。"],
  ["數位資產", "制度研究", "STO 與 RWA", "由博士研究延伸到實體資產憑證化、權利紀錄及跨境監管比較。大阪相關構想目前列為研究方向。"],
];

const japan = [
  ["中小企業與專業服務", "從日文詢問回覆、提案、文件整理或內部知識查詢切入。先挑一項耗時而能驗收的流程，建立權限、人工覆核與工時基準。"],
  ["台日跨境商務", "協助日本商家理解台灣客群，也協助台灣團隊整理日本市場與商品情報。優先驗證選品、詢價、商品資料與訂單交接。"],
  ["教育與現場營運", "以日本商品銷售、房仲實務和店舖管理為題，規劃日文工作坊及小班試教，透過實際任務衡量學員能否獨立操作。"],
  ["企業 AI 治理與制度研究", "為需要擴大 AI 使用的團隊規劃集中閘道、權限、日誌與用量管理。數位資產方向聚焦制度研究及技術可行性。"],
];

export default function LinboAI() {
  return (
    <div className="min-h-screen bg-[#f2f6fa] text-slate-950">
      <header className="bg-[#061a33] text-white">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-sky-200 hover:text-white">
            <ArrowLeft aria-hidden="true" size={16} /> 返回ろかいずみ首頁
          </Link>
          <div className="grid gap-8 py-12 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold tracking-widest text-cyan-200">林博 AI · Dr. Lin Yin-Chih</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">林吟芝博士</h1>
              <p className="mt-3 text-xl font-medium text-sky-100 sm:text-2xl">企業 AI 戰略與數位轉型顧問</p>
              <p className="mt-5 max-w-2xl leading-8 text-slate-200">從三十年跨產業經營、資訊基礎設施維運與經濟學研究出發，協助企業把 AI 放進日常營運，讓成效、成本和責任都看得見。</p>
              <a href="#japan" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-cyan-200 px-5 py-3 font-semibold text-[#061a33] hover:bg-white">
                探索日本發展方向 <ArrowRight aria-hidden="true" size={17} />
              </a>
              <a href="#abp-c" className="ml-4 mt-4 inline-flex items-center gap-2 py-3 font-semibold text-cyan-100 underline underline-offset-4 hover:text-white">看 Abp C 日本研發進度</a>
            </div>
            <aside lang="ja" className="rounded-2xl border border-sky-700 bg-[#0b2747] p-6">
              <h2 className="text-lg font-semibold text-cyan-100">日本企業の皆さまへ</h2>
              <p className="mt-3 leading-8 text-slate-200">AIエージェントの導入、業務の自動化、利用コストの管理、日台間の事業展開を支援します。まず現場の業務を一つ選び、効果と運用上の課題を確認するところから始めます。</p>
            </aside>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-5 py-14 sm:px-8">
        <section aria-labelledby="strengths">
          <h2 id="strengths" className="text-3xl font-bold">林博的三項優勢</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {strengths.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-xl border border-slate-200 bg-white p-6">
                <Icon aria-hidden="true" className="text-sky-700" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-700">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <AbpCTrends />

        <section aria-labelledby="projects">
          <h2 id="projects" className="text-3xl font-bold">專案與應用</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-700">從企業內部治理到第一線營運，以下專案展示林博如何設計 AI 工作流程，以及可延伸到日本的應用。</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {projects.map(([category, stage, title, body]) => (
              <article key={title} className="rounded-xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-sky-800">{category} · {stage}</p>
                <h3 className="mt-2 text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-700">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="japan" aria-labelledby="japan-title" className="scroll-mt-5 rounded-2xl bg-[#061a33] p-6 text-white sm:p-9">
          <h2 id="japan-title" className="text-3xl font-bold">在日本的發展方向</h2>
          <p className="mt-3 max-w-2xl leading-7 text-sky-100">以大阪為合作起點，先做可驗收的小型試點，再把有效的流程擴展到其他團隊與市場。</p>
          <div className="mt-7 grid gap-6 md:grid-cols-2">
            {japan.map(([title, body]) => (
              <article key={title} className="border-t border-sky-700 pt-4">
                <h3 className="text-xl font-semibold text-cyan-100">{title}</h3>
                <p className="mt-2 leading-7 text-slate-200">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="contact" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-9">
          <h2 id="contact" className="text-3xl font-bold">企業合作</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-700">提供決策層策略諮詢、企業 AI 閘道與算力成本治理、跨部門 AI 工作流程規劃，以及主管與團隊工作坊。歡迎來信說明產業、想改善的流程與期待成果。</p>
          <a href="mailto:cia8885@gmail.com" className="mt-5 inline-flex rounded-lg bg-[#0b4778] px-5 py-3 font-semibold text-white hover:bg-[#082f50]">聯絡林博</a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

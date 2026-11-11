import {
  ArrowDown, Box, CheckCircle2, Cloud, Cpu, GraduationCap, Laptop,
  ListChecks, Mic, Monitor, Network, Radio, Scale, Server, ShieldCheck, Users,
} from "lucide-react";

const devices = [
  { icon: Network, title: "協作機", text: "分派任務、串接工具、回報進度" },
  { icon: Cpu, title: "算力機", text: "本機推論與 GPU 工作負載" },
  { icon: Server, title: "企業機", text: "企業知識、權限與營運流程" },
  { icon: Mic, title: "共創機", text: "語音對話、節目與內容協作" },
  { icon: Monitor, title: "媒體機", text: "會議、教室與遠距影音" },
  { icon: GraduationCap, title: "AI 小教授", text: "提問、練習與學生創作" },
];

const principles = [
  { icon: Users, title: "組織學", question: "誰指揮、誰執行、誰驗收？", text: "先定義每個角色的權限、交付責任與人工覆核點。" },
  { icon: Scale, title: "經濟學", question: "每次交付花多少、創造多少價值？", text: "比較工時、算力與維運成本，從產品延伸到服務，再依場域需求組成解決方案。" },
  { icon: ListChecks, title: "方法學", question: "怎麼把意圖變成可驗收的成果？", text: "用 Abp C 協作網路派工、執行並回傳證據，再依預先約定的標準驗收。" },
];

const roles = [
  ["Cito", "產品與工程"],
  ["Lulu", "行銷與銷售"],
  ["Coco", "營運與執行"],
  ["Milo", "媒體指揮"],
];

const execution = [
  { icon: Users, title: "設定目標", text: "四個角色共同確認目標、資源、優先順序及驗收條件。" },
  { icon: ListChecks, title: "拆解任務", text: "用任務樹編排目標、任務、資源、角色和時程，並追蹤狀態。" },
  { icon: Network, title: "跨節點執行", text: "將開發、操作與品管任務交給適合的設備或代理。" },
  { icon: CheckCircle2, title: "回報與驗收", text: "回傳執行紀錄與成果，交由人員覆核和修正。" },
];

const environments = [
  { icon: Laptop, title: "本機", text: "工作現場與低延遲任務" },
  { icon: Network, title: "區域網路", text: "同一場域的設備協作" },
  { icon: Server, title: "私有雲", text: "組織資料與集中管理" },
  { icon: Cloud, title: "公有雲", text: "彈性算力與外部模型" },
];

const lesson = [
  ["10 分鐘", "認識我的家鄉"],
  ["10 分鐘", "與 AI 提問探索"],
  ["15 分鐘", "與遠方教室直播交流"],
  ["15 分鐘", "創作家鄉故事"],
  ["10 分鐘", "分享作品與未來想像"],
];

export function AbpCTrends() {
  return (
    <section id="abp-c" aria-labelledby="abp-c-title" className="scroll-mt-6 space-y-8">
      <header className="overflow-hidden rounded-2xl bg-[#061a33] px-6 py-9 text-white sm:px-9">
        <p className="text-sm font-semibold tracking-widest text-cyan-200">日本 AI 大腦｜研發方向與目前進度</p>
        <h2 id="abp-c-title" className="mt-3 text-3xl font-bold sm:text-5xl">Abp C</h2>
        <p className="mt-4 max-w-3xl leading-8 text-sky-100">Abp C 是林博 AI 在日本發展的 AI 大腦。研發方向是把組織知識、任務分工與本機及雲端算力接起來，讓企業、教室和內容團隊能在自己的工作場域指派任務、追蹤執行並驗收成果。</p>
      </header>

      <section aria-labelledby="abp-c-progress" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h3 id="abp-c-progress" className="text-2xl font-bold">目前研發進度</h3>
        <dl className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-[#e7f6f2] p-4">
            <dt className="font-bold text-teal-900">已有維運紀錄</dt>
            <dd className="mt-2 text-sm leading-6 text-slate-700">部分基礎服務已有版本更新、登入與 API 健康檢查、部署回證和重啟確認。</dd>
          </div>
          <div className="rounded-xl bg-[#edf6fb] p-4">
            <dt className="font-bold text-sky-900">已整理設計</dt>
            <dd className="mt-2 text-sm leading-6 text-slate-700">已整理六種設備角色、四個指揮角色、任務樹與跨平台核心架構，以及偏鄉共學示範課流程。</dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <dt className="font-bold text-amber-950">待驗證與試點</dt>
            <dd className="mt-2 text-sm leading-6 text-slate-700">驗證 Apple M4 相容性與效能、遠端桌面整合、備份還原及開機復原，再評估日本節點成本與場域試點。</dd>
          </div>
        </dl>
      </section>

      <figure className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <figcaption className="text-2xl font-bold">AI 是組織學 × 經濟學 × 方法學</figcaption>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, question, text }) => (
            <li key={title} className="rounded-xl bg-[#edf6fb] p-4">
              <Icon aria-hidden="true" className="size-7 text-sky-700" />
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm font-semibold">{question}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-lg bg-[#061a33] p-4 text-white">
          <h3 className="font-semibold">官網發布流程</h3>
          <ol className="mt-2 flex flex-wrap gap-2 text-sm text-sky-100">
            <li>Lab 驗證</li>
            <li><span aria-hidden="true">→ </span>人工核准</li>
            <li><span aria-hidden="true">→ </span>正式發布</li>
          </ol>
        </div>
      </figure>

      <figure className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <figcaption className="text-2xl font-bold">六種設備角色</figcaption>
        <p className="mt-2 leading-7 text-slate-700">依任務配置設備，配合模型、組織知識與持續維運，從單機試點延伸為場域方案。</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl bg-[#edf6fb] p-4">
              <Icon aria-hidden="true" className="text-sky-700" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
            </li>
          ))}
        </ul>
      </figure>

      <div className="grid gap-5 lg:grid-cols-2">
        <figure className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <figcaption className="text-2xl font-bold">從目標到驗收</figcaption>
          <ul aria-label="指揮團隊" className="mt-4 grid grid-cols-2 gap-2">
            {roles.map(([name, responsibility]) => (
              <li key={name} className="rounded-lg border border-sky-200 px-3 py-2 text-sm">
                <strong className="block text-sky-800">{name}</strong>
                <span className="text-slate-700">{responsibility}</span>
              </li>
            ))}
          </ul>
          <ol className="mt-5 space-y-2">
            {execution.map(({ icon: Icon, title, text }, index) => (
              <li key={title}>
                {index > 0 && <ArrowDown aria-hidden="true" className="mx-auto mb-2 size-4 text-sky-700" />}
                <div className="flex gap-3 rounded-lg bg-slate-100 p-3">
                  <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-sky-700" />
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-700">{text}</p></div>
                </div>
              </li>
            ))}
          </ol>
        </figure>

        <figure className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <figcaption className="text-2xl font-bold">本機與雲端共同運作</figcaption>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {environments.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-lg border border-sky-200 p-3">
                <Icon aria-hidden="true" className="size-5 text-sky-700" />
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3 rounded-lg bg-[#e9f5fa] p-4">
            <Box aria-hidden="true" className="mt-1 size-5 shrink-0 text-sky-700" />
            <div>
              <h3 className="font-semibold">跨平台核心規劃</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">Linux、Windows 與 macOS 共用身分、信任、維運和任務執行設計。Apple M4 的隔離 Linux、x86-64 相容性、效能及遠端桌面整合仍待驗證。</p>
            </div>
          </div>
        </figure>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl bg-[#e7f6f2] p-6 sm:p-8">
          <Radio aria-hidden="true" className="text-teal-800" />
          <h3 className="mt-3 text-2xl font-bold">人與 AI 共創</h3>
          <p className="mt-3 leading-7 text-slate-700">將語音對話和採訪整理成可編輯的知識與作品。廣播可製作 Podcast，教師可共編教材，地方團隊可保存故事，企業和創作者可整理品牌內容與短影音。</p>
          <ol className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-teal-900" aria-label="內容共創流程">
            {["對話發想", "協作執行", "整理知識", "交付作品"].map(step => (
              <li key={step} className="rounded-md bg-white px-3 py-2">{step}</li>
            ))}
          </ol>
          <h4 className="mt-6 font-semibold">偏鄉共學的 60 分鐘示範課</h4>
          <ol className="mt-2 divide-y divide-teal-200">
            {lesson.map(([time, title]) => (
              <li key={title} className="flex items-baseline gap-4 py-2 text-sm"><span className="shrink-0 font-semibold text-teal-900">{time}</span><span>{title}</span></li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl bg-[#eaf1fb] p-6 sm:p-8">
          <ShieldCheck aria-hidden="true" className="text-sky-800" />
          <h3 className="mt-3 text-2xl font-bold">資安與日本場域試點</h3>
          <p className="mt-3 leading-7 text-slate-700">以大阪為合作起點，優先規劃中小企業的 AI 權限與成本治理，以及教室和地方內容團隊的遠距共創。日本運算節點的部署、成本與維運模式仍待驗證。</p>
          <dl className="mt-5 space-y-4">
            <div className="rounded-lg bg-white p-4"><dt className="font-semibold">近期維運經驗</dt><dd className="mt-1 text-sm leading-6 text-slate-700">參考資料涵蓋版本更新、登入與 API 健康檢查、部署回證，以及服務重啟後的運作確認。</dd></div>
            <div className="rounded-lg bg-white p-4"><dt className="font-semibold">待驗證項目</dt><dd className="mt-1 text-sm leading-6 text-slate-700">完整備份還原演練、服務開機復原、更新覆蓋率及試點場域的成果驗收。</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}

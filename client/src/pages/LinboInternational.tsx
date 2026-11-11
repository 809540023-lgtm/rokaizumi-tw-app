import { PortalNavigation } from "@/components/PortalNavigation";
import { SiteFooter } from "@/components/SiteFooter";

const copy = {
  cn: {
    name: "林吟芝博士", headline: "企业 AI 战略与数字转型顾问",
    intro: "结合跨行业经营、机房运维与经济学研究，协助企业设计可衡量、可管理的 AI 工作流程。",
    jump: "查看 ABC_YPCloud 日本研发进度",
    strengths: ["核心优势", "跨行业经营与跨境商务", "企业级 AI 架构、模型路由和用量治理", "数字资产制度研究、成本与风险管理"],
    progress: "日本 AI 大脑研发方向与进度",
    brain: "在用户授权下整理可搜索的记忆，从同一入口协调多个工具，并设计权限、导出与删除机制。先验证会议、决议、跟进和回复这条工作流程。",
    stages: ["已有部分基础服务的更新与健康检查记录。", "已梳理设备角色、任务分工和本地与云端协作架构。", "端到端演示、任务成效、装置相容性与日本试点仍待验证。"],
    projects: ["项目与应用", "企业资安与 AI 治理", "日本商品跨境运营与品牌开发", "直播共创、餐饮运营、日文培训与数字资产研究"],
    contact: "联系林博",
  },
  ja: {
    name: "林吟芝 博士", headline: "企業向けAI戦略・デジタル変革アドバイザー",
    intro: "事業運営、データセンター運用、経済学の知見を生かし、成果とコストを測定できるAI業務フローを設計します。",
    jump: "ABC_YPCloudの日本での研究開発を見る",
    strengths: ["専門分野", "複数業界での事業運営と越境ビジネス", "企業向けAI基盤、モデルの振り分け、利用量管理", "デジタル資産の制度研究、コスト・リスク管理"],
    progress: "日本向けAIブレインの開発方針と進捗",
    brain: "利用者の許可に基づいて検索可能な記憶を整理し、複数のツールを一つの窓口から利用できるようにします。権限管理、エクスポート、削除を設計し、まず会議から決定事項の追跡、返信までの流れを検証します。",
    stages: ["一部の基盤サービスで更新と稼働確認の記録があります。", "端末の役割、タスク分担、ローカルとクラウドの連携を設計しています。", "一連の動作デモ、タスクの成果、端末の互換性、日本での実証は今後の検証項目です。"],
    projects: ["プロジェクトと活用分野", "企業のセキュリティとAIガバナンス", "日本商品の越境販売とブランド開発", "ライブ制作、飲食店運営、日本語研修、デジタル資産の研究"],
    contact: "お問い合わせ",
  },
  en: {
    name: "Dr. Lin Yin-Chih", headline: "Enterprise AI strategy and digital transformation",
    intro: "Dr. Lin draws on business operations, data center management, and economics to design AI workflows with measurable results and manageable costs.",
    jump: "See ABC_YPCloud’s R&D progress in Japan",
    strengths: ["Areas of expertise", "Cross-industry operations and cross-border commerce", "Enterprise AI infrastructure, model routing, and usage controls", "Digital asset research, cost analysis, and risk management"],
    progress: "AI brain R&D direction and progress in Japan",
    brain: "With user authorization, ABC_YPCloud aims to organize searchable memory, coordinate tools through one interface, and let users manage access, export data, and delete it. The first workflow to validate follows a meeting from decisions through follow-up and replies.",
    stages: ["Some infrastructure services have documented updates and health checks.", "Device roles, task coordination, and hybrid local and cloud architecture have been outlined.", "End-to-end demos, task outcomes, device compatibility, and a pilot in Japan still need validation."],
    projects: ["Projects and applications", "Enterprise security and AI governance", "Cross-border operations for Japanese products and brand development", "Live production, restaurant operations, Japanese training, and digital asset research"],
    contact: "Contact Dr. Lin",
  },
};

export function LinboInternational({ language }: { language: keyof typeof copy }) {
  const c = copy[language];
  return (
    <div className="min-h-screen bg-[#f2f6fa] text-slate-950">
      <PortalNavigation />
      <main>
        <header className="bg-[#061a33] px-5 py-14 text-white">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-4xl font-bold sm:text-6xl">{c.name}</h1>
            <p className="mt-3 text-xl text-sky-100">{c.headline}</p>
            <p className="mt-4 max-w-2xl leading-7 text-slate-200">{c.intro}</p>
            <a href="#abp-c" className="mt-6 inline-block rounded-lg bg-cyan-200 px-4 py-3 font-semibold text-[#061a33]">{c.jump}</a>
          </div>
        </header>
        <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
          <section className="rounded-xl bg-white p-6">
            <h2 className="text-2xl font-bold">{c.strengths[0]}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">{c.strengths.slice(1).map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <section id="abp-c" className="scroll-mt-4 rounded-xl bg-white p-6">
            <h2 className="text-2xl font-bold">ABC_YPCloud</h2>
            <h3 className="mt-2 text-lg font-semibold">{c.progress}</h3>
            <p className="mt-3 max-w-3xl leading-7">{c.brain}</p>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">{c.stages.map(item => <li key={item} className="rounded-lg bg-sky-50 p-4 leading-6">{item}</li>)}</ol>
          </section>
          <section className="rounded-xl bg-white p-6">
            <h2 className="text-2xl font-bold">{c.projects[0]}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">{c.projects.slice(1).map(item => <li key={item}>{item}</li>)}</ul>
            <a href="mailto:cia8885@gmail.com" className="mt-6 inline-block rounded-lg bg-[#07556c] px-4 py-3 font-semibold text-white">{c.contact}</a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

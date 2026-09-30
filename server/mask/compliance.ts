/**
 * 台灣化粧品法遵檢核引擎。
 *
 * 依《化粧品衛生安全管理法》第 10 條方向整理：面膜要賣回台灣，
 * 最大的風險不是物流，而是文案寫了「消炎」「抗痘」「美白」這類字眼。
 *
 * 三種輸出：
 *   1. scanText()     掃出所有命中（含原因與建議替代詞）
 *   2. sanitizeText() 自動改寫成合規說法
 *   3. checkLabels()  檢查中文標示 11 項法定要素
 *
 * ⚠️ 這不是法律意見。實際法遵仍以 TFDA 最新公告與個案認定為準，
 *    系統只能擋下已知的紅線並提醒缺件。
 */

export type Severity = "block" | "warn";

export interface ComplianceRule {
  id: string;
  severity: Severity;
  category: string;
  patterns: string[];
  reason: string;
  suggestions?: string[];
  requiresRegistration?: boolean;
}

export const BLOCKING_RULES: ComplianceRule[] = [
  {
    id: "MED-001",
    severity: "block",
    category: "醫療效能",
    patterns: ["治療", "療效", "根治", "痊癒", "醫治", "處方", "藥效", "對症"],
    reason: "涉及醫療效能宣稱，違反化粧品衛生安全管理法第 10 條第 2 項。",
    suggestions: ["日常保養", "維持肌膚健康"],
  },
  {
    id: "MED-002",
    severity: "block",
    category: "醫療效能",
    patterns: ["消炎", "抗菌", "殺菌", "抑菌", "除菌"],
    reason: "涉及醫療效能或殺菌宣稱，一般化粧品不得使用。",
    suggestions: ["舒緩肌膚不適感", "清潔肌膚", "維持肌膚潔淨"],
  },
  {
    id: "MED-003",
    severity: "block",
    category: "醫療效能",
    patterns: ["抗痘", "治痘", "除痘", "去粉刺", "痘痘肌改善"],
    reason: "抗痘屬特定用途化粧品（需查驗登記），未登記不得宣稱。",
    suggestions: ["調理肌膚油水平衡", "維持肌膚清爽"],
  },
  {
    id: "MED-004",
    severity: "block",
    category: "醫療效能",
    patterns: ["除疤", "去疤", "淡疤", "修復傷口", "癒合"],
    reason: "涉及皮膚修復與除疤之醫療效能宣稱。",
    suggestions: ["使肌膚平滑柔嫩"],
  },
  {
    id: "MED-005",
    severity: "block",
    category: "醫療效能",
    patterns: ["生髮", "育毛", "防止落髮", "健髮"],
    reason: "生髮屬醫療效能宣稱。",
    suggestions: ["維持頭皮清爽"],
  },
  {
    id: "MED-006",
    severity: "block",
    category: "醫療效能",
    patterns: ["減肥", "瘦身", "燃脂", "消脂", "豐胸", "增高"],
    reason: "涉及身體形塑之醫療效能宣稱。",
    suggestions: ["維持肌膚緊緻感"],
  },
  {
    id: "MED-007",
    severity: "block",
    category: "醫療效能",
    patterns: ["類固醇", "抗生素", "抗組織胺", "換膚", "微整", "注射", "麻醉"],
    reason: "涉及藥品或醫療行為詞彙。",
    suggestions: [],
  },
  {
    id: "MED-008",
    severity: "block",
    category: "醫療效能",
    patterns: ["皮膚炎", "異位性皮膚炎", "濕疹", "酒糟", "紅斑性狼瘡"],
    reason: "涉及疾病名稱，不得作為化粧品效能宣稱。",
    suggestions: ["敏感性肌膚適用"],
  },
  {
    id: "EXA-001",
    severity: "block",
    category: "誇大不實",
    patterns: ["100%有效", "百分之百", "保證有效", "絕對", "永久", "一次見效", "立即見效", "馬上見效"],
    reason: "誇大不實或無法佐證之效能宣稱。",
    suggestions: ["持續使用可維持肌膚狀態"],
  },
  {
    id: "EXA-002",
    severity: "block",
    category: "誇大不實",
    patterns: ["最有效", "第一品牌", "唯一", "全球第一", "No.1", "no.1"],
    reason: "最高級用語若無客觀佐證構成誇大。",
    suggestions: ["人氣熱銷", "日本熱賣"],
  },
  {
    id: "EXA-003",
    severity: "block",
    category: "誇大不實",
    patterns: ["無副作用", "零刺激", "絕不敏感", "零過敏", "完全無害"],
    reason: "無法保證之安全性宣稱。",
    suggestions: ["建議先做局部測試"],
  },
  {
    id: "EXA-004",
    severity: "block",
    category: "誇大不實",
    patterns: ["細胞再生", "幹細胞", "DNA修復", "基因修復", "排毒", "解毒", "深層排毒"],
    reason: "涉及生理機制之不實或誇大宣稱。",
    suggestions: ["維持肌膚彈性", "潔淨肌膚"],
  },
  {
    id: "EXA-005",
    severity: "block",
    category: "誇大不實",
    patterns: ["純天然無添加", "百分百天然", "零化學"],
    reason: "全成分天然之宣稱難以佐證，易構成誇大。",
    suggestions: ["含多種植物萃取成分"],
  },
  {
    id: "REG-001",
    severity: "block",
    category: "特定用途化粧品",
    patterns: ["美白", "淡斑", "去斑", "防曬", "隔離紫外線", "染髮", "燙髮", "止汗", "制臭"],
    reason: "屬特定用途化粧品，須先完成查驗登記取得許可字號方可宣稱。",
    suggestions: ["提亮膚色", "均勻膚色", "展現透亮感"],
    requiresRegistration: true,
  },
  {
    id: "REG-002",
    severity: "block",
    category: "特定用途化粧品",
    patterns: ["藥用", "醫美級", "醫美", "皮膚科醫師推薦"],
    reason: "「藥用」為日本醫藥部外品用語，在台灣易被認定為醫療效能；「醫美級」屬誇大。",
    suggestions: ["專業保養", "日本原裝進口"],
    requiresRegistration: true,
  },
];

export const WARNING_RULES: ComplianceRule[] = [
  {
    id: "WRN-001",
    severity: "warn",
    category: "產地",
    patterns: ["日本製", "日本原裝", "產地日本"],
    reason: "產地宣稱需與實際製造地相符，並保留進口報單佐證。",
  },
  {
    id: "WRN-002",
    severity: "warn",
    category: "促銷",
    patterns: ["限量", "最後一批", "即將完售"],
    reason: "限量／急迫性宣稱需有事實依據。",
  },
  {
    id: "WRN-003",
    severity: "warn",
    category: "特定族群",
    patterns: ["敏感肌", "孕婦", "嬰幼兒可用"],
    reason: "特定族群適用宣稱需有安全性評估支持，並加註建議諮詢醫師。",
  },
  {
    id: "WRN-004",
    severity: "warn",
    category: "認證",
    patterns: ["有機", "天然有機"],
    reason: "「有機」宣稱須有認證佐證。",
  },
];

/** 台灣化粧品中文標示的法定要素 */
export const REQUIRED_LABELS = [
  { key: "product_name", label: "產品名稱", note: "中文品名" },
  { key: "purpose", label: "用途", note: "例如：保濕、清潔" },
  { key: "usage_storage", label: "用法及保存方法", note: "使用方式、頻率、保存條件" },
  { key: "ingredients", label: "全成分", note: "依含量由高至低，中文或英文國際命名" },
  { key: "net_weight", label: "淨重、容量或數量", note: "例如 30mL/片、5片/盒" },
  { key: "manufacture_date", label: "製造日期或批號", note: "可擇一標示，需現場抄錄" },
  { key: "expiry_date", label: "有效期間或保存期限", note: "例如 3 年" },
  { key: "applicant", label: "製造或輸入業者名稱、地址、電話", note: "在台進口商資訊" },
  { key: "origin", label: "原產地", note: "例如日本" },
  { key: "license_no", label: "許可字號或登錄字號", note: "特定用途為許可證字號；一般化粧品為產品登錄字號" },
  { key: "precautions", label: "注意事項", note: "例如避免陽光直射、使用後不適請停用" },
] as const;

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: string;
  pattern: string;
  matched: string;
  index: number;
  reason: string;
  suggestions: string[];
  requiresRegistration: boolean;
  /** 這是在哪個欄位發現的（由呼叫端填入） */
  source?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 掃描一段文字裡所有違規／需注意的用語 */
export function scanText(
  text: string | null | undefined,
  rules: ComplianceRule[] = [...BLOCKING_RULES, ...WARNING_RULES],
): Finding[] {
  if (!text) return [];
  const haystack = String(text);
  const findings: Finding[] = [];

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(escapeRegExp(pattern), "gi");
      let match: RegExpExecArray | null;
      while ((match = re.exec(haystack)) !== null) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          category: rule.category,
          pattern,
          matched: match[0],
          index: match.index,
          reason: rule.reason,
          suggestions: rule.suggestions ?? [],
          requiresRegistration: rule.requiresRegistration ?? false,
        });
        // 零長度匹配保護
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

/** 自動改寫：把高風險字眼換成合規說法，並回報改了什麼 */
export function sanitizeText(text: string | null | undefined): {
  text: string;
  replacements: Array<{ from: string; to: string; ruleId: string }>;
} {
  if (!text) return { text: text ?? "", replacements: [] };

  const findings = scanText(text, BLOCKING_RULES);
  const parts: string[] = [];
  const replacements: Array<{ from: string; to: string; ruleId: string }> = [];
  let cursor = 0;

  for (const f of findings) {
    // 已經被前一個（較長的）規則吃掉的字串就跳過，避免重複替換
    if (f.index < cursor) continue;
    const replacement = f.suggestions[0] ?? "";
    parts.push(text.slice(cursor, f.index), replacement);
    cursor = f.index + f.matched.length;
    replacements.push({ from: f.matched, to: replacement, ruleId: f.ruleId });
  }
  parts.push(text.slice(cursor));

  return { text: parts.join(""), replacements };
}

export interface LabelCheckInput {
  nameZh?: string | null;
  ingredients?: string[] | null;
  volumeMl?: number | null;
  sheetsPerPack?: number | null;
  piecesPerBox?: number | null;
  shelfLifeMonths?: number | null;
  origin?: string | null;
  registrationNo?: string | null;
  purpose?: string | null;
  usage?: string | null;
  precautions?: string | null;
  manufactureDate?: string | null;
  applicant?: string | null;
}

export interface LabelChecklistItem {
  key: string;
  label: string;
  note: string;
  ok: boolean;
  blocking: boolean;
}

export function checkLabels(input: LabelCheckInput): {
  checklist: LabelChecklistItem[];
  missing: string[];
  missingBlocking: string[];
} {
  const has = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  const blockingKeys = new Set(["ingredients", "net_weight", "license_no", "applicant", "manufacture_date"]);

  const present: Record<string, boolean> = {
    product_name: has(input.nameZh) && !String(input.nameZh).includes("待 AI"),
    purpose: has(input.purpose),
    usage_storage: has(input.usage),
    ingredients: has(input.ingredients),
    net_weight: has(input.volumeMl) || has(input.sheetsPerPack) || has(input.piecesPerBox),
    manufacture_date: has(input.manufactureDate),
    expiry_date: has(input.shelfLifeMonths),
    applicant: has(input.applicant),
    origin: has(input.origin),
    license_no: has(input.registrationNo),
    precautions: has(input.precautions),
  };

  const checklist: LabelChecklistItem[] = REQUIRED_LABELS.map((item) => ({
    key: item.key,
    label: item.label,
    note: item.note,
    ok: Boolean(present[item.key]),
    blocking: blockingKeys.has(item.key),
  }));

  return {
    checklist,
    missing: checklist.filter((c) => !c.ok).map((c) => c.key),
    missingBlocking: checklist.filter((c) => !c.ok && c.blocking).map((c) => c.key),
  };
}

/** 各來源欄位的可讀名稱（報告裡用） */
export const SOURCE_LABELS: Record<string, string> = {
  nameZh: "商品名稱",
  nameJa: "日文品名",
  brand: "品牌",
  series: "系列",
  benefits: "包裝上的訴求文字",
  usageText: "包裝上的用法",
  cautionText: "包裝上的注意事項",
  visibleText: "照片中可見文字",
  copyTitle: "文案標題",
  copyBullets: "文案賣點",
  copyDescription: "商品說明",
  copySocial: "社群貼文",
  wholesaleCopy: "批發文案",
};

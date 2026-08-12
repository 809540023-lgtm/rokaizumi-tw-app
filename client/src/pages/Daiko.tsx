import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Link as LinkIcon, Package, ExternalLink } from "lucide-react";

// 國際運費級距（日圓）— 預估值，請依實際物流費率調整
const SHIPPING: Record<
  string,
  { label: string; note: string; tiers: { max: number; jpy: number }[] }
> = {
  ems: {
    label: "EMS（快速・含追蹤）",
    note: "約 3–6 天，含追蹤與基本保險",
    tiers: [
      { max: 500, jpy: 1450 },
      { max: 1000, jpy: 2150 },
      { max: 1500, jpy: 2850 },
      { max: 2000, jpy: 3550 },
      { max: 3000, jpy: 4750 },
      { max: 5000, jpy: 7150 },
    ],
  },
  air_small: {
    label: "航空小包（經濟・較慢）",
    note: "適合輕小件，約 7–14 天",
    tiers: [
      { max: 100, jpy: 720 },
      { max: 250, jpy: 1080 },
      { max: 500, jpy: 1560 },
      { max: 1000, jpy: 2520 },
      { max: 2000, jpy: 4320 },
    ],
  },
};

const JPY_TO_TWD = 0.21; // 參考匯率，可調整
const SERVICE_RATE = 0.05; // 代購服務費 5%

function shippingJPY(method: string, grams: number): number | null {
  const m = SHIPPING[method];
  if (!m) return null;
  for (const t of m.tiers) if (grams <= t.max) return t.jpy;
  return null; // 超重
}

export default function Daiko() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [priceJPY, setPriceJPY] = useState("");
  const [grams, setGrams] = useState("500");
  const [method, setMethod] = useState("ems");
  const [error, setError] = useState("");

  async function handleFetch() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/daiko/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      setFetched(data || {});
      if (!data || !data.ok) {
        setError((data && data.error) || "無法取得商品資訊，請手動填寫下方欄位。");
      } else {
        setTitle(data.title || "");
        setImage(data.image || "");
        if (data.priceJPY) setPriceJPY(String(data.priceJPY));
      }
    } catch (e) {
      setError("連線失敗，請手動填寫下方欄位。");
      setFetched({});
    }
    setLoading(false);
  }

  const p = Number(priceJPY) || 0;
  const g = Number(grams) || 0;
  const service = Math.round(p * SERVICE_RATE);
  const goods = p + service;
  const ship = shippingJPY(method, g);
  const totalJPY = ship == null ? null : goods + ship;
  const fmtJ = (n: number) => "¥" + n.toLocaleString();
  const twd = (n: number) => "NT$ " + Math.round(n * JPY_TO_TWD).toLocaleString();

  return (
    <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">日本代購・貼網址報價</h1>
          <p className="text-sm text-gray-500 mt-2">
            貼上任何日本商店的商品網址，立即試算「商品費用 ＋ 國際運費」
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-[#0ABAB5]" /> 商品網址
          </label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://item.rakuten.co.jp/..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0ABAB5]"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url}
              className="px-4 py-2 rounded-lg bg-[#0ABAB5] text-white font-bold text-sm disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? "讀取中..." : "取得商品資訊"}
            </button>
          </div>
          {error && <div className="text-xs text-amber-600 mt-2">{error}</div>}
        </div>

        {fetched && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-4">
            <div className="flex gap-4">
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="w-24 h-24 object-contain rounded-lg border border-gray-100 shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="商品名稱"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 shrink-0">商品日圓價</span>
                  <input
                    value={priceJPY}
                    onChange={(e) => setPriceJPY(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="例 2980"
                    className="w-32 px-2 py-1.5 border border-gray-200 rounded text-sm"
                  />
                  <span className="text-sm text-gray-400">円</span>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">預估重量（公克）</label>
                <input
                  value={grams}
                  onChange={(e) => setGrams(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">運送方式</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {Object.entries(SHIPPING).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">{SHIPPING[method].note}</p>

            <div className="mt-5 bg-[#FEF9F3] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">商品原價</span>
                <span>{fmtJ(p)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">代購服務費（5%）</span>
                <span>{fmtJ(service)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">國際運費</span>
                <span>{ship == null ? "超重，請洽詢" : fmtJ(ship)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
                <span className="font-bold">合計</span>
                <span className="text-right">
                  <span className="font-bold text-lg text-[#E26D5C]">
                    {totalJPY == null ? "—" : fmtJ(totalJPY)}
                  </span>
                  {totalJPY != null && (
                    <span className="block text-xs text-gray-500">約 {twd(totalJPY)}</span>
                  )}
                </span>
              </div>
            </div>

            <a
              href="https://line.me/R/ti/p/@rokaizumi"
              target="_blank"
              rel="noreferrer"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#06C755] text-white font-bold text-sm"
            >
              透過 LINE 確認下單 <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              ※ 運費為級距預估值，實際以包裹重量與當日物流費率為準；匯率參考 1 円 ≈ {JPY_TO_TWD}{" "}
              元。代購僅收取「商品費用 ＋ 國際運費」兩項。
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

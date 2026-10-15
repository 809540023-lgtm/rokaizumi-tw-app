import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Link as LinkIcon, Package, ExternalLink } from "lucide-react";
import { LINE_ADD_FRIEND_URL } from "@/lib/line";
import { useLanguage } from "@/contexts/LanguageContext";

// 國際運費級距（日圓）— 預估值，請依實際物流費率調整
// 顯示名稱與說明放在 LanguageContext 的 daiko.ship.*
const SHIPPING: Record<string, { tiers: { max: number; jpy: number }[] }> = {
  ems: {
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
    tiers: [
      { max: 100, jpy: 720 },
      { max: 250, jpy: 1080 },
      { max: 500, jpy: 1560 },
      { max: 1000, jpy: 2520 },
      { max: 2000, jpy: 4320 },
    ],
  },
};

const SHIP_LABEL_KEY: Record<string, string> = { ems: "daiko.ship.ems", air_small: "daiko.ship.air" };
const SHIP_NOTE_KEY: Record<string, string> = { ems: "daiko.ship.emsNote", air_small: "daiko.ship.airNote" };

const JPY_TO_TWD = 0.21; // 參考匯率，可調整
const SERVICE_RATE = 0.05; // 代購服務費 5%

function shippingJPY(method: string, grams: number): number | null {
  const m = SHIPPING[method];
  if (!m) return null;
  for (const t of m.tiers) if (grams <= t.max) return t.jpy;
  return null; // 超重
}

export default function Daiko() {
  const { t } = useLanguage();
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
        setError((data && data.error) || t("daiko.errFetch"));
      } else {
        setTitle(data.title || "");
        setImage(data.image || "");
        if (data.priceJPY) setPriceJPY(String(data.priceJPY));
      }
    } catch (e) {
      setError(t("daiko.errNetwork"));
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
          <h1 className="text-2xl md:text-3xl font-bold">{t("daiko.title")}</h1>
          <p className="text-sm text-gray-500 mt-2">{t("daiko.sub")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-bold mb-2 flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-[#0ABAB5]" /> {t("daiko.urlLabel")}
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
              {loading ? t("daiko.fetching") : t("daiko.fetch")}
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
                  placeholder={t("daiko.productName")}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 shrink-0">{t("daiko.priceJpy")}</span>
                  <input
                    value={priceJPY}
                    onChange={(e) => setPriceJPY(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={t("daiko.pricePlaceholder")}
                    className="w-32 px-2 py-1.5 border border-gray-200 rounded text-sm"
                  />
                  <span className="text-sm text-gray-400">円</span>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("daiko.grams")}</label>
                <input
                  value={grams}
                  onChange={(e) => setGrams(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("daiko.method")}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {Object.keys(SHIPPING).map(k => (
                    <option key={k} value={k}>
                      {t(SHIP_LABEL_KEY[k])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">{t(SHIP_NOTE_KEY[method])}</p>

            <div className="mt-5 bg-[#FEF9F3] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("daiko.goods")}</span>
                <span>{fmtJ(p)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("daiko.service")}</span>
                <span>{fmtJ(service)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("daiko.shipping")}</span>
                <span>{ship == null ? t("daiko.overweight") : fmtJ(ship)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between items-baseline">
                <span className="font-bold">{t("daiko.total")}</span>
                <span className="text-right">
                  <span className="font-bold text-lg text-[#E26D5C]">
                    {totalJPY == null ? "—" : fmtJ(totalJPY)}
                  </span>
                  {totalJPY != null && (
                    <span className="block text-xs text-gray-500">{t("daiko.approx")} {twd(totalJPY)}</span>
                  )}
                </span>
              </div>
            </div>

            <a
              href={LINE_ADD_FRIEND_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#06C755] text-white font-bold text-sm"
            >
              {t("daiko.lineCta")} <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
              {t("daiko.note1")}{JPY_TO_TWD}{t("daiko.note2")}
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * 成本與定價：日圓進貨價 → 台灣到岸成本 → 批發價／零售價。
 *
 * 這份模型是從口罩批發平台的做法搬過來的，重點在於兩個常被做錯的地方：
 *
 * 1. **整批算完再攤提成單件**，不要一開始就用單件去乘。
 *    國際運費、報關費、日本國內運費都是以「批」為單位，混在一起算會嚴重失真。
 * 2. **通路抽成不算進成本**，而是在「由目標毛利反推售價」時納入。
 *    這樣毛利率的定義才一致（毛利 = (淨收入 − 成本) / 淨收入）。
 */

export interface PricingParams {
  /** 日圓進貨單價 */
  supplierJpy: number;
  /** 一次進貨數量 */
  qty?: number;
  /** 每件重量（公斤），面膜含精華液大約 0.07–0.1 */
  weightKg?: number;
  /** 每件材積（立方公尺） */
  volumeM3?: number;
  /** 幾件裝一箱 */
  unitsPerParcel?: number;
}

export interface CostModel {
  fx: { fallbackJpyToTwd: number; bufferPct: number };
  import: {
    dutyRatePct: number;
    businessTaxPct: number;
    tradePromotionFeeRatePct: number;
    customsClearancePerShipmentTwd: number;
  };
  logistics: {
    jpDomesticPerParcelJpy: number;
    jpConsolidationPerKgJpy: number;
    intlFreightPerKgJpy: number;
    intlFreightMinJpy: number;
    volumetricDivisor: number;
    packagingPerUnitTwd: number;
    lossRatePct: number;
  };
  channelFees: Record<string, { commissionPct: number; paymentPct: number; fixedTwd: number }>;
  marginTargets: { wholesale: number; retail: number };
}

export const DEFAULT_COST_MODEL: CostModel = {
  fx: { fallbackJpyToTwd: 0.21, bufferPct: 2 },
  import: {
    // 面膜多歸 HS 3304/3307，實際稅率依稅則號別而定，請與報關行確認
    dutyRatePct: 2.5,
    businessTaxPct: 5,
    tradePromotionFeeRatePct: 0.0415,
    customsClearancePerShipmentTwd: 1200,
  },
  logistics: {
    jpDomesticPerParcelJpy: 700,
    jpConsolidationPerKgJpy: 300,
    intlFreightPerKgJpy: 1750,
    intlFreightMinJpy: 2600,
    volumetricDivisor: 6000,
    packagingPerUnitTwd: 8,
    lossRatePct: 2,
  },
  channelFees: {
    /** 自家網站：主要是金流手續費 */
    website: { commissionPct: 0, paymentPct: 2.8, fixedTwd: 0 },
    /** 批發／團媽：無抽成，但收款手續費抓一點 */
    wholesale: { commissionPct: 0, paymentPct: 0.5, fixedTwd: 0 },
  },
  marginTargets: { wholesale: 35, retail: 62 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function effectiveFxRate(rate: number, model: CostModel = DEFAULT_COST_MODEL): number {
  return round2(rate * (1 + model.fx.bufferPct / 100));
}

/** 心理價位：往上取到 0 / 5 / 9 結尾 */
export function psychologicalRound(value: number): number {
  if (value <= 0) return 0;
  const base = Math.floor(value / 10) * 10;
  let best: number | null = null;
  for (const decade of [base - 10, base, base + 10, base + 20]) {
    for (const suffix of [0, 5, 9]) {
      const candidate = decade + suffix;
      if (candidate < value) continue;
      if (best === null || candidate < best) best = candidate;
    }
  }
  return best ?? Math.ceil(value / 10) * 10;
}

export interface LandedCost {
  fxRate: number;
  qty: number;
  batch: Record<string, number>;
  perUnit: Record<string, number>;
  unitCostTwd: number;
  totalTwd: number;
  chargeableKg: number;
  parcels: number;
}

/** 計算整批的台灣到岸成本，並攤提成單件成本 */
export function computeLandedCost(
  params: PricingParams,
  fxRateJpyToTwd: number,
  model: CostModel = DEFAULT_COST_MODEL,
): LandedCost {
  const rate = effectiveFxRate(fxRateJpyToTwd, model);
  const units = Math.max(1, Math.round(params.qty ?? 600));
  const weightKg = params.weightKg ?? 0.075;
  const volumeM3 = params.volumeM3 ?? 0.0004;
  const unitsPerParcel = params.unitsPerParcel ?? 60;

  const goodsTwd = params.supplierJpy * units * rate;

  const totalWeightKg = weightKg * units;
  const totalVolumeM3 = volumeM3 * units;
  const volumetricKg = (totalVolumeM3 * 1_000_000) / model.logistics.volumetricDivisor;
  const chargeableKg = Math.max(totalWeightKg, volumetricKg, 0.5);

  const parcels = Math.max(1, Math.ceil(units / unitsPerParcel));
  const jpDomesticJpy = model.logistics.jpDomesticPerParcelJpy * parcels;
  const consolidationJpy = model.logistics.jpConsolidationPerKgJpy * chargeableKg;
  const intlJpy = Math.max(chargeableKg * model.logistics.intlFreightPerKgJpy, model.logistics.intlFreightMinJpy);

  const jpDomesticTwd = jpDomesticJpy * rate;
  const consolidationTwd = consolidationJpy * rate;
  const intlFreightTwd = intlJpy * rate;

  // 完稅價格 = 貨款 + 運費（國際＋日本端）
  const dutiableValueTwd = goodsTwd + intlFreightTwd + jpDomesticTwd + consolidationTwd;
  const dutyTwd = (dutiableValueTwd * model.import.dutyRatePct) / 100;
  const tradePromotionFeeTwd = (dutiableValueTwd * model.import.tradePromotionFeeRatePct) / 100;
  const businessTaxTwd = ((dutiableValueTwd + dutyTwd) * model.import.businessTaxPct) / 100;

  const packagingTwd = model.logistics.packagingPerUnitTwd * units;
  const clearanceTwd = model.import.customsClearancePerShipmentTwd;

  const subtotal =
    goodsTwd +
    intlFreightTwd +
    jpDomesticTwd +
    consolidationTwd +
    clearanceTwd +
    dutyTwd +
    tradePromotionFeeTwd +
    businessTaxTwd +
    packagingTwd;

  const lossTwd = (subtotal * model.logistics.lossRatePct) / 100;
  const total = subtotal + lossTwd;

  const per = (v: number) => round2(v / units);

  return {
    fxRate: rate,
    qty: units,
    batch: {
      goodsTwd: round2(goodsTwd),
      jpDomesticTwd: round2(jpDomesticTwd),
      consolidationTwd: round2(consolidationTwd),
      intlFreightTwd: round2(intlFreightTwd),
      dutyTwd: round2(dutyTwd),
      tradePromotionFeeTwd: round2(tradePromotionFeeTwd),
      businessTaxTwd: round2(businessTaxTwd),
      clearanceTwd: round2(clearanceTwd),
      packagingTwd: round2(packagingTwd),
      lossTwd: round2(lossTwd),
      totalTwd: round2(total),
    },
    perUnit: {
      goodsTwd: per(goodsTwd),
      jpDomesticTwd: per(jpDomesticTwd),
      consolidationTwd: per(consolidationTwd),
      intlFreightTwd: per(intlFreightTwd),
      dutyTwd: per(dutyTwd),
      tradePromotionFeeTwd: per(tradePromotionFeeTwd),
      businessTaxTwd: per(businessTaxTwd),
      clearanceTwd: per(clearanceTwd),
      packagingTwd: per(packagingTwd),
      lossTwd: per(lossTwd),
    },
    unitCostTwd: round2(total / units),
    totalTwd: round2(total),
    chargeableKg: Math.round(chargeableKg * 1000) / 1000,
    parcels,
  };
}

function channelFee(channel: string, model: CostModel) {
  return model.channelFees[channel] ?? { commissionPct: 0, paymentPct: 0, fixedTwd: 0 };
}

/** 由目標毛利率反推售價（淨收入要扣掉通路抽成） */
export function priceFromMargin(
  unitCostTwd: number,
  grossMarginPct: number,
  fee: { commissionPct: number; paymentPct: number; fixedTwd: number },
): number {
  const m = Math.min(Math.max(grossMarginPct, 1), 95) / 100;
  const netNeeded = unitCostTwd / (1 - m);
  const feePct = Math.min(Math.max((fee.commissionPct + fee.paymentPct) / 100, 0), 0.9);
  return (netNeeded + fee.fixedTwd) / (1 - feePct);
}

export function netRevenue(
  priceTwd: number,
  fee: { commissionPct: number; paymentPct: number; fixedTwd: number },
): number {
  return priceTwd * (1 - (fee.commissionPct + fee.paymentPct) / 100) - fee.fixedTwd;
}

export function marginFromPrice(
  unitCostTwd: number,
  priceTwd: number,
  fee: { commissionPct: number; paymentPct: number; fixedTwd: number },
): number {
  const net = netRevenue(priceTwd, fee);
  if (net <= 0) return -100;
  return ((net - unitCostTwd) / net) * 100;
}

export interface PricePlan {
  channel: string;
  wholesaleTwd: number;
  retailTwd: number;
  suggestedMsrpTwd: number;
  wholesaleMarginPct: number;
  retailMarginPct: number;
  retailNetTwd: number;
  retailProfitTwd: number;
}

/** 產生各通路的批發／零售價 */
export function buildPricePlans(
  unitCostTwd: number,
  model: CostModel = DEFAULT_COST_MODEL,
): PricePlan[] {
  return Object.keys(model.channelFees).map((channel) => {
    const fee = channelFee(channel, model);
    const wholesaleBase = priceFromMargin(unitCostTwd, model.marginTargets.wholesale, fee);
    const retailBase = priceFromMargin(unitCostTwd, model.marginTargets.retail, fee);

    let wholesale = psychologicalRound(wholesaleBase);
    let retail = psychologicalRound(retailBase);

    // 保底：批發價的淨收入不得低於 18% 毛利
    const minWholesale = psychologicalRound(priceFromMargin(unitCostTwd, 18, fee));
    if (wholesale < minWholesale) wholesale = minWholesale;

    // 零售價不得超過批發價的 3 倍，否則批發客會覺得被坑
    const cap = wholesale * 3;
    if (retail > cap) retail = psychologicalRound(cap);
    if (retail < wholesale) retail = wholesale;

    return {
      channel,
      wholesaleTwd: wholesale,
      retailTwd: retail,
      suggestedMsrpTwd: psychologicalRound(retail * 1.15),
      wholesaleMarginPct: round2(marginFromPrice(unitCostTwd, wholesale, fee)),
      retailMarginPct: round2(marginFromPrice(unitCostTwd, retail, fee)),
      retailNetTwd: round2(netRevenue(retail, fee)),
      retailProfitTwd: round2(netRevenue(retail, fee) - unitCostTwd),
    };
  });
}

/** 依面膜規格粗估單件重量（公克） */
export function estimateWeightGrams(input: { sheetsPerPack?: number | null; volumeMl?: number | null }): number {
  const sheets = input.sheetsPerPack ?? 1;
  const ml = input.volumeMl ?? 25;
  return Math.round(28 + sheets * (ml * 0.9) + 18);
}

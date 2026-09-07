import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPLIT,
  computeClientConcentration,
  computeOrderFinancials,
  computeRepBalance,
  isCriticallyLowMargin,
  isLowMargin,
  isValidSplit,
  normalizeSplitFromRepPct,
  splitTotal,
} from "./finance";

// أرقام حقيقية من seed-orders.csv (القسم 11 من الوثيقة: تحقق منها بأرقام حقيقية)
describe("computeOrderFinancials", () => {
  it("Dr. Mohammed Alqurashi: factoryCost=4916.14 clientPrice=5709.06", () => {
    const r = computeOrderFinancials(4916.14, 5709.06, 50);
    expect(r.profit).toBeCloseTo(792.92, 2);
    expect(r.profitExVat).toBeCloseTo(689.5, 2);
    expect(r.repShare).toBeCloseTo(344.75, 2);
    expect(r.vatDue).toBeCloseTo(103.42, 2);
  });

  it("شركة حقول الربيع للتجارة: factoryCost=86351.51 clientPrice=95130.3", () => {
    const r = computeOrderFinancials(86351.51, 95130.3, 50);
    expect(r.profit).toBeCloseTo(8778.79, 2);
    expect(r.profitExVat).toBeCloseTo(7633.73, 2);
    expect(r.repShare).toBeCloseTo(3816.87, 1);
    expect(r.marginPct).toBeCloseTo(9.229, 1);
  });

  it("عاطف عبد اللطيف: factoryCost=6055.39 clientPrice=11120.5 (هامش مرتفع)", () => {
    const r = computeOrderFinancials(6055.39, 11120.5, 50);
    expect(r.profit).toBeCloseTo(5065.11, 2);
    expect(r.profitExVat).toBeCloseTo(4404.44, 2);
    expect(r.repShare).toBeCloseTo(2202.22, 2);
    expect(r.marginPct).toBeGreaterThan(40);
  });

  it("رسام الشمال: factoryCost=2500.20 clientPrice=3863.77", () => {
    const r = computeOrderFinancials(2500.2, 3863.77, 50);
    expect(r.profit).toBeCloseTo(1363.57, 2);
    expect(r.profitExVat).toBeCloseTo(1185.71, 2);
    expect(r.repShare).toBeCloseTo(592.86, 2);
  });

  it("مجموع الحصص الأربع == الربح بعد الضريبة", () => {
    const r = computeOrderFinancials(1000, 1500, DEFAULT_SPLIT);
    expect(r.repShare + r.ownerShare + r.partnerShare + r.companyShare).toBeCloseTo(
      r.profitExVat,
      10,
    );
  });

  it("profit == profitExVat + vatDue", () => {
    const r = computeOrderFinancials(1000, 1500, 50);
    expect(r.profitExVat + r.vatDue).toBeCloseTo(r.profit, 10);
  });

  it("يعيد الحساب بنسبة مخصصة غير 50%، لا تستخدم 60% القديمة كافتراضي", () => {
    const r = computeOrderFinancials(1000, 1500, 60);
    expect(r.repSharePct).toBe(60);
    expect(r.repShare).toBeCloseTo(r.profitExVat * 0.6, 10);
  });
});

// نموذج صاحب العمل: المندوب الذي جاء بالعميل 50% · المالك 20% ·
// الشريك 20% · الشركة 10%
describe("توزيع الربح على أربع جهات", () => {
  it("التوزيع الافتراضي 50/20/20/10 مجموعه 100%", () => {
    expect(splitTotal(DEFAULT_SPLIT)).toBe(100);
    expect(isValidSplit(DEFAULT_SPLIT)).toBe(true);
  });

  it("يرفض توزيعًا لا يساوي 100%", () => {
    expect(isValidSplit({ repPct: 50, ownerPct: 20, partnerPct: 20, companyPct: 20 })).toBe(
      false,
    );
  });

  it("شام وقمر (تكلفة 4772.50 وسعر 5536.10): الحصص الأربع بأرقامها", () => {
    const r = computeOrderFinancials(4772.5, 5536.1, DEFAULT_SPLIT);
    expect(r.profit).toBeCloseTo(763.6, 2);
    expect(r.profitExVat).toBeCloseTo(664.0, 2);
    expect(r.repShare).toBeCloseTo(332.0, 2); // 50%
    expect(r.ownerShare).toBeCloseTo(132.8, 2); // 20%
    expect(r.partnerShare).toBeCloseTo(132.8, 2); // 20%
    expect(r.companyShare).toBeCloseTo(66.4, 2); // 10%
  });

  it("لا حصة للمندوب في صفقة بلا مندوب: 0/40/40/20 تبقى 100%", () => {
    const split = { repPct: 0, ownerPct: 40, partnerPct: 40, companyPct: 20 };
    const r = computeOrderFinancials(1000, 2150, split);
    expect(r.repShare).toBe(0);
    expect(r.repShare + r.ownerShare + r.partnerShare + r.companyShare).toBeCloseTo(
      r.profitExVat,
      10,
    );
  });

  it("normalizeSplitFromRepPct يبقي المجموع 100% لأي نسبة مندوب", () => {
    for (const repPct of [0, 25, 50, 60, 70, 100]) {
      const split = normalizeSplitFromRepPct(repPct);
      expect(split.repPct).toBe(repPct);
      expect(splitTotal(split)).toBeCloseTo(100, 10);
    }
  });

  it("نسبة مندوب 70% تترك 30% موزّعة بنفس تناسب 20/20/10", () => {
    const split = normalizeSplitFromRepPct(70);
    expect(split.ownerPct).toBeCloseTo(12, 6); // 20/50 × 30
    expect(split.partnerPct).toBeCloseTo(12, 6);
    expect(split.companyPct).toBeCloseTo(6, 6);
  });
});

describe("computeRepBalance", () => {
  it("balance = sum(repShare) - sum(withdrawals)", () => {
    expect(computeRepBalance(1000, 400)).toBe(600);
    expect(computeRepBalance(0, 100)).toBe(-100);
  });
});

describe("computeClientConcentration", () => {
  it("matches the ~32% top-client concentration noted in the spec", () => {
    // شركة حقول الربيع 100839.36 من إجمالي مبيعات ~317000
    const { topClientPct } = computeClientConcentration([100839.36], 317000);
    expect(topClientPct).toBeCloseTo(31.8, 0);
  });
});

describe("margin thresholds", () => {
  it("marks حقول الربيع (9.4%) as both low and critically low", () => {
    expect(isLowMargin(9.4)).toBe(true);
    expect(isCriticallyLowMargin(9.4)).toBe(true);
  });

  it("marks a 13.9% margin as fine (>=12%)", () => {
    expect(isLowMargin(13.9)).toBe(false);
  });

  it("11%-14% band: low margin (<12%) but not critical (<10%) only below 10", () => {
    expect(isLowMargin(11)).toBe(true);
    expect(isCriticallyLowMargin(11)).toBe(false);
  });
});

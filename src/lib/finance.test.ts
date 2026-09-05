import { describe, expect, it } from "vitest";
import {
  computeClientConcentration,
  computeOrderFinancials,
  computeRepBalance,
  isCriticallyLowMargin,
  isLowMargin,
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

  it("companyShare + repShare == profitExVat", () => {
    const r = computeOrderFinancials(1000, 1500, 50);
    expect(r.companyShare + r.repShare).toBeCloseTo(r.profitExVat, 10);
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

import { describe, expect, it } from "vitest";
import { quadrantCoord } from "@/lib/layout";
import { TIER_LIST, type Tier } from "@/lib/tiers";

/**
 * التخطيط يحكمه شرطان لا ثالث لهما: ألّا تتصادم نبتتان على خانة واحدة،
 * وألّا يتغيّر موضع نبتة بعد زرعها. الثاني هو الأخطر — نبتة تنتقل لأن الطالب
 * نال نقطة من فئة أخرى تعني مزرعة مختلفة في كل زيارة.
 */

const TIERS: Tier[] = TIER_LIST.map((t) => t.tier);

describe("تخطيط الأرباع", () => {
  it("لا تصادم بين ٢٠٠٠ نبتة", () => {
    const seen = new Map<string, string>();
    for (const tier of TIERS) {
      for (let n = 0; n < 500; n++) {
        const p = quadrantCoord(tier, n);
        const cell = `${p.x},${p.y}`;
        const prev = seen.get(cell);
        expect(prev, `${tier}#${n} يتصادم مع ${prev} عند ${cell}`).toBeUndefined();
        seen.set(cell, `${tier}#${n}`);
      }
    }
    expect(seen.size).toBe(TIERS.length * 500);
  });

  it("كل فئة داخل ربعها وحدها، ولا نبتة على المحورين", () => {
    for (const tier of TIERS) {
      const signs = new Set<string>();
      for (let n = 0; n < 300; n++) {
        const p = quadrantCoord(tier, n);
        expect(p.x, `${tier}#${n} على المحور`).not.toBe(0);
        expect(p.y, `${tier}#${n} على المحور`).not.toBe(0);
        signs.add(`${Math.sign(p.x)},${Math.sign(p.y)}`);
      }
      expect(signs.size, `${tier} تجاوز ربعه`).toBe(1);
    }
  });

  it("ينمو من المركز للخارج: القشرة لا تتراجع", () => {
    let prev = 0;
    for (let n = 0; n < 500; n++) {
      const p = quadrantCoord("green", n);
      const ring = Math.max(Math.abs(p.x), Math.abs(p.y));
      expect(ring).toBeGreaterThanOrEqual(prev);
      prev = ring;
    }
  });

  it("يرفض الترتيب السالب أو الكسري", () => {
    expect(() => quadrantCoord("green", -1)).toThrow(RangeError);
    expect(() => quadrantCoord("green", 1.5)).toThrow(RangeError);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(
  new URL("../client/src/pages/PortalHome.tsx", import.meta.url),
  "utf8"
);

describe("homepage LINE shop entry", () => {
  it("opens the existing static storefront in the same tab", () => {
    const entry = home.match(
      /<a\s[^>]*aria-label="LINE商店（代購）"[^>]*\/>/s
    )?.[0];
    expect(entry).toBeDefined();
    expect(entry).toContain('href="/line-shop/"');
    expect(entry).not.toContain('target="_blank"');
    expect(entry).not.toContain("nihon-mama-savebuy");
    expect(entry).toContain("top-[22.47%]");
    expect(entry).toContain("h-[10%]");
    expect(entry).not.toContain("min-h-10");
  });

  it.each([320, 390, 768, 1357])(
    "keeps the LINE hotspot on its image card at %ipx",
    width => {
      const height = (width * 770) / 1357;
      const top = height * 0.2247;
      const bottom = top + height * 0.1;
      const nextCardTop = (height * 260) / 770;
      expect(top).toBeCloseTo((height * 173) / 770, 0);
      expect(bottom).toBeLessThan(nextCardTop);
    }
  );

  it("does not expose the unfinished retail page", () => {
    expect(home).not.toContain('href="/products?category=hundred"');
    expect(home).not.toContain('aria-label="日本精美小商品（零售）"');
  });

  it("preserves the mother image, wholesale and the other ready entry destinations", () => {
    expect(home).toContain('src="/home/1793840233965.jpg"');
    for (const href of ["/ag", "/products?category=care", "/women"]) {
      expect(home).toContain(`href="${href}"`);
    }
  });
});

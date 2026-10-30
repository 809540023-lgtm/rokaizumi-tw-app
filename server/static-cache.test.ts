import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticCacheControl } from "./_core/vite";

const p = (...parts: string[]) => path.join("/srv/dist/public", ...parts);

describe("staticCacheControl", () => {
  it("讓帶雜湊的 /assets/ 檔案永久快取", () => {
    expect(staticCacheControl(p("assets", "index-DZmwNX1c.js"))).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(staticCacheControl(p("assets", "style-BHQJ6Gvn.css"))).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it("商品圖快取七天", () => {
    expect(staticCacheControl(p("line-shop", "img", "COSTCO-1.jpg"))).toBe(
      "public, max-age=604800"
    );
  });

  it("HTML、sw.js 與商品 JSON 維持預設，每次都要驗證", () => {
    expect(staticCacheControl(p("index.html"))).toBeNull();
    expect(staticCacheControl(p("sw.js"))).toBeNull();
    expect(staticCacheControl(p("products.json"))).toBeNull();
    expect(staticCacheControl(p("line-shop", "app.js"))).toBeNull();
    expect(staticCacheControl(p("line-shop", "style.css"))).toBeNull();
  });

  it("不會誤判名稱裡剛好有 assets 的檔案", () => {
    expect(staticCacheControl(p("my-assets-notes.json"))).toBeNull();
    expect(staticCacheControl(p("line-shop", "assets.txt"))).toBeNull();
  });
});

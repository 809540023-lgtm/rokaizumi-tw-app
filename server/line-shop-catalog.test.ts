import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import seed from "./public/line-shop-catalog.json";

/**
 * 商品圖以前外連到別人的測試站（roka-izumi-mask100-test.swannylo.chatgpt.site），
 * 對方關站整間店的商品圖就全掛。圖檔現在放在本站，這裡守住不要又貼回外部網址。
 */
describe("LINE 商店商品目錄", () => {
  const publicDir = path.resolve(import.meta.dirname, "..", "client", "public");

  it("沒有任何商品圖外連到第三方網站", () => {
    const external = seed
      .filter(p => typeof p.image === "string" && /^https?:\/\//.test(p.image))
      .map(p => `${p.id} → ${p.image}`);
    expect(external).toEqual([]);
  });

  it("沒有任何商品圖用內嵌 base64（會撐大 API 回應）", () => {
    const inline = seed
      .filter(p => typeof p.image === "string" && p.image.startsWith("data:"))
      .map(p => p.id);
    expect(inline).toEqual([]);
  });

  it("每一張本機商品圖都真的存在", () => {
    const missing = seed
      .filter(p => typeof p.image === "string" && p.image.startsWith("/"))
      .filter(p => !fs.existsSync(path.join(publicDir, p.image)))
      .map(p => `${p.id} → ${p.image}`);
    expect(missing).toEqual([]);
  });

  it("沒有圖片的商品維持 null，前台會顯示「商品照片準備中」", () => {
    const withoutImage = seed.filter(p => !p.image).map(p => p.id);
    expect(withoutImage.sort()).toEqual(["COSTCO-76872", "COSTCO-88665"]);
  });
});

import { describe, expect, it } from "vitest";
import { imgSrc, installImageFallback, proxySrc } from "@/lib/imageSrc";

const KOKUBO = "https://kokubo.co.jp/wp/wp-content/uploads/KC-302_01.jpg";

function withWindow(run: (fire: (target: unknown) => { stopped: boolean }) => void) {
  const listeners: Array<(event: any) => void> = [];
  (globalThis as any).window = {
    addEventListener: (_type: string, fn: (event: any) => void) => listeners.push(fn),
  };
  try {
    installImageFallback();
    run(target => {
      const event = { target, stopPropagation: () => (event.stopped = true), stopped: false };
      listeners.forEach(fn => fn(event));
      return event;
    });
  } finally {
    delete (globalThis as any).window;
  }
}

describe("product image sources", () => {
  it("keeps external URLs untouched so the browser can use the origin CDN", () => {
    expect(imgSrc(KOKUBO)).toBe(KOKUBO);
  });

  it("passes relative and non-http sources through", () => {
    expect(imgSrc("/line-shop/img/M001.webp")).toBe("/line-shop/img/M001.webp");
    expect(imgSrc("blob:https://rokaizumi-tw.jp/abc")).toBe(
      "blob:https://rokaizumi-tw.jp/abc"
    );
  });

  it("returns an empty string for a missing image", () => {
    expect(imgSrc(null)).toBe("");
    expect(imgSrc(undefined)).toBe("");
  });

  it("builds an encoded proxy URL for the retry", () => {
    const url = "https://www.yamadakagaku.co.jp/a b/圖.jpg?x=1&y=2";
    const proxied = proxySrc(url);
    expect(proxied.startsWith("/api/img?url=")).toBe(true);
    expect(decodeURIComponent(proxied.slice("/api/img?url=".length))).toBe(url);
    expect(proxied).not.toContain(" ");
  });

  it("does nothing when there is no window to listen on", () => {
    expect(() => installImageFallback()).not.toThrow();
  });

  it("retries a failed external image through the proxy", () => {
    withWindow(fire => {
      const image: any = { tagName: "IMG", src: KOKUBO, dataset: {} };
      const event = fire(image);
      expect(image.src).toBe(proxySrc(KOKUBO));
      expect(image.dataset.imgFallback).toBe(KOKUBO);
      // 這次失敗由攔截器接手，元件不該同時退成替代內容
      expect(event.stopped).toBe(true);
    });
  });

  it("does not retry the same image twice, nor retry a failed proxy response", () => {
    withWindow(fire => {
      const image: any = { tagName: "IMG", src: KOKUBO, dataset: {} };
      fire(image);
      const retried = image.src;
      const second = fire(image);
      expect(image.src).toBe(retried);
      expect(second.stopped).toBe(false);
    });
  });

  it("gives a different image its own rescue attempt", () => {
    withWindow(fire => {
      const image: any = { tagName: "IMG", src: KOKUBO, dataset: { imgFallback: KOKUBO } };
      const other = "https://kaigo.itembox.design/item/other.jpg";
      image.src = other;
      fire(image);
      expect(image.src).toBe(proxySrc(other));
    });
  });

  it("ignores failures that are not external images", () => {
    withWindow(fire => {
      const script = { tagName: "SCRIPT", src: "https://cdn.example/x.js", dataset: {} };
      fire(script);
      expect(script.src).toBe("https://cdn.example/x.js");

      const local: any = { tagName: "IMG", src: "/line-shop/img/M001.webp", dataset: {} };
      const event = fire(local);
      expect(local.src).toBe("/line-shop/img/M001.webp");
      expect(event.stopped).toBe(false);
    });
  });
});

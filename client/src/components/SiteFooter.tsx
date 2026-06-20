import { Link } from "wouter";

export function SiteFooter() {
  return (
    <footer className="bg-[#2B2B2B] text-gray-300 mt-12">
      <div className="container mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="font-bold text-white text-lg mb-2">ろかいずみ合同会社</div>
          <p className="text-sm leading-relaxed">日本介護用品專賣・大阪直送台灣</p>
          <p className="text-sm mt-2">
            〒532-0011
            <br />
            大阪市淀川区西中島六丁目10番1の502
          </p>
        </div>
        <div>
          <div className="font-bold text-white mb-3">快速連結</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/products">全部商品</Link>
            </li>
            <li>
              <Link href="/guides">選購指南</Link>
            </li>
            <li>
              <Link href="/b2b">企業合作</Link>
            </li>
            <li>
              <Link href="/about">關於我們</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="font-bold text-white mb-3">客戶服務</div>
          <ul className="space-y-2 text-sm">
            <li>正品保證・安全送達</li>
            <li>專業包裝</li>
            <li>快速配送</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ろかいずみ合同会社. All rights reserved.
      </div>
    </footer>
  );
}

export default SiteFooter;

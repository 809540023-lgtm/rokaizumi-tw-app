import { Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-6 h-6 text-[#E26D5C] fill-[#E26D5C]" />
            <span className="font-bold text-lg">ろかいずみ合同会社</span>
          </div>
          <p className="text-sm text-gray-500">日本介護用品專賣・大阪直送台灣</p>
          <p className="text-sm text-gray-500">大阪市淀川区西中島六丁目10番1の502</p>
          <p className="text-xs text-gray-400 mt-4">
            © 2026 ろかいずみ合同会社. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;

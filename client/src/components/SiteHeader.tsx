import { useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingCart, Building2, LogIn, Heart, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const LANGS: { code: "zh" | "cn" | "ja" | "en"; label: string }[] = [
  { code: "zh", label: "繁中" },
  { code: "cn", label: "简中" },
  { code: "ja", label: "日本語" },
  { code: "en", label: "EN" },
];

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-1.5 py-1">
      <Globe className="w-4 h-4 text-gray-400" />
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code as any)}
          className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
            language === l.code ? "bg-[#0ABAB5] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

interface SiteHeaderProps {
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
}

export function SiteHeader({ searchQuery = "", onSearchChange, onSearchSubmit }: SiteHeaderProps) {
  const [local, setLocal] = useState(searchQuery);
  const value = onSearchChange ? searchQuery : local;
  const setValue = (v: string) => {
    if (onSearchChange) onSearchChange(v);
    else setLocal(v);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 h-[72px] flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Heart className="w-7 h-7 text-[#E26D5C] fill-[#E26D5C]" />
          <div className="leading-tight">
            <div className="font-bold text-lg">ろかいずみ合同会社</div>
            <div className="text-xs text-gray-500">日本介護用品專賣</div>
          </div>
        </Link>

        <form
          className="flex-1 max-w-2xl hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (onSearchSubmit) onSearchSubmit();
          }}
        >
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="搜尋商品..."
            className="bg-transparent flex-1 outline-none text-sm"
          />
        </form>

        <nav className="flex items-center gap-2 ml-auto">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/b2b"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E26D5C] text-[#E26D5C] text-sm font-bold"
          >
            <Building2 className="w-4 h-4" /> 企業合作
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold"
          >
            <LogIn className="w-4 h-4" /> 登入
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ABAB5] text-white text-sm font-bold"
          >
            <ShoppingCart className="w-4 h-4" /> 購物車
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;

import { useState } from "react";
import { Link } from "wouter";
import { Search, ShoppingCart, Building2, LogIn, LogOut, User, Heart, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { MobileMenu } from "@/components/MobileMenu";

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
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { itemCount } = useCart();
  const value = onSearchChange ? searchQuery : local;
  const setValue = (v: string) => {
    if (onSearchChange) onSearchChange(v);
    else setLocal(v);
  };

  const handleLogout = () => {
    try {
      if (typeof logout === "function") logout();
    } catch (e) {
      /* ignore */
    }
    setTimeout(() => {
      window.location.href = "/";
    }, 200);
  };

  const cycleLanguage = () => {
    const currentIndex = LANGS.findIndex(lang => lang.code === language);
    setLanguage(LANGS[(currentIndex + 1) % LANGS.length].code);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 h-[72px] flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Heart className="w-7 h-7 text-[#E26D5C] fill-[#E26D5C]" />
          <div className="leading-tight">
            <div className="font-bold text-lg">ろかいずみ</div>
            <div className="text-xs text-gray-500">日本介護用品專賣</div>
          </div>
        </Link>

        <form
          className="hidden max-w-2xl flex-1 items-center rounded-full bg-gray-100 px-4 py-2 lg:flex"
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

        <nav className="ml-auto hidden items-center gap-2 lg:flex">
          <div>
            <LanguageSwitcher />
          </div>
          <Link
            href="/ag"
            className="flex items-center gap-1.5 rounded-lg bg-[#0ABAB5]/10 px-3 py-2 text-sm font-bold text-[#087F7B]"
          >
            22元商品
          </Link>
          <Link
            href="/daiko"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E26D5C]/10 text-[#E26D5C] text-sm font-bold"
          >
            代購
          </Link>
          <Link
            href="/b2b"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E26D5C] text-[#E26D5C] text-sm font-bold"
          >
            <Building2 className="w-4 h-4" /> 企業合作
          </Link>

          {user ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/manage"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ABAB5]/10 text-[#0ABAB5] text-sm font-bold"
                >
                  後台
                </Link>
              )}
              <Link
                href="/profile"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-gray-700 max-w-[160px]"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate">{user.name || user.email}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold"
              >
                <LogOut className="w-4 h-4" /> 登出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold"
            >
              <LogIn className="w-4 h-4" /> 登入
            </Link>
          )}

          <Link
            href="/cart"
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ABAB5] text-white text-sm font-bold"
            aria-label={`購物車，${itemCount} 件商品`}
          >
            <ShoppingCart className="w-4 h-4" /> 購物車
            {itemCount > 0 && (
              <span className="min-w-5 rounded-full bg-white px-1.5 py-0.5 text-center text-xs leading-none text-[#089B96]">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={cycleLanguage}
            className="flex items-center gap-1 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Change language"
            title="Change language"
          >
            <Globe className="h-4 w-4" />
            <span className="text-xs font-bold">{LANGS.find(lang => lang.code === language)?.label}</span>
          </button>
          <Link
            href="/cart"
            className="relative rounded-lg p-2 text-[#089B96] hover:bg-[#0ABAB5]/10"
            aria-label={`購物車，${itemCount} 件商品`}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#DC2626] px-1 text-center text-[10px] font-bold leading-5 text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;

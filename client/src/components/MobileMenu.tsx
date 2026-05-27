import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { language, t } = useLanguage();

  const menuItems = [
    { href: '/', label: t('nav.home') || 'ホーム' },
    { href: '/products', label: t('products.allProducts') || 'すべての商品' },
    { href: '/cart', label: t('nav.cart') || 'カート' },
  ];

  return (
    <div className="md:hidden">
      {/* 漢堡按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* 下拉菜單 */}
      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white shadow-lg border-t border-gray-200 z-50">
          <nav className="flex flex-col">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

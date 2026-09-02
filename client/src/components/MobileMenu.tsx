import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '@/hooks/useCart';

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();
  const { itemCount } = useCart();

  const menuItems = [
    { href: '/', label: t('nav.home') || 'ホーム' },
    { href: '/products', label: t('products.allProducts') || 'すべての商品' },
    { href: '/ag', label: '山田化學 NT$22' },
    {
      href: '/cart',
      label: `${t('nav.cart') || 'カート'}${itemCount > 0 ? ` (${itemCount})` : ''}`,
    },
  ];

  return (
    <div className="relative">
      {/* 漢堡按鈕 */}
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* 下拉菜單 */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <nav id="mobile-navigation" className="flex flex-col" aria-label="Mobile navigation">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

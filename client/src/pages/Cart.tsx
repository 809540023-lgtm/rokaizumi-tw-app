import { Link, useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { useAuth } from '../_core/hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Loader2, Minus, Plus, Trash2, ShoppingBag, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { getLoginUrl } from '../const';

export default function Cart() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const utils = trpc.useUtils();

  const { data: cartItems, isLoading } = trpc.cart.list.useQuery(undefined, {
    enabled: !!user,
  });

  const updateQuantityMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => {
      utils.cart.list.invalidate();
      toast.success('數量已更新');
    },
    onError: () => {
      toast.error('更新失敗');
    },
  });

  const removeItemMutation = trpc.cart.remove.useMutation({
    onSuccess: () => {
      utils.cart.list.invalidate();
      toast.success('商品已移除');
    },
    onError: () => {
      toast.error('移除失敗');
    },
  });

  const toggleLanguage = () => {
    if (language === 'zh') {
      setLanguage('en');
    } else if (language === 'en') {
      setLanguage('ja');
    } else {
      setLanguage('zh');
    }
  };

  const getLanguageLabel = () => {
    switch (language) {
      case 'zh': return '中文';
      case 'en': return 'EN';
      case 'ja': return '日本語';
      default: return '中文';
    }
  };

  const handleUpdateQuantity = (id: number, currentQuantity: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 1) return;
    updateQuantityMutation.mutate({ id, quantity: newQuantity });
  };

  const handleRemoveItem = (id: number) => {
    if (confirm(language === 'zh' ? '確定要移除此商品嗎？' : 'Are you sure you want to remove this item?')) {
      removeItemMutation.mutate({ id });
    }
  };

  const totalAmount = cartItems?.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0) || 0;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef9f3]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <a className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    ろ
                  </div>
                  <span className="text-2xl font-bold text-[#0ABAB5]">
                    {t('home.company')}
                  </span>
                </a>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {getLanguageLabel()}
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            {language === 'zh' ? '請先登入' : 'Please Login First'}
          </h2>
          <p className="text-gray-600 mb-8">
            {language === 'zh' ? '您需要登入才能查看購物車' : 'You need to login to view your cart'}
          </p>
          <a
            href={getLoginUrl()}
            className="inline-block bg-[#DC2626] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#B91C1C] transition-colors"
          >
            {language === 'zh' ? '立即登入' : 'Login Now'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  ろ
                </div>
                <span className="text-2xl font-bold text-[#0ABAB5]">
                  {t('home.company')}
                </span>
              </a>
            </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <Link href="/">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.home')}</a>
                </Link>
                <Link href="/products">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.products')}</a>
                </Link>
                <Link href="/videos">
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.videos')}</a>
                </Link>
                <Link href="/cart">
                  <a className="text-[#0ABAB5] font-semibold">{t('nav.cart')}</a>
                </Link>
              </nav>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {getLanguageLabel()}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Cart Content */}
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">{t('cart.title')}</h1>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
          </div>
        ) : !cartItems || cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold mb-4 text-gray-900">{t('cart.empty')}</h2>
            <Link href="/products">
              <a className="inline-block bg-[#DC2626] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#B91C1C] transition-colors">
                {t('cart.startShopping')}
              </a>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
                          📦
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2 text-gray-900">
                        {item.product?.name}
                      </h3>
                      <p className="text-2xl font-bold text-[#DC2626] mb-4">
                        ${item.product?.price}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                            disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-12 text-center font-semibold text-gray-900">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                            disabled={updateQuantityMutation.isPending}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removeItemMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('cart.remove')}
                        </Button>
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">{t('cart.subtotal')}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(item.product?.price || 0) * item.quantity}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
                <h2 className="text-xl font-bold mb-6 text-gray-900">
                  {language === 'zh' ? '訂單摘要' : 'Order Summary'}
                </h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>{t('cart.subtotal')}</span>
                    <span>${totalAmount}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                    <span>{t('cart.total')}</span>
                    <span className="text-[#DC2626]">${totalAmount}</span>
                  </div>
                </div>

                <Button
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white py-6 text-lg font-semibold"
                  onClick={() => setLocation('/checkout')}
                >
                  {t('cart.checkout')}
                </Button>

                <Link href="/products">
                  <a className="block text-center mt-4 text-[#0ABAB5] hover:text-[#089B96] font-semibold">
                    {t('cart.continueShopping')}
                  </a>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

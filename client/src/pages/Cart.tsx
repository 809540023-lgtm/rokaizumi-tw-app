import { Link, useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_CART_QUANTITY, useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/price';
import { ProductImage } from '@/components/ProductImage';
import { SiteHeader } from '@/components/SiteHeader';

export default function Cart() {
  const [, setLocation] = useLocation();
  const { language, t } = useLanguage();
  // 購物車存在瀏覽器本機，不需要登入也不依賴資料庫
  const { lines: cartItems, setQuantity, remove, total: totalAmount } = useCart();

  const handleUpdateQuantity = (productId: number, currentQuantity: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 1) return;
    setQuantity(productId, newQuantity);
    toast.success('數量已更新');
  };

  const handleRemoveItem = (productId: number) => {
    if (confirm((language === 'zh' || language === 'cn') ? '確定要移除此商品嗎？' : 'Are you sure you want to remove this item?')) {
      remove(productId);
      toast.success('商品已移除');
    }
  };

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      <SiteHeader />

      {/* Cart Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <h1 className="mb-6 text-3xl font-bold text-gray-900 sm:mb-8 sm:text-4xl">{t('cart.title')}</h1>

        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold mb-4 text-gray-900">{t('cart.empty')}</h2>
            <Link href="/products" className="inline-block bg-[#DC2626] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#B91C1C] transition-colors">
                {t('cart.startShopping')}
              </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.productId} className="bg-white rounded-lg shadow-sm p-3 sm:p-6">
                  <div className="flex gap-3 sm:gap-6">
                    {/* Product Image */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {<ProductImage src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/product/${item.productId}`} className="block">
                        <h2 className="mb-1.5 text-sm font-bold text-gray-900 hover:text-[#0ABAB5] sm:mb-2 sm:text-lg">
                          {item.name}
                        </h2>
                      </Link>
                      <p className="text-lg sm:text-2xl font-bold text-[#DC2626] mb-2 sm:mb-4">
                        {formatPrice(item.price, language)}
                      </p>
                      <p className="mb-2 text-sm text-gray-600 sm:hidden">
                        {t('cart.subtotal')}: <span className="font-semibold text-gray-900">{formatPrice(item.price * item.quantity, language)}</span>
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity, -1)}
                            disabled={item.quantity <= 1}
                            aria-label={`減少 ${item.name} 的數量`}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-12 text-center font-semibold text-gray-900" aria-live="polite">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity, 1)}
                            disabled={item.quantity >= MAX_CART_QUANTITY}
                            aria-label={`增加 ${item.name} 的數量`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.productId)}
                          aria-label={`${t('cart.remove')} ${item.name}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('cart.remove')}
                        </Button>
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-sm text-gray-600 mb-1">{t('cart.subtotal')}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPrice(item.price * item.quantity, language)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 sticky top-24">
                <h2 className="text-xl font-bold mb-6 text-gray-900">
                  {(language === 'zh' || language === 'cn') ? '訂單摘要' : 'Order Summary'}
                </h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between gap-3 text-gray-600">
                    <span>{t('cart.subtotal')}</span>
                    <span>{formatPrice(totalAmount, language)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between gap-3 text-lg sm:text-xl font-bold text-gray-900">
                    <span>{t('cart.total')}</span>
                    <span className="text-[#DC2626]">{formatPrice(totalAmount, language)}</span>
                  </div>
                </div>

                <Button
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white py-6 text-lg font-semibold"
                  onClick={() => setLocation('/checkout')}
                >
                  {t('cart.checkout')}
                </Button>

                <Link href="/products" className="block text-center mt-4 text-[#0ABAB5] hover:text-[#089B96] font-semibold">
                    {t('cart.continueShopping')}
                  </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

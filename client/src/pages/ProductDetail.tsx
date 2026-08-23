import { useRoute, Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { formatPrice } from '@/lib/price';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Loader2, Share2, Facebook, Twitter, MessageCircle, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { MAX_CART_QUANTITY, useCart } from '@/hooks/useCart';
import { SiteHeader } from '@/components/SiteHeader';
// ReviewSection removed per user request

export default function ProductDetail() {
  const [, params] = useRoute('/product/:productId');
  const { language, t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { add: addToCart, lines: cartLines } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  
  const parsedProductId = Number(params?.productId);
  const productId = Number.isSafeInteger(parsedProductId) && parsedProductId > 0 ? parsedProductId : 0;
  
  const { data: product, isLoading } = trpc.products.getById.useQuery(
    { id: productId },
    { enabled: productId > 0 }
  );
  const { data: relatedProducts = [] } = trpc.products.list.useQuery();

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl || undefined,
      },
      quantity
    );
    toast.success(t('cart.addSuccess') || '已加入購物車');
    setQuantity(1);
  };

  const handleShare = () => {
    if (!product) return;
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${product.name}` 
      : language === 'en'
      ? `Check out this product: ${product.name}`
      : `この商品をチェック：${product.name}`;

    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: shareText,
        url: productUrl,
      }).catch(() => {
        // Fallback if user cancels
      });
    } else {
      if (!navigator.clipboard) {
        toast.error((language === 'zh' || language === 'cn') ? '此瀏覽器無法複製連結' : 'Copying links is not supported by this browser');
        return;
      }
      navigator.clipboard.writeText(productUrl)
        .then(() => toast.success((language === 'zh' || language === 'cn') ? '已複製產品連結' : 'Product link copied'))
        .catch(() => toast.error((language === 'zh' || language === 'cn') ? '無法複製產品連結' : 'Could not copy product link'));
    }
  };

  const handleShareToFacebook = () => {
    if (!product) return;
    const productUrl = `${window.location.origin}/product/${productId}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleShareToTwitter = () => {
    if (!product) return;
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${product.name}` 
      : language === 'en'
      ? `Check out this product: ${product.name}`
      : `この商品をチェック：${product.name}`;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleShareToLine = () => {
    if (!product) return;
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${product.name}` 
      : language === 'en'
      ? `Check out this product: ${product.name}`
      : `この商品をチェック：${product.name}`;
    const lineUrl = `https://line.me/R/msg/0/?${encodeURIComponent(shareText + ' ' + productUrl)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  };

  const addToWishlistMutation = trpc.wishlist.add.useMutation({
    onSuccess: () => {
      toast.success((language === 'zh' || language === 'cn') ? '已加入願望清單' : 'Added to wishlist');
    },
    onError: (error: any) => {
      toast.error(error.message || ((language === 'zh' || language === 'cn') ? '加入願望清單失敗' : 'Failed to add to wishlist'));
    },
  });

  const handleAddToWishlist = () => {
    if (!isAuthenticated) {
      toast.error((language === 'zh' || language === 'cn') ? '請先登入' : 'Please log in first');
      return;
    }
    addToWishlistMutation.mutate({ productId });
  };

  useEffect(() => {
    setQuantity(1);
    setSelectedImageIndex(0);
    setShareOpen(false);
  }, [productId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fef9f3]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">
            {(language === 'zh' || language === 'cn') ? '產品未找到' : 'Product Not Found'}
          </h2>
          <Link href="/products" className="inline-block bg-[#0ABAB5] text-white px-6 py-2 rounded-lg hover:bg-[#089B96]">
              {(language === 'zh' || language === 'cn') ? '返回產品列表' : 'Back to Products'}
            </Link>
        </div>
      </div>
    );
  }

  const filteredRelated = relatedProducts
    .filter(p => p.id !== productId && p.categoryId === product.categoryId)
    .slice(0, 4);
  const productImages = [product.imageUrl, ...(product.images || [])]
    .filter((image): image is string => typeof image === 'string' && image.length > 0)
    .filter((image, index, images) => images.indexOf(image) === index);
  const quantityInCart = cartLines.find(line => line.productId === product.id)?.quantity ?? 0;
  const maxQuantity = Math.min(
    MAX_CART_QUANTITY - quantityInCart,
    product.stock === undefined ? MAX_CART_QUANTITY - quantityInCart : product.stock - quantityInCart
  );
  const selectorMax = Math.max(1, maxQuantity);
  const isUnavailable = product.status !== 'available' || maxQuantity < 1;

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      <SiteHeader />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/" className="hover:text-[#0ABAB5]">{t('nav.home')}</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#0ABAB5]">{t('nav.products')}</Link>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </div>
      </div>

      {/* Product Detail */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 mb-12">
          {/* Product Images */}
          <div className="flex flex-col gap-4">
            {/* Main Image */}
            <div className="w-full aspect-square bg-white rounded-lg shadow-sm overflow-hidden flex items-center justify-center">
              {(() => {
                const currentImage = productImages[selectedImageIndex] || productImages[0];
                return currentImage ? (
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="text-6xl text-gray-400">📦</div>
                );
              })()}
            </div>
            
            {/* Thumbnail Gallery */}
            {productImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {productImages.map((img, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`查看 ${product.name} 圖片 ${index + 1}`}
                      aria-pressed={selectedImageIndex === index}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedImageIndex === index ? 'border-[#0ABAB5]' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} - ${index + 1}`}
                        className="w-full h-full object-contain p-4"
                      />
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">{product.name}</h1>
            
            <div className="mb-6">
              <p className="text-4xl font-bold text-[#DC2626] mb-3">
                {formatPrice(product.price, language)}
              </p>
              {/* Stock Status */}
              <div className="flex items-center gap-2">
                {product.stock !== undefined && (
                  <>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      product.stock > product.lowStockThreshold 
                        ? 'bg-green-100 text-green-800' 
                        : product.stock > 0 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.stock > 0 
                        ? ((language === 'zh' || language === 'cn') ? `庫存: ${product.stock}` : `Stock: ${product.stock}`)
                        : ((language === 'zh' || language === 'cn') ? '缺貨' : 'Out of Stock')
                      }
                    </span>
                    {product.stock <= product.lowStockThreshold && product.stock > 0 && (
                      <span className="text-xs text-orange-600 font-semibold">
                        {(language === 'zh' || language === 'cn') ? '⚠️ 庫存即將用盡' : '⚠️ Low Stock'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <p className="text-gray-700 mb-6 leading-relaxed">
              {product.description}
            </p>

            {product.specifications && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">{(language === 'zh' || language === 'cn') ? '規格' : 'Specifications'}</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{product.specifications}</p>
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                {(language === 'zh' || language === 'cn') ? '數量' : 'Quantity'}
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setQuantity(current => Math.max(1, current - 1))}
                  disabled={isUnavailable || quantity <= 1}
                  aria-label="減少數量"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={selectorMax}
                  disabled={isUnavailable}
                  value={quantity}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setQuantity(Number.isFinite(next) ? Math.min(selectorMax, Math.max(1, Math.floor(next))) : 1);
                  }}
                  aria-label={(language === 'zh' || language === 'cn') ? '數量' : 'Quantity'}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(current => Math.min(selectorMax, current + 1))}
                  disabled={isUnavailable || quantity >= selectorMax}
                  aria-label="增加數量"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={isUnavailable}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white py-6 text-lg font-semibold flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" />
              {isUnavailable
                ? ((language === 'zh' || language === 'cn') ? '缺貨' : 'Out of Stock')
                : ((language === 'zh' || language === 'cn') ? '加入購物車' : 'Add to Cart')
              }
            </Button>

            {/* Action Buttons - Wishlist and Share */}
            <div className="flex gap-2 mb-4">
              <Button
                onClick={handleAddToWishlist}
                disabled={addToWishlistMutation.isPending}
                variant="outline"
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                {(language === 'zh' || language === 'cn') ? '加入願望清單' : 'Add to Wishlist'}
              </Button>
              <div className="relative flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  aria-haspopup="menu"
                  aria-expanded={shareOpen}
                  onClick={() => setShareOpen(open => !open)}
                >
                  <Share2 className="w-4 h-4" />
                  {(language === 'zh' || language === 'cn') ? '分享' : 'Share'}
                </Button>
                {shareOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48" role="menu">
                  <button
                    type="button"
                    onClick={() => handleShareToFacebook()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Facebook</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareToTwitter()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <Twitter className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Twitter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareToLine()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">LINE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                    <span className="text-sm">{(language === 'zh' || language === 'cn') ? '更多' : 'More'}</span>
                  </button>
                  </div>
                )}
              </div>
            </div>

            <Link href="/products" className="block text-center text-[#0ABAB5] hover:text-[#089B96] font-semibold py-2">
                {(language === 'zh' || language === 'cn') ? '繼續購物' : 'Continue Shopping'}
              </Link>
          </div>
        </div>

        {/* Related Products */}
        {filteredRelated.length > 0 && (
          <div className="mb-12 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">
                {(language === 'zh' || language === 'cn') ? '✨ 相關商品推薦' : '✨ Related Products'}
              </h2>
              <p className="text-gray-600">
                {(language === 'zh' || language === 'cn') ? '您可能也會喜歡這些商品' : 'You might also like these products'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredRelated.map((relatedProduct) => (
                <Card key={relatedProduct.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <Link href={`/product/${relatedProduct.id}`} className="block">
                      <div className="aspect-square bg-gray-200 overflow-hidden flex items-center justify-center relative">
                        {relatedProduct.imageUrl ? (
                          <img
                            src={relatedProduct.imageUrl}
                            alt={relatedProduct.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-4xl text-gray-400">📦</div>
                        )}
                        {/* Quick View Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white text-[#0ABAB5] px-4 py-2 rounded-md text-sm font-medium">
                            {(language === 'zh' || language === 'cn') ? '快速查看' : 'Quick View'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#0ABAB5] transition-colors">
                          {relatedProduct.name}
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-bold text-[#DC2626]">
                            {formatPrice(relatedProduct.price, language)}
                          </p>
                          <span className="text-xs bg-[#0ABAB5] text-white px-2 py-1 rounded-full">
                            {(language === 'zh' || language === 'cn') ? '推薦' : 'Recommended'}
                          </span>
                        </div>
                        {/* Category Badge */}
                        {relatedProduct.categoryId && (
                          <div className="text-xs text-gray-600 mb-3">
                            {relatedProduct.categoryId === 1 ? ((language === 'zh' || language === 'cn') ? '🛍️ 日本百元商品' : '🛍️ 100 Yen Products') : ((language === 'zh' || language === 'cn') ? '♿ 老人看護器材' : '♿ Care Equipment')}
                          </div>
                        )}
                      </div>
                    </Link>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section removed per user request */}
      </main>
    </div>
  );
}

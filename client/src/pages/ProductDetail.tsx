import { useRoute, useLocation, Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, ArrowLeft, ShoppingCart, Loader2, Share2, Facebook, Twitter, MessageCircle, Heart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
// ReviewSection removed per user request

export default function ProductDetail() {
  const [match, params] = useRoute('/product/:productId');
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const productId = params?.productId ? parseInt(params.productId) : 0;
  
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id: productId });
  const { data: relatedProducts = [] } = trpc.products.list.useQuery();
  
  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success(t('cart.addSuccess') || '已加入購物車');
      setQuantity(1);
    },
    onError: (error: any) => {
      toast.error(error.message || '加入購物車失敗');
    },
  });

  const toggleLanguage = () => {
    if ((language === 'zh' || language === 'cn')) {
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

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error('請先登入');
      return;
    }
    addToCartMutation.mutate({ productId, quantity });
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
      toast.info((language === 'zh' || language === 'cn') ? '複製了產品連結' : 'Product link copied');
      navigator.clipboard.writeText(productUrl);
    }
  };

  const handleShareToFacebook = () => {
    if (!product) return;
    const productUrl = `${window.location.origin}/product/${productId}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
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
    window.open(twitterUrl, '_blank', 'width=600,height=400');
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
    window.open(lineUrl, '_blank');
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
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    ろ
                  </div>
                  <span className="text-2xl font-bold text-[#0ABAB5]">
                    {t('home.company')}
                  </span>
                </Link>
            </div>
          </div>
        </header>
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

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0ABAB5] to-[#089B96] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  ろ
                </div>
                <span className="text-2xl font-bold text-[#0ABAB5]">
                  {t('home.company')}
                </span>
              </Link>
            <div className="flex items-center gap-6">
              <nav className="flex gap-6">
                <Link href="/" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.home')}</Link>
                <Link href="/products" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.products')}</Link>
                <Link href="/videos" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.videos')}</Link>
                <Link href="/cart" className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.cart')}</Link>
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
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          {/* Product Images */}
          <div className="flex flex-col gap-4">
            {/* Main Image */}
            <div className="w-full aspect-square bg-white rounded-lg shadow-sm overflow-hidden flex items-center justify-center">
              {(() => {
                const allImages = [
                  product.imageUrl,
                  ...(product.images || [])
                ].filter(Boolean) as string[];
                const currentImage = allImages[selectedImageIndex] || product.imageUrl;
                return currentImage ? (
                  <img
                    src={currentImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-6xl text-gray-400">📦</div>
                );
              })()}
            </div>
            
            {/* Thumbnail Gallery */}
            {(() => {
              const allImages = [
                product.imageUrl,
                ...(product.images || [])
              ].filter(Boolean) as string[];
              return allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedImageIndex === index ? 'border-[#0ABAB5]' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} - ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-4xl font-bold mb-4 text-gray-900">{product.name}</h1>
            
            <div className="mb-6">
              <p className="text-4xl font-bold text-[#DC2626] mb-3">
                {(language === 'zh' || language === 'cn') ? `NT$${Math.round(product.price).toLocaleString()}` : 
                 language === 'ja' ? `¥${Math.round(product.price * 4.5).toLocaleString()}` : 
                 `$${(product.price * 0.031).toFixed(2)}`}
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
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              disabled={addToCartMutation.isPending || (product.stock !== undefined && product.stock <= 0)}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white py-6 text-lg font-semibold flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" />
              {product.stock !== undefined && product.stock <= 0 
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
              <Button
                variant="outline"
                className="flex-1 relative group flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {(language === 'zh' || language === 'cn') ? '分享' : 'Share'}
                {/* Share dropdown menu */}
                <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 w-48">
                  <button
                    onClick={() => handleShareToFacebook()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Facebook</span>
                  </button>
                  <button
                    onClick={() => handleShareToTwitter()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <Twitter className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Twitter</span>
                  </button>
                  <button
                    onClick={() => handleShareToLine()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                  >
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">LINE</span>
                  </button>
                  <button
                    onClick={() => handleShare()}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                    <span className="text-sm">{(language === 'zh' || language === 'cn') ? '更多' : 'More'}</span>
                  </button>
                </div>
              </Button>
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
                          <Button className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white text-[#0ABAB5] hover:bg-gray-100">
                            {(language === 'zh' || language === 'cn') ? '快速查看' : 'Quick View'}
                          </Button>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-[#0ABAB5] transition-colors">
                          {relatedProduct.name}
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-bold text-[#DC2626]">
                            ¥{relatedProduct.price?.toLocaleString()}
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
      </div>
    </div>
  );
}

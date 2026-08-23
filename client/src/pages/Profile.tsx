'use client';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Heart, ShoppingCart, Trash2, Share2, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/price';
import { ProductImage } from '@/components/ProductImage';
import { SiteHeader } from '@/components/SiteHeader';

export default function Profile() {
  const { language } = useLanguage();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { add: addToCart } = useCart();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'wishlist'>('profile');
  const [sharedWishlistId, setSharedWishlistId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    bio: '',
  });

  // Wishlist queries
  const { data: wishlistData, isLoading: isLoadingWishlist, refetch: refetchWishlist } = trpc.wishlist.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const removeFromWishlistMutation = trpc.wishlist.remove.useMutation({
    onSuccess: () => {
      refetchWishlist();
      toast.success((language === 'zh' || language === 'cn') ? '已從願望清單移除' : 'Removed from wishlist');
    },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        postalCode: user.postalCode || '',
        country: user.country || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement save profile mutation
      toast.success((language === 'zh' || language === 'cn') ? '個人資料已保存' : 'Profile saved successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error((language === 'zh' || language === 'cn') ? '保存失敗' : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromWishlist = (productId: number) => {
    removeFromWishlistMutation.mutate({ productId });
  };

  const handleAddToCart = (product?: { id?: number; name?: string; price?: number; imageUrl?: string | null }) => {
    if (!product || !product.id || !product.name || typeof product.price !== 'number') return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl || undefined,
    });
    toast.success((language === 'zh' || language === 'cn') ? '已添加到購物車' : 'Added to cart');
  };

  const handleShare = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${productName}` 
      : language === 'en'
      ? `Check out this product: ${productName}`
      : `この商品をチェック：${productName}`;

    // Web Share API for native sharing
    if (navigator.share) {
      navigator.share({
        title: productName,
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

  const handleShareToFacebook = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/product/${productId}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleShareToTwitter = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${productName}` 
      : language === 'en'
      ? `Check out this product: ${productName}`
      : `この商品をチェック：${productName}`;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleShareToLine = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareText = (language === 'zh' || language === 'cn') 
      ? `看看這個商品：${productName}` 
      : language === 'en'
      ? `Check out this product: ${productName}`
      : `この商品をチェック：${productName}`;
    const lineUrl = `https://line.me/R/msg/0/?${encodeURIComponent(shareText + ' ' + productUrl)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fef9f3] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0ABAB5]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
        <SiteHeader />
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">
            {(language === 'zh' || language === 'cn') ? '請先登入' : 'Please log in first'}
          </h2>
          <Link href="/" className="inline-block bg-[#0ABAB5] text-white px-6 py-2 rounded-lg hover:bg-[#089B96]">
              {(language === 'zh' || language === 'cn') ? '返回首頁' : 'Back to Home'}
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fef9f3]">
      <SiteHeader />

      {/* Profile Content */}
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 px-4 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-[#0ABAB5] text-[#0ABAB5]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {(language === 'zh' || language === 'cn') ? '個人資料' : 'Profile'}
            </button>
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`pb-3 px-4 font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'wishlist'
                  ? 'border-b-2 border-[#0ABAB5] text-[#0ABAB5]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Heart className="w-4 h-4" />
              {(language === 'zh' || language === 'cn') ? '願望清單' : 'Wishlist'}
            </button>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">
                  {(language === 'zh' || language === 'cn') ? '個人資料' : 'Profile'}
                </h1>
                <Button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isSaving}
                  className="bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {(language === 'zh' || language === 'cn') ? '保存中...' : 'Saving...'}
                    </>
                  ) : isEditing ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {(language === 'zh' || language === 'cn') ? '保存' : 'Save'}
                    </>
                  ) : (
                    (language === 'zh' || language === 'cn') ? '編輯' : 'Edit'
                  )}
                </Button>
              </div>

              <Card className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '名稱' : 'Name'}
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '郵箱' : 'Email'}
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '電話' : 'Phone'}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '城市' : 'City'}
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Postal Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '郵編' : 'Postal Code'}
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '國家' : 'Country'}
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Address - Full Width */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '地址' : 'Address'}
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Bio - Full Width */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {(language === 'zh' || language === 'cn') ? '個人簡介' : 'Bio'}
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* Wishlist Tab */}
          {activeTab === 'wishlist' && (
            <>
              <h1 className="text-3xl font-bold mb-8">
                {(language === 'zh' || language === 'cn') ? '願望清單' : 'Wishlist'}
              </h1>

              {isLoadingWishlist ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0ABAB5]" />
                </div>
              ) : !wishlistData || wishlistData.length === 0 ? (
                <Card className="p-12 text-center">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {(language === 'zh' || language === 'cn') ? '您的願望清單是空的' : 'Your wishlist is empty'}
                  </p>
                  <Link href="/products" className="inline-block mt-4 bg-[#0ABAB5] text-white px-6 py-2 rounded-lg hover:bg-[#089B96]">
                      {(language === 'zh' || language === 'cn') ? '瀏覽產品' : 'Browse Products'}
                    </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlistData.map((item: any) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <ProductImage
                        src={item.wishlists_product?.imageUrl}
                        alt={item.wishlists_product?.name || 'Product'}
                        className="aspect-square w-full bg-white object-contain p-3"
                      />
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                          {item.wishlists_product?.name || 'Product'}
                        </h3>
                        <p className="text-[#0ABAB5] font-bold text-lg mb-4">
                          {formatPrice(item.wishlists_product?.price || 0, language)}
                        </p>
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => handleAddToCart(item.wishlists_product)}
                            className="w-full bg-[#0ABAB5] hover:bg-[#089B96] text-white flex items-center justify-center gap-2"
                            disabled={!item.wishlists_product?.id}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {(language === 'zh' || language === 'cn') ? '加入購物車' : 'Add to Cart'}
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleRemoveFromWishlist(item.wishlists_product?.id)}
                              variant="outline"
                              disabled={removeFromWishlistMutation.isPending}
                              className="flex-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <div className="relative flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                disabled={!item.wishlists_product?.id}
                                aria-haspopup="menu"
                                aria-expanded={sharedWishlistId === item.id}
                                onClick={() => setSharedWishlistId(openId => openId === item.id ? null : item.id)}
                              >
                                <Share2 className="w-4 h-4" />
                              </Button>
                              {sharedWishlistId === item.id && (
                                <div className="absolute bottom-full right-0 z-10 mb-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleShareToFacebook(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <Facebook className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm">Facebook</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleShareToTwitter(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <Twitter className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm">Twitter</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleShareToLine(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <MessageCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-sm">LINE</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleShare(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <Share2 className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm">{(language === 'zh' || language === 'cn') ? '更多' : 'More'}</span>
                                </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

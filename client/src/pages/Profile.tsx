'use client';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, ArrowLeft, Loader2, Save, Heart, ShoppingCart, Trash2, Share2, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';

export default function Profile() {
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'wishlist'>('profile');

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
      toast.success(language === 'zh' ? '已從願望清單移除' : 'Removed from wishlist');
    },
  });

  const addToCartMutation = trpc.cart.add.useMutation({
    onSuccess: () => {
      toast.success(language === 'zh' ? '已添加到購物車' : 'Added to cart');
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
      toast.success(language === 'zh' ? '個人資料已保存' : 'Profile saved successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(language === 'zh' ? '保存失敗' : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromWishlist = (productId: number) => {
    removeFromWishlistMutation.mutate({ productId });
  };

  const handleAddToCart = (productId: number) => {
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  const handleShare = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/products?id=${productId}`;
    const shareText = language === 'zh' 
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
      // Fallback: show share options
      toast.info(language === 'zh' ? '複製了產品連結' : 'Product link copied');
      navigator.clipboard.writeText(productUrl);
    }
  };

  const handleShareToFacebook = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/products?id=${productId}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };

  const handleShareToTwitter = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/products?id=${productId}`;
    const shareText = language === 'zh' 
      ? `看看這個商品：${productName}` 
      : language === 'en'
      ? `Check out this product: ${productName}`
      : `この商品をチェック：${productName}`;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const handleShareToLine = (productId: number, productName: string) => {
    const productUrl = `${window.location.origin}/products?id=${productId}`;
    const shareText = language === 'zh' 
      ? `看看這個商品：${productName}` 
      : language === 'en'
      ? `Check out this product: ${productName}`
      : `この商品をチェック：${productName}`;
    const lineUrl = `https://line.me/R/msg/0/?${encodeURIComponent(shareText + ' ' + productUrl)}`;
    window.open(lineUrl, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fef9f3]">
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
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">
            {language === 'zh' ? '請先登入' : 'Please log in first'}
          </h2>
          <Link href="/">
            <a className="inline-block bg-[#0ABAB5] text-white px-6 py-2 rounded-lg hover:bg-[#089B96]">
              {language === 'zh' ? '返回首頁' : 'Back to Home'}
            </a>
          </Link>
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
                  <a className="text-gray-700 hover:text-[#0ABAB5]">{t('nav.cart')}</a>
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

      {/* Profile Content */}
      <div className="container mx-auto px-4 py-12">
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
              {language === 'zh' ? '個人資料' : 'Profile'}
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
              {language === 'zh' ? '願望清單' : 'Wishlist'}
            </button>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">
                  {language === 'zh' ? '個人資料' : 'Profile'}
                </h1>
                <Button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={isSaving}
                  className="bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {language === 'zh' ? '保存中...' : 'Saving...'}
                    </>
                  ) : isEditing ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {language === 'zh' ? '保存' : 'Save'}
                    </>
                  ) : (
                    language === 'zh' ? '編輯' : 'Edit'
                  )}
                </Button>
              </div>

              <Card className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'zh' ? '名稱' : 'Name'}
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
                      {language === 'zh' ? '郵箱' : 'Email'}
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
                      {language === 'zh' ? '電話' : 'Phone'}
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
                      {language === 'zh' ? '城市' : 'City'}
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
                      {language === 'zh' ? '郵編' : 'Postal Code'}
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
                      {language === 'zh' ? '國家' : 'Country'}
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
                      {language === 'zh' ? '地址' : 'Address'}
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
                      {language === 'zh' ? '個人簡介' : 'Bio'}
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
                {language === 'zh' ? '願望清單' : 'Wishlist'}
              </h1>

              {isLoadingWishlist ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0ABAB5]" />
                </div>
              ) : !wishlistData || wishlistData.length === 0 ? (
                <Card className="p-12 text-center">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {language === 'zh' ? '您的願望清單是空的' : 'Your wishlist is empty'}
                  </p>
                  <Link href="/products">
                    <a className="inline-block mt-4 bg-[#0ABAB5] text-white px-6 py-2 rounded-lg hover:bg-[#089B96]">
                      {language === 'zh' ? '瀏覽產品' : 'Browse Products'}
                    </a>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlistData.map((item: any) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square bg-gray-200 flex items-center justify-center text-4xl">
                        📦
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                          {item.wishlists_product?.name || 'Product'}
                        </h3>
                        <p className="text-[#0ABAB5] font-bold text-lg mb-4">
                          ¥{item.wishlists_product?.price || 0}
                        </p>
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => handleAddToCart(item.wishlists_product?.id)}
                            className="w-full bg-[#0ABAB5] hover:bg-[#089B96] text-white flex items-center justify-center gap-2"
                            disabled={addToCartMutation.isPending}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {language === 'zh' ? '加入購物車' : 'Add to Cart'}
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
                            <Button
                              variant="outline"
                              className="flex-1 relative group"
                            >
                              <Share2 className="w-4 h-4" />
                              <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 w-48">
                                <button
                                  onClick={() => handleShareToFacebook(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <Facebook className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm">Facebook</span>
                                </button>
                                <button
                                  onClick={() => handleShareToTwitter(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <Twitter className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm">Twitter</span>
                                </button>
                                <button
                                  onClick={() => handleShareToLine(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-200"
                                >
                                  <MessageCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-sm">LINE</span>
                                </button>
                                <button
                                  onClick={() => handleShare(item.wishlists_product?.id, item.wishlists_product?.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <Share2 className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm">{language === 'zh' ? '更多' : 'More'}</span>
                                </button>
                              </div>
                            </Button>
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
      </div>
    </div>
  );
}

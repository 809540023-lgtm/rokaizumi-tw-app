import { Link } from 'wouter';
import { Heart, ShoppingCart, Eye, Star } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  imageUrl?: string | null;
  price: number;
  originalPrice?: number | null;
  rating?: number;
  reviewCount?: number;
  categoryId?: number;
  categoryName?: string;
}

interface Props {
  product: Product;
  language: 'zh' | 'en' | 'ja';
  quantity: number;
  onQuantityChange: (q: number) => void;
  onAddToCart: () => void;
}

/** 幣別與顯示 */
function formatPrice(price: number, language: 'zh' | 'en' | 'ja'): string {
  if (language === 'zh') return `NT$ ${Math.round(price).toLocaleString()}`;
  if (language === 'ja') return `¥ ${Math.round(price * 4.5).toLocaleString()}`;
  return `$ ${(price * 0.031).toFixed(2)}`;
}

export function ProductCard({
  product,
  language,
  onAddToCart,
}: Props) {
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  return (
    <article className="group bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(10,186,181,0.14)] hover:-translate-y-1 transition-all flex flex-col">
      {/* 圖片區 */}
      <Link href={`/product/${product.id}`}>
        <a className="block relative aspect-square bg-gray-100 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl bg-gradient-to-br from-gray-100 to-[#E0F7F6]">
              📦
            </div>
          )}

          {/* 價格 badge */}

          {/* 分類 tag */}
          {product.categoryName && (
            <div className="absolute top-3 right-3 bg-white/95 text-[#089B96] px-2.5 py-1 rounded-full text-[11px] font-bold">
              {product.categoryName}
            </div>
          )}

          {/* 折扣 */}
          {discount > 0 && (
            <div className="absolute bottom-3 left-3 bg-[#F59E0B] text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              -{discount}%
            </div>
          )}

          {/* 收藏按鈕 */}
          <button
            className="absolute bottom-3 right-3 w-9 h-9 bg-white/95 rounded-full flex items-center justify-center text-gray-400 hover:text-[#DC2626] hover:bg-white shadow"
            title="加入收藏"
            onClick={e => e.preventDefault()}
          >
            <Heart className="w-4 h-4" />
          </button>
        </a>
      </Link>

      {/* 內容區 */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/product/${product.id}`}>
          <a className="block">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.6rem] mb-2 hover:text-[#0ABAB5] transition-colors">
              {product.name}
            </h3>
          </a>
        </Link>

        {/* 評分 */}
        {product.rating != null && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-400">
            <span className="text-[#F59E0B] flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="w-3.5 h-3.5"
                  fill={i < Math.round(product.rating || 0) ? '#F59E0B' : 'none'}
                  stroke="#F59E0B"
                />
              ))}
            </span>
            {product.rating?.toFixed(1)}{' '}
            {product.reviewCount != null && <span>({product.reviewCount})</span>}
          </div>
        )}

        {/* 原價 */}
        {product.originalPrice && product.originalPrice > product.price && (
          <div className="text-xs text-gray-400 line-through mb-3">
            {formatPrice(product.originalPrice, language)}
          </div>
        )}

        {/* 按鈕 */}
        <div className="flex gap-2 mt-auto">
          <Link href={`/product/${product.id}`}>
            <a className="flex-1 flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-gray-200 text-gray-600 hover:border-[#0ABAB5] hover:text-[#0ABAB5] px-3 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <Eye className="w-4 h-4" /> 詳情
            </a>
          </Link>
          <button
            onClick={onAddToCart}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-3 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> 加入購物車
          </button>
        </div>
      </div>
    </article>
  );
}

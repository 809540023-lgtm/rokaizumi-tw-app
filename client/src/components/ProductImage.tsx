import { useState } from 'react';

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
}

/**
 * 商品圖片。
 *
 * 商品資料裡有一批 imageUrl 指向已停止服務的圖床（via.placeholder.com），
 * 也有一批根本是空字串。原本的寫法是 `{imageUrl && <img>}`，
 * 沒有圖就整塊不渲染、載入失敗就破圖。這裡一律保留版位，
 * 缺圖或載入失敗時退成商品名稱的文字方塊。
 */
export function ProductImage({ src, alt, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#E0F7F6] to-[#FFF5F0] text-center px-3 ${className}`}
        aria-label={alt}
      >
        <span className="text-sm font-bold text-[#089B96] line-clamp-3">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export default ProductImage;

import { Link } from 'wouter';
import { MessageCircle, ShoppingBag } from 'lucide-react';

/** 手機底部固定 CTA：LINE 客服 + 立刻選購 */
export function MobileStickyCTA() {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-40 px-4 py-3 flex gap-2 pb-[env(safe-area-inset-bottom)]">
      <a
        href="https://line.me/R/ti/p/@rokaizumi"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center justify-center gap-1.5 border-2 border-[#0ABAB5] text-[#0ABAB5] px-4 py-3 rounded-xl font-bold text-sm"
      >
        <MessageCircle className="w-4 h-4" />
        LINE 客服
      </a>
      <Link href="/products">
        <a className="flex-1 flex items-center justify-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(220,38,38,0.3)]">
          <ShoppingBag className="w-4 h-4" />
          立刻選購 →
        </a>
      </Link>
    </div>
  );
}

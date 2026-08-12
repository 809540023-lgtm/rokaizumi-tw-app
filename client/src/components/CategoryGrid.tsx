import { Link } from 'wouter';
import { Search } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  count: number;
  icon?: string;
}

interface Props {
  categories: Category[];
}

// 預設 icon 對應表（若資料庫 icon 欄位為空時退回此表）
const iconMap: Record<string, string> = {
  '杖': '🦯',
  '歩行': '🚶',
  '靴': '👟',
  '車椅子': '🦽',
  '入浴': '🚿',
  'トイレ': '🚽',
  'おむつ': '📦',
  'ベッド': '🛏️',
  '床ずれ': '🛡️',
  '手すり': '🤲',
  '食器': '🥢',
};

function pickIcon(name: string): string {
  for (const k of Object.keys(iconMap)) {
    if (name.includes(k)) return iconMap[k];
  }
  return '🎁';
}

export function CategoryGrid({ categories }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
      {categories.map(cat => (
        <Link key={cat.id} href={`/category/${cat.id}`}>
          <a className="group bg-white rounded-2xl p-5 text-center border-[1.5px] border-transparent hover:border-[#0ABAB5] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(10,186,181,0.14)] transition-all flex flex-col items-center gap-2">
            <span className="text-4xl">{cat.icon || pickIcon(cat.name)}</span>
            <span className="text-sm font-bold text-gray-900 group-hover:text-[#0ABAB5]">
              {cat.name}
            </span>
            <span className="text-xs text-gray-400">{cat.count} 件</span>
          </a>
        </Link>
      ))}

      {/* 查看全部卡片 */}
      <Link href="/products">
        <a className="bg-gradient-to-br from-[#E0F7F6] to-white rounded-2xl p-5 text-center border-[1.5px] border-[#0ABAB5] hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(10,186,181,0.14)] transition-all flex flex-col items-center gap-2">
          <Search className="w-9 h-9 text-[#0ABAB5]" />
          <span className="text-sm font-bold text-[#089B96]">查看全部</span>
          <span className="text-xs text-gray-400">220 件</span>
        </a>
      </Link>
    </div>
  );
}

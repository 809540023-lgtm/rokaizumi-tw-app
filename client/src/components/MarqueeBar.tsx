import { X } from 'lucide-react';

interface Announcement {
  id: number;
  contentZh: string;
  contentEn?: string | null;
  contentJa?: string | null;
}

interface Props {
  announcements: Announcement[];
  language: 'zh' | 'en' | 'ja';
  onClose: () => void;
}

export function MarqueeBar({ announcements, language, onClose }: Props) {
  const pickContent = (a: Announcement) => {
    if (language === 'zh') return a.contentZh;
    if (language === 'ja') return a.contentJa || a.contentZh;
    return a.contentEn || a.contentZh;
  };

  return (
    <div className="bg-gradient-to-r from-[#0ABAB5] to-[#089B96] text-white h-9 overflow-hidden relative flex items-center">
      <div
        className="flex gap-16 whitespace-nowrap animate-marquee"
        style={{ animation: 'marquee 30s linear infinite' }}
      >
        {[...announcements, ...announcements].map((a, idx) => (
          <span key={`${a.id}-${idx}`} className="pl-6 text-sm">
            {pickContent(a)}
          </span>
        ))}
      </div>
      <button
        onClick={onClose}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
        title="關閉公告"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

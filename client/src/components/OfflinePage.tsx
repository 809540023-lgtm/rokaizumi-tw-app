import { WifiOff, RefreshCw, Home, ShoppingCart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface OfflinePageProps {
  onRetry?: () => void;
}

export function OfflinePage({ onRetry }: OfflinePageProps) {
  const { language } = useLanguage();

  const translations = {
    'zh-TW': {
      title: '您目前處於離線狀態',
      subtitle: '無法連接到網路',
      description: '請檢查您的網路連線，或稍後再試。',
      retry: '重新連線',
      offlineFeatures: '離線可用功能',
      viewCart: '查看購物車',
      viewHistory: '瀏覽歷史',
      goHome: '返回首頁',
      tips: '小提示',
      tip1: '已瀏覽過的頁面可能仍可查看',
      tip2: '購物車內容已保存在本地',
      tip3: '網路恢復後將自動同步',
    },
    'en': {
      title: 'You are offline',
      subtitle: 'Unable to connect to the network',
      description: 'Please check your internet connection and try again.',
      retry: 'Retry Connection',
      offlineFeatures: 'Available Offline',
      viewCart: 'View Cart',
      viewHistory: 'Browse History',
      goHome: 'Go Home',
      tips: 'Tips',
      tip1: 'Previously viewed pages may still be accessible',
      tip2: 'Cart items are saved locally',
      tip3: 'Data will sync when connection is restored',
    },
    'ja': {
      title: 'オフラインです',
      subtitle: 'ネットワークに接続できません',
      description: 'インターネット接続を確認して、もう一度お試しください。',
      retry: '再接続',
      offlineFeatures: 'オフラインで利用可能',
      viewCart: 'カートを見る',
      viewHistory: '閲覧履歴',
      goHome: 'ホームへ',
      tips: 'ヒント',
      tip1: '以前閲覧したページは引き続き表示できる場合があります',
      tip2: 'カートの内容はローカルに保存されています',
      tip3: '接続が回復すると自動的に同期されます',
    },
  };

  const t = translations[language as keyof typeof translations] || translations['zh-TW'];

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fef9f3] to-white flex flex-col items-center justify-center p-4">
      {/* Main Content */}
      <div className="max-w-md w-full text-center space-y-8">
        {/* Offline Icon Animation */}
        <div className="relative">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
            <WifiOff className="w-16 h-16 text-gray-400" />
          </div>
          {/* Animated rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 border-4 border-gray-200 rounded-full animate-ping opacity-20" />
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-gray-800">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
          <p className="text-sm text-gray-400">{t.description}</p>
        </div>

        {/* Retry Button */}
        <Button
          onClick={handleRetry}
          className="bg-[#40E0D0] hover:bg-[#3BC9BB] text-white px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          {t.retry}
        </Button>

        {/* Offline Features */}
        <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-[#40E0D0]" />
            {t.offlineFeatures}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = '/cart'}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="w-6 h-6 text-[#40E0D0]" />
              <span className="text-sm text-gray-600">{t.viewCart}</span>
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Home className="w-6 h-6 text-[#40E0D0]" />
              <span className="text-sm text-gray-600">{t.goHome}</span>
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="text-left bg-[#40E0D0]/10 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[#40E0D0] mb-3">{t.tips}</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-[#40E0D0] mt-1">•</span>
              {t.tip1}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#40E0D0] mt-1">•</span>
              {t.tip2}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#40E0D0] mt-1">•</span>
              {t.tip3}
            </li>
          </ul>
        </div>

        {/* Company Logo */}
        <div className="pt-4">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="w-8 h-8 bg-[#40E0D0] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">ろ</span>
            </div>
            <span className="text-sm">ろかいずみ合同会社</span>
          </div>
        </div>
      </div>
    </div>
  );
}

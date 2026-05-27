import { useState, useEffect } from 'react';
import { WifiOff, Wifi, X, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLanguage } from '@/contexts/LanguageContext';

export function NetworkStatusBanner() {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { language } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  const translations = {
    'zh-TW': {
      offline: '您目前處於離線狀態',
      offlineDesc: '部分功能可能無法使用',
      slowConnection: '網路連線緩慢',
      slowDesc: '載入可能需要較長時間',
      reconnected: '網路已恢復連線',
      dismiss: '關閉',
    },
    'en': {
      offline: 'You are offline',
      offlineDesc: 'Some features may not be available',
      slowConnection: 'Slow connection detected',
      slowDesc: 'Loading may take longer',
      reconnected: 'Connection restored',
      dismiss: 'Dismiss',
    },
    'ja': {
      offline: 'オフラインです',
      offlineDesc: '一部の機能が利用できない場合があります',
      slowConnection: '接続が遅いです',
      slowDesc: '読み込みに時間がかかる場合があります',
      reconnected: '接続が回復しました',
      dismiss: '閉じる',
    },
  };

  const t = translations[language as keyof typeof translations] || translations['zh-TW'];

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else {
      if (wasOffline) {
        // 網路恢復，顯示恢復提示
        setShowBanner(false);
        setShowReconnected(true);
        setTimeout(() => {
          setShowReconnected(false);
        }, 3000);
        setWasOffline(false);
      }
    }
  }, [isOnline, wasOffline]);

  useEffect(() => {
    if (isSlowConnection && isOnline) {
      setShowBanner(true);
    }
  }, [isSlowConnection, isOnline]);

  // 網路恢復提示
  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
        <div className="bg-green-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg">
          <Wifi className="w-5 h-5" />
          <span className="font-medium">{t.reconnected}</span>
        </div>
      </div>
    );
  }

  // 離線或慢速連線提示
  if (!showBanner) return null;

  const isOfflineBanner = !isOnline;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
      <div 
        className={`px-4 py-3 flex items-center justify-between shadow-lg ${
          isOfflineBanner 
            ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white' 
            : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          {isOfflineBanner ? (
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <WifiOff className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-semibold">
              {isOfflineBanner ? t.offline : t.slowConnection}
            </p>
            <p className="text-sm opacity-90">
              {isOfflineBanner ? t.offlineDesc : t.slowDesc}
            </p>
          </div>
        </div>
        
        {!isOfflineBanner && (
          <button
            onClick={() => setShowBanner(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            aria-label={t.dismiss}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

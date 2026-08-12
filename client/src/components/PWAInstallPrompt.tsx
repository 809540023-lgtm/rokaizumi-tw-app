import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { language } = useLanguage();

  const translations = {
    'zh-TW': {
      title: '安裝 App',
      description: '將 ろかいずみ 安裝到您的裝置，享受更好的體驗！',
      install: '安裝',
      later: '稍後',
      iosTitle: '安裝到主畫面',
      iosStep1: '點擊底部的',
      iosStep2: '分享按鈕',
      iosStep3: '然後選擇「加入主畫面」',
    },
    'en': {
      title: 'Install App',
      description: 'Install Rokaizumi to your device for a better experience!',
      install: 'Install',
      later: 'Later',
      iosTitle: 'Add to Home Screen',
      iosStep1: 'Tap the',
      iosStep2: 'Share button',
      iosStep3: 'then select "Add to Home Screen"',
    },
    'ja': {
      title: 'アプリをインストール',
      description: 'ろかいずみをデバイスにインストールして、より良い体験を！',
      install: 'インストール',
      later: '後で',
      iosTitle: 'ホーム画面に追加',
      iosStep1: '下部の',
      iosStep2: '共有ボタンをタップ',
      iosStep3: '「ホーム画面に追加」を選択',
    },
  };

  const t = translations[language as keyof typeof translations] || translations['zh-TW'];

  useEffect(() => {
    // 檢查是否已經是 PWA 模式
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // 檢查是否是 iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 監聽安裝提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // 檢查是否已經顯示過提示
      const hasShownPrompt = localStorage.getItem('pwa-prompt-shown');
      if (!hasShownPrompt) {
        setTimeout(() => setShowPrompt(true), 3000); // 3秒後顯示
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 對於 iOS，延遲顯示提示
    if (isIOSDevice && !isInStandaloneMode) {
      const hasShownPrompt = localStorage.getItem('pwa-prompt-shown');
      if (!hasShownPrompt) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-shown', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-shown', 'true');
  };

  // 如果已經是 PWA 模式，不顯示
  if (isStandalone) return null;

  // 如果沒有安裝提示且不是 iOS，不顯示
  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#40E0D0] to-[#48D1CC] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-[#40E0D0]">ろ</span>
            </div>
            <div className="text-white">
              <h3 className="font-bold text-lg">{t.title}</h3>
              <p className="text-sm text-white/80">ろかいずみ合同会社</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isIOS ? (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">{t.iosTitle}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{t.iosStep1}</span>
                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L12 14M12 2L8 6M12 2L16 6M4 12V20H20V12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>{t.iosStep2}</span>
              </div>
              <p className="text-sm text-gray-500">{t.iosStep3}</p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm mb-4">{t.description}</p>
              <div className="flex gap-3">
                <Button
                  onClick={handleInstall}
                  className="flex-1 bg-[#40E0D0] hover:bg-[#3BC9BB] text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t.install}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  className="flex-1"
                >
                  {t.later}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Features */}
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            <span>離線可用</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>快速啟動</span>
          </div>
        </div>
      </div>
    </div>
  );
}

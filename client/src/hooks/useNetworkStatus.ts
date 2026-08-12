import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

interface NetworkInformation extends EventTarget {
  effectiveType: string;
  downlink: number;
  rtt: number;
  type: string;
  saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => void) | null;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export function useNetworkStatus(): NetworkStatus & { checkConnection: () => Promise<boolean> } {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    effectiveType: null,
    downlink: null,
    rtt: null,
  });

  // 獲取網路連線資訊
  const getConnectionInfo = useCallback(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const isSlowConnection = 
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g' ||
        connection.rtt > 500;

      return {
        connectionType: connection.type || null,
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        isSlowConnection,
      };
    }

    return {
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null,
      isSlowConnection: false,
    };
  }, []);

  // 檢查實際網路連線（通過發送請求）
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/manifest.json', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // 更新狀態
  const updateStatus = useCallback(() => {
    const connectionInfo = getConnectionInfo();
    setStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine,
      ...connectionInfo,
    }));
  }, [getConnectionInfo]);

  useEffect(() => {
    // 初始化狀態
    updateStatus();

    // 監聽線上/離線事件
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      // 線上時重新獲取連線資訊
      updateStatus();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 監聽連線變化
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, [updateStatus]);

  return { ...status, checkConnection };
}

// 離線狀態提示 Toast
export function useOfflineToast() {
  const { isOnline } = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // 網路恢復
      setWasOffline(false);
    }
  }, [isOnline, wasOffline]);

  return { isOnline, wasOffline };
}

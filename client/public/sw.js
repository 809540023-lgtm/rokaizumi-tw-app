// ろかいずみ合同会社 Service Worker
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `rokaizumi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `rokaizumi-dynamic-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// 需要預緩存的靜態資源
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service Worker installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Pre-caching failed:', error);
      })
  );
});

// 啟動 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // 刪除舊版本的緩存
              return name.startsWith('rokaizumi-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// 攔截網絡請求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過非 GET 請求
  if (request.method !== 'GET') {
    return;
  }

  // 跳過 API 請求（不緩存動態數據）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // API 請求失敗時返回錯誤響應
          return new Response(
            JSON.stringify({ error: 'offline', message: '您目前處於離線狀態' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 跳過 Chrome 擴展請求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 跳過外部請求
  if (url.origin !== location.origin) {
    return;
  }

  // 處理導航請求（HTML 頁面）
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功獲取，緩存並返回
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // 網絡失敗，嘗試從緩存獲取
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // 沒有緩存，返回離線頁面
          const offlineResponse = await caches.match(OFFLINE_PAGE);
          if (offlineResponse) {
            return offlineResponse;
          }
          // 最後的備用方案
          return new Response(getOfflineFallbackHTML(), {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 處理其他資源請求（JS、CSS、圖片等）
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // 有緩存，返回緩存並在後台更新
          fetchAndCache(request);
          return cachedResponse;
        }
        // 沒有緩存，從網絡獲取
        return fetchAndCache(request);
      })
      .catch(() => {
        // 對於圖片，返回佔位圖
        if (request.headers.get('accept')?.includes('image')) {
          return getPlaceholderImage();
        }
        return new Response('離線中', { status: 503 });
      })
  );
});

// 從網絡獲取並緩存
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    // 只緩存成功的響應
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    throw error;
  }
}

// 生成佔位圖片
function getPlaceholderImage() {
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f3f4f6"/>
      <text x="100" y="100" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="14">
        離線中
      </text>
    </svg>
  `;
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

// 備用離線 HTML
function getOfflineFallbackHTML() {
  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>離線中 - ろかいずみ合同会社</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(to bottom, #fef9f3, #fff);
          text-align: center;
          padding: 20px;
        }
        .container { max-width: 400px; }
        h1 { color: #1f2937; margin-bottom: 8px; }
        p { color: #6b7280; }
        button {
          background: #40E0D0;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 20px;
        }
        button:hover { background: #3BC9BB; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>您目前處於離線狀態</h1>
        <p>請檢查您的網路連線，或稍後再試。</p>
        <button onclick="location.reload()">重新連線</button>
      </div>
    </body>
    </html>
  `;
}

// 處理推送通知
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = { title: 'ろかいずみ合同会社', body: '您有新的通知' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: '查看' },
      { action: 'close', title: '關閉' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 如果已有窗口打開，聚焦它
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // 否則打開新窗口
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// 後台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

async function syncCart() {
  // 同步購物車數據的邏輯
  console.log('[SW] Syncing cart data...');
}

// 監聽來自客戶端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_ONLINE') {
    // 檢查網絡狀態
    fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
      .then(() => {
        event.ports[0].postMessage({ online: true });
      })
      .catch(() => {
        event.ports[0].postMessage({ online: false });
      });
  }
});

console.log('[SW] Service Worker loaded');

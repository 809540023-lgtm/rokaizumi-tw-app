import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation, useRoute } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Package,
  Truck,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Users,
  Megaphone,
} from 'lucide-react';
import OrderManagement from './OrderManagement';
import ProductManagement from './ProductManagement';
import SupplierManagement from './SupplierManagement';
import UserManagement from './UserManagement';
import AnnouncementManagement from './AnnouncementManagement';
import ApiLogsManagement from './ApiLogsManagement';

interface AdminMenuItem {
  id: string;
  label: Record<string, string>;
  icon: React.ReactNode;
  path: string;
  badge?: string;
}

export default function AdminPanel() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const { language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');


  // 根據 URL 路徑自動設置 currentPage
  useEffect(() => {
    if (location.includes('/admin-panel/orders')) {
      setCurrentPage('orders');
    } else if (location.includes('/admin-panel/products')) {
      setCurrentPage('products');
    } else if (location.includes('/admin-panel/suppliers')) {
      setCurrentPage('suppliers');
    } else if (location.includes('/admin-panel/users')) {
      setCurrentPage('users');
    } else if (location.includes('/admin-panel/announcements')) {
      setCurrentPage('announcements');
    } else if (location.includes('/admin-panel/api-logs')) {
      setCurrentPage('apiLogs');
    } else if (location.includes('/admin-panel/financial')) {
      setCurrentPage('financial');
    } else if (location.includes('/admin-panel/settings')) {
      setCurrentPage('settings');
    } else if (location === '/admin-panel' || location === '/admin-panel/') {
      setCurrentPage('dashboard');
    }
  }, [location]);

  // 檢查管理員權限
  // useEffect(() => {
  //   if (!loading && isAuthenticated && user?.role !== 'admin') {
  //     setLocation('/');
  //   }
  // }, [loading, isAuthenticated, user, setLocation]);

  // 如果還在加載認證信息，顯示加載狀態
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // 如果不是登入的用戶，顯示無權限提示
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Please Login</h1>
          <p className="text-muted-foreground mb-6">You need to login first</p>
          <Button onClick={() => setLocation('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const menuItems: AdminMenuItem[] = [
    {
      id: 'dashboard',
      label: {
        zh: '📊 儀表板',
        en: '📊 Dashboard',
        ja: '📊 ダッシュボード',
      },
      icon: <LayoutDashboard className="w-5 h-5" />,
      path: '/admin-panel',
    },
    {
      id: 'financial',
      label: {
        zh: '💰 財務報表',
        en: '💰 Financial',
        ja: '💰 財務',
      },
      icon: <BarChart3 className="w-5 h-5" />,
      path: '/admin-panel/financial',
    },
    {
      id: 'orders',
      label: {
        zh: '📦 訂單管理',
        en: '📦 Orders',
        ja: '📦 注文',
      },
      icon: <ShoppingCart className="w-5 h-5" />,
      path: '/admin-panel/orders',
    },
    {
      id: 'products',
      label: {
        zh: '🛍️ 產品管理',
        en: '🛍️ Products',
        ja: '🛍️ 商品',
      },
      icon: <Package className="w-5 h-5" />,
      path: '/admin-panel/products',
    },
    {
      id: 'suppliers',
      label: {
        zh: '🏭 廠商管理',
        en: '🏭 Suppliers',
        ja: '🏭 サプライヤー',
      },
      icon: <Truck className="w-5 h-5" />,
      path: '/admin-panel/suppliers',
    },
    {
      id: 'users',
      label: {
        zh: '👥 會員管理',
        en: '👥 Users',
        ja: '👥 会員管理',
      },
      icon: <Users className="w-5 h-5" />,
      path: '/admin-panel/users',
    },
    {
      id: 'announcements',
      label: {
        zh: '📢 公告管理',
        en: '📢 Announcements',
        ja: '📢 お知らせ',
      },
      icon: <Megaphone className="w-5 h-5" />,
      path: '/admin-panel/announcements',
    },
    {
      id: 'apiLogs',
      label: {
        zh: '🔌 API 日誌',
        en: '🔌 API Logs',
        ja: '🔌 API ログ',
      },
      icon: <BarChart3 className="w-5 h-5" />,
      path: '/admin-panel/api-logs',
    },
    {
      id: 'settings',
      label: {
        zh: '⚙️ 設置',
        en: '⚙️ Settings',
        ja: '⚙️ 設定',
      },
      icon: <Settings className="w-5 h-5" />,
      path: '/admin-panel/settings',
    },
  ];

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const getMenuLabel = (item: AdminMenuItem) => {
    const labels: Record<string, string> = item.label;
    return labels[language] || labels['en'];
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-10 h-10 bg-[#0ABAB5] rounded-lg flex items-center justify-center text-white font-bold text-lg">
              ろ
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-gray-900">Rokaizumi</span>
                <span className="text-xs text-gray-500">
                  {language === 'zh' ? '管理後台' : language === 'ja' ? '管理画面' : 'Admin'}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id);
                setLocation(item.path);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === item.id
                  ? 'bg-[#0ABAB5] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {sidebarOpen && (
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium">{getMenuLabel(item)}</span>
                  {item.badge && (
                    <span className="inline-block ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
              {sidebarOpen && currentPage === item.id && (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          {sidebarOpen && (
            <div className="px-4 py-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                {language === 'zh' ? '登入用戶' : language === 'ja' ? 'ログイン中' : 'Logged in as'}
              </p>
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            </div>
          )}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && (
              <span>
                {language === 'zh' ? '登出' : language === 'ja' ? 'ログアウト' : 'Logout'}
              </span>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {language === 'zh'
                ? 'ろかいずみ合同会社 - 管理後台'
                : language === 'ja'
                  ? 'ろかいずみ合同会社 - 管理画面'
                  : 'Rokaizumi - Admin Panel'}
            </h1>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleDateString(
                language === 'zh' ? 'zh-TW' : language === 'ja' ? 'ja-JP' : 'en-US',
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {currentPage === 'orders' && <OrderManagement />}
          {currentPage === 'products' && <ProductManagement />}
          {currentPage === 'suppliers' && <SupplierManagement />}
          {currentPage === 'users' && <UserManagement />}
          {currentPage === 'announcements' && <AnnouncementManagement />}
          {currentPage === 'apiLogs' && <ApiLogsManagement />}

          {currentPage === 'dashboard' && (
            <div>
              <h2 className="text-xl font-bold mb-6 text-gray-900">
                {language === 'zh' ? '歡迎回到管理後台' : language === 'ja' ? '管理画面へようこそ' : 'Welcome to Admin Panel'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Quick Stats */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        {language === 'zh' ? '今日訂單' : language === 'ja' ? '本日の注文' : 'Today Orders'}
                      </p>
                      <p className="text-3xl font-bold text-gray-900">0</p>
                    </div>
                    <ShoppingCart className="w-12 h-12 text-[#0ABAB5] opacity-20" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        {language === 'zh' ? '待處理訂單' : language === 'ja' ? '処理待ち' : 'Pending Orders'}
                      </p>
                      <p className="text-3xl font-bold text-gray-900">0</p>
                    </div>
                    <Package className="w-12 h-12 text-orange-500 opacity-20" />
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        {language === 'zh' ? '低庫存商品' : language === 'ja' ? '在庫不足' : 'Low Stock'}
                      </p>
                      <p className="text-3xl font-bold text-gray-900">0</p>
                    </div>
                    <Truck className="w-12 h-12 text-red-500 opacity-20" />
                  </div>
                </Card>
              </div>

              {/* Quick Links */}
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4 text-gray-900">
                  {language === 'zh' ? '快速導航' : language === 'ja' ? 'クイックリンク' : 'Quick Links'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {menuItems.slice(1).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentPage(item.id);
                        setLocation(item.path);
                      }}
                      className="p-4 bg-white rounded-lg border border-gray-200 hover:border-[#0ABAB5] hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-[#0ABAB5] group-hover:scale-110 transition-transform">
                            {item.icon}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {getMenuLabel(item)}
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#0ABAB5] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentPage === 'financial' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">
                {language === 'zh'
                  ? '此功能正在開發中...'
                  : language === 'ja'
                    ? 'この機能は開発中です...'
                    : 'This feature is coming soon...'}
              </p>
              <Button onClick={() => setLocation('/admin-panel')}>
                {language === 'zh' ? '返回儀表板' : language === 'ja' ? 'ダッシュボードに戻る' : 'Back to Dashboard'}
              </Button>
            </div>
          )}

          {currentPage === 'settings' && (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-600 mb-4">
                {language === 'zh'
                  ? '此功能正在開發中...'
                  : language === 'ja'
                    ? 'この機能は開発中です...'
                    : 'This feature is coming soon...'}
              </p>
              <Button onClick={() => setLocation('/admin-panel')}>
                {language === 'zh' ? '返回儀表板' : language === 'ja' ? 'ダッシュボードに戻る' : 'Back to Dashboard'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

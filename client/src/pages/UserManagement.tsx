import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Search,
  Users,
  Shield,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Mail,
  Calendar,
  MoreVertical,
} from 'lucide-react';

interface User {
  id: number;
  openId: string;
  name: string | null;
  email?: string | null;
  avatar?: string | null;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export default function UserManagement() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data: users, isLoading, refetch } = trpc.admin.users.useQuery();
  const updateUserRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => refetch(),
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((user: User) => {
      const matchesSearch = 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const getLanguageLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        'users': '會員管理',
        'search': '搜尋會員...',
        'filter': '篩選角色',
        'all': '全部',
        'admin': '管理員',
        'user': '一般會員',
        'name': '名稱',
        'email': '電子郵件',
        'role': '角色',
        'joinDate': '註冊日期',
        'action': '操作',
        'setAdmin': '設為管理員',
        'setUser': '設為一般會員',
        'noUsers': '暫無會員',
        'loading': '加載中...',
        'totalUsers': '總會員數',
        'totalAdmins': '管理員數',
        'totalMembers': '一般會員數',
      },
      en: {
        'users': 'User Management',
        'search': 'Search users...',
        'filter': 'Filter Role',
        'all': 'All',
        'admin': 'Admin',
        'user': 'Member',
        'name': 'Name',
        'email': 'Email',
        'role': 'Role',
        'joinDate': 'Join Date',
        'action': 'Action',
        'setAdmin': 'Set as Admin',
        'setUser': 'Set as Member',
        'noUsers': 'No users',
        'loading': 'Loading...',
        'totalUsers': 'Total Users',
        'totalAdmins': 'Admins',
        'totalMembers': 'Members',
      },
      ja: {
        'users': '会員管理',
        'search': '会員を検索...',
        'filter': '役割フィルター',
        'all': 'すべて',
        'admin': '管理者',
        'user': '一般会員',
        'name': '名前',
        'email': 'メール',
        'role': '役割',
        'joinDate': '登録日',
        'action': 'アクション',
        'setAdmin': '管理者に設定',
        'setUser': '一般会員に設定',
        'noUsers': '会員なし',
        'loading': '読み込み中...',
        'totalUsers': '総会員数',
        'totalAdmins': '管理者数',
        'totalMembers': '一般会員数',
      },
    };
    return labels[language]?.[key] || key;
  };

  const handleRoleChange = async (userId: number, newRole: 'admin' | 'user') => {
    const confirmMessage = newRole === 'admin' 
      ? (language === 'zh' ? '確定要將此會員設為管理員嗎？' : 
         language === 'ja' ? 'この会員を管理者に設定しますか？' : 
         'Are you sure you want to set this user as admin?')
      : (language === 'zh' ? '確定要將此會員設為一般會員嗎？' : 
         language === 'ja' ? 'この会員を一般会員に設定しますか？' : 
         'Are you sure you want to set this user as member?');
    
    if (confirm(confirmMessage)) {
      await updateUserRoleMutation.mutateAsync({ userId, role: newRole });
    }
  };

  const adminCount = users?.filter((u: User) => u.role === 'admin').length || 0;
  const memberCount = users?.filter((u: User) => u.role === 'user').length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {getLanguageLabel('users')}
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">{getLanguageLabel('totalUsers')}</p>
              <p className="text-2xl font-bold text-gray-900">{users?.length || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">{getLanguageLabel('totalAdmins')}</p>
              <p className="text-2xl font-bold text-gray-900">{adminCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">{getLanguageLabel('totalMembers')}</p>
              <p className="text-2xl font-bold text-gray-900">{memberCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={getLanguageLabel('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
            />
          </div>
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] appearance-none pr-10"
            >
              <option value="all">{getLanguageLabel('all')}</option>
              <option value="admin">{getLanguageLabel('admin')}</option>
              <option value="user">{getLanguageLabel('user')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('name')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('email')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('role')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('joinDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    {getLanguageLabel('action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: User) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img 
                            src={user.avatar} 
                            alt={user.name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#0ABAB5] rounded-full flex items-center justify-center text-white font-bold">
                            {user.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <span>{user.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {user.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'admin' ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <Users className="w-3 h-3" />
                        )}
                        {getLanguageLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(user.createdAt).toLocaleDateString(
                          language === 'zh' ? 'zh-TW' : language === 'ja' ? 'ja-JP' : 'en-US'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.role === 'admin' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleChange(user.id, 'user')}
                          disabled={updateUserRoleMutation.isPending}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          {getLanguageLabel('setUser')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          disabled={updateUserRoleMutation.isPending}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          {getLanguageLabel('setAdmin')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{getLanguageLabel('noUsers')}</p>
        </div>
      )}
    </div>
  );
}

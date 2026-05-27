'use client';

import { useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Mail,
  Phone,
  MapPin,
  Loader2,
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function SupplierManagement() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    code: '',
    notes: '',
  });

  const { data: suppliers, isLoading, refetch } = trpc.admin.suppliers.useQuery();
  const createSupplierMutation = trpc.admin.createSupplier.useMutation({
    onSuccess: () => {
      refetch();
      setShowAddModal(false);
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        code: '',
        notes: '',
      });
    },
  });
  const updateSupplierMutation = trpc.admin.updateSupplier.useMutation({
    onSuccess: () => {
      refetch();
      setEditingSupplier(null);
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        code: '',
        notes: '',
      });
    },
  });
  const deleteSupplierMutation = trpc.admin.deleteSupplier.useMutation({
    onSuccess: () => refetch(),
  });

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];

    return suppliers.filter((supplier: Supplier) => {
      return (
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.phone?.includes(searchTerm)
      );
    });
  }, [suppliers, searchTerm]);

  const getLanguageLabel = (key: string) => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        'suppliers': '廠商管理',
        'search': '搜尋廠商...',
        'add': '新增廠商',
        'name': '廠商名稱',
        'contact': '聯絡人',
        'email': '郵箱',
        'phone': '電話',
        'address': '地址',
        'city': '城市',
        'country': '國家',
        'code': '廠商編號',
        'notes': '備註',
        'action': '操作',
        'edit': '編輯',
        'delete': '刪除',
        'noSuppliers': '暫無廠商',
        'loading': '加載中...',
        'save': '保存',
        'cancel': '取消',
      },
      en: {
        'suppliers': 'Supplier Management',
        'search': 'Search suppliers...',
        'add': 'Add Supplier',
        'name': 'Supplier Name',
        'contact': 'Contact Person',
        'email': 'Email',
        'phone': 'Phone',
        'address': 'Address',
        'city': 'City',
        'country': 'Country',
        'code': 'Supplier Code',
        'notes': 'Notes',
        'action': 'Action',
        'edit': 'Edit',
        'delete': 'Delete',
        'noSuppliers': 'No suppliers',
        'loading': 'Loading...',
        'save': 'Save',
        'cancel': 'Cancel',
      },
      ja: {
        'suppliers': 'サプライヤー管理',
        'search': 'サプライヤーを検索...',
        'add': 'サプライヤーを追加',
        'name': 'サプライヤー名',
        'contact': '連絡先',
        'email': 'メール',
        'phone': '電話',
        'address': '住所',
        'city': '都市',
        'country': '国',
        'code': 'サプライヤーコード',
        'notes': '注記',
        'action': 'アクション',
        'edit': '編集',
        'delete': '削除',
        'noSuppliers': 'サプライヤーなし',
        'loading': '読み込み中...',
        'save': '保存',
        'cancel': 'キャンセル',
      },
    };
    return labels[language]?.[key] || key;
  };

  const handleAddSupplier = async () => {
    if (!formData.name.trim()) return;
    await createSupplierMutation.mutateAsync(formData as any);
  };

  const handleDelete = async (id: number) => {
    if (confirm(getLanguageLabel('delete') + '?')) {
      await deleteSupplierMutation.mutateAsync({ id });
    }
  };

  const handleEditSupplier = async () => {
    if (!editingSupplier || !formData.name.trim()) return;
    await updateSupplierMutation.mutateAsync({
      id: editingSupplier.id,
      ...formData,
    } as any);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {getLanguageLabel('suppliers')}
        </h2>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#0ABAB5] hover:bg-[#089B96]"
        >
          <Plus className="w-4 h-4" />
          {getLanguageLabel('add')}
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={getLanguageLabel('search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0ABAB5]" />
        </div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier: Supplier) => (
            <Card key={supplier.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">{supplier.name}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSupplier(supplier)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(supplier.id)}
                    disabled={deleteSupplierMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {supplier.contactPerson && (
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{getLanguageLabel('contact')}:</span> {supplier.contactPerson}
                  </p>
                )}

                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${supplier.email}`} className="text-[#0ABAB5] hover:underline">
                      {supplier.email}
                    </a>
                  </div>
                )}

                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${supplier.phone}`} className="text-[#0ABAB5] hover:underline">
                      {supplier.phone}
                    </a>
                  </div>
                )}

                {supplier.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p>{supplier.address}</p>
                      {(supplier.city || supplier.country) && (
                        <p className="text-xs text-gray-600">
                          {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {supplier.notes && (
                  <p className="text-xs text-gray-600 italic border-t pt-3">
                    {supplier.notes}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm">
          <p className="text-gray-500">{getLanguageLabel('noSuppliers')}</p>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6 text-gray-900">
                {getLanguageLabel('edit')}
              </h3>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder={getLanguageLabel('name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('contact')}
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="email"
                  placeholder={getLanguageLabel('email')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="tel"
                  placeholder={getLanguageLabel('phone')}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('address')}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('city')}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('country')}
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('code')}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <textarea
                  placeholder={getLanguageLabel('notes')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleEditSupplier}
                  disabled={updateSupplierMutation.isPending || !formData.name.trim()}
                  className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {updateSupplierMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {getLanguageLabel('loading')}
                    </>
                  ) : (
                    getLanguageLabel('save')
                  )}
                </Button>
                <Button
                  onClick={() => setEditingSupplier(null)}
                  variant="outline"
                  className="flex-1"
                >
                  {getLanguageLabel('cancel')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6 text-gray-900">
                {getLanguageLabel('add')}
              </h3>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder={getLanguageLabel('name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('contact')}
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="email"
                  placeholder={getLanguageLabel('email')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="tel"
                  placeholder={getLanguageLabel('phone')}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('address')}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('city')}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('country')}
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <input
                  type="text"
                  placeholder={getLanguageLabel('code')}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
                />
                <textarea
                  placeholder={getLanguageLabel('notes')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ABAB5] h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleAddSupplier}
                  disabled={createSupplierMutation.isPending || !formData.name.trim()}
                  className="flex-1 bg-[#0ABAB5] hover:bg-[#089B96] text-white"
                >
                  {createSupplierMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {getLanguageLabel('loading')}
                    </>
                  ) : (
                    getLanguageLabel('save')
                  )}
                </Button>
                <Button
                  onClick={() => setShowAddModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  {getLanguageLabel('cancel')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AnnouncementFormData {
  contentZh: string;
  contentEn: string;
  contentJa: string;
  isActive: boolean;
  priority: number;
  startDate: string;
  endDate: string;
}

const defaultFormData: AnnouncementFormData = {
  contentZh: '',
  contentEn: '',
  contentJa: '',
  isActive: true,
  priority: 0,
  startDate: '',
  endDate: '',
};

export default function AnnouncementManagement() {
  const { language } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(defaultFormData);

  const utils = trpc.useUtils();
  const { data: announcements, isLoading } = trpc.admin.announcements.useQuery();

  const createMutation = trpc.admin.createAnnouncement.useMutation({
    onSuccess: () => {
      utils.admin.announcements.invalidate();
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      toast.success(language === 'zh' ? '公告已創建' : language === 'ja' ? 'お知らせを作成しました' : 'Announcement created');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.admin.updateAnnouncement.useMutation({
    onSuccess: () => {
      utils.admin.announcements.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      toast.success(language === 'zh' ? '公告已更新' : language === 'ja' ? 'お知らせを更新しました' : 'Announcement updated');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.admin.deleteAnnouncement.useMutation({
    onSuccess: () => {
      utils.admin.announcements.invalidate();
      toast.success(language === 'zh' ? '公告已刪除' : language === 'ja' ? 'お知らせを削除しました' : 'Announcement deleted');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleActiveMutation = trpc.admin.toggleAnnouncementActive.useMutation({
    onSuccess: () => {
      utils.admin.announcements.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: any = {
      contentZh: formData.contentZh,
      contentEn: formData.contentEn || undefined,
      contentJa: formData.contentJa || undefined,
      isActive: formData.isActive,
      priority: formData.priority,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (announcement: any) => {
    setEditingId(announcement.id);
    setFormData({
      contentZh: announcement.contentZh || '',
      contentEn: announcement.contentEn || '',
      contentJa: announcement.contentJa || '',
      isActive: announcement.isActive,
      priority: announcement.priority || 0,
      startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().slice(0, 16) : '',
      endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm(language === 'zh' ? '確定要刪除這個公告嗎？' : language === 'ja' ? 'このお知らせを削除しますか？' : 'Are you sure you want to delete this announcement?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !currentActive });
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const getText = (zh: string, en: string, ja: string) => {
    return language === 'zh' ? zh : language === 'ja' ? ja : en;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ABAB5]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {getText('公告管理', 'Announcement Management', 'お知らせ管理')}
        </h2>
        <Button onClick={openCreateDialog} className="bg-[#0ABAB5] hover:bg-[#089B96]">
          <Plus className="w-4 h-4 mr-2" />
          {getText('新增公告', 'Add Announcement', 'お知らせを追加')}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId
                  ? getText('編輯公告', 'Edit Announcement', 'お知らせを編集')
                  : getText('新增公告', 'Add Announcement', 'お知らせを追加')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="contentZh" className="flex items-center gap-2">
                  🇹🇼 {getText('中文內容', 'Chinese Content', '中国語内容')}
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="contentZh"
                  value={formData.contentZh}
                  onChange={(e) => setFormData({ ...formData, contentZh: e.target.value })}
                  placeholder={getText('輸入中文公告內容...', 'Enter Chinese content...', '中国語の内容を入力...')}
                  required
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="contentEn" className="flex items-center gap-2">
                  🇺🇸 {getText('英文內容', 'English Content', '英語内容')}
                </Label>
                <Textarea
                  id="contentEn"
                  value={formData.contentEn}
                  onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
                  placeholder={getText('輸入英文公告內容...', 'Enter English content...', '英語の内容を入力...')}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="contentJa" className="flex items-center gap-2">
                  🇯🇵 {getText('日文內容', 'Japanese Content', '日本語内容')}
                </Label>
                <Textarea
                  id="contentJa"
                  value={formData.contentJa}
                  onChange={(e) => setFormData({ ...formData, contentJa: e.target.value })}
                  placeholder={getText('輸入日文公告內容...', 'Enter Japanese content...', '日本語の内容を入力...')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">{getText('優先順序', 'Priority', '優先順位')}</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('數字越大越優先顯示', 'Higher number = higher priority', '数字が大きいほど優先')}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">
                    {getText('立即啟用', 'Active', '有効')}
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">{getText('開始時間', 'Start Date', '開始日時')}</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('留空表示立即開始', 'Leave empty for immediate start', '空欄で即時開始')}
                  </p>
                </div>

                <div>
                  <Label htmlFor="endDate">{getText('結束時間', 'End Date', '終了日時')}</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('留空表示永不結束', 'Leave empty for no end', '空欄で無期限')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {getText('取消', 'Cancel', 'キャンセル')}
                </Button>
                <Button
                  type="submit"
                  className="bg-[#0ABAB5] hover:bg-[#089B96]"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? getText('處理中...', 'Processing...', '処理中...')
                    : editingId
                      ? getText('更新', 'Update', '更新')
                      : getText('創建', 'Create', '作成')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{getText('狀態', 'Status', 'ステータス')}</TableHead>
              <TableHead>{getText('中文內容', 'Chinese', '中国語')}</TableHead>
              <TableHead>{getText('英文內容', 'English', '英語')}</TableHead>
              <TableHead>{getText('日文內容', 'Japanese', '日本語')}</TableHead>
              <TableHead className="w-20">{getText('優先', 'Priority', '優先')}</TableHead>
              <TableHead className="w-32">{getText('操作', 'Actions', '操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements && announcements.length > 0 ? (
              announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(announcement.id, announcement.isActive)}
                      className={`p-1 rounded ${announcement.isActive ? 'text-green-600' : 'text-gray-400'}`}
                      title={announcement.isActive ? getText('點擊停用', 'Click to disable', 'クリックで無効化') : getText('點擊啟用', 'Click to enable', 'クリックで有効化')}
                    >
                      {announcement.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={announcement.contentZh}>
                    {announcement.contentZh}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-gray-500" title={announcement.contentEn || ''}>
                    {announcement.contentEn || '-'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-gray-500" title={announcement.contentJa || ''}>
                    {announcement.contentJa || '-'}
                  </TableCell>
                  <TableCell>{announcement.priority}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {getText('暫無公告', 'No announcements', 'お知らせはありません')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Card>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">
          {getText('使用說明', 'Instructions', '使用方法')}
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• {getText('公告會顯示在網站首頁的跑馬燈中', 'Announcements will be displayed in the marquee on the homepage', 'お知らせはホームページのマーキーに表示されます')}</li>
          <li>• {getText('可以設置多語言內容，系統會根據用戶語言自動顯示', 'You can set multi-language content, the system will display based on user language', '多言語コンテンツを設定でき、システムはユーザーの言語に基づいて表示します')}</li>
          <li>• {getText('優先順序數字越大，顯示越靠前', 'Higher priority number means earlier display', '優先順位の数字が大きいほど、先に表示されます')}</li>
          <li>• {getText('可以設置開始和結束時間來控制公告的顯示期間', 'You can set start and end times to control the display period', '開始時間と終了時間を設定して表示期間を制御できます')}</li>
        </ul>
      </div>
    </div>
  );
}

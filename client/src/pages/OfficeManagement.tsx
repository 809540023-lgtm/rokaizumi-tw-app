import UniverOfficeFrame from '@/components/office/UniverOfficeFrame';

/**
 * 管理後台的「Office 編輯器」頁：內嵌 Univer Office（試算表／文檔）。
 * 由 AdminPanel 依路徑 /admin-panel/office 掛載，因此沿用後台的登入保護。
 */
export default function OfficeManagement() {
  return <UniverOfficeFrame />;
}

/**
 * 文檔（Word 式）範本庫。
 *
 * 每個範本是一串段落文字。表格與進階排版會隨 Univer Docs 的開源版本能力而異，
 * 這裡刻意只用「段落 + 標題」這種在任何版本都成立的做法，
 * 需要更複雜排版時使用者可以在編輯器裡自行加。
 */

import type { DocTemplateDefinition, TemplateContext } from '../types';

const today = (context?: TemplateContext) => context?.today ?? new Date().toLocaleDateString('zh-TW');
const company = (context?: TemplateContext) => context?.company ?? 'ろかいずみ株式会社';

/** 正式函文 / 通知 */
const officialLetter: DocTemplateDefinition = {
  key: 'official-letter',
  name: '公司函文',
  description: '對外正式發文，含受文者、主旨、說明與署名',
  icon: 'Mail',
  centeredIndexes: [0, 1],
  build: (context) => [
    `${company(context)}`,
    '函',
    '',
    `發文日期：${today(context)}`,
    '發文字號：　　　　　號',
    '',
    '受文者：　　　　　　　　　　　　　　　',
    '',
    '主旨：　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '說明：',
    '一、　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '二、　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '三、　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '',
    '正本：　　　　　　　　　　　　　',
    '副本：　　　　　　　　　　　　　',
    '',
    '',
    '　　　　　　　　　　　　　　　　（公司章）',
  ],
};

/** 報價說明函（搭配報價單一起寄給客戶） */
const quotationLetter: DocTemplateDefinition = {
  key: 'quotation-letter',
  name: '報價說明函',
  description: '寄報價單給客戶時附的說明信',
  icon: 'FileSignature',
  build: (context) => [
    '報價說明函',
    '',
    '尊敬的　　　　　　　　　先生／小姐：',
    '',
    '感謝您對本公司商品的關注與支持。隨函附上本次報價，詳細內容如下：',
    '',
    '一、報價品項與單價：詳如附件報價單。',
    '二、報價有效期限：自本函發出日起 14 天內有效。',
    '三、交期：確認訂單後約　　個工作日（實際依船期與報關作業而定）。',
    '四、付款條件：　　　　　　　　　　　　。',
    '五、運費與稅金：依實際出貨條件另行計算，明細會於訂單確認時提供。',
    '',
    '若您對上述內容有任何疑問，或需要調整數量與品項，歡迎隨時與我們聯繫，',
    '我們將竭誠為您服務。',
    '',
    '順頌　商祺',
    '',
    '',
    `${company(context)}`,
    `日期：${today(context)}`,
  ],
};

/** 會議記錄 */
const meetingMinutes: DocTemplateDefinition = {
  key: 'meeting-minutes',
  name: '會議記錄',
  description: '標準會議記錄，含出席人員、決議事項與待辦',
  icon: 'Users',
  build: (context) => [
    '會議記錄',
    '',
    `會議名稱：　　　　　　　　　　　　　　　`,
    `會議時間：${today(context)}　　時　　分 ～ 　　時　　分`,
    '會議地點：　　　　　　　　　　　　',
    '主 持 人：　　　　　　　',
    '出席人員：　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '請假人員：　　　　　　　',
    '',
    '一、上次會議決議追蹤',
    '　（一）　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '二、報告事項',
    '　（一）　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '　（二）　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '三、討論事項與決議',
    '　（一）案由：　　　　　　　　　　　　　　　　　　　　　　　',
    '　　　　決議：　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '四、待辦事項',
    '　（一）　　　　　　　　　　　　　　負責人：　　　　　期限：　　　　',
    '',
    '五、臨時動議',
    '',
    '散會時間：　　時　　分',
    '',
    '記錄：　　　　　　　',
  ],
};

/** 簽呈 */
const approval: DocTemplateDefinition = {
  key: 'approval',
  name: '簽　呈',
  description: '內部簽核用，含事由、說明、擬辦與核章欄',
  icon: 'FileCheck',
  centeredIndexes: [0],
  build: (context) => [
    '簽　呈',
    '',
    `簽辦單位：　　　　　　　　　　　承辦人：　　　　　　　日期：${today(context)}`,
    '',
    '主旨：　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '說明：',
    '一、　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '二、　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '擬辦：　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '',
    '核　　章',
    '',
    '承辦人：　　　　　　',
    '單位主管：　　　　　　',
    '總經理：　　　　　　',
    '董事長：　　　　　　',
  ],
};

/** 出貨通知 */
const shippingNotice: DocTemplateDefinition = {
  key: 'shipping-notice',
  name: '出貨通知',
  description: '通知客戶出貨資訊與追蹤單號',
  icon: 'Truck',
  build: (context) => [
    '出貨通知 SHIPPING NOTICE',
    '',
    '受文者：　　　　　　　　　　　',
    `通知日期：${today(context)}`,
    '',
    '一、訂單編號：　　　　　　　　',
    '二、出貨日期：　　　　　　　　',
    '三、承運方式：　　　　　　　　　　',
    '四、追蹤單號：　　　　　　　　　　　　',
    '五、預計到貨日：　　　　　　　　',
    '',
    '六、出貨明細',
    '　　品名　　　　　　　　　　　　數量　　　　備註',
    '　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '　　　　　　　　　　　　　　　　　　　　　　　　　　',
    '',
    '如有任何問題，請聯繫本公司客服。',
    '',
    `${company(context)}`,
  ],
};

/** 空白文件 */
const blankDoc: DocTemplateDefinition = {
  key: 'blank',
  name: '空白文件',
  description: '乾淨的空白文件',
  icon: 'File',
  build: () => [''],
};

export const DOC_TEMPLATES: DocTemplateDefinition[] = [
  officialLetter,
  quotationLetter,
  meetingMinutes,
  approval,
  shippingNotice,
  blankDoc,
];

export function findDocTemplate(key: string): DocTemplateDefinition | undefined {
  return DOC_TEMPLATES.find((t) => t.key === key);
}

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: 'Q1. 從日本送台灣需要報關嗎？要不要繳關稅？',
    a:
      '所有訂單由 ろかいずみ 大阪倉庫直送，網站上標示的價格已內含報關費與關稅，您不需要再額外處理任何海關手續。標示「非課税」的醫療輔具，依台灣海關規定可享免稅。',
  },
  {
    q: 'Q2. 多久可以收到貨？真的 7 天嗎？',
    a:
      '一般商品從下單到收貨平均 7 個工作天。大型商品（介護床、電動輪椅）約 10-14 個工作天。如未準時送達，我們提供全額退費。',
  },
  {
    q: 'Q3. 怎麼確認商品適合我家長輩？',
    a:
      '您可以加 LINE 與我們的客服聯絡（受過介護福祉士訓練），告知長輩身高、體重、行動狀況、使用情境，我們會推薦最適合的款式。也可預約 30 分鐘視訊諮詢。',
  },
  {
    q: 'Q4. 商品壞了怎麼辦？真的有 3 年保固嗎？',
    a:
      '所有商品享 3 年原廠保固，故障零件免費更換，運費由我們負擔。屬人為損壞則酌收材料費。詳情見每件商品頁的「保固說明」區。',
  },
  {
    q: 'Q5. 可以開立統一發票嗎？機構採購流程？',
    a:
      '可開立電子發票或紙本三聯式發票。機構採購請點 Header「企業合作」，填寫採購需求或加 LINE 客服，業務會主動聯繫。月結 30 / 60 天可談。',
  },
  {
    q: 'Q6. 不滿意可以退貨嗎？',
    a:
      '收到貨 7 日內，商品未拆封、未使用，可申請退貨，運費由您負擔。已開封但有原廠瑕疵，我們全額退費並負擔來回運費。詳情見「退換貨政策」。',
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block text-[#0ABAB5] font-bold text-sm tracking-widest uppercase mb-3">
            常見問題
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            下單前最常被問的 6 件事
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
              >
                <button
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left font-bold text-gray-900"
                >
                  {item.q}
                  {open ? (
                    <Minus className="w-5 h-5 text-[#0ABAB5] flex-shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-[#0ABAB5] flex-shrink-0" />
                  )}
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{ maxHeight: open ? '300px' : '0px' }}
                >
                  <div className="px-6 pb-5 text-gray-600 leading-[1.75]">{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

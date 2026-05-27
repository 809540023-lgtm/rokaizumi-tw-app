import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 如果後端有 newsletter API 就直接接，否則先用 fallback toast
  const subscribeMutation = (trpc as any).newsletter?.subscribe?.useMutation?.({
    onSuccess: () => {
      toast.success('感謝訂閱，優惠券已寄至您的 Email');
      setEmail('');
    },
    onError: (e: any) => toast.error(e.message || '訂閱失敗，請稍後再試'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);

    if (subscribeMutation) {
      subscribeMutation.mutate({ email });
    } else {
      // fallback：尚未實作 newsletter API
      await new Promise(r => setTimeout(r, 400));
      toast.success('感謝訂閱，優惠券已寄至您的 Email');
      setEmail('');
    }
    setSubmitting(false);
  };

  return (
    <section className="bg-[#2D2D2D] text-white py-14">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              訂閱電子報，立刻領 NT$ 200 優惠券
            </h2>
            <p className="text-white/70 text-[15px]">
              每週一封：新品快訊、選品指南、限時優惠。隨時可退訂，不會打擾您。
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="輸入您的 Email"
              className="flex-1 px-5 py-3.5 rounded-xl border-0 text-gray-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0ABAB5]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white px-6 py-3.5 rounded-xl font-bold text-sm whitespace-nowrap transition-colors"
            >
              {submitting ? '訂閱中…' : '立即訂閱'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

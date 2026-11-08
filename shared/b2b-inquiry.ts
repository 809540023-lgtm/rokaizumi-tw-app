import { z } from 'zod';

export const b2bInquiryInput = z.object({
  company: z.string().trim().min(1, '公司名稱必填'),
  name: z.string().trim().min(1, '聯絡人必填'),
  phone: z.string().trim().min(1, '電話必填'),
  email: z.string().trim().pipe(z.string().email().or(z.literal(''))).optional().transform(value => value || undefined),
  type: z.string(),
  monthlyBudget: z.string(),
  message: z.string().optional(),
});

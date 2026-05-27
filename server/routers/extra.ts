/**
 * v4 新增的 tRPC routes
 * 把 router 物件展開到 server/routers.ts 的 appRouter 裡：
 *
 * import { newsletter, b2bInquiries, reviews } from './routers/extra';
 *
 * export const appRouter = router({
 *   ...existing,
 *   newsletter,
 *   b2bInquiries,
 *   reviews,
 * });
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, adminProcedure, router } from '../_core/trpc';
import { db } from '../db';
import {
  newsletterSubscribers,
  b2bInquiries as b2bInquiriesTable,
  productReviews,
} from '../../drizzle/schema';
import { eq, desc, sql } from 'drizzle-orm';

/* ============ Newsletter ============ */
export const newsletter = router({
  /** 訪客訂閱電子報，回傳優惠券碼 */
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email('請輸入有效 Email'),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 先檢查是否已訂閱
      const [existed] = await db
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, input.email))
        .limit(1);

      if (existed) {
        return { ok: true, alreadySubscribed: true };
      }

      // 產生 coupon code
      const couponCode = 'NEWS200-' + Math.random().toString(36).slice(2, 8).toUpperCase();

      await db.insert(newsletterSubscribers).values({
        email: input.email,
        source: input.source ?? 'web',
        couponCode,
      });

      // TODO: 寄送 welcome email + 優惠券（接 Mailgun / Resend / SendGrid）
      console.log(`[Newsletter] New subscriber: ${input.email}, coupon ${couponCode}`);

      return { ok: true, couponCode };
    }),

  /** Admin：取得所有訂閱者 */
  list: adminProcedure.query(async () => {
    return db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(500);
  }),

  /** 使用者退訂 */
  unsubscribe: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await db
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: new Date() })
        .where(eq(newsletterSubscribers.email, input.email));
      return { ok: true };
    }),
});

/* ============ B2B Inquiries ============ */
export const b2bInquiries = router({
  /** 訪客送出企業合作詢價 */
  create: publicProcedure
    .input(
      z.object({
        company: z.string().min(1, '公司名稱必填'),
        name: z.string().min(1, '聯絡人必填'),
        phone: z.string().min(1, '電話必填'),
        email: z.string().email().optional(),
        type: z.string(),
        monthlyBudget: z.string(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [inserted] = await db
        .insert(b2bInquiriesTable)
        .values({
          ...input,
          status: 'new',
        })
        .$returningId();

      // TODO: 通知業務（Slack / Telegram / Email）
      console.log(`[B2B Inquiry] ${input.company} (${input.name}) -- ${input.monthlyBudget}`);

      return { ok: true, id: inserted.id };
    }),

  /** Admin：列出所有詢價 */
  list: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const q = db.select().from(b2bInquiriesTable);
      if (input?.status) {
        return q.where(eq(b2bInquiriesTable.status, input.status)).orderBy(desc(b2bInquiriesTable.createdAt));
      }
      return q.orderBy(desc(b2bInquiriesTable.createdAt)).limit(200);
    }),

  /** Admin：更新狀態 */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(['new', 'contacted', 'qualified', 'closed', 'lost']),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(b2bInquiriesTable)
        .set({ status: input.status, internalNote: input.note ?? null })
        .where(eq(b2bInquiriesTable.id, input.id));
      return { ok: true };
    }),
});

/* ============ Product Reviews ============ */
export const reviews = router({
  /** 取得單一商品的評論 */
  listByProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(productReviews)
        .where(eq(productReviews.productId, input.productId))
        .orderBy(desc(productReviews.createdAt))
        .limit(100);
    }),

  /** 取得商品平均評分與評論數 */
  getAggregated: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const [result] = await db
        .select({
          avg: sql<number>`AVG(${productReviews.rating})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(productReviews)
        .where(eq(productReviews.productId, input.productId));
      return {
        average: Number(result?.avg ?? 0),
        count: Number(result?.count ?? 0),
      };
    }),

  /** 已登入用戶送出評論 */
  create: protectedProcedure
    .input(
      z.object({
        productId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string().optional(),
        body: z.string().min(2, '請至少寫 2 個字'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [inserted] = await db
        .insert(productReviews)
        .values({
          productId: input.productId,
          userId: ctx.user.id,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          status: 'pending', // 等審核
        })
        .$returningId();
      return { ok: true, id: inserted.id };
    }),

  /** Admin：審核評論 */
  approve: adminProcedure
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(productReviews)
        .set({ status: input.approve ? 'approved' : 'rejected' })
        .where(eq(productReviews.id, input.id));
      return { ok: true };
    }),
});

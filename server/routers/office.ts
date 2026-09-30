/**
 * Univer Office Kit 的後端路由。
 *
 * 設計重點：
 *  - 只有登入者能讀寫，且只能存取自己的文件（管理員可看全部）
 *  - `save` 只更新最新內容（autosave 用），`saveVersion` 才會留下版本紀錄，
 *    這樣自動存檔不會把版本表灌爆
 *  - 內容是 Univer 快照 JSON，伺服器不理解它的結構，只做大小把關
 *    （太大會被 TiDB 的封包上限擋掉，寧可在這裡給清楚的錯誤）
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { protectedProcedure, router } from '../_core/trpc';
import { db } from '../db';
import { officeDocuments, officeDocumentVersions } from '../../drizzle/schema';

/** TiDB 單一 JSON 欄位的實務上限；超過就請使用者改用「下載備份」 */
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

const kindSchema = z.enum(['sheet', 'doc']);

const saveInput = z.object({
  id: z.string().min(1).max(40).optional(),
  title: z.string().min(1).max(200),
  kind: kindSchema,
  templateKey: z.string().max(80).nullable().optional(),
  content: z.unknown(),
  note: z.string().max(200).optional(),
});

type SaveInput = z.infer<typeof saveInput>;

function contentSize(content: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(content ?? null), 'utf8');
  } catch {
    return 0;
  }
}

function assertSize(content: unknown): void {
  const size = contentSize(content);
  if (size === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '內容是空的，無法存檔' });
  }
  if (size > MAX_CONTENT_BYTES) {
    throw new TRPCError({
      code: 'PAYLOAD_TOO_LARGE',
      message: `內容 ${(size / 1024 / 1024).toFixed(1)}MB 超過 ${MAX_CONTENT_BYTES / 1024 / 1024}MB 上限，請改用「下載備份」保存，或把文件拆成多份。`,
    });
  }
}

type SessionUser = { id: number; role?: string | null };

function canAccess(row: { ownerId: number | null }, user: SessionUser): boolean {
  return user.role === 'admin' || row.ownerId === user.id;
}

async function findDocument(id: string) {
  const rows = await db.select().from(officeDocuments).where(eq(officeDocuments.id, id)).limit(1);
  return rows?.[0] ?? null;
}

function toMeta(row: {
  id: string;
  title: string;
  kind: 'sheet' | 'doc';
  templateKey: string | null;
  currentVersion: number;
  ownerId: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    templateKey: row.templateKey,
    currentVersion: row.currentVersion,
    ownerId: row.ownerId,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

/** 建立版本紀錄（內容為當下的快照） */
async function insertVersion(
  documentId: string,
  version: number,
  content: unknown,
  note: string | undefined,
  userId: number,
) {
  await db.insert(officeDocumentVersions).values({
    documentId,
    version,
    content,
    note: note ?? null,
    createdBy: userId,
  });
}

async function upsertDocument(
  input: SaveInput,
  user: SessionUser,
  options: { createVersion: boolean },
) {
  assertSize(input.content);

  const existing = input.id ? await findDocument(input.id) : null;

  if (existing) {
    if (!canAccess(existing, user)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '沒有權限修改這份文件' });
    }

    const nextVersion = options.createVersion ? existing.currentVersion + 1 : existing.currentVersion;

    await db
      .update(officeDocuments)
      .set({
        title: input.title,
        templateKey: input.templateKey ?? existing.templateKey ?? null,
        content: input.content,
        currentVersion: nextVersion,
      })
      .where(eq(officeDocuments.id, existing.id));

    if (options.createVersion) {
      await insertVersion(existing.id, nextVersion, input.content, input.note, user.id);
    }

    return {
      id: existing.id,
      title: input.title,
      kind: existing.kind,
      templateKey: input.templateKey ?? existing.templateKey ?? null,
      currentVersion: nextVersion,
      ownerId: existing.ownerId,
      createdAt: existing.createdAt ? new Date(existing.createdAt).toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  const id = input.id && input.id.length > 0 ? input.id : randomUUID();

  await db.insert(officeDocuments).values({
    id,
    ownerId: user.id,
    title: input.title,
    kind: input.kind,
    templateKey: input.templateKey ?? null,
    currentVersion: 1,
    content: input.content,
  });

  // 第一版也要留一份，之後才有「回到最初」可用
  await insertVersion(id, 1, input.content, input.note ?? '建立文件', user.id);

  const now = new Date().toISOString();
  return {
    id,
    title: input.title,
    kind: input.kind,
    templateKey: input.templateKey ?? null,
    currentVersion: 1,
    ownerId: user.id,
    createdAt: now,
    updatedAt: now,
  };
}

export const office = router({
  /** 列出可存取的文件（不含內容，讓清單查詢維持輕量） */
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user as SessionUser;
    const rows = await db
      .select({
        id: officeDocuments.id,
        title: officeDocuments.title,
        kind: officeDocuments.kind,
        templateKey: officeDocuments.templateKey,
        currentVersion: officeDocuments.currentVersion,
        ownerId: officeDocuments.ownerId,
        createdAt: officeDocuments.createdAt,
        updatedAt: officeDocuments.updatedAt,
      })
      .from(officeDocuments)
      .where(user.role === 'admin' ? undefined : eq(officeDocuments.ownerId, user.id))
      .orderBy(desc(officeDocuments.updatedAt))
      .limit(200);

    return (rows ?? []).map(toMeta);
  }),

  /** 取得單一文件（含內容快照） */
  get: protectedProcedure.input(z.object({ id: z.string().min(1).max(40) })).query(async ({ ctx, input }) => {
    const user = ctx.user as SessionUser;
    const row = await findDocument(input.id);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到這份文件' });
    if (!canAccess(row, user)) throw new TRPCError({ code: 'FORBIDDEN', message: '沒有權限存取這份文件' });

    return { ...toMeta(row), content: row.content };
  }),

  /** 存檔（更新最新內容，不新增版本） */
  save: protectedProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    return upsertDocument(input, ctx.user as SessionUser, { createVersion: false });
  }),

  /** 另存為新版本（保留歷史） */
  saveVersion: protectedProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    return upsertDocument(input, ctx.user as SessionUser, { createVersion: true });
  }),

  /** 版本清單（不含內容，只回大小與時間） */
  versions: protectedProcedure
    .input(z.object({ documentId: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.user as SessionUser;
      const row = await findDocument(input.documentId);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到這份文件' });
      if (!canAccess(row, user)) throw new TRPCError({ code: 'FORBIDDEN', message: '沒有權限存取這份文件' });

      const rows = await db
        .select()
        .from(officeDocumentVersions)
        .where(eq(officeDocumentVersions.documentId, input.documentId))
        .orderBy(desc(officeDocumentVersions.version))
        .limit(50);

      return (rows ?? []).map((v: any) => ({
        id: v.id,
        documentId: v.documentId,
        version: v.version,
        note: v.note,
        createdBy: v.createdBy,
        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : undefined,
        sizeBytes: contentSize(v.content),
      }));
    }),

  /**
   * 還原到指定版本。
   * 還原會建立一個「新版本」而不是覆蓋歷史，這樣誤按還原也能回頭。
   */
  restore: protectedProcedure
    .input(z.object({ documentId: z.string().min(1).max(40), version: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as SessionUser;
      const row = await findDocument(input.documentId);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到這份文件' });
      if (!canAccess(row, user)) throw new TRPCError({ code: 'FORBIDDEN', message: '沒有權限修改這份文件' });

      const targets = await db
        .select()
        .from(officeDocumentVersions)
        .where(
          and(
            eq(officeDocumentVersions.documentId, input.documentId),
            eq(officeDocumentVersions.version, input.version),
          ),
        )
        .limit(1);

      const target = targets?.[0];
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: `找不到 v${input.version}` });

      const nextVersion = row.currentVersion + 1;
      await db
        .update(officeDocuments)
        .set({ content: target.content, currentVersion: nextVersion })
        .where(eq(officeDocuments.id, row.id));
      await insertVersion(row.id, nextVersion, target.content, `還原自 v${input.version}`, user.id);

      return { ...toMeta({ ...row, currentVersion: nextVersion, updatedAt: new Date() }), content: target.content };
    }),

  /** 刪除文件與其所有版本 */
  remove: protectedProcedure.input(z.object({ id: z.string().min(1).max(40) })).mutation(async ({ ctx, input }) => {
    const user = ctx.user as SessionUser;
    const row = await findDocument(input.id);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到這份文件' });
    if (!canAccess(row, user)) throw new TRPCError({ code: 'FORBIDDEN', message: '沒有權限刪除這份文件' });

    await db.delete(officeDocumentVersions).where(eq(officeDocumentVersions.documentId, row.id));
    await db.delete(officeDocuments).where(eq(officeDocuments.id, row.id));

    return { ok: true, id: row.id };
  }),
});

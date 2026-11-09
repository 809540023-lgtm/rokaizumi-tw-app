import { Router } from "express";
import mysql from "mysql2/promise";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sdk } from "./_core/sdk";

/**
 * 員工打卡（簡單版試用）
 * - 員工用手機開 /attendance/，選名字 + 輸入 PIN，按出勤／退勤／休息開始／休息結束。
 * - 時間一律由伺服器產生（日本時間 JST 顯示與分組），員工改手機時間無效。
 * - 管理員（網站 admin 帳號）在 /attendance/admin/ 新增員工、看紀錄、下載 CSV。
 * - 儲存：有 DATABASE_URL 時用 MySQL（正式環境）；沒有時用本機 JSON 檔（本地測試用，
 *   Render 正式環境一定有 DATABASE_URL，不會走到檔案後備）。
 */

export type AttendanceType = "in" | "out" | "break_start" | "break_end";
const TYPES: AttendanceType[] = ["in", "out", "break_start", "break_end"];

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AttendanceType;
  atMs: number;
  /** true = 管理員事後補登（非即時打卡）。補登必須以實際出勤事實為依據。 */
  manual?: boolean;
  note?: string;
};

type Employee = {
  id: string;
  name: string;
  pinHash: string;
  active: boolean;
  createdAtMs: number;
};

// ---------- PIN ----------
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------- JST 時間 ----------
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDateString(atMs: number): string {
  const d = new Date(atMs + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function jstTimeString(atMs: number): string {
  const d = new Date(atMs + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** JST 月份的 UTC 起訖（exclusive end）。month = "YYYY-MM" */
export function jstMonthRangeMs(month: string): { startMs: number; endMs: number } {
  const [y, m] = month.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, 1) - JST_OFFSET_MS;
  const endMs = Date.UTC(y, m, 1) - JST_OFFSET_MS;
  return { startMs, endMs };
}

/** JST 牆鐘時間（date "YYYY-MM-DD" + time "HH:MM"）轉 UTC epoch ms。 */
export function jstWallToMs(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - JST_OFFSET_MS;
}

/** date "YYYY-MM-DD" 的星期（0=週日 … 6=週六，JST 與 UTC 同日曆日）。 */
export function jstWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const validDateString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
export const validTimeString = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// ---------- 打卡狀態機 ----------
export function allowedNext(last: AttendanceType | null): AttendanceType[] {
  switch (last) {
    case null:
    case "out":
      return ["in"];
    case "in":
    case "break_end":
      return ["break_start", "out"];
    case "break_start":
      return ["break_end"];
  }
}

// ---------- 每日彙總（給薪資計算用） ----------
export type DaySummary = {
  date: string;
  employeeId: string;
  employeeName: string;
  firstIn: string | null;
  lastOut: string | null;
  breakMinutes: number;
  workMinutes: number | null; // 尚未退勤時為 null
  complete: boolean;
};

export function summarize(records: AttendanceRecord[]): DaySummary[] {
  const groups = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const key = `${r.employeeId}|${jstDateString(r.atMs)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const summaries: DaySummary[] = [];
  groups.forEach((list, key) => {
    const [employeeId, date] = key.split("|");
    const sorted = [...list].sort((a, b) => a.atMs - b.atMs);
    let workMs = 0;
    let breakMs = 0;
    let segmentStart: number | null = null;
    let breakStart: number | null = null;
    let firstIn: number | null = null;
    let lastOut: number | null = null;
    let openSegment = false;
    for (const r of sorted) {
      if (r.type === "in") {
        segmentStart = r.atMs;
        openSegment = true;
        if (firstIn === null) firstIn = r.atMs;
      } else if (r.type === "break_start") {
        breakStart = r.atMs;
      } else if (r.type === "break_end") {
        if (breakStart !== null) {
          breakMs += r.atMs - breakStart;
          breakStart = null;
        }
      } else if (r.type === "out") {
        if (segmentStart !== null) {
          workMs += r.atMs - segmentStart;
          segmentStart = null;
        }
        openSegment = false;
        lastOut = r.atMs;
      }
    }
    // 退勤時還在休息中的段落：休息時間算到退勤為止
    const netWorkMs = workMs - breakMs;
    summaries.push({
      date,
      employeeId,
      employeeName: sorted[0].employeeName,
      firstIn: firstIn !== null ? jstTimeString(firstIn) : null,
      lastOut: lastOut !== null ? jstTimeString(lastOut) : null,
      breakMinutes: Math.round(breakMs / 60000),
      workMinutes: lastOut !== null || !openSegment ? Math.max(0, Math.round(netWorkMs / 60000)) : null,
      complete: !openSegment && lastOut !== null,
    });
  });
  return summaries.sort((a, b) => (a.date === b.date ? a.employeeName.localeCompare(b.employeeName) : a.date < b.date ? 1 : -1));
}

// ---------- 儲存層 ----------
let pool: mysql.Pool | undefined;
function database(): mysql.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    const override = process.env.DATABASE_SSL;
    const internal = /^(localhost|127\.0\.0\.1|10\..*|192\.168\..*|172\.(1[6-9]|2\d|3[01])\..*)$/.test(url.hostname);
    pool = mysql.createPool({ uri: process.env.DATABASE_URL, ...(override === "false" || (!override && internal) ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }) });
  }
  return pool;
}

async function ensureTables(db: mysql.Pool) {
  await db.query("CREATE TABLE IF NOT EXISTS attendance_employees (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, pin_hash VARCHAR(200) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at_ms BIGINT NOT NULL)");
  await db.query("CREATE TABLE IF NOT EXISTS attendance_records (id VARCHAR(36) PRIMARY KEY, employee_id VARCHAR(36) NOT NULL, type VARCHAR(20) NOT NULL, at_ms BIGINT NOT NULL, manual TINYINT(1) NOT NULL DEFAULT 0, note VARCHAR(255) NULL, INDEX idx_attendance_employee (employee_id), INDEX idx_attendance_at (at_ms))");
  // 既有資料表（補登功能上線前建立的）補上 manual / note 欄位；重複欄位錯誤忽略。
  try { await db.query("ALTER TABLE attendance_records ADD COLUMN manual TINYINT(1) NOT NULL DEFAULT 0"); } catch { /* 已存在 */ }
  try { await db.query("ALTER TABLE attendance_records ADD COLUMN note VARCHAR(255) NULL"); } catch { /* 已存在 */ }
}

// 本地測試用 JSON 檔後備（正式環境有 DATABASE_URL，不會使用）
type FileData = { employees: Employee[]; records: AttendanceRecord[] };
function filePath(): string {
  return process.env.ATTENDANCE_DATA_FILE || path.join(process.cwd(), "data", "attendance.json");
}
function readFileData(): FileData {
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    const parsed = JSON.parse(raw) as FileData;
    return { employees: parsed.employees ?? [], records: parsed.records ?? [] };
  } catch {
    return { employees: [], records: [] };
  }
}
function writeFileData(data: FileData) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), "utf8");
}

async function listEmployees(activeOnly: boolean): Promise<Employee[]> {
  const db = database();
  if (db) {
    await ensureTables(db);
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, name, pin_hash, active, created_at_ms FROM attendance_employees ${activeOnly ? "WHERE active = 1" : ""} ORDER BY created_at_ms ASC`
    );
    return rows.map(r => ({ id: String(r.id), name: String(r.name), pinHash: String(r.pin_hash), active: Boolean(r.active), createdAtMs: Number(r.created_at_ms) }));
  }
  return readFileData().employees.filter(e => !activeOnly || e.active);
}

async function findEmployee(id: string): Promise<Employee | null> {
  const all = await listEmployees(false);
  return all.find(e => e.id === id) ?? null;
}

async function createEmployee(name: string, pinHash: string): Promise<Employee> {
  const employee: Employee = { id: randomUUID(), name, pinHash, active: true, createdAtMs: Date.now() };
  const db = database();
  if (db) {
    await ensureTables(db);
    await db.execute("INSERT INTO attendance_employees (id, name, pin_hash, active, created_at_ms) VALUES (?, ?, ?, 1, ?)", [employee.id, employee.name, employee.pinHash, employee.createdAtMs]);
    return employee;
  }
  const data = readFileData();
  data.employees.push(employee);
  writeFileData(data);
  return employee;
}

async function setEmployeeActive(id: string, active: boolean): Promise<boolean> {
  const db = database();
  if (db) {
    await ensureTables(db);
    const [result] = await db.execute<mysql.ResultSetHeader>("UPDATE attendance_employees SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
    return result.affectedRows > 0;
  }
  const data = readFileData();
  const employee = data.employees.find(e => e.id === id);
  if (!employee) return false;
  employee.active = active;
  writeFileData(data);
  return true;
}

async function addRecord(employeeId: string, type: AttendanceType, atMs: number, opts?: { manual?: boolean; note?: string }): Promise<AttendanceRecord> {
  const employee = await findEmployee(employeeId);
  const record: AttendanceRecord = { id: randomUUID(), employeeId, employeeName: employee?.name ?? "", type, atMs, manual: opts?.manual ?? false, note: opts?.note };
  const db = database();
  if (db) {
    await ensureTables(db);
    await db.execute("INSERT INTO attendance_records (id, employee_id, type, at_ms, manual, note) VALUES (?, ?, ?, ?, ?, ?)", [record.id, employeeId, type, atMs, record.manual ? 1 : 0, record.note ?? null]);
    return record;
  }
  const data = readFileData();
  data.records.push(record);
  writeFileData(data);
  return record;
}

async function listRecords(range?: { startMs: number; endMs: number }): Promise<AttendanceRecord[]> {
  const employees = await listEmployees(false);
  const names = new Map(employees.map(e => [e.id, e.name]));
  const db = database();
  if (db) {
    await ensureTables(db);
    const [rows] = range
      ? await db.query<mysql.RowDataPacket[]>("SELECT id, employee_id, type, at_ms, manual, note FROM attendance_records WHERE at_ms >= ? AND at_ms < ? ORDER BY at_ms DESC LIMIT 5000", [range.startMs, range.endMs])
      : await db.query<mysql.RowDataPacket[]>("SELECT id, employee_id, type, at_ms, manual, note FROM attendance_records ORDER BY at_ms DESC LIMIT 5000");
    return rows.map(r => ({ id: String(r.id), employeeId: String(r.employee_id), employeeName: names.get(String(r.employee_id)) ?? "", type: r.type as AttendanceType, atMs: Number(r.at_ms), manual: Boolean(r.manual), note: r.note ? String(r.note) : undefined }));
  }
  return readFileData()
    .records.filter(r => !range || (r.atMs >= range.startMs && r.atMs < range.endMs))
    .map(r => ({ ...r, employeeName: names.get(r.employeeId) ?? r.employeeName }))
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, 5000);
}

async function lastRecord(employeeId: string): Promise<AttendanceRecord | null> {
  const db = database();
  const employees = await listEmployees(false);
  const name = employees.find(e => e.id === employeeId)?.name ?? "";
  if (db) {
    await ensureTables(db);
    const [rows] = await db.query<mysql.RowDataPacket[]>("SELECT id, employee_id, type, at_ms, manual, note FROM attendance_records WHERE employee_id = ? ORDER BY at_ms DESC LIMIT 1", [employeeId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return { id: String(r.id), employeeId: String(r.employee_id), employeeName: name, type: r.type as AttendanceType, atMs: Number(r.at_ms), manual: Boolean(r.manual), note: r.note ? String(r.note) : undefined };
  }
  const mine = readFileData().records.filter(r => r.employeeId === employeeId).sort((a, b) => b.atMs - a.atMs);
  return mine.length ? { ...mine[0], employeeName: name } : null;
}

// ---------- 共用檢查 ----------
const router = Router();

const sameOrigin = (req: import("express").Request) => {
  const origin = req.get("origin");
  return !origin || origin === `${req.protocol}://${req.get("host")}` || origin === `https://${req.get("host")}`;
};

async function requireAdmin(req: import("express").Request): Promise<boolean> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin";
  } catch {
    return false;
  }
}

const validPinFormat = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4,8}$/.test(pin);
const field = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;

// PIN 連續錯誤鎖定（簡單版：10 分鐘內錯 5 次，鎖 10 分鐘）
const attempts = new Map<string, { count: number; lockedUntil: number; windowStart: number }>();
function pinLocked(employeeId: string): boolean {
  const entry = attempts.get(employeeId);
  return Boolean(entry && entry.lockedUntil > Date.now());
}
function notePinResult(employeeId: string, ok: boolean) {
  if (ok) {
    attempts.delete(employeeId);
    return;
  }
  const now = Date.now();
  const entry = attempts.get(employeeId);
  if (!entry || now - entry.windowStart > 10 * 60 * 1000) {
    attempts.set(employeeId, { count: 1, lockedUntil: 0, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count >= 5) entry.lockedUntil = now + 10 * 60 * 1000;
}

async function authenticateEmployee(req: import("express").Request, res: import("express").Response): Promise<Employee | null> {
  const employeeId = field(req.body?.employeeId, 64);
  const pin = req.body?.pin;
  if (!employeeId || !validPinFormat(pin)) {
    res.status(400).json({ error: "従業員とPINコードを選んでください。" });
    return null;
  }
  if (pinLocked(employeeId)) {
    res.status(429).json({ error: "PINコードの入力ミスが続いたため、10分間ロックされています。" });
    return null;
  }
  const employee = await findEmployee(employeeId);
  if (!employee || !employee.active || !verifyPin(pin, employee.pinHash)) {
    notePinResult(employeeId, false);
    res.status(401).json({ error: "PINコードが違います。" });
    return null;
  }
  notePinResult(employeeId, true);
  return employee;
}

// ---------- 員工端 ----------
router.get("/employees", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const employees = await listEmployees(true);
    return res.json({ employees: employees.map(e => ({ id: e.id, name: e.name })) });
  } catch (error) {
    console.error("Could not list attendance employees", error);
    return res.status(503).json({ error: "一時的に利用できません。" });
  }
});

router.post("/status", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  const employee = await authenticateEmployee(req, res);
  if (!employee) return;
  try {
    const last = await lastRecord(employee.id);
    const today = jstDateString(Date.now());
    const all = await listRecords();
    const todays = all
      .filter(r => r.employeeId === employee.id && jstDateString(r.atMs) === today)
      .sort((a, b) => a.atMs - b.atMs)
      .map(r => ({ type: r.type, time: jstTimeString(r.atMs), manual: Boolean(r.manual) }));
    return res.json({ employee: { id: employee.id, name: employee.name }, lastType: last?.type ?? null, allowed: allowedNext(last?.type ?? null), today: todays });
  } catch (error) {
    console.error("Could not read attendance status", error);
    return res.status(503).json({ error: "一時的に利用できません。" });
  }
});

router.post("/clock", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  const type = req.body?.type as AttendanceType;
  if (!TYPES.includes(type)) return res.status(400).json({ error: "打刻の種類が正しくありません。" });
  const employee = await authenticateEmployee(req, res);
  if (!employee) return;
  try {
    const last = await lastRecord(employee.id);
    const allowed = allowedNext(last?.type ?? null);
    if (!allowed.includes(type)) {
      return res.status(409).json({ error: "今の状態ではこの打刻はできません。", allowed });
    }
    const now = Date.now();
    const record = await addRecord(employee.id, type, now);
    return res.json({
      ok: true,
      type: record.type,
      date: jstDateString(now),
      time: jstTimeString(now),
      allowed: allowedNext(type),
    });
  } catch (error) {
    console.error("Could not save attendance record", error);
    return res.status(503).json({ error: "保存できませんでした。もう一度お試しください。" });
  }
});

// ---------- 管理員端 ----------
router.post("/employees", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const name = field(req.body?.name, 50);
  const pin = req.body?.pin;
  if (!name) return res.status(400).json({ error: "請輸入員工姓名。" });
  if (!validPinFormat(pin)) return res.status(400).json({ error: "PIN 必須是 4 到 8 位數字。" });
  try {
    const employee = await createEmployee(name, hashPin(pin));
    return res.json({ employee: { id: employee.id, name: employee.name, active: true } });
  } catch (error) {
    console.error("Could not create attendance employee", error);
    return res.status(503).json({ error: "無法新增員工，請再試一次。" });
  }
});

router.get("/admin/employees", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const employees = await listEmployees(false);
  return res.json({ employees: employees.map(e => ({ id: e.id, name: e.name, active: e.active })) });
});

router.post("/employees/:id/active", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const active = req.body?.active === true;
  const ok = await setEmployeeActive(req.params.id, active);
  if (!ok) return res.status(404).json({ error: "Employee not found." });
  return res.json({ ok: true, active });
});

// ---------- 管理員補登（事後補紀錄，全部標記 manual） ----------
// 補登是「把實際發生過的出勤事後補進系統」，不是即時打卡：紀錄會永久標記為
// 補登並附補登備註，列印／CSV 都看得出區別。只能補已經過去的時間。
type ManualDay = { date: string; in: string; out: string; breakStart?: string; breakEnd?: string; note?: string };

function parseManualDay(body: Record<string, unknown>): { day: ManualDay } | { error: string } {
  const date = body?.date;
  if (!validDateString(date)) return { error: "日期格式不正確（YYYY-MM-DD）。" };
  if (date > jstDateString(Date.now())) return { error: "不能補登未來的日期。" };
  const inTime = body?.in;
  const outTime = body?.out;
  if (!validTimeString(inTime) || !validTimeString(outTime)) return { error: "請輸入正確的出勤與退勤時間。" };
  if (jstWallToMs(date, outTime) <= jstWallToMs(date, inTime)) return { error: "退勤時間必須晚於出勤時間（簡單版不支援跨夜班）。" };
  if (jstWallToMs(date, outTime) > Date.now()) return { error: "只能補登已經過去的時間。" };
  const breakStart = body?.breakStart;
  const breakEnd = body?.breakEnd;
  const hasBreakStart = typeof breakStart === "string" && breakStart.length > 0;
  const hasBreakEnd = typeof breakEnd === "string" && breakEnd.length > 0;
  if (hasBreakStart !== hasBreakEnd) return { error: "休息開始與休息結束要一起填，或都留空。" };
  if (hasBreakStart) {
    if (!validTimeString(breakStart) || !validTimeString(breakEnd)) return { error: "休息時間格式不正確。" };
    if (jstWallToMs(date, breakStart) < jstWallToMs(date, inTime) || jstWallToMs(date, breakEnd) > jstWallToMs(date, outTime) || jstWallToMs(date, breakEnd) <= jstWallToMs(date, breakStart)) {
      return { error: "休息時間必須在出勤到退勤之間，且結束晚於開始。" };
    }
  }
  const note = field(body?.note, 200) ?? undefined;
  return { day: { date, in: inTime, out: outTime, breakStart: hasBreakStart ? (breakStart as string) : undefined, breakEnd: hasBreakEnd ? (breakEnd as string) : undefined, note } };
}

async function dayHasRecords(employeeId: string, date: string): Promise<boolean> {
  const startMs = jstWallToMs(date, "00:00");
  const records = await listRecords({ startMs, endMs: startMs + 24 * 60 * 60 * 1000 });
  return records.some(r => r.employeeId === employeeId);
}

async function createManualDay(employeeId: string, day: ManualDay): Promise<number> {
  const note = day.note ?? "管理員補登";
  let count = 0;
  await addRecord(employeeId, "in", jstWallToMs(day.date, day.in), { manual: true, note });
  count += 1;
  if (day.breakStart && day.breakEnd) {
    await addRecord(employeeId, "break_start", jstWallToMs(day.date, day.breakStart), { manual: true, note });
    await addRecord(employeeId, "break_end", jstWallToMs(day.date, day.breakEnd), { manual: true, note });
    count += 2;
  }
  await addRecord(employeeId, "out", jstWallToMs(day.date, day.out), { manual: true, note });
  count += 1;
  return count;
}

router.post("/manual", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const employeeId = field(req.body?.employeeId, 64);
  if (!employeeId) return res.status(400).json({ error: "請選擇員工。" });
  const employee = await findEmployee(employeeId);
  if (!employee) return res.status(404).json({ error: "找不到這位員工。" });
  const parsed = parseManualDay(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    if (await dayHasRecords(employeeId, parsed.day.date)) {
      return res.status(409).json({ error: `${parsed.day.date} 這天已經有打卡紀錄，不能再補登（避免重複）。` });
    }
    const created = await createManualDay(employeeId, parsed.day);
    return res.json({ ok: true, date: parsed.day.date, created });
  } catch (error) {
    console.error("Could not create manual attendance day", error);
    return res.status(503).json({ error: "補登失敗，請再試一次。" });
  }
});

router.post("/manual-batch", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const employeeId = field(req.body?.employeeId, 64);
  if (!employeeId) return res.status(400).json({ error: "請選擇員工。" });
  const employee = await findEmployee(employeeId);
  if (!employee) return res.status(404).json({ error: "找不到這位員工。" });
  const fromDate = req.body?.fromDate;
  const toDate = req.body?.toDate;
  if (!validDateString(fromDate) || !validDateString(toDate)) return res.status(400).json({ error: "起訖日期格式不正確。" });
  if (fromDate > toDate) return res.status(400).json({ error: "結束日期不能早於開始日期。" });
  if (toDate > jstDateString(Date.now())) return res.status(400).json({ error: "結束日期不能是未來。" });
  const weekdaysRaw = req.body?.weekdays;
  if (!Array.isArray(weekdaysRaw) || weekdaysRaw.length === 0 || !weekdaysRaw.every(w => Number.isInteger(w) && w >= 0 && w <= 6)) {
    return res.status(400).json({ error: "請至少選一個上班星期。" });
  }
  const weekdays = new Set(weekdaysRaw as number[]);
  const spanDays = Math.round((jstWallToMs(toDate, "00:00") - jstWallToMs(fromDate, "00:00")) / (24 * 60 * 60 * 1000)) + 1;
  if (spanDays > 731) return res.status(400).json({ error: "一次最多補登兩年，請分段補登。" });
  // 用單日解析驗證時間欄位（日期先用 fromDate 代表，未來檢查改用 toDate 的退勤時間）
  const parsed = parseManualDay({ date: fromDate, in: req.body?.in, out: req.body?.out, breakStart: req.body?.breakStart, breakEnd: req.body?.breakEnd, note: req.body?.note });
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  if (jstWallToMs(toDate, parsed.day.out) > Date.now()) return res.status(400).json({ error: "結束日期當天的退勤時間還沒到，只能補登已經過去的時間。" });
  try {
    const createdDates: string[] = [];
    const skippedDates: string[] = [];
    for (let i = 0; i < spanDays; i += 1) {
      const date = jstDateString(jstWallToMs(fromDate, "12:00") + i * 24 * 60 * 60 * 1000);
      if (!weekdays.has(jstWeekday(date))) continue;
      if (await dayHasRecords(employeeId, date)) {
        skippedDates.push(date);
        continue;
      }
      await createManualDay(employeeId, { ...parsed.day, date });
      createdDates.push(date);
    }
    return res.json({ ok: true, createdDays: createdDates.length, createdDates, skippedDays: skippedDates });
  } catch (error) {
    console.error("Could not create manual attendance batch", error);
    return res.status(503).json({ error: "批量補登失敗，請再試一次。" });
  }
});

function currentJstMonth(): string {
  return jstDateString(Date.now()).slice(0, 7);
}

router.get("/records", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentJstMonth();
  try {
    const records = await listRecords(jstMonthRangeMs(month));
    return res.json({
      month,
      records: records.map(r => ({ id: r.id, employeeName: r.employeeName, type: r.type, date: jstDateString(r.atMs), time: jstTimeString(r.atMs), manual: Boolean(r.manual), note: r.note ?? "" })),
      summary: summarize(records),
    });
  } catch (error) {
    console.error("Could not list attendance records", error);
    return res.status(503).json({ error: "無法讀取打卡紀錄。" });
  }
});

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

router.get("/records.csv", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) return res.status(401).json({ error: "Please sign in as an administrator." });
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentJstMonth();
  const kind = req.query.kind === "summary" ? "summary" : "punches";
  try {
    const records = await listRecords(jstMonthRangeMs(month));
    let lines: string[];
    if (kind === "summary") {
      lines = ["date,employee,clock_in,clock_out,break_minutes,work_minutes,complete"];
      for (const s of summarize(records)) {
        lines.push([s.date, s.employeeName, s.firstIn ?? "", s.lastOut ?? "", s.breakMinutes, s.workMinutes ?? "", s.complete ? "yes" : "no"].map(csvCell).join(","));
      }
    } else {
      lines = ["date,time_jst,employee,type,source,note"];
      for (const r of [...records].sort((a, b) => a.atMs - b.atMs)) {
        lines.push([jstDateString(r.atMs), jstTimeString(r.atMs), r.employeeName, r.type, r.manual ? "manual" : "punch", r.note ?? ""].map(csvCell).join(","));
      }
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}-${kind}.csv"`);
    return res.send("﻿" + lines.join("\r\n"));
  } catch (error) {
    console.error("Could not export attendance CSV", error);
    return res.status(503).json({ error: "無法匯出 CSV。" });
  }
});

export default router;

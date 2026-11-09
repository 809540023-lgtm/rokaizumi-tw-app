import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(async (req: { headers?: Record<string, string | string[] | undefined> }) => {
      if (req.headers?.["x-test-admin"] === "1") return { role: "admin" };
      throw new Error("not signed in");
    }),
  },
}));

const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "attendance-test-")), "attendance.json");
process.env.ATTENDANCE_DATA_FILE = dataFile;
delete process.env.DATABASE_URL;

let server: Server;
let base = "";
let attendance: typeof import("./attendance");

const adminHeaders = { "x-test-admin": "1", "Content-Type": "application/json" };

async function postJson(url: string, body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  const response = await fetch(`${base}${url}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: response.status, data: (await response.json().catch(() => ({}))) as Record<string, any> };
}

beforeAll(async () => {
  attendance = await import("./attendance");
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", attendance.default);
  await new Promise<void>(resolve => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("attendance pure helpers", () => {
  it("hashes and verifies PINs", () => {
    const stored = attendance.hashPin("1234");
    expect(stored).not.toContain("1234");
    expect(attendance.verifyPin("1234", stored)).toBe(true);
    expect(attendance.verifyPin("9999", stored)).toBe(false);
  });

  it("formats JST date/time from UTC ms", () => {
    const ms = Date.UTC(2026, 10, 9, 0, 30); // 09:30 JST
    expect(attendance.jstDateString(ms)).toBe("2026-11-09");
    expect(attendance.jstTimeString(ms)).toBe("09:30");
    const lateUtc = Date.UTC(2026, 10, 8, 16, 0); // 01:00 JST on Nov 9
    expect(attendance.jstDateString(lateUtc)).toBe("2026-11-09");
  });

  it("enforces the punch state machine", () => {
    expect(attendance.allowedNext(null)).toEqual(["in"]);
    expect(attendance.allowedNext("in")).toEqual(["break_start", "out"]);
    expect(attendance.allowedNext("break_start")).toEqual(["break_end"]);
    expect(attendance.allowedNext("break_end")).toEqual(["break_start", "out"]);
    expect(attendance.allowedNext("out")).toEqual(["in"]);
  });

  it("summarizes a day with a break", () => {
    const at = (h: number, m: number) => Date.UTC(2026, 10, 9, h - 9, m); // JST wall time -> UTC ms
    const records = [
      { id: "1", employeeId: "e1", employeeName: "測試員工", type: "in" as const, atMs: at(10, 0) },
      { id: "2", employeeId: "e1", employeeName: "測試員工", type: "break_start" as const, atMs: at(12, 0) },
      { id: "3", employeeId: "e1", employeeName: "測試員工", type: "break_end" as const, atMs: at(12, 45) },
      { id: "4", employeeId: "e1", employeeName: "測試員工", type: "out" as const, atMs: at(14, 0) },
    ];
    const [summary] = attendance.summarize(records);
    expect(summary.date).toBe("2026-11-09");
    expect(summary.firstIn).toBe("10:00");
    expect(summary.lastOut).toBe("14:00");
    expect(summary.breakMinutes).toBe(45);
    expect(summary.workMinutes).toBe(195);
    expect(summary.complete).toBe(true);
  });
});

describe("attendance API (file fallback storage)", () => {
  let employeeId = "";

  it("rejects employee creation without admin", async () => {
    const result = await postJson("/api/attendance/employees", { name: "山田花子", pin: "1234" });
    expect(result.status).toBe(401);
  });

  it("creates an employee as admin and lists it publicly by name only", async () => {
    const created = await postJson("/api/attendance/employees", { name: "山田花子", pin: "1234" }, adminHeaders);
    expect(created.status).toBe(200);
    employeeId = created.data.employee.id;
    expect(employeeId).toBeTruthy();

    const response = await fetch(`${base}/api/attendance/employees`);
    const data = (await response.json()) as { employees: { id: string; name: string }[] };
    expect(data.employees).toEqual([{ id: employeeId, name: "山田花子" }]);
  });

  it("rejects a wrong PIN and an out-of-order punch", async () => {
    const wrong = await postJson("/api/attendance/clock", { employeeId, pin: "9999", type: "in" });
    expect(wrong.status).toBe(401);

    const outFirst = await postJson("/api/attendance/clock", { employeeId, pin: "1234", type: "out" });
    expect(outFirst.status).toBe(409);
  });

  it("records a full day: in, break, out; then reports status and summary", async () => {
    for (const type of ["in", "break_start", "break_end", "out"]) {
      const result = await postJson("/api/attendance/clock", { employeeId, pin: "1234", type });
      expect(result.status).toBe(200);
      expect(result.data.ok).toBe(true);
    }
    const status = await postJson("/api/attendance/status", { employeeId, pin: "1234" });
    expect(status.status).toBe(200);
    expect(status.data.allowed).toEqual(["in"]);
    expect(status.data.today).toHaveLength(4);

    const month = attendance.jstDateString(Date.now()).slice(0, 7);
    const recordsResponse = await fetch(`${base}/api/attendance/records?month=${month}`, { headers: adminHeaders });
    expect(recordsResponse.status).toBe(200);
    const records = (await recordsResponse.json()) as { records: unknown[]; summary: { employeeName: string; complete: boolean }[] };
    expect(records.records).toHaveLength(4);
    expect(records.summary[0].employeeName).toBe("山田花子");
    expect(records.summary[0].complete).toBe(true);

    const csvResponse = await fetch(`${base}/api/attendance/records.csv?month=${month}&kind=summary`, { headers: adminHeaders });
    expect(csvResponse.status).toBe(200);
    const csv = await csvResponse.text();
    expect(csv).toContain("山田花子");
  });

  it("blocks admin records without admin", async () => {
    const response = await fetch(`${base}/api/attendance/records`);
    expect(response.status).toBe(401);
  });
});

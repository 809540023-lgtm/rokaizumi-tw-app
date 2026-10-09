import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import net from "node:net";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));

// 假 SMTP 伺服器：只做最少的 ESMTP 對話，把 DATA 收到的信存下來驗證。
const delivered: string[] = [];
const rejectedRecipients = new Set<string>();
const smtpServer = net.createServer(socket => {
  let buffer = "";
  let inData = false;
  let data: string[] = [];
  socket.write("220 fake ESMTP\r\n");
  socket.on("data", chunk => {
    buffer += chunk.toString("utf8");
    let index: number;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === ".") {
          inData = false;
          delivered.push(data.join("\n"));
          data = [];
          socket.write("250 OK\r\n");
        } else {
          data.push(line);
        }
        continue;
      }
      if (/^DATA/i.test(line)) {
        inData = true;
        data = [];
        socket.write("354 Start mail input\r\n");
      } else if (/^EHLO|^HELO/i.test(line)) {
        socket.write("250-fake\r\n250 AUTH PLAIN\r\n");
      } else if (/^AUTH/i.test(line)) {
        socket.write("235 Authenticated\r\n");
      } else if (/^RCPT TO/i.test(line) && [...rejectedRecipients].some(email => line.includes(email))) {
        socket.write("550 Recipient temporarily rejected\r\n");
      } else if (/^MAIL FROM|^RCPT TO/i.test(line)) {
        socket.write("250 OK\r\n");
      } else if (/^QUIT/i.test(line)) {
        socket.write("221 Bye\r\n");
        socket.end();
      } else {
        socket.write("250 OK\r\n");
      }
    }
  });
});

// 讓模組以為有資料庫，才走得進寄信那一段。
const { savedOrders, dbWrites, pendingCustomerRows } = vi.hoisted(() => ({ savedOrders: [] as unknown[][], dbWrites: [] as {sql: string; values: unknown[]}[], pendingCustomerRows: [] as Record<string, unknown>[] }));
vi.mock("mysql2/promise", () => {
  const pool = { query: async (sql: string) => [sql.includes("INNER JOIN candle_customer_emails") ? pendingCustomerRows : []], execute: async (sql: string, values: unknown[]) => { dbWrites.push({sql, values}); if (sql.startsWith("INSERT INTO candle_orders ")) savedOrders.push(values); return [{}, null]; } };
  return { default: { createPool: () => pool }, createPool: () => pool };
});

const smtpPort = 0;
let port = 0;
let server: ReturnType<express.Express["listen"]>;

const order = {
  name: "測試客人",
  email: "customer@example.com",
  phone: "+61400000000",
  street: "1 Test Street",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
  note: "自動測試",
  importConfirmed: "on",
  items: [1, 2, 3, 5, 7],
};

beforeAll(async () => {
  await new Promise<void>(resolve => smtpServer.listen(smtpPort, "127.0.0.1", resolve));
  const address = smtpServer.address();
  if (typeof address === "object" && address) process.env.SMTP_PORT = String(address.port);

  process.env.DATABASE_URL = "mysql://user:pass@127.0.0.1:3306/test";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "app-password";
  process.env.EMAIL_FROM = "ROKA IZUMI <sender@example.com>";
  process.env.CANDLE_ORDER_NOTIFY_EMAIL = "owner@example.com";
  delete process.env.RESEND_API_KEY;

  const { default: candleOrdersRouter } = await import("./candle-orders");
  const app = express();
  app.use(express.json());
  app.use("/api/candles/orders", candleOrdersRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await new Promise<void>(resolve => smtpServer.close(() => resolve()));
});

async function postOrder() {
  return fetch(`http://127.0.0.1:${port}/api/candles/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
}

// 郵件內容是 quoted-printable，驗證前要先解碼回真正的中文。
function decodeQuotedPrintable(input: string) {
  const stripped = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 1) {
    const hex = stripped.slice(i + 1, i + 3);
    if (stripped[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(stripped.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function decodeEncodedWords(input: string) {
  return input.replace(/=\?([^?]+)\?([QBqb])\?([^?]*)\?=/g, (_match, _charset, encoding: string, data: string) =>
    encoding.toUpperCase() === "B"
      ? Buffer.from(data, "base64").toString("utf8")
      : decodeQuotedPrintable(data.replace(/_/g, " ")),
  );
}

describe("蠟燭訂單通知信", () => {
  it("設好 SMTP 時，訂單會經由既有信箱寄出通知", async () => {
    const response = await postOrder();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.notificationSent).toBe(true);
    expect(body.payment).toEqual({
      method: "bank_transfer", currency: "AUD", amount: 99, shipping: 0,
      bank: { accountHolder: "ろかいずみ合同会社", bsb: "774-001", accountNumber: "250413129", bankName: "Wise Australia Pty Ltd" },
      reference: body.orderNumber, status: "awaiting_payment",
    });
    expect(savedOrders[0].at(-1)).toBe("awaiting_payment");

    expect(body.customerEmailSent).toBe(true);
    expect(delivered).toHaveLength(2);
    const mail = delivered.find(mail => mail.includes("To: owner@example.com"))!;
    const [headers, ...bodyParts] = mail.split(/\r?\n\r?\n/);
    const text = decodeQuotedPrintable(bodyParts.join("\n\n"));
    const compact = text.replace(/\s+/g, "");

    expect(mail).toContain("To: owner@example.com");
    expect(mail).toContain("From: ROKA IZUMI <sender@example.com>");
    expect(decodeEncodedWords(headers)).toContain(body.orderNumber);
    expect(compact).toContain("customer@example.com");
    expect(compact).toContain("1TestStreet,Sydney,NSW2000");
    expect(compact).toContain("RZ-C001,RZ-C002,RZ-C003,RZ-C005,RZ-C007");
    expect(compact).toContain("澳洲A$99");
    expect(compact).toContain("等待銀行轉帳");
    expect(compact).toContain(`轉帳附言：${body.orderNumber}`);
    const customerMail = delivered.find(mail => mail.includes("To: customer@example.com"))!;
    const decoded = decodeQuotedPrintable(customerMail);
    expect(decodeEncodedWords(customerMail)).toContain("awaiting payment");
    for (const value of [body.orderNumber, "A$99.00", "774-001", "250413129", "ろかいずみ合同会社", "RZ-C001", "Elephant", "Golden Retriever Pair", "1 Test Street", "3 business days", "No Wise account is needed", "not a payment receipt"]) expect(decoded).toContain(value);
    expect(customerMail).toContain("Reply-To: owner@example.com");
    expect(customerMail).toContain("Content-Type: multipart/alternative");
    expect(dbWrites.some(write => write.sql.startsWith("UPDATE candle_customer_emails") && write.values[0] === body.orderNumber)).toBe(true);
  });

  it("客戶信失敗不影響公司通知，補寄只寄客戶且不重寄公司", async () => {
    rejectedRecipients.add("customer@example.com");
    const before = delivered.length;
    const response = await postOrder();
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.notificationSent).toBe(true);
    expect(body.customerEmailSent).toBe(false);
    expect(body.payment.reference).toBe(body.orderNumber);
    expect(delivered).toHaveLength(before + 1);
    expect(dbWrites.some(write => write.sql.startsWith("UPDATE candle_customer_emails") && write.values[0] === body.orderNumber)).toBe(false);
    rejectedRecipients.clear();
    pendingCustomerRows.push({ id: body.orderNumber, customer_name: order.name, customer_email: order.email,
      customer_phone: order.phone, street_address: order.street, suburb: order.suburb, state: order.state,
      postcode: order.postcode, items: JSON.stringify(order.items), note: order.note });
    const { retryPendingCustomerEmails } = await import("./candle-orders");
    await retryPendingCustomerEmails();
    expect(delivered).toHaveLength(before + 2);
    expect(delivered.at(-1)).toContain("To: customer@example.com");
    expect(dbWrites.some(write => write.sql.startsWith("UPDATE candle_customer_emails") && write.values[0] === body.orderNumber)).toBe(true);
    pendingCustomerRows.length = 0;
  });

  it("確認信正確使用特殊 SKU 與一手套一毛線球，HTML 跳脫客戶資料", async () => {
    const before = delivered.length;
    const response = await fetch(`http://127.0.0.1:${port}/api/candles/orders`, {
      method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({...order, name: '<img src=x onerror="bad">', items: [1, 2, 20, 29, 30]}),
    });
    expect(response.status).toBe(201);
    const decoded = decodeQuotedPrintable(delivered.slice(before).find(mail => mail.includes("To: customer@example.com"))!);
    expect(decoded).toContain("RZ-C026");
    expect(decoded).toContain("Knitted Mitten + Yarn Ball (1 of each)");
    expect(decoded).toContain("Rose Ball (1 candle · random colour)");
    expect(decoded).toContain("&lt;img src=x onerror=&quot;bad&quot;&gt;");
  });

  it("寄信不可用時，訂單仍保存並回傳轉帳資料", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const before = delivered.length;

    const response = await postOrder();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.notificationSent).toBe(false);
    expect(body.customerEmailSent).toBe(false);
    expect(body.payment.status).toBe("awaiting_payment");
    expect(body.payment.reference).toBe(body.orderNumber);
    expect(delivered).toHaveLength(before);
  });
  it("拒絕非四位澳洲郵遞區號與重複商品，不會存單", async () => {
    const count = savedOrders.length;
    for (const invalid of [{ ...order, postcode: "200" }, { ...order, items: [1, 1, 3, 5, 7] }]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/candles/orders`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalid),
      });
      expect(response.status).toBe(400);
    }
    expect(savedOrders).toHaveLength(count);
  });

});


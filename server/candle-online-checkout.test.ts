import express from "express";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mock = vi.hoisted(() => ({
  execute: vi.fn(),
  query: vi.fn(),
  paypalConfigured: vi.fn(),
  createPayPalCheckout: vi.fn(),
  capturePayPalOrder: vi.fn(),
  getPayPalOrder: vi.fn(),
  stripeCreate: vi.fn(),
  stripeRetrieve: vi.fn(),
  sendMail: vi.fn(),
}));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ execute: mock.execute, query: mock.query }) },
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./candle-paypal", () => ({
  paypalConfigured: mock.paypalConfigured,
  createPayPalCheckout: mock.createPayPalCheckout,
  capturePayPalOrder: mock.capturePayPalOrder,
  getPayPalOrder: mock.getPayPalOrder,
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mock.sendMail }) },
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = {
      sessions: { create: mock.stripeCreate, retrieve: mock.stripeRetrieve },
    };
  },
}));
vi.mock("./candle-products", () => ({
  DEFAULT_PRICES: { aud: 99, twd: 1499 },
  candlePrices: async () => ({ aud: 99, twd: 1499 }),
  activeCandleIds: async () => new Set([1, 2, 3, 5, 7]),
  listCandleProducts: async () => [],
}));
import router, { verifiedPayPalCapture } from "./candle-orders";

const orderId = "RI-ABCDEF123456";
const receipt = "12345678-1234-4123-8123-123456789abc";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const orderInput = {
  name: "Test Buyer",
  email: "test@example.invalid",
  phone: "0400000000",
  street: "1 Example Street",
  suburb: "Sydney",
  state: "NSW",
  postcode: "2000",
  items: [1, 2, 3, 5, 7],
  importConfirmed: "on",
};
let payment: Record<string, any>;
let order: Record<string, any>;
let queued: Set<string>;
let server: Server;
let base: string;
const nativeFetch = globalThis.fetch;
const complete = () => ({
  id: "PAYPAL123",
  status: "COMPLETED",
  purchase_units: [
    {
      custom_id: orderId,
      invoice_id: orderId,
      reference_id: orderId,
      amount: { currency_code: "AUD", value: "99.00" },
      payments: {
        captures: [
          {
            id: "CAPTURE123",
            status: "COMPLETED",
            final_capture: true,
            amount: { currency_code: "AUD", value: "99.00" },
          },
        ],
      },
    },
  ],
});
const request = async (path: string, body?: object) => {
  const result = await fetch(
    `${base}${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}
  );
  return { status: result.status, data: await result.json() };
};
const paidWrites = () =>
  mock.execute.mock.calls.filter(([sql]) =>
    /UPDATE candle_orders SET status = 'paid'/.test(sql)
  );

beforeAll(async () => {
  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
    if (typeof url !== "string" || !url.startsWith(`${base}/`))
      throw new Error("External network forbidden in checkout tests");
    return nativeFetch(url, init);
  });
  const app = express();
  app.use(express.json());
  app.use("/orders", router);
  server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing localhost address");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PAYPAL_ENVIRONMENT", "sandbox");
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "LINE_SHOP_STRIPE_SECRET_KEY",
    "LINE_SHOP_STRIPE_WEBHOOK_SECRET",
  ])
    vi.stubEnv(key, "");
  vi.stubEnv("DATABASE_URL", "mysql://test:test@127.0.0.1:3306/mock");
  vi.stubEnv("PUBLIC_BASE_URL", "https://shop.example");
  mock.paypalConfigured.mockReturnValue(true);
  mock.createPayPalCheckout.mockReset().mockResolvedValue({
    id: "PAYPAL123",
    url: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL123",
  });
  mock.stripeCreate.mockReset().mockResolvedValue({
    id: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  mock.stripeRetrieve
    .mockReset()
    .mockResolvedValue({ id: "cs_test_123", payment_status: "unpaid" });
  mock.getPayPalOrder.mockReset().mockResolvedValue(complete());
  mock.capturePayPalOrder.mockReset().mockResolvedValue(complete());
  payment = {
    order_id: orderId,
    market: "AU",
    method: "paypal",
    provider_id: "PAYPAL123",
    amount_minor: 9900,
    currency: "AUD",
    receipt_hash: hash(receipt),
    checkout_url: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL123",
  };
  order = { id: orderId, status: "awaiting_payment", payment_method: "paypal" };
  queued = new Set();
  mock.query.mockReset().mockResolvedValue([[], []]);
  mock.execute
    .mockReset()
    .mockImplementation(async (sql: string, args: any[] = []) => {
      if (sql.startsWith("SELECT * FROM candle_online_payments"))
        return [[payment], []];
      if (sql.startsWith("SELECT") && sql.includes("FROM candle_orders"))
        return [[order], []];
      if (sql.startsWith("UPDATE candle_orders SET status = 'paid'"))
        order.status = "paid";
      if (sql.startsWith("INSERT IGNORE INTO candle_paid_emails")) {
        queued.add(`${args[0]}-customer`);
        queued.add(`${args[0]}-merchant`);
      }
      return [{ affectedRows: 1 }, []];
    });
});

function enableStripe() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
}

describe("AU online checkout integrity, isolated mocked providers", () => {
  it("advertises unavailable providers and rejects them before inserting orders", async () => {
    mock.paypalConfigured.mockReturnValue(false);
    expect((await request("/orders/payment-methods")).data).toEqual({
      card: false,
      paypal: false,
      bank_transfer: true,
    });
    for (const paymentMethod of ["paypal", "card"]) {
      expect(
        (await request("/orders", { ...orderInput, paymentMethod })).status
      ).toBe(503);
    }
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it.each(["paypal", "card"])(
    "snapshots %s amount and returns its hosted checkout",
    async paymentMethod => {
      enableStripe();
      const { status, data } = await request("/orders", {
        ...orderInput,
        paymentMethod,
      });
      expect(status).toBe(201);
      expect(data.orderNumber).toMatch(/^RI-[A-F0-9]{12}$/);
      expect(data.receiptToken).toMatch(/^[a-f0-9-]{36}$/);
      expect(data.payment).toMatchObject({
        method: paymentMethod,
        status: "awaiting_payment",
        amount: 99,
        currency: "AUD",
      });
      const snapshot = mock.execute.mock.calls.find(([sql]) =>
        sql.startsWith("INSERT INTO candle_online_payments")
      );
      expect(snapshot?.[1]).toEqual([
        data.orderNumber,
        paymentMethod,
        9900,
        "AUD",
        hash(data.receiptToken),
      ]);
      if (paymentMethod === "paypal") {
        expect(data.checkoutUrl).toContain("www.sandbox.paypal.com");
        expect(mock.createPayPalCheckout).toHaveBeenCalledWith({
          orderId: data.orderNumber,
          amount: 99,
          currency: "AUD",
          returnUrl: `https://shop.example/candles/?payment=paypal&order=${data.orderNumber}&receipt=${data.receiptToken}`,
          cancelUrl: `https://shop.example/candles/?payment=cancelled&order=${data.orderNumber}&receipt=${data.receiptToken}`,
        });
      } else {
        expect(data.checkoutUrl).toContain("checkout.stripe.com");
        const [checkout, options] = mock.stripeCreate.mock.calls[0];
        expect(checkout.line_items[0].price_data).toMatchObject({
          currency: "aud",
          unit_amount: 9900,
        });
        expect(checkout.metadata).toEqual({
          candleOrderId: data.orderNumber,
          candleMarket: "AU",
        });
        expect(checkout.success_url).toBe(
          `https://shop.example/candles/?payment=success&order=${data.orderNumber}&receipt=${data.receiptToken}`
        );
        expect(options.idempotencyKey).toBe(
          `candle-checkout-${data.orderNumber}`
        );
      }
      expect(paidWrites()).toHaveLength(0);
    }
  );

  it.each(["paypal", "card"])(
    "preserves saved %s order on provider failure without duplicate inserts",
    async paymentMethod => {
      enableStripe();
      mock.createPayPalCheckout.mockRejectedValue(
        new Error("provider unavailable")
      );
      mock.stripeCreate.mockRejectedValue(new Error("provider unavailable"));
      const result = await request("/orders", { ...orderInput, paymentMethod });
      expect(result.status).toBe(201);
      expect(result.data.checkoutError).toContain("Do not place another order");
      expect(result.data.checkoutUrl).toBeUndefined();
      expect(result.data.receiptToken).toBeTruthy();
      expect(
        mock.execute.mock.calls.filter(([sql]) =>
          sql.startsWith("INSERT INTO candle_orders (")
        )
      ).toHaveLength(1);
      expect(paidWrites()).toHaveLength(0);
    }
  );

  it("requires the correct receipt token for status, capture and resume", async () => {
    for (const token of [undefined, "00000000-0000-4000-8000-000000000000"]) {
      const result = await request(
        `/orders/payment-status?order=${orderId}${token ? `&receipt=${token}` : ""}`
      );
      expect(result.status).toBe(404);
      for (const path of ["paypal/capture", "checkout/resume"]) {
        expect(
          (await request(`/orders/${path}`, { order: orderId, receipt: token }))
            .status
        ).toBe(404);
      }
    }
    expect(mock.getPayPalOrder).not.toHaveBeenCalled();
    expect(paidWrites()).toHaveLength(0);
  });

  it("never treats a browser payment=success parameter as proof of payment", async () => {
    const result = await request(
      `/orders/payment-status?order=${orderId}&receipt=${receipt}&payment=success`
    );
    expect(result.status).toBe(200);
    expect(result.data.status).toBe("awaiting_payment");
    expect(paidWrites()).toHaveLength(0);
  });

  it("captures APPROVED PayPal orders and reconciles a timeout before marking exactly the bound order paid", async () => {
    mock.getPayPalOrder
      .mockResolvedValueOnce({ id: "PAYPAL123", status: "APPROVED" })
      .mockResolvedValueOnce(complete());
    mock.capturePayPalOrder.mockRejectedValueOnce(
      new Error("timeout after capture")
    );
    const result = await request("/orders/paypal/capture", {
      order: orderId,
      receipt,
    });
    expect(result.status).toBe(200);
    expect(result.data.status).toBe("paid");
    expect(mock.capturePayPalOrder).toHaveBeenCalledWith("PAYPAL123", orderId);
    expect(mock.getPayPalOrder).toHaveBeenCalledTimes(2);
    expect(paidWrites()).toEqual([
      [
        "UPDATE candle_orders SET status = 'paid' WHERE id = ? AND payment_method = 'paypal'",
        [orderId],
      ],
    ]);
    expect(queued.size).toBe(2);
  });

  it("repeated completed callbacks do not capture again and use idempotent receipt queue writes", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (await request("/orders/paypal/capture", { order: orderId, receipt }))
          .status
      ).toBe(200);
    expect(mock.capturePayPalOrder).not.toHaveBeenCalled();
    expect(queued).toEqual(
      new Set([`${orderId}-customer`, `${orderId}-merchant`])
    );
    const queueWrites = mock.execute.mock.calls.filter(([sql]) =>
      sql.includes("INTO candle_paid_emails")
    );
    expect(queueWrites).toHaveLength(2);
    expect(queueWrites.every(([sql]) => sql.startsWith("INSERT IGNORE"))).toBe(
      true
    );
  });

  it("leaves a pending PayPal capture unpaid and does not enqueue receipts", async () => {
    mock.getPayPalOrder.mockResolvedValue({ status: "APPROVED" });
    const result = await request("/orders/paypal/capture", {
      order: orderId,
      receipt,
    });
    expect(result.status).toBe(202);
    expect(paidWrites()).toHaveLength(0);
    expect(queued.size).toBe(0);
  });

  it("reconciles a paid Stripe session against the stored snapshot", async () => {
    enableStripe();
    payment.method = "card";
    payment.provider_id = "cs_test_123";
    order.payment_method = "card";
    mock.stripeRetrieve.mockResolvedValue({
      id: "cs_test_123",
      payment_status: "paid",
      currency: "aud",
      amount_total: 9900,
      metadata: { candleOrderId: orderId, candleMarket: "AU" },
    });
    const result = await request(
      `/orders/payment-status?order=${orderId}&receipt=${receipt}`
    );
    expect(result.status).toBe(200);
    expect(result.data.status).toBe("paid");
    expect(mock.stripeRetrieve).toHaveBeenCalledWith("cs_test_123");
    expect(paidWrites()).toHaveLength(1);
    expect(queued.size).toBe(2);
  });

  it.each([
    ["missing order metadata", { metadata: {} }],
    [
      "wrong order metadata",
      { metadata: { candleOrderId: "RI-000000000000", candleMarket: "AU" } },
    ],
    ["wrong session ID", { id: "cs_other" }],
    ["wrong total", { amount_total: 1 }],
    ["wrong currency", { currency: "usd" }],
    [
      "wrong market",
      { metadata: { candleOrderId: orderId, candleMarket: "TW" } },
    ],
  ])("does not report Stripe paid for %s", async (_label, changes) => {
    enableStripe();
    payment.method = "card";
    payment.provider_id = "cs_test_123";
    order.payment_method = "card";
    mock.stripeRetrieve.mockResolvedValue({
      id: "cs_test_123",
      payment_status: "paid",
      currency: "aud",
      amount_total: 9900,
      metadata: { candleOrderId: orderId, candleMarket: "AU" },
      ...(changes as object),
    });
    const result = await request(
      `/orders/payment-status?order=${orderId}&receipt=${receipt}&payment=success`
    );
    expect(result.status).toBe(503);
    expect(result.data.status).not.toBe("paid");
    expect(paidWrites()).toHaveLength(0);
    expect(queued.size).toBe(0);
  });

  it("keeps a verified PayPal order awaiting payment if receipt enrollment fails", async () => {
    const normalExecute = mock.execute.getMockImplementation()!;
    mock.execute.mockImplementation(async (sql: string, args: any[] = []) => {
      if (sql.startsWith("INSERT IGNORE INTO candle_paid_emails"))
        throw new Error("Queue unavailable");
      return normalExecute(sql, args);
    });
    const result = await request("/orders/paypal/capture", {
      order: orderId,
      receipt,
    });
    expect(result.status).toBe(503);
    expect(order.status).toBe("awaiting_payment");
    expect(paidWrites()).toHaveLength(0);
    expect(queued.size).toBe(0);
    expect(mock.sendMail).not.toHaveBeenCalled();
    // Retrying reconciles the existing provider capture and enrolls receipts first.
    mock.execute.mockImplementation(normalExecute);
    expect(
      (await request("/orders/paypal/capture", { order: orderId, receipt }))
        .status
    ).toBe(200);
    expect(mock.capturePayPalOrder).not.toHaveBeenCalled();
    expect(order.status).toBe("paid");
    expect(queued.size).toBe(2);
  });

  it("disables sandbox PayPal and test Stripe in production before creating orders", async () => {
    enableStripe();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYPAL_ENVIRONMENT", "sandbox");
    expect((await request("/orders/payment-methods")).data).toEqual({
      card: false,
      paypal: false,
      bank_transfer: true,
    });
    for (const paymentMethod of ["card", "paypal"]) {
      expect(
        (await request("/orders", { ...orderInput, paymentMethod })).status
      ).toBe(503);
    }
    expect(mock.execute).not.toHaveBeenCalled();
    expect(mock.stripeCreate).not.toHaveBeenCalled();
    expect(mock.createPayPalCheckout).not.toHaveBeenCalled();
  });

  it("advertises live providers in production only with their required configuration", async () => {
    enableStripe();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_mock_only_never_used");
    vi.stubEnv("PAYPAL_ENVIRONMENT", "live");
    expect((await request("/orders/payment-methods")).data).toEqual({
      card: true,
      paypal: true,
      bank_transfer: true,
    });
    expect(mock.stripeCreate).not.toHaveBeenCalled();
    expect(mock.createPayPalCheckout).not.toHaveBeenCalled();
  });

  const corruptions: [string, (result: ReturnType<typeof complete>) => void][] =
    [
      [
        "provider ID",
        result => {
          result.id = "OTHER";
        },
      ],
      [
        "custom ID",
        result => {
          result.purchase_units[0].custom_id = "RI-000000000000";
        },
      ],
      [
        "invoice ID",
        result => {
          result.purchase_units[0].invoice_id = "RI-000000000000";
        },
      ],
      [
        "reference ID",
        result => {
          result.purchase_units[0].reference_id = "RI-000000000000";
        },
      ],
      [
        "unit amount",
        result => {
          result.purchase_units[0].amount.value = "1.00";
        },
      ],
      [
        "unit currency",
        result => {
          result.purchase_units[0].amount.currency_code = "USD";
        },
      ],
      [
        "capture amount",
        result => {
          result.purchase_units[0].payments.captures[0].amount.value = "1.00";
        },
      ],
      [
        "capture currency",
        result => {
          result.purchase_units[0].payments.captures[0].amount.currency_code =
            "USD";
        },
      ],
      [
        "capture status",
        result => {
          result.purchase_units[0].payments.captures[0].status = "PENDING";
        },
      ],
      [
        "final capture",
        result => {
          result.purchase_units[0].payments.captures[0].final_capture = false;
        },
      ],
      [
        "capture ID",
        result => {
          result.purchase_units[0].payments.captures[0].id = "";
        },
      ],
      [
        "extra purchase unit",
        result => {
          result.purchase_units.push(result.purchase_units[0]);
        },
      ],
      [
        "extra capture",
        result => {
          result.purchase_units[0].payments.captures.push(
            result.purchase_units[0].payments.captures[0]
          );
        },
      ],
    ];
  it.each(corruptions)(
    "rejects wrong %s before recording paid or queuing receipts",
    async (_label, mutate) => {
      const result = complete();
      mutate(result);
      expect(() => verifiedPayPalCapture(result, payment as any)).toThrow();
      mock.getPayPalOrder.mockResolvedValue(result);
      expect(
        (await request("/orders/paypal/capture", { order: orderId, receipt }))
          .status
      ).toBe(503);
      expect(paidWrites()).toHaveLength(0);
      expect(queued.size).toBe(0);
    }
  );
});

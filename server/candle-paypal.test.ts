import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const token = () => ({ access_token: "mock-token", expires_in: 3600 });
const approval = (
  href = "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL123"
) => ({
  id: "PAYPAL123",
  links: [{ rel: "payer-action", href }],
});
const input = {
  orderId: "CANDLE-123",
  amount: 99,
  currency: "AUD" as const,
  returnUrl: "https://shop.example/candles/return",
  cancelUrl: "https://shop.example/candles/cancel",
};
function respond(data: object, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PAYPAL_CLIENT_ID", "mock-client");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "mock-secret");
  vi.stubEnv("PAYPAL_ENVIRONMENT", "sandbox");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("PayPal Orders adapter (mocked network only)", () => {
  it("requires credentials and an explicit valid environment", async () => {
    const api = await import("./candle-paypal");
    expect(api.paypalConfigured()).toBe(true);
    for (const environment of ["", "production", "LIVE"]) {
      vi.stubEnv("PAYPAL_ENVIRONMENT", environment);
      expect(api.paypalConfigured()).toBe(false);
      await expect(api.createPayPalCheckout(input)).rejects.toThrow(
        "not configured"
      );
    }
    vi.stubEnv("PAYPAL_ENVIRONMENT", "live");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", " ");
    expect(api.paypalConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an AUD CAPTURE order without customer PII and reuses a memory-only token", async () => {
    respond(token());
    respond(approval());
    respond(approval());
    const api = await import("./candle-paypal");
    expect(await api.createPayPalCheckout(input)).toEqual({
      id: "PAYPAL123",
      url: approval().links[0].href,
    });
    await api.createPayPalCheckout(input);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers["PayPal-Request-Id"]).toHaveLength(38);
    expect(init.headers["PayPal-Request-Id"]).toBe(
      fetchMock.mock.calls[2][1].headers["PayPal-Request-Id"]
    );
    expect(JSON.parse(init.body)).toEqual({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "CANDLE-123",
          custom_id: "CANDLE-123",
          invoice_id: "CANDLE-123",
          amount: { currency_code: "AUD", value: "99.00" },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    });
  });

  it.each([
    "https://www.sandbox.paypal.com.evil.test/pay",
    "http://www.sandbox.paypal.com/pay",
    "https://www.sandbox.paypal.com:444/pay",
    "https://evil@www.sandbox.paypal.com/pay",
    "https://www.paypal.com/pay",
  ])("rejects unsafe approval URL %s", async url => {
    respond(token());
    respond(approval(url));
    await expect(
      (await import("./candle-paypal")).createPayPalCheckout(input)
    ).rejects.toThrow("approval URL");
  });

  it("uses only live endpoints when explicitly configured live", async () => {
    vi.stubEnv("PAYPAL_ENVIRONMENT", "live");
    respond(token());
    respond(approval("https://www.paypal.com/checkoutnow?token=PAYPAL123"));
    await (await import("./candle-paypal")).createPayPalCheckout(input);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "https://api-m.paypal.com/v1/oauth2/token",
      "https://api-m.paypal.com/v2/checkout/orders",
    ]);
  });

  it.each([0, -1, NaN, Infinity, 99.001])(
    "rejects invalid total %s without requests",
    async amount => {
      await expect(
        (await import("./candle-paypal")).createPayPalCheckout({
          ...input,
          amount,
        })
      ).rejects.toThrow("amount");
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("rejects unsafe IDs and callback URLs without requests", async () => {
    const api = await import("./candle-paypal");
    await expect(api.getPayPalOrder("../other")).rejects.toThrow("identifier");
    await expect(
      api.createPayPalCheckout({
        ...input,
        returnUrl: "http://shop.example/return",
      })
    ).rejects.toThrow("callback");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("captures idempotently and provides full order data for reconciliation", async () => {
    const captured = {
      id: "PAYPAL123",
      status: "COMPLETED",
      purchase_units: [
        {
          custom_id: "CANDLE-123",
          invoice_id: "CANDLE-123",
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
    };
    respond(token());
    respond(captured);
    respond(captured);
    respond(captured);
    const api = await import("./candle-paypal");
    expect(await api.capturePayPalOrder("PAYPAL123", "CANDLE-123")).toEqual(
      captured
    );
    await api.capturePayPalOrder("PAYPAL123", "CANDLE-123");
    expect(await api.getPayPalOrder("PAYPAL123")).toEqual(captured);
    expect(fetchMock.mock.calls[1][1].headers["PayPal-Request-Id"]).toBe(
      fetchMock.mock.calls[2][1].headers["PayPal-Request-Id"]
    );
    expect(fetchMock.mock.calls[3][1].method).toBe("GET");
  });

  it("does not leak API error bodies or network exceptions", async () => {
    respond(token());
    respond({ secret: "do-not-leak" }, 422);
    const api = await import("./candle-paypal");
    await expect(
      api.capturePayPalOrder("PAYPAL123", "CANDLE-123")
    ).rejects.toThrow("PayPal API request failed (422)");
    fetchMock.mockRejectedValueOnce(new Error("do-not-leak"));
    await expect(api.getPayPalOrder("PAYPAL123")).rejects.toThrow(
      /^PayPal request failed$/
    );
  });

  it("aborts stalled requests at the timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        })
    );
    const api = await import("./candle-paypal");
    const pending = expect(api.getPayPalOrder("PAYPAL123")).rejects.toThrow(
      "timed out"
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
  });
});

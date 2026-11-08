import { createHash } from "node:crypto";

type JsonObject = Record<string, unknown>;
type Configuration = {
  base: string;
  approvalHost: string;
  clientId: string;
  secret: string;
  key: string;
};
let tokenCache: { key: string; token: string; expiresAt: number } | undefined;
const TIMEOUT_MS = 15_000;

export function paypalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() &&
      process.env.PAYPAL_CLIENT_SECRET?.trim() &&
      ["live", "sandbox"].includes(process.env.PAYPAL_ENVIRONMENT ?? "")
  );
}

function configuration(): Configuration {
  if (!paypalConfigured()) throw new Error("PayPal is not configured");
  const live = process.env.PAYPAL_ENVIRONMENT === "live";
  const clientId = process.env.PAYPAL_CLIENT_ID!.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET!.trim();
  const base = live
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
  return {
    base,
    approvalHost: live ? "www.paypal.com" : "www.sandbox.paypal.com",
    clientId,
    secret,
    key: createHash("sha256")
      .update(JSON.stringify([base, clientId, secret]))
      .digest("hex"),
  };
}

function identifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,127}$/.test(value))
    throw new Error("Invalid PayPal order identifier");
  return value;
}

function requestId(action: string, ...ids: string[]): string {
  // Stable, scoped keys make retries safe without storing payment credentials.
  return createHash("sha256")
    .update(JSON.stringify(["candles", action, ...ids]))
    .digest("hex")
    .slice(0, 38);
}

function callbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Invalid PayPal callback URL");
  return url.href;
}

async function fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Never forward authorization to an unexpected redirect target.
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(`PayPal API request failed (${response.status})`);
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("Invalid PayPal response");
    return result as JsonObject;
  } catch (error) {
    // Do not expose provider bodies, authorization headers, URLs or credentials.
    if (
      error instanceof Error &&
      /^PayPal API request failed \(\d{3}\)$/.test(error.message)
    )
      throw error;
    throw new Error(
      controller.signal.aborted
        ? "PayPal request timed out"
        : "PayPal request failed"
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function accessToken(config: Configuration): Promise<string> {
  if (tokenCache?.key === config.key && tokenCache.expiresAt > Date.now())
    return tokenCache.token;
  const data = await fetchJson(`${config.base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  )
    throw new Error("Invalid PayPal token response");
  tokenCache = {
    key: config.key,
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function orderRequest(
  path: string,
  method: "POST" | "GET",
  idempotencyKey?: string,
  body?: JsonObject
): Promise<JsonObject> {
  const config = configuration();
  const token = await accessToken(config);
  return fetchJson(`${config.base}/v2/checkout/orders${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function createPayPalCheckout(input: {
  orderId: string;
  amount: number;
  currency: "AUD";
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const orderId = identifier(input.orderId);
  const cents = Math.round(input.amount * 100);
  if (
    input.currency !== "AUD" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !Number.isSafeInteger(cents) ||
    Math.abs(input.amount * 100 - cents) > 0.000001
  ) {
    throw new Error("Invalid PayPal amount");
  }
  const config = configuration();
  const data = await orderRequest("", "POST", requestId("create", orderId), {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderId,
        custom_id: orderId,
        invoice_id: orderId,
        amount: { currency_code: "AUD", value: input.amount.toFixed(2) },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: callbackUrl(input.returnUrl),
          cancel_url: callbackUrl(input.cancelUrl),
        },
      },
    },
  });
  if (typeof data.id !== "string")
    throw new Error("Invalid PayPal order response");
  const id = identifier(data.id);
  const links = Array.isArray(data.links) ? data.links : [];
  const approval = links.find(
    link =>
      link &&
      typeof link === "object" &&
      ["approve", "payer-action"].includes(link.rel)
  );
  if (!approval || typeof approval.href !== "string")
    throw new Error("Missing PayPal approval URL");
  const url = new URL(approval.href);
  if (
    url.protocol !== "https:" ||
    url.hostname !== config.approvalHost ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid PayPal approval URL");
  }
  return { id, url: url.href };
}

// Call only after explicit payer approval. The caller MUST validate this result
// against the persisted PayPal ID, internal order ID, currency and total before
// marking paid. For timeouts/already-captured errors, reconcile with getPayPalOrder.
export async function capturePayPalOrder(
  paypalOrderId: string,
  internalOrderId: string
): Promise<JsonObject> {
  return orderRequest(
    `/${identifier(paypalOrderId)}/capture`,
    "POST",
    requestId("capture", identifier(internalOrderId), paypalOrderId),
    {}
  );
}

export async function getPayPalOrder(
  paypalOrderId: string
): Promise<JsonObject> {
  return orderRequest(`/${identifier(paypalOrderId)}`, "GET");
}

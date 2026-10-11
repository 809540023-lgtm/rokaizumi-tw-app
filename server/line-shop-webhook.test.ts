import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import Stripe from "stripe";
import { createServer, type Server } from "node:http";
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("mysql2/promise", () => ({
  default: {
    createPool: vi.fn(() => {
      throw Error("Database must not be accessed");
    }),
  },
}));
import router, { registerLineShop } from "./line-shop";
let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
  vi.unstubAllEnvs();
});
async function post(payload: string, signature: string) {
  const app = express();
  registerLineShop(app);
  app.use(express.json());
  app.use("/api/line-shop", router);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return fetch(
    `http://127.0.0.1:${address.port}/api/line-shop/stripe/webhook`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }
  );
}
function setup() {
  vi.stubEnv("LINE_SHOP_STRIPE_SECRET_KEY", "rk_test_placeholder");
  vi.stubEnv("LINE_SHOP_STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
  vi.stubEnv("LINE_SHOP_MODE", "test");
}
const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  livemode: false,
  type: "checkout.session.completed",
  data: { object: { id: "cs_test", metadata: {} } },
});
describe("LINE shop webhook trust boundary", () => {
  it("rejects invalid signatures before touching the database", async () => {
    setup();
    expect((await post(payload, "invalid")).status).toBe(400);
  });
  it("verifies the unmodified request body and acknowledges unrelated sessions", async () => {
    setup();
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_test_secret",
    });
    const response = await post(payload, header);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
  it("rejects mode mismatch even with a valid signature", async () => {
    setup();
    const livePayload = payload.replace('"livemode":false', '"livemode":true');
    const header = Stripe.webhooks.generateTestHeaderString({
      payload: livePayload,
      secret: "whsec_test_secret",
    });
    expect((await post(livePayload, header)).status).toBe(400);
  });
  it("rejects a tampered body signed with the original payload", async () => {
    setup();
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_test_secret",
    });
    expect((await post(payload + " ", header)).status).toBe(400);
  });
});

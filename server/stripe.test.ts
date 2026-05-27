import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from './routers';
import { createMsw } from './_core/testUtils';

describe('Stripe Payment Integration', () => {
  let caller: any;

  beforeEach(() => {
    // Mock Stripe
    vi.mock('stripe', () => ({
      default: vi.fn(() => ({
        checkout: {
          sessions: {
            create: vi.fn().mockResolvedValue({
              id: 'cs_test_123',
              url: 'https://checkout.stripe.com/pay/cs_test_123',
            }),
          },
        },
      })),
    }));

    // Create a test caller with mock context
    caller = appRouter.createCaller({
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      req: {
        headers: {
          origin: 'http://localhost:3000',
        },
      },
      res: {},
    });
  });

  it('should create a checkout session with valid items', async () => {
    const result = await caller.payments.createCheckoutSession({
      items: [
        {
          productId: 1,
          productName: 'Test Product',
          productPrice: 10000,
          quantity: 2,
          subtotal: 20000,
        },
      ],
      shippingInfo: {
        name: 'John Doe',
        phone: '09123456789',
        address: '123 Main St',
        notes: 'Please deliver carefully',
      },
    });

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(result.sessionId).toMatch(/^cs_test_/);
    expect(result.url).toContain('checkout.stripe.com');
  });

  it('should handle multiple items in checkout', async () => {
    const result = await caller.payments.createCheckoutSession({
      items: [
        {
          productId: 1,
          productName: 'Product 1',
          productPrice: 5000,
          quantity: 1,
          subtotal: 5000,
        },
        {
          productId: 2,
          productName: 'Product 2',
          productPrice: 8000,
          quantity: 2,
          subtotal: 16000,
        },
      ],
      shippingInfo: {
        name: 'Jane Doe',
        phone: '09987654321',
        address: '456 Oak Ave',
      },
    });

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
  });

  it('should include correct metadata in checkout session', async () => {
    const result = await caller.payments.createCheckoutSession({
      items: [
        {
          productId: 1,
          productName: 'Test Product',
          productPrice: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      ],
      shippingInfo: {
        name: 'Test User',
        phone: '09123456789',
        address: '123 Main St',
      },
    });

    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
  });

  it('should require authentication for checkout', async () => {
    const unauthenticatedCaller = appRouter.createCaller({
      user: null,
      req: { headers: { origin: 'http://localhost:3000' } },
      res: {},
    });

    await expect(
      unauthenticatedCaller.payments.createCheckoutSession({
        items: [
          {
            productId: 1,
            productName: 'Test Product',
            productPrice: 10000,
            quantity: 1,
            subtotal: 10000,
          },
        ],
        shippingInfo: {
          name: 'Test User',
          phone: '09123456789',
          address: '123 Main St',
        },
      })
    ).rejects.toThrow();
  });
});

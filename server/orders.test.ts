import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';

describe('Orders API', () => {
  let caller: any;

  beforeEach(() => {
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

  it('should list orders for authenticated user', async () => {
    const result = await caller.orders.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should create an order with items', async () => {
    const result = await caller.orders.create({
      shippingAddress: '123 Main St, City, Country',
      contactName: 'John Doe',
      contactPhone: '09123456789',
      contactEmail: 'john@example.com',
      notes: 'Please deliver carefully',
      items: [
        {
          productId: 1,
          productName: 'Test Product 1',
          productPrice: 10000,
          quantity: 2,
          subtotal: 20000,
        },
        {
          productId: 2,
          productName: 'Test Product 2',
          productPrice: 5000,
          quantity: 1,
          subtotal: 5000,
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.orderId).toBeDefined();
    expect(typeof result.orderId).toBe('number');
  });

  it('should get order by ID with items', async () => {
    // First create an order
    const createResult = await caller.orders.create({
      shippingAddress: '456 Oak Ave, City, Country',
      contactName: 'Jane Doe',
      contactPhone: '09987654321',
      items: [
        {
          productId: 1,
          productName: 'Test Product',
          productPrice: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      ],
    });

    // Then get the order
    const order = await caller.orders.getById({ id: createResult.orderId });

    expect(order).toBeDefined();
    expect(order.id).toBe(createResult.orderId);
    expect(order.contactName).toBe('Jane Doe');
    expect(order.shippingAddress).toBe('456 Oak Ave, City, Country');
    expect(Array.isArray(order.items)).toBe(true);
    expect(order.items.length).toBeGreaterThan(0);
  });

  it('should get order by session ID', async () => {
    // First create an order
    const createResult = await caller.orders.create({
      shippingAddress: '789 Pine Rd, City, Country',
      contactName: 'Bob Smith',
      contactPhone: '09555555555',
      items: [
        {
          productId: 1,
          productName: 'Test Product',
          productPrice: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      ],
    });

    // Then get the order by session ID
    const order = await caller.orders.getBySessionId({ sessionId: 'cs_test_123' });

    expect(order).toBeDefined();
    expect(order.id).toBe(createResult.orderId);
    expect(Array.isArray(order.items)).toBe(true);
  });

  it('should require authentication for order operations', async () => {
    const unauthenticatedCaller = appRouter.createCaller({
      user: null,
      req: { headers: { origin: 'http://localhost:3000' } },
      res: {},
    });

    await expect(
      unauthenticatedCaller.orders.list()
    ).rejects.toThrow();

    await expect(
      unauthenticatedCaller.orders.create({
        shippingAddress: '123 Main St',
        contactName: 'Test User',
        contactPhone: '09123456789',
        items: [],
      })
    ).rejects.toThrow();
  });

  it('should handle order with multiple items correctly', async () => {
    const items = [
      {
        productId: 1,
        productName: 'Product A',
        productPrice: 5000,
        quantity: 2,
        subtotal: 10000,
      },
      {
        productId: 2,
        productName: 'Product B',
        productPrice: 3000,
        quantity: 3,
        subtotal: 9000,
      },
      {
        productId: 3,
        productName: 'Product C',
        productPrice: 7000,
        quantity: 1,
        subtotal: 7000,
      },
    ];

    const result = await caller.orders.create({
      shippingAddress: '999 Test St',
      contactName: 'Test User',
      contactPhone: '09999999999',
      items,
    });

    const order = await caller.orders.getById({ id: result.orderId });

    expect(order.items.length).toBe(3);
    expect(order.totalAmount).toBe(26000); // 10000 + 9000 + 7000
  });
});

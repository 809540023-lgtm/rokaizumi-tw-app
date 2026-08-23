import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  nextOrderId: 1,
  orders: [] as Array<Record<string, unknown> & { id: number; userId: number; items: unknown[] }>,
}));

vi.mock('./db', () => ({
  getProductById: async (id: number) => ({
    id,
    name: `Product ${id}`,
    price: id * 1000,
    stock: 99,
    status: 'available',
  }),
  getOrdersByUserId: async (userId: number) => store.orders.filter(order => order.userId === userId),
  createOrder: async (order: Record<string, unknown>, items: unknown[]) => {
    const id = store.nextOrderId++;
    store.orders.push({ ...order, id, userId: order.userId as number, items });
    return id;
  },
  getOrderByIdForUser: async (id: number, userId: number) =>
    store.orders.find(order => order.id === id && order.userId === userId) ?? null,
  getOrderByStripeSessionIdForUser: async () => null,
  clearCart: vi.fn(),
}));

const { appRouter } = await import('./routers');

describe('Orders API', () => {
  const context = {
    user: { id: 1, email: 'test@example.com', name: 'Test User', role: 'user' as const },
    req: { headers: { origin: 'http://localhost:3000' } },
    res: {},
  };

  beforeEach(() => {
    store.nextOrderId = 1;
    store.orders = [];
  });

  it('lists only the authenticated user’s orders', async () => {
    const caller = appRouter.createCaller(context);
    await caller.orders.create({
      shippingAddress: '123 Main St',
      contactName: 'John Doe',
      contactPhone: '09123456789',
      items: [{ productId: 1, quantity: 2 }],
    });

    const result = await caller.orders.list();
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(1);
  });

  it('uses server-side product prices rather than client supplied prices', async () => {
    const caller = appRouter.createCaller(context);
    const result = await caller.orders.create({
      shippingAddress: '123 Main St',
      contactName: 'John Doe',
      contactPhone: '09123456789',
      items: [{ productId: 2, quantity: 3 }],
    });

    const order = await caller.orders.getById({ id: result.orderId });
    expect(order?.totalAmount).toBe(6000);
    expect(order?.items).toEqual([
      { productId: 2, productName: 'Product 2', productPrice: 2000, quantity: 3, subtotal: 6000 },
    ]);
  });

  it('does not expose another user’s order', async () => {
    const owner = appRouter.createCaller(context);
    const { orderId } = await owner.orders.create({
      shippingAddress: '123 Main St',
      contactName: 'John Doe',
      contactPhone: '09123456789',
      items: [{ productId: 1, quantity: 1 }],
    });
    const otherUser = appRouter.createCaller({
      ...context,
      user: { ...context.user, id: 2 },
    });

    await expect(otherUser.orders.getById({ id: orderId })).resolves.toBeNull();
  });

  it('requires authentication and a non-empty cart', async () => {
    const unauthenticated = appRouter.createCaller({ ...context, user: null });

    await expect(unauthenticated.orders.list()).rejects.toThrow();
    const caller = appRouter.createCaller(context);
    await expect(caller.orders.create({
      shippingAddress: '123 Main St',
      contactName: 'John Doe',
      contactPhone: '09123456789',
      items: [],
    })).rejects.toThrow();
  });
});

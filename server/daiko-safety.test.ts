import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));
import { fetchProductHTML, isPublicIPv4, MAX_PRODUCT_BYTES, productURL } from './_core/safe-product-fetch';

function upstream(status = 200, headers: Record<string, string> = { 'content-type': 'text/html' }, body = '<title>Product</title>') {
  mocks.request.mockImplementationOnce((_url, options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      options.lookup('example.com', {}, (error: unknown, ip: string, family: number) => {
        expect(error).toBeNull(); expect(ip).toBe('93.184.216.34'); expect(family).toBe(4);
      });
      const response = Readable.from([Buffer.from(body)]) as Readable & { statusCode: number; headers: Record<string, string> };
      response.statusCode = status; response.headers = headers;
      callback(response);
    };
    return req;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
});
describe('safe product fetch', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.31.1.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1', '::1'])('rejects reserved address %s', ip => expect(isPublicIPv4(ip)).toBe(false));
  it.each(['http://127.1', 'http://2130706433', 'http://[::1]', 'http://localhost', 'http://host.local', 'https://user:pass@example.com', 'file:///etc/passwd', 'https://example.com:8443'])('rejects unsafe URL %s', url => expect(() => productURL(url)).toThrow());
  it('pins a public DNS address and reads HTML', async () => {
    upstream();
    await expect(fetchProductHTML('https://example.com/item')).resolves.toEqual({ html: '<title>Product</title>', url: 'https://example.com/item' });
  });
  it('blocks a hostname resolving to private addresses before connecting', async () => {
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);
    await expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: 403 });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('blocks private redirects before connecting to the target', async () => {
    upstream(302, { location: 'http://169.254.169.254/latest' });
    await expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: 403 });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('revalidates DNS on each redirect', async () => {
    upstream(302, { location: '/next' });
    mocks.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    await expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: 403 });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it.each([[404, { 'content-type': 'text/html' }, 502], [200, { 'content-type': 'application/json' }, 415], [200, { 'content-type': 'text/html', 'content-length': String(MAX_PRODUCT_BYTES + 1) }, 413]])('rejects upstream response %s', async (status, headers, expected) => {
    upstream(status as number, headers as Record<string, string>);
    await expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: expected });
  });
  it('enforces streamed size even without content-length', async () => {
    upstream(200, { 'content-type': 'text/html' }, 'x'.repeat(MAX_PRODUCT_BYTES + 1));
    await expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: 413 });
  });
  it('bounds stalled DNS resolution', async () => {
    vi.useFakeTimers();
    try {
      mocks.lookup.mockReturnValue(new Promise(() => {}));
      const pending = expect(fetchProductHTML('https://example.com')).rejects.toMatchObject({ status: 504 });
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;
    } finally { vi.useRealTimers(); }
  });
});

import { registerDaikoRoutes } from './_core/daiko';
import type { Express, Request, Response } from 'express';
async function callRoute(body: unknown) {
  let handler: (req: Request, res: Response) => Promise<void>;
  const post = vi.fn((_path, callback) => { handler = callback; });
  registerDaikoRoutes({ post } as unknown as Express);
  const result: { status: number; body?: any } = { status: 200 };
  const res = { status: (code: number) => { result.status = code; return res; }, json: (value: unknown) => { result.body = value; return res; } };
  await handler!({ body } as Request, res as unknown as Response);
  expect(post.mock.calls[0][0]).toBe('/api/daiko/fetch');
  return result;
}
describe('Daiko route', () => {
  it('returns JSON 400 for an already-parsed empty body without waiting on stream events', async () => {
    expect(await callRoute({})).toMatchObject({ status: 400, body: { ok: false } });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('extracts metadata and resolves a relative image', async () => {
    upstream(200, { 'content-type': 'text/html' }, '<title>Item &amp; more</title><meta property="og:image" content="/item.jpg"><meta property="product:price:amount" content="1,200">');
    expect(await callRoute({ url: 'https://example.com/item' })).toMatchObject({ status: 200, body: { ok: true, title: 'Item & more', image: 'https://example.com/item.jpg', priceJPY: 1200 } });
  });
  it('does not return executable image URLs', async () => {
    upstream(200, { 'content-type': 'text/html' }, '<meta property="og:image" content="javascript:alert(1)">');
    expect(await callRoute({ url: 'https://example.com/item' })).toMatchObject({ status: 200, body: { image: null } });
  });
});

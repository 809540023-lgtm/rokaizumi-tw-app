import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export class ProductFetchError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const MAX_PRODUCT_BYTES = 2 * 1024 * 1024;

// Conservatively exclude private, loopback, link-local, multicast and reserved IPv4.
export function isPublicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 0 && c === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function productURL(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ProductFetchError(400, '請輸入有效的商品網址（http/https）'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.port || raw.length > 4096) {
    throw new ProductFetchError(400, '請輸入不含帳密或自訂連接埠的商品網址。');
  }
  // IP literals (including IPv6 and alternate numeric spellings) are not product hosts.
  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  if (isIP(host) || host.includes(':') || !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) {
    throw new ProductFetchError(403, '僅支援公開商品網站。');
  }
  return url;
}

// Resolve and pin the socket to a checked address on EVERY hop. A second DNS
// resolution by fetch would leave a DNS-rebinding window. IPv6-only hosts fail closed.
export async function fetchProductHTML(raw: string): Promise<{ html: string; url: string }> {
  let target = productURL(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    for (let hop = 0; hop <= 4; hop++) {
      const addresses = await Promise.race([
        lookup(target.hostname, { family: 4, all: true }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new ProductFetchError(504, '網站回應逾時，請改為手動填寫。')), { once: true });
        }),
      ]);
      if (!addresses.length || addresses.some(item => !isPublicIPv4(item.address))) {
        throw new ProductFetchError(403, '僅支援公開商品網站。');
      }
      const result = await new Promise<{ html?: string; redirect?: string }>((resolve, reject) => {
        const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
        const req = request(target, {
          signal: controller.signal,
          family: 4,
          // Keep the original host for HTTP Host and TLS certificate verification.
          lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Rokaizumi/1.0)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
        }, response => {
          const status = response.statusCode ?? 502;
          if ([301, 302, 303, 307, 308].includes(status)) {
            const location = response.headers.location;
            response.destroy();
            if (!location) reject(new ProductFetchError(502, '商品網站轉址失敗。'));
            else resolve({ redirect: location });
            return;
          }
          if (status < 200 || status >= 300) {
            response.destroy();
            reject(new ProductFetchError(502, '商品網站暫時無法讀取，請改為手動填寫。'));
            return;
          }
          if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type'] ?? '')) {
            response.destroy();
            reject(new ProductFetchError(415, '此網址不是商品網頁，請改為手動填寫。'));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          if (Number(response.headers['content-length']) > MAX_PRODUCT_BYTES) {
            response.destroy();
            reject(new ProductFetchError(413, '商品網頁過大，請改為手動填寫。'));
            return;
          }
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_PRODUCT_BYTES) {
              response.destroy();
              reject(new ProductFetchError(413, '商品網頁過大，請改為手動填寫。'));
            } else chunks.push(chunk);
          });
          response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
          response.on('error', reject);
          response.on('aborted', () => reject(new ProductFetchError(502, '商品網站連線中斷。')));
        });
        req.on('error', reject);
        req.end();
      });
      if (result.redirect) {
        target = productURL(new URL(result.redirect, target).href);
        continue;
      }
      return { html: result.html ?? '', url: target.href };
    }
    throw new ProductFetchError(502, '商品網站轉址次數過多。');
  } catch (error) {
    if (controller.signal.aborted) throw new ProductFetchError(504, '網站回應逾時，請改為手動填寫。');
    if (error instanceof ProductFetchError) throw error;
    throw new ProductFetchError(502, '無法連線到此網址，請確認網址或改為手動填寫。');
  } finally { clearTimeout(timer); }
}

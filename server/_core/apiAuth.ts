import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getApiKeyByKey, incrementApiKeyRequestCount, createApiLog } from '../db';

/**
 * API Key 認證中間件
 * 驗證請求中的 API Key 和 IP 白名單
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // 從 header 或 query 參數中獲取 API Key
    const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API Key is required. Provide it via X-API-Key header or api_key query parameter.',
      });
    }

    // 查詢 API Key
    const keyRecord = await getApiKeyByKey(apiKey);

    if (!keyRecord) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API Key.',
      });
    }

    // 檢查 API Key 是否啟用
    if (!keyRecord.isActive) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'API Key is disabled.',
      });
    }

    // 檢查 IP 白名單
    if (keyRecord.ipWhitelist) {
      const clientIp = getClientIp(req);
      const allowedIps = keyRecord.ipWhitelist.split(',').map(ip => ip.trim());

      if (!allowedIps.includes(clientIp)) {
        await createApiLog({
          apiKeyId: keyRecord.id,
          endpoint: req.path,
          method: req.method,
          statusCode: 403,
          ipAddress: clientIp,
          errorMessage: 'IP not in whitelist',
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your IP address is not whitelisted.',
        });
      }
    }

    // 檢查速率限制
    if (keyRecord.rateLimit && keyRecord.lastUsedAt) {
      const timeSinceLastRequest = (Date.now() - keyRecord.lastUsedAt.getTime()) / 1000;
      const windowStart = Date.now() - (keyRecord.rateLimitWindow || 3600) * 1000;

      // 簡單的速率限制檢查（實際應用中應使用更複雜的邏輯）
      if (timeSinceLastRequest < 1 && keyRecord.requestCount >= keyRecord.rateLimit) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${keyRecord.rateLimit} requests per ${keyRecord.rateLimitWindow} seconds.`,
        });
      }
    }

    // 更新 API Key 的使用統計
    await incrementApiKeyRequestCount(keyRecord.id);

    // 將 API Key 信息附加到 request 對象
    (req as any).apiKey = keyRecord;
    (req as any).clientIp = getClientIp(req);

    next();
  } catch (error) {
    console.error('API Key authentication error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during authentication.',
    });
  }
}

/**
 * 獲取客戶端 IP 地址
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 生成 API Key
 * 返回一個隨機的 64 字元 API Key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 驗證管理員權限
 */
export async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const apiKey = (req as any).apiKey;

  if (!apiKey || !apiKey.createdByAdminId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This API Key does not have admin privileges.',
    });
  }

  next();
}

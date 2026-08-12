import { Router, Request, Response } from 'express';
import { apiKeyAuth, requireAdminRole } from '../_core/apiAuth';
import { createProduct, getCategoryById, createApiLog } from '../db';

const router = Router();

/**
 * OpenClaw 商品上傳 API
 * POST /api/openclaw/products
 * 
 * 請求體格式：
 * {
 *   "name": "商品名稱",
 *   "categoryId": 90001,
 *   "description": "商品描述",
 *   "specifications": "規格信息",
 *   "costJPY": "1000",           // 原始價格（日幣）
 *   "priceUSD": "10",            // 售價（美元）
 *   "imageUrl": "https://...",   // 第一張圖片 URL
 *   "images": ["https://...", "https://..."]  // 所有圖片 URL
 * }
 */
router.post('/products', apiKeyAuth, requireAdminRole, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const apiKey = (req as any).apiKey;
  const clientIp = (req as any).clientIp;

  try {
    const {
      name,
      categoryId,
      description,
      specifications,
      costJPY,
      priceUSD,
      imageUrl,
      images,
    } = req.body;

    // 驗證必填欄位
    const errors: string[] = [];
    if (!name) errors.push('商品名稱 (name) 為必填');
    if (!categoryId) errors.push('分類 ID (categoryId) 為必填');
    if (!costJPY) errors.push('原始價格 (costJPY) 為必填');
    if (!priceUSD) errors.push('售價 (priceUSD) 為必填');

    if (errors.length > 0) {
      await createApiLog({
        apiKeyId: apiKey.id,
        endpoint: '/api/openclaw/products',
        method: 'POST',
        statusCode: 400,
        requestBody: req.body,
        responseBody: { errors },
        ipAddress: clientIp,
        errorMessage: `驗證失敗: ${errors.join('; ')}`,
        executionTimeMs: Date.now() - startTime,
      });

      return res.status(400).json({
        error: 'Validation Error',
        message: '缺少必填欄位',
        details: errors,
      });
    }

    // 驗證分類是否存在
    const category = await getCategoryById(categoryId);
    if (!category) {
      await createApiLog({
        apiKeyId: apiKey.id,
        endpoint: '/api/openclaw/products',
        method: 'POST',
        statusCode: 404,
        requestBody: req.body,
        responseBody: { error: '分類不存在' },
        ipAddress: clientIp,
        errorMessage: `分類 ID ${categoryId} 不存在`,
        executionTimeMs: Date.now() - startTime,
      });

      return res.status(404).json({
        error: 'Not Found',
        message: `分類 ID ${categoryId} 不存在`,
      });
    }

    // 計算利潤（TWD）
    // 假設匹率：1 JPY = 0.2 TWD，1 USD = 30 TWD
    const costJPYNum = parseFloat(costJPY);
    const priceUSDNum = parseFloat(priceUSD);
    const exchangeRateJPYtoTWD = 0.2;
    const exchangeRateUSDtoTWD = 30;

    const costTWD = costJPYNum * exchangeRateJPYtoTWD;
    const priceTWD = priceUSDNum * exchangeRateUSDtoTWD;
    const profitTWD = priceTWD - costTWD;

    // 建立商品
    const result = await createProduct({
      name,
      categoryId,
      description,
      specifications,
      imageUrl,
      images: images || [imageUrl],
      price: Math.round(parseFloat(priceUSD) * 100), // 轉換為整數（分）
      costJPY: costJPY.toString(),
      priceUSD: priceUSD.toString(),
      profitTWD: profitTWD.toString(),
      status: 'available' as const,
      stock: 1,
    });

    // 記錄成功的 API 請求
    const productId = result[0]?.insertId || 0;
    await createApiLog({
      apiKeyId: apiKey.id,
      endpoint: '/api/openclaw/products',
      method: 'POST',
      statusCode: 201,
      requestBody: req.body,
      responseBody: { success: true, productId },
      ipAddress: clientIp,
      executionTimeMs: Date.now() - startTime,
    });

    return res.status(201).json({
      success: true,
      message: '商品已成功上傳',
      productId,
      data: {
        name,
        categoryId,
        costJPY,
        priceUSD,
        profitTWD: profitTWD.toString(),
      },
    });
  } catch (error) {
    console.error('OpenClaw API error:', error);

    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    // 記錄錯誤的 API 請求
    await createApiLog({
      apiKeyId: apiKey.id,
      endpoint: '/api/openclaw/products',
      method: 'POST',
      statusCode: 500,
      requestBody: req.body,
      responseBody: { error: errorMessage },
      ipAddress: clientIp,
      errorMessage,
      executionTimeMs: Date.now() - startTime,
    });

    return res.status(500).json({
      error: 'Internal Server Error',
      message: '處理請求時發生錯誤',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

/**
 * 獲取 API 使用統計
 * GET /api/openclaw/stats
 */
router.get('/stats', apiKeyAuth, async (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;

  return res.json({
    apiKeyName: apiKey.name,
    isActive: apiKey.isActive,
    requestCount: apiKey.requestCount,
    lastUsedAt: apiKey.lastUsedAt,
    rateLimit: apiKey.rateLimit,
    rateLimitWindow: apiKey.rateLimitWindow,
  });
});

export default router;

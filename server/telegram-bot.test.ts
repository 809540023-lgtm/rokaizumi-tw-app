import { describe, it, expect } from 'vitest';
import axios from 'axios';

// 這是打真實 Telegram API 的整合測試，CI 沒有 token 時必須跳過，
// 否則每次建置都會因為缺少憑證而失敗。
const token = process.env.TELEGRAM_BOT_TOKEN;

describe.skipIf(!token)('Telegram Bot Token Validation', () => {
  it('should validate Telegram Bot Token', async () => {
    try {
      // 驗證 Token 是否有效
      const response = await axios.get(
        `https://api.telegram.org/bot${token}/getMe`,
        { timeout: 10000 }
      );

      expect(response.status).toBe(200);
      expect(response.data.ok).toBe(true);
      expect(response.data.result).toHaveProperty('id');
      expect(response.data.result).toHaveProperty('username');
      
      console.log('✅ Telegram Bot Token 驗證成功');
      console.log(`Bot 名稱: @${response.data.result.username}`);
      console.log(`Bot ID: ${response.data.result.id}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Telegram Bot Token 驗證失敗: ${error.message}`);
      }
      throw error;
    }
  });
});

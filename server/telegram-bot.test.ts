import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('Telegram Bot Token Validation', () => {
  it('should validate Telegram Bot Token', async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

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

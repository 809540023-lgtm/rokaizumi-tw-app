import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';
import { storagePut } from '../storage';
import * as db from '../db';

// 定義分類名稱
const CATEGORY_NAMES = {
  HUNDRED_YEN: '日本精美小商品',
  ELDERLY_CARE: '銀髮生活品質加乘輔具',
};

// 動態獲取分類 ID
async function getCategoryId(name: string): Promise<number | null> {
  const categories = await db.getAllCategories();
  const category = categories.find((cat: { id: number; name: string }) => cat.name === name);
  return category?.id || null;
}

// 定義用戶狀態接口
interface UserSession {
  step: 'category' | 'name' | 'price' | 'stock' | 'description' | 'specifications' | 'images' | 'confirm';
  categoryId?: number;
  categoryName?: string;
  name?: string;
  price?: number;
  stock?: number;
  description?: string;
  specifications?: string;
  images?: string[];
  tempImagePath?: string;
}

// 存儲用戶會話
const userSessions = new Map<number, UserSession>();

export function initTelegramBot() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!TELEGRAM_BOT_TOKEN) {
    console.log('Telegram Bot not initialized (no token provided)');
    return null;
  }

  const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

  // 開始命令
  bot.start((ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      userSessions.set(userId, { step: 'category' });
    }

    ctx.reply(
      '👋 歡迎使用商品上傳機器人！\n\n' +
      '請選擇商品分類：',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('📦 日本精美小商品', 'cat_hundred_yen'),
          Markup.button.callback('♿ 銀髮生活品質加乘輔具', 'cat_elderly_care'),
        ],
      ])
    );
  });

  // 分類選擇
  bot.action('cat_hundred_yen', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const session = userSessions.get(userId) || { step: 'category' };
      const categoryId = await getCategoryId(CATEGORY_NAMES.HUNDRED_YEN);
      session.categoryId = categoryId || 0;
      session.categoryName = CATEGORY_NAMES.HUNDRED_YEN;
      session.step = 'name';
      userSessions.set(userId, session);
    }

    ctx.editMessageText('✅ 已選擇：日本精美小商品\n\n請輸入商品名稱：');
  });

  bot.action('cat_elderly_care', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const session = userSessions.get(userId) || { step: 'category' };
      const categoryId = await getCategoryId(CATEGORY_NAMES.ELDERLY_CARE);
      session.categoryId = categoryId || 0;
      session.categoryName = CATEGORY_NAMES.ELDERLY_CARE;
      session.step = 'name';
      userSessions.set(userId, session);
    }

    ctx.editMessageText('✅ 已選擇：銀髮生活品質加乘輔具\n\n請輸入商品名稱：');
  });

  // 處理文本輸入
  bot.on(message('text'), async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = userSessions.get(userId);
    if (!session) {
      ctx.reply('請先使用 /start 開始');
      return;
    }

    const text = ctx.message.text;

    try {
      switch (session.step) {
        case 'name':
          session.name = text;
          session.step = 'price';
          userSessions.set(userId, session);
          ctx.reply(`✅ 商品名稱：${text}\n\n請輸入價格（台幣 NT$）：`);
          break;

        case 'price':
          const price = parseFloat(text);
          if (isNaN(price)) {
            ctx.reply('❌ 請輸入有效的價格（數字）');
            return;
          }
          session.price = price;
          session.step = 'stock';
          userSessions.set(userId, session);
          ctx.reply(`✅ 價格：NT$${price}\n\n請輸入庫存數量：`);
          break;

        case 'stock':
          const stock = parseInt(text);
          if (isNaN(stock) || stock < 0) {
            ctx.reply('❌ 請輸入有效的數量（正整數）');
            return;
          }
          session.stock = stock;
          session.step = 'description';
          userSessions.set(userId, session);
          ctx.reply(`✅ 庫存數量：${stock}\n\n請輸入商品描述：`);
          break;

        case 'description':
          session.description = text;
          session.step = 'specifications';
          userSessions.set(userId, session);
          ctx.reply(`✅ 描述已保存\n\n請輸入商品規格（例如：尺寸、材質等）：`);
          break;

        case 'specifications':
          session.specifications = text;
          session.step = 'images';
          userSessions.set(userId, session);
          ctx.reply(
            `✅ 規格已保存\n\n請上傳商品圖片（支持多張，每次上傳一張）：\n` +
            `上傳完成後，請輸入 "完成" 來結束上傳。`
          );
          break;

        case 'images':
          if (text === '完成') {
            // 進入確認步驟
            session.step = 'confirm';
            userSessions.set(userId, session);

            const summary =
              `📋 商品信息確認：\n\n` +
              `分類：${session.categoryName}\n` +
              `名稱：${session.name}\n` +
              `價格：NT$${session.price}\n` +
              `數量：${session.stock}\n` +
              `描述：${session.description}\n` +
              `規格：${session.specifications}\n` +
              `圖片數量：${session.images?.length || 0} 張\n\n` +
              `確認無誤？`;

            ctx.reply(
              summary,
              Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ 確認上傳', 'confirm_upload'),
                  Markup.button.callback('❌ 取消', 'cancel_upload'),
                ],
              ])
            );
          } else {
            ctx.reply('❌ 請上傳圖片或輸入 "完成" 結束上傳');
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ctx.reply('❌ 處理出錯，請重試');
    }
  });

  // 處理圖片上傳
  bot.on(message('photo'), async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = userSessions.get(userId);
    if (!session || session.step !== 'images') {
      ctx.reply('❌ 請先完成前面的步驟');
      return;
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.telegram.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      // 下載圖片
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' } as any);
      const imageBuffer = Buffer.from(response.data as any);

      // 上傳到 S3
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { url } = await storagePut(`products/${fileName}`, imageBuffer, 'image/jpeg');

      // 保存圖片 URL
      if (!session.images) {
        session.images = [];
      }
      session.images.push(url);
      userSessions.set(userId, session);

      ctx.reply(`✅ 圖片已上傳 (${session.images.length} 張)\n\n繼續上傳或輸入 "完成" 結束：`);
    } catch (error) {
      console.error('Error uploading image:', error);
      ctx.reply('❌ 圖片上傳失敗，請重試');
    }
  });

  // 確認上傳
  bot.action('confirm_upload', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const session = userSessions.get(userId);
    if (!session) {
      ctx.reply('❌ 會話已過期');
      return;
    }

    try {
      // 直接調用數據庫創建商品（避免 tRPC 格式問題）
      console.log('Creating product with data:', {
        categoryId: session.categoryId,
        name: session.name,
        price: session.price,
        description: session.description,
        specifications: session.specifications,
        imageUrl: session.images?.[0],
        stock: session.stock || 1,
      } as any);

      const product = await db.createProduct({
        categoryId: session.categoryId!,
        name: session.name!,
        price: session.price!,
        description: session.description,
        specifications: session.specifications,
        imageUrl: session.images?.[0] || undefined,
        images: session.images || [],
        stock: session.stock || 1,
        status: 'available',
      } as any);

      console.log('Product created successfully:', product);

      // 獲取創建的商品 ID
      const productId = (product as any)?.insertId || '已創建';

      ctx.reply(
        `✅ 商品上傳成功！\n\n` +
        `商品 ID：${productId}\n` +
        `名稱：${session.name}\n` +
        `分類：${session.categoryName}\n` +
        `價格：¥${session.price}\n\n` +
        `使用 /start 上傳新商品`
      );

      // 清除會話
      userSessions.delete(userId);
    } catch (error) {
      console.error('Error creating product:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      ctx.reply('❌ 上傳失敗，請重試');
    }
  });

  // 取消上傳
  bot.action('cancel_upload', (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      userSessions.delete(userId);
    }

    ctx.reply('❌ 已取消上傳\n\n使用 /start 重新開始');
  });

  // 幫助命令
  bot.help((ctx) => {
    ctx.reply(
      '📖 幫助\n\n' +
      '/start - 開始上傳商品\n' +
      '/help - 顯示此幫助信息\n' +
      '/cancel - 取消當前上傳'
    );
  });

  // 取消命令
  bot.command('cancel', (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      userSessions.delete(userId);
    }
    ctx.reply('❌ 已取消\n\n使用 /start 重新開始');
  });

  // 啟動機器人
  bot.launch()
    .then(() => {
      console.log('✅ Telegram 商品上傳機器人已啟動！');
    })
    .catch((error) => {
      console.error('❌ 機器人啟動失敗:', error);
    });

  // 優雅關閉
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

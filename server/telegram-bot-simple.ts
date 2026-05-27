import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';

// 定義分類
const CATEGORIES = {
  HUNDRED_YEN: { id: 1, name: '日本百元商品' },
  ELDERLY_CARE: { id: 2, name: '老人看護器材' },
};

// 定義用戶狀態接口
interface UserSession {
  categoryId?: number;
  categoryName?: string;
  name?: string;
  price?: string;
  description?: string;
  specifications?: string;
  images?: string[];
}

// 存儲用戶會話
const userSessions = new Map<number, UserSession>();

// 初始化機器人
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// 開始命令
bot.start((ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    userSessions.set(userId, {});
  }

  ctx.reply(
    '👋 歡迎使用商品上傳機器人（測試版）！\n\n' +
    '請選擇商品分類：',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('📦 日本百元商品', 'cat_hundred_yen'),
        Markup.button.callback('👴 老人看護器材', 'cat_elderly_care'),
      ],
    ])
  );
});

// 分類選擇
bot.action('cat_hundred_yen', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    const session = userSessions.get(userId) || {};
    session.categoryId = CATEGORIES.HUNDRED_YEN.id;
    session.categoryName = CATEGORIES.HUNDRED_YEN.name;
    userSessions.set(userId, session);
  }

  ctx.editMessageText('✅ 已選擇：日本百元商品\n\n請輸入商品名稱：');
});

bot.action('cat_elderly_care', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    const session = userSessions.get(userId) || {};
    session.categoryId = CATEGORIES.ELDERLY_CARE.id;
    session.categoryName = CATEGORIES.ELDERLY_CARE.name;
    userSessions.set(userId, session);
  }

  ctx.editMessageText('✅ 已選擇：老人看護器材\n\n請輸入商品名稱：');
});

// 處理文本輸入 - 簡化版
// 處理圖片
bot.on(message('photo'), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = userSessions.get(userId);
  const step = inputStep.get(userId);

  if (step === 'images' && session) {
    const photo = (ctx.message as any).photo[(ctx.message as any).photo.length - 1];
    if (!session.images) session.images = [];
    session.images.push(photo.file_id);
    ctx.reply(`✅ 已保存 ${session.images.length} 張圖片\n\n繼續上傳或點擊「完成」：`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ 完成上傳', 'confirm_upload')],
      ])
    );
  }
});

let inputStep = new Map<number, string>(); // 追蹤每個用戶的輸入步驟

bot.on(message('text'), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = userSessions.get(userId);
  if (!session || !session.categoryId) {
    ctx.reply('請先使用 /start 選擇分類');
    return;
  }

  const step = inputStep.get(userId) || 'name';
  const text = ctx.message.text;

  try {
    switch (step) {
      case 'name':
        session.name = text;
        inputStep.set(userId, 'price');
        ctx.reply(`✅ 商品名稱：${text}\n\n請輸入價格（例如：100）：`);
        break;

      case 'price':
        session.price = text;
        inputStep.set(userId, 'description');
        ctx.reply(`✅ 價格：${text}\n\n請輸入描述：`);
        break;

      case 'description':
        session.description = text;
        inputStep.set(userId, 'specifications');
        ctx.reply(`✅ 描述已保存\n\n請輸入規格：`);
        break;

      case 'specifications':
        session.specifications = text;
        inputStep.set(userId, 'images');
        ctx.reply('✅ 規格已保存\n\n請上傳商品圖片（可選，發送圖片或點擊「跳過」）：', 
          Markup.inlineKeyboard([
            [Markup.button.callback('⏭️ 跳過圖片', 'skip_images')],
          ])
        );
        break;


    }
  } catch (error) {
    console.error('Error processing message:', error);
    ctx.reply('❌ 處理出錯，請重試');
  }
});

// 確認上傳
// 跳過圖片
bot.action('skip_images', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    inputStep.set(userId, 'confirm');
  }
  ctx.answerCbQuery();
  
  const session = userSessions.get(userId!);
  if (session) {
    const summary =
      `📋 商品信息確認：\n\n` +
      `分類：${session.categoryName}\n` +
      `名稱：${session.name}\n` +
      `價格：${session.price}\n` +
      `描述：${session.description}\n` +
      `規格：${session.specifications}\n` +
      `圖片：${session.images?.length || 0} 張\n\n` +
      `確認無誤？`;

    ctx.editMessageText(summary, Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ 確認上傳', 'confirm_upload'),
        Markup.button.callback('❌ 取消', 'cancel_upload'),
      ],
    ]));
  }
});

bot.action('confirm_upload', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = userSessions.get(userId);
  if (!session) {
    ctx.reply('❌ 會話已過期');
    return;
  }

  try {
    const payload = {
      categoryId: session.categoryId,
      name: session.name || '未命名商品',
      price: parseInt(session.price || '0') || 0,
      description: session.description || '',
      specifications: session.specifications || '',
      images: [],
      stock: 1,
    };

    console.log('Uploading product:', JSON.stringify(payload));

    const response = await axios.post(
      'http://localhost:3000/api/trpc/admin.createProductPublic',
      { json: payload },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    console.log('Upload response:', JSON.stringify(response.data));

    const result = response.data?.result?.data?.json?.[0];
    const productId = result?.insertId || '已創建';

    ctx.reply(
      `✅ 商品上傳成功！\n\n` +
      `商品 ID：${productId}\n` +
      `名稱：${session.name}\n` +
      `分類：${session.categoryName}\n` +
      `價格：${session.price}\n\n` +
      `使用 /start 上傳新商品`
    );

    // 清除會話
    userSessions.delete(userId);
    inputStep.delete(userId);
  } catch (error) {
    console.error('Error uploading product:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data));
    }
    ctx.reply('❌ 上傳失敗，請重試');
  }
});

// 取消上傳
bot.action('cancel_upload', (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    userSessions.delete(userId);
    inputStep.delete(userId);
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
    inputStep.delete(userId);
  }
  ctx.reply('❌ 已取消\n\n使用 /start 重新開始');
});

export { bot };

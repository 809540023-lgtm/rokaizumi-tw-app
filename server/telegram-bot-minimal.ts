import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import axios from 'axios';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// 用戶狀態
const users = new Map<number, any>();

// 開始
bot.start((ctx) => {
  const uid = ctx.from?.id;
  if (uid) users.set(uid, {});
  
  ctx.reply('👋 歡迎！請選擇分類：', Markup.inlineKeyboard([
    [Markup.button.callback('📦 日本百元商品', 'cat1'), Markup.button.callback('👴 老人看護器材', 'cat2')],
  ]));
});

// 分類1
bot.action('cat1', (ctx) => {
  const uid = ctx.from?.id;
  if (uid) users.get(uid).categoryId = 1;
  ctx.editMessageText('✅ 已選擇日本百元商品\n\n請輸入商品名稱：');
});

// 分類2
bot.action('cat2', (ctx) => {
  const uid = ctx.from?.id;
  if (uid) users.get(uid).categoryId = 2;
  ctx.editMessageText('✅ 已選擇老人看護器材\n\n請輸入商品名稱：');
});

// 文本處理
bot.on(message('text'), async (ctx) => {
  const uid = ctx.from?.id;
  if (!uid) return;
  
  const user = users.get(uid);
  if (!user) {
    ctx.reply('請先使用 /start');
    return;
  }

  const text = ctx.message.text;

  if (!user.categoryId) {
    ctx.reply('請先選擇分類');
    return;
  }

  if (!user.name) {
    user.name = text;
    ctx.reply(`✅ 名稱：${text}\n\n請輸入價格：`);
  } else if (!user.price) {
    user.price = text;
    ctx.reply(`✅ 價格：${text}\n\n請輸入描述：`);
  } else if (!user.description) {
    user.description = text;
    ctx.reply(`✅ 描述已保存\n\n請輸入規格：`);
  } else if (!user.specifications) {
    user.specifications = text;
    
    // 顯示確認
    const summary = `📋 確認信息：\n分類：${user.categoryId === 1 ? '日本百元商品' : '老人看護器材'}\n名稱：${user.name}\n價格：${user.price}\n描述：${user.description}\n規格：${user.specifications}`;
    
    ctx.reply(summary, Markup.inlineKeyboard([
      [Markup.button.callback('✅ 確認上傳', 'upload'), Markup.button.callback('❌ 取消', 'cancel')],
    ]));
  }
});

// 上傳
bot.action('upload', async (ctx) => {
  const uid = ctx.from?.id;
  if (!uid) return;
  
  const user = users.get(uid);
  if (!user) return;

  try {
    const payload = {
      categoryId: user.categoryId,
      name: user.name,
      price: parseInt(user.price) || 0,
      description: user.description,
      specifications: user.specifications,
    };

    const response = await axios.post(
      'http://localhost:3000/api/trpc/admin.createProductPublic',
      { json: payload },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const insertId = response.data?.result?.data?.json?.[0]?.insertId;
    ctx.editMessageText(`✅ 上傳成功！\n商品 ID：${insertId || '已創建'}\n\n使用 /start 上傳新商品`);
    users.delete(uid);
  } catch (error) {
    console.error('Upload error:', error);
    ctx.editMessageText('❌ 上傳失敗，請重試');
  }
});

// 取消
bot.action('cancel', (ctx) => {
  const uid = ctx.from?.id;
  if (uid) users.delete(uid);
  ctx.editMessageText('❌ 已取消\n\n使用 /start 重新開始');
});

// 幫助
bot.help((ctx) => {
  ctx.reply('/start - 開始上傳\n/help - 幫助');
});

export { bot };

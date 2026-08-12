import { bot } from './telegram-bot';
import dotenv from 'dotenv';

// 加載環境變量
dotenv.config();

// 啟動機器人
async function startBot() {
  try {
    console.log('🤖 Telegram 機器人啟動中...');
    
    // 設置機器人命令
    await bot.telegram.setMyCommands([
      { command: 'start', description: '開始上傳商品' },
      { command: 'help', description: '顯示幫助信息' },
      { command: 'cancel', description: '取消當前操作' },
    ]);

    // 啟動機器人
    bot.launch();
    console.log('✅ Telegram 機器人已啟動！');

    // 優雅關閉
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ 機器人啟動失敗:', error);
    process.exit(1);
  }
}

startBot();

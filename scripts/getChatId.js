const TelegramBot = require('node-telegram-bot-api');

const fs = require('fs');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log(`📥 Chat ID 수신됨: ${chatId}`);
  fs.writeFileSync('telegram_chat_id.txt', chatId.toString());
  bot.sendMessage(chatId, '✅ 알림 서비스 등록 완료!');
});
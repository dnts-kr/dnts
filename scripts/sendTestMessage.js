const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = process.env.TELEGRAM_CHAT_ID;

bot.sendMessage(chatId, '🧪 테스트 메시지: 봇 연결이 정상 작동합니다!');
console.log('✅ 테스트 메시지 전송 완료');
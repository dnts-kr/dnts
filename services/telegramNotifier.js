const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
console.log("📡 TELEGRAM_BOT_TOKEN:", TELEGRAM_BOT_TOKEN ? "[OK]" : "❌ 없음");

// 전역 DB 클라이언트 변수
let globalDbClient = null;

// 초기화 함수 - server.js에서 호출
function initializeNotifier(dbClient) {
  globalDbClient = dbClient;
  console.log("📡 Database client initialized in telegramNotifier");
  return bot;
}

// Telegram 봇 초기화
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
  console.error("⚠️ Telegram Polling 오류:", err.message);
});

// 사용자 chatId 저장
bot.on('message', async (msg) => {
  if (!globalDbClient) {
    console.error("❌ DB 클라이언트가 초기화되지 않았습니다");
    return;
  }

  const chatId = msg.chat.id;

  try {
    await globalDbClient.query(
      `INSERT INTO telegram_subscribers (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING`,
      [chatId]
    );
    console.log(`✅ chatId 저장됨: ${chatId}`);
    bot.sendMessage(chatId, '🤖 알림 봇에 연결되었습니다!');
  } catch (err) {
    console.error("❌ chatId 저장 실패:", err.message);
  }
});

// 알림 전송 함수
async function sendAlert(symbol, change, newsList) {
  if (!globalDbClient) {
    console.error("❌ DB 클라이언트가 초기화되지 않았습니다");
    return;
  }

  const header = `🚨 [${symbol}] ${change}% 변동 감지`;

  const newsText = Array.isArray(newsList) && newsList.length
    ? newsList.map((n, i) => `📰 ${i + 1}. ${n.headline}\n🔗 ${n.url || ''}`).join('\n\n')
    : '관련 뉴스 없음.';

  const message = `${header}\n\n${newsText}`;

  try {
    const res = await globalDbClient.query('SELECT chat_id FROM telegram_subscribers');
    for (const row of res.rows) {
      await bot.sendMessage(row.chat_id, message).catch((err) => {
        console.error(`❌ [${row.chat_id}] 메시지 전송 실패:`, err.message);
      });
    }
  } catch (err) {
    console.error("❌ 알림 전송 실패:", err.message);
  }
}

// 모듈 내보내기 - 함수와 봇 객체 모두 내보내기
module.exports = sendAlert;
module.exports.initializeNotifier = initializeNotifier;
module.exports.bot = bot;
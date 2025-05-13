require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const telegramNotifier = require('./services/telegramNotifier');
const startMonitor = require('./services/tickerMonitor');
const indexRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ 전역 상태 변수 등록
global.subscriptionCount = 0;
const startTime = Date.now();

// PostgreSQL 클라이언트
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 환경변수 검증
const validateEnvVars = () => {
  const requiredVars = {
    'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
    'DATABASE_URL': process.env.DATABASE_URL,
    'POLYGON_API_KEY': process.env.POLYGON_API_KEY
  };

  let allValid = true;
  for (const [name, value] of Object.entries(requiredVars)) {
    if (!value) {
      console.error(`❌ ${name}: [MISSING]`);
      allValid = false;
    } else {
      console.log(`📡 ${name}: [OK]`);
    }
  }
  return allValid;
};

// ✅ 이 위치에 /status 라우트 포함시키세요
app.get('/status', async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  let dbConnected = false;

  try {
    await dbClient.query('SELECT 1');
    dbConnected = true;
  } catch (_) {
    dbConnected = false;
  }

  res.status(200).json({
    status: "✅ Server is alive",
    env: process.env.NODE_ENV,
    uptime: `${uptimeSeconds}s`,
    subscriptionCount: global.subscriptionCount,
    dbConnected
  });
});

// 서버 시작 함수
const startServer = async () => {
  try {
    if (!validateEnvVars()) throw new Error('Missing required environment variables');

    await dbClient.connect();
    console.log('✅ Database connected successfully');

    const telegramBot = telegramNotifier.bot;
    telegramNotifier.initializeNotifier(dbClient);
    console.log('✅ Telegram notifier initialized');

    app.use(express.json());
    app.use('/', indexRouter);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    try {
      console.log('🔍 Starting stock monitoring service...');
      await startMonitor(dbClient, telegramBot);
      console.log('✅ Monitoring service started successfully');
    } catch (err) {
      console.error('❌ Failed to start monitoring service:', err);
    }

    // ✅ Telegram 봇 launch (production에서만)
    if (telegramBot.launch && process.env.NODE_ENV === 'production') {
      await telegramBot.launch();
      console.log('🤖 Telegram bot is running');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// 종료 시그널 처리
process.once('SIGINT', () => {
  telegramNotifier.bot.stop && telegramNotifier.bot.stop('SIGINT');
  dbClient.end();
});
process.once('SIGTERM', () => {
  telegramNotifier.bot.stop && telegramNotifier.bot.stop('SIGTERM');
  dbClient.end();
});

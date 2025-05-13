require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const telegramNotifier = require('./services/telegramNotifier');
const startMonitor = require('./services/tickerMonitor');
const indexRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 8080;

// PostgreSQL 클라이언트
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 필수 환경변수 검사
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

// 서버 시작
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

    // 헬스 체크 라우트 (Railway용)
    app.get('/status', (req, res) => {
      res.status(200).send('✅ Server is alive and monitoring stocks.');
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 실시간 주식 모니터링 시작
    try {
      console.log('🔍 Starting stock monitoring service...');
      await startMonitor(dbClient, telegramBot);
      console.log('✅ Monitoring service started successfully');
    } catch (err) {
      console.error('❌ Failed to start monitoring service:', err);
    }

    // 텔레그램 봇 실행 (production 환경에서만)
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

require('dotenv').config();
const express = require('express');
const { Client } = require('pg');  // pg 라이브러리 사용
const telegramNotifier = require('./services/telegramNotifier');
const startMonitor = require('./services/tickerMonitor');
const indexRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터베이스 클라이언트 설정
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Railway 배포 시 SSL 필요
});

// 환경 변수 검증 함수
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

// 서버 시작 함수
const startServer = async () => {
  try {
    if (!validateEnvVars()) {
      throw new Error('Missing required environment variables');
    }

    // DB 연결
    await dbClient.connect();
    console.log('✅ Database connected successfully');

    // Telegram 봇 초기화
    const telegramBot = telegramNotifier.bot;
    telegramNotifier.initializeNotifier(dbClient);
    console.log('✅ Telegram notifier initialized');

    // JSON 파서 등록
    app.use(express.json());

    // 기본 라우터 등록
    app.use('/', indexRouter);

    // 서버 실행
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // 모니터링 시작
    try {
      console.log('🔍 Starting stock monitoring service...');
      await startMonitor(dbClient, telegramBot);
      console.log('✅ Monitoring service started successfully');
    } catch (error) {
      console.error('❌ Failed to start monitoring service:', error);
    }

    // Telegram 봇 실행
    if (telegramBot.launch) {
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

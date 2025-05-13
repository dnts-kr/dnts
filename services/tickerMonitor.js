const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { bot } = require('./telegramNotifier');

const polygonApiKey = process.env.POLYGON_API_KEY;

module.exports = async function startMonitor(dbClient, telegramBot) {
  const POLYGON_SOCKET_URL = 'wss://socket.polygon.io/stocks';
  const ws = new WebSocket(POLYGON_SOCKET_URL);

  // ✅ NASDAQ/NYSE/AMEX 전용 티커 목록 로드
  const tickerPath = path.join(__dirname, '../tickers.json');
  const symbols = JSON.parse(fs.readFileSync(tickerPath, 'utf8'));
  const tradableSymbols = symbols
    .filter(t => ['NASDAQ', 'NYSE', 'AMEX'].includes(t.primary_exchange))
    .map(t => `T.${t.ticker}`);

  ws.on('open', () => {
    console.log('✅ WebSocket 연결됨');
    ws.send(JSON.stringify({ action: 'auth', params: polygonApiKey }));

    const chunkSize = 400; // Polygon 요청 제한 회피용
    for (let i = 0; i < tradableSymbols.length; i += chunkSize) {
      const chunk = tradableSymbols.slice(i, i + chunkSize);
      ws.send(JSON.stringify({ action: 'subscribe', params: chunk.join(',') }));
    }

    console.log(`📡 총 ${tradableSymbols.length} 종목 구독 요청 완료`);
  });

  ws.on('message', async (raw) => {
    const data = JSON.parse(raw);
    // 여기서 급등 조건 감지 & 알림 처리
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket 오류:', err);
  });

  ws.on('close', () => {
    console.warn('⚠️ WebSocket 연결 종료됨');
  });

  process.once('SIGINT', () => ws.close());
  process.once('SIGTERM', () => ws.close());
};

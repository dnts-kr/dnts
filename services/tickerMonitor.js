const axios = require('axios');
const WebSocket = require('ws');
const sendAlert = require('./telegramNotifier');
const fetchNewsForTicker = require('./newsFetcher');

const polygonApiKey = process.env.POLYGON_API_KEY;

module.exports = async function startMonitor(dbClient, telegramBot) {
  console.log('🌐 Polygon에서 티커 불러오는 중...');

  let tradableSymbols = [];

  try {
    const exchanges = ['XNAS', 'XNYS', 'XASE']; // 나스닥, 뉴욕, 아멕스
    let url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${polygonApiKey}`;
    let results = [];

    while (url) {
      const res = await axios.get(url);
      results = results.concat(res.data.results);
      url = res.data.next_url ? `${res.data.next_url}&apiKey=${polygonApiKey}` : null;
    }

    tradableSymbols = results
      .filter(t => exchanges.includes(t.primary_exchange))
      .map(t => `T.${t.ticker}`);

    console.log(`📦 구독 대상 티커 수: ${tradableSymbols.length}`);
  } catch (err) {
    console.error('❌ 티커 로딩 실패:', err.message);
    return;
  }

  const socket = new WebSocket('wss://socket.polygon.io/stocks');

  socket.on('open', () => {
    console.log('✅ WebSocket 연결됨');
    socket.send(JSON.stringify({ action: 'auth', params: polygonApiKey }));

    const chunkSize = 5000;
    for (let i = 0; i < tradableSymbols.length; i += chunkSize) {
      const chunk = tradableSymbols.slice(i, i + chunkSize);
      const joined = chunk.join(',');
      console.log(`📡 구독 요청 (${i} ~ ${i + chunkSize - 1})`);
      socket.send(JSON.stringify({ action: 'subscribe', params: joined }));
    }

    console.log('🚀 모든 종목 구독 요청 완료');
  });

  socket.on('message', async (data) => {
    let messages;
    try {
      messages = JSON.parse(data);
      if (!Array.isArray(messages)) messages = [messages];
    } catch (err) {
      console.error('❌ JSON 파싱 오류:', err.message);
      return;
    }

    for (const msg of messages) {
      if (msg.ev === 'status') {
        console.log(`🔐 ${msg.message}`);
      }

      if (msg.ev === 'T') {
        const symbol = msg.sym;
        const price = msg.p;
        const volume = msg.v;
        const changeFlag = msg.c ? msg.c[0] : 0;

        if (Math.abs(changeFlag) === 2 && volume > 50000) {
          console.log(`🚨 감지됨: ${symbol} (${price}, ${volume}주)`);

          try {
            const news = await fetchNewsForTicker(symbol);
            console.log(`📰 ${symbol} 뉴스 ${news.length}건`);
            await sendAlert(symbol, price, news);
          } catch (err) {
            console.error(`❌ 알림 오류 (${symbol}):`, err.message);
          }
        }
      }
    }
  });

  socket.on('error', (err) => {
    console.error('❌ WebSocket 오류:', err.message);
  });

  socket.on('close', () => {
    console.warn('⚠️ WebSocket 연결 종료됨. 재시작 시도 중...');
    setTimeout(() => process.exit(1), 5000); // Railway가 자동 재시작
  });

  process.once('SIGINT', () => socket.close());
  process.once('SIGTERM', () => socket.close());
};

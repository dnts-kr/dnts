const WebSocket = require('ws');
const sendAlert = require('./telegramNotifier');
const fetchNewsForTicker = require('./newsFetcher');

// 매개변수를 받도록 함수 시그니처 수정
function startMonitor(dbClient, telegramBot) {
  const API_KEY = process.env.POLYGON_API_KEY;
  console.log("🔐 POLYGON_API_KEY:", API_KEY ? "[OK]" : "❌ 없음");

  const socket = new WebSocket(`wss://socket.polygon.io/stocks`);

  socket.on('open', () => {
    console.log('✅ WebSocket 연결됨');
    // 인증
    socket.send(JSON.stringify({ action: 'auth', params: API_KEY }));

    // 모든 티커 구독
    socket.send(JSON.stringify({
      action: 'subscribe',
      params: 'T.*'  // 모든 티커 트랜잭션 구독
    }));
  });

  socket.on('message', async (data) => {
    let messages;
    try {
      messages = JSON.parse(data);
      if (!Array.isArray(messages)) {
        messages = [messages];
      }
    } catch (error) {
      console.error('❌ JSON 파싱 오류:', error.message);
      return;
    }

    for (const message of messages) {
      if (message.ev === 'status') {
        console.log(`🔐 ${message.message}`);
      }

      if (message.ev === 'T') {
        const symbol = message.sym;
        const price = message.p;
        const volume = message.v;
        const changeFlag = message.c ? message.c[0] : 0;

        // 감지 조건 예시 - 큰 거래량과 가격 변화
        if (Math.abs(changeFlag) === 2 && volume > 50000) {
          console.log(`🚨 감지됨: ${symbol} (${price}, ${volume}주, 변화플래그: ${changeFlag})`);

          try {
            // 실제 뉴스 데이터 가져오기
            const news = await fetchNewsForTicker(symbol);
            console.log(`📰 ${symbol}에 대한 뉴스 ${news.length}개 검색됨`);
            
            // 알림 보내기
            await sendAlert(symbol, price, news);
          } catch (error) {
            console.error(`❌ ${symbol} 처리 중 오류:`, error.message);
          }
        }
      }
    }
  });

  socket.on('error', (err) => {
    console.error('❌ WebSocket 오류:', err.message);
  });

  socket.on('close', () => {
    console.warn('⚠️ WebSocket 연결 종료됨. 재연결 시도 중...');
    setTimeout(() => {
      process.exit(1); // Railway가 자동 재시작하도록 종료
    }, 5000);
  });
  
  // 성공적으로 시작되었음을 알리기 위해 Promise 반환
  return Promise.resolve();
}

module.exports = startMonitor;
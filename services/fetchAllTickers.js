const fs = require('fs');
const fetch = require('node-fetch');  // 이미 설치되어 있음

const API_KEY = process.env.POLYGON_API_KEY;

const fetchAllTickers = async () => {
  const exchanges = ['XNAS', 'XNYS', 'ARCX'];
  let allTickers = [];

  for (const ex of exchanges) {
    let url = `https://api.polygon.io/v3/reference/tickers?market=stocks&exchange=${ex}&active=true&limit=1000&apiKey=${API_KEY}`;

    while (url) {
      console.log(`📡 요청: ${url}`);
      const res = await fetch(url);
      const json = await res.json();

      if (json.results) {
        allTickers = allTickers.concat(json.results.map(t => t.ticker));
        console.log(`📥 ${ex}: 누적 ${allTickers.length}개`);
      } else {
        console.warn(`⚠️ 응답에 results 없음:`, json);
      }

      url = json.next_url ? `${json.next_url}&apiKey=${API_KEY}` : null;
    }
  }

  fs.writeFileSync('tickers.json', JSON.stringify(allTickers, null, 2));
  console.log(`✅ 총 ${allTickers.length}개 종목 저장 완료`);
};

fetchAllTickers();


const API_KEY = process.env.POLYGON_API_KEY;

module.exports = async function fetchNewsForTicker(ticker) {
  console.log(`📰 뉴스 검색 중: ${ticker}`);

  try {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=3&order=desc&apiKey=${API_KEY}`;
    const response = await fetch(url); // Node.js 18+ 내장 fetch 사용
    const result = await response.json();

    if (!result || !result.results || !Array.isArray(result.results)) {
      console.warn('⚠️ 뉴스 데이터 형식 이상. 빈 배열 반환.');
      return [];
    }

    return result.results.map((item) => ({
      headline: item.title || '제목 없음',
      summary: item.description?.substring(0, 200) || '요약 없음',
      url: item.article_url || ''
    }));
  } catch (err) {
    console.error('❌ 뉴스 가져오기 실패:', err.message);
    return [];
  }
};

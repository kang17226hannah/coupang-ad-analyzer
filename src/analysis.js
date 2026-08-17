export const DEFAULT_SETTINGS = { marginRate: 35, feeRate: 10.8, shippingCost: 3000, targetRoa: 500 };

const aliases = {
  date: ['날짜', '일자', 'date'], product: ['광고집행 상품명', '상품명', 'product'], keyword: ['키워드', '검색어', 'keyword'],
  placement: ['광고 노출 지면', '노출지면', '지면', 'placement'], impressions: ['노출수', 'impressions'], clicks: ['클릭수', 'clicks'],
  cost: ['광고비', '총 비용', '비용', 'cost'], orders: ['주문수', '구매수', 'orders'], sales: ['광고 전환 매출액', '전환매출', '매출액', 'sales'],
};

const num = value => Number(String(value ?? 0).replace(/[₩원,%\s,]/g, '')) || 0;
export function normalizeRow(row, index = 0) {
  const get = key => { const found = aliases[key].find(name => row[name] !== undefined); return found ? row[found] : ''; };
  return { id: index + 1, date: get('date'), product: get('product') || '미지정 상품', keyword: get('keyword') || '(검색어 없음)', placement: get('placement') || '기타', impressions: num(get('impressions')), clicks: num(get('clicks')), cost: num(get('cost')), orders: num(get('orders')), sales: num(get('sales')) };
}
export function metrics(rows, settings = DEFAULT_SETTINGS) {
  const sum = key => rows.reduce((a, r) => a + r[key], 0);
  const impressions = sum('impressions'), clicks = sum('clicks'), cost = sum('cost'), orders = sum('orders'), sales = sum('sales');
  const expectedProfit = sales * (settings.marginRate / 100) - cost - orders * settings.shippingCost;
  return { impressions, clicks, cost, orders, sales, ctr: impressions ? clicks / impressions * 100 : 0, cpc: clicks ? cost / clicks : 0, cvr: clicks ? orders / clicks * 100 : 0, roa: cost ? sales / cost * 100 : 0, cpa: orders ? cost / orders : 0, expectedProfit, estimatedVisits: clicks ? Math.round(clicks * 1.12) : 0 };
}
export function groupRows(rows, key, settings = DEFAULT_SETTINGS) {
  const groups = Object.groupBy ? Object.groupBy(rows, r => r[key]) : rows.reduce((a, r) => ((a[r[key]] ||= []).push(r), a), {});
  return Object.entries(groups).map(([name, items]) => ({ name, count: items.length, ...metrics(items, settings) })).sort((a, b) => b.cost - a.cost);
}
export function classify(row, settings = DEFAULT_SETTINGS) {
  const m = metrics([row], settings);
  if (row.cost > 0 && row.orders === 0) return { level: 'danger', label: '누수', message: '비용이 발생했지만 주문이 없습니다.' };
  if (m.roa >= settings.targetRoa && row.orders > 0) return { level: 'good', label: '효자', message: '목표 ROAS를 달성했습니다.' };
  if (row.impressions > 100 && m.ctr < 0.3) return { level: 'warn', label: '소재 개선', message: '노출 대비 클릭률이 낮습니다.' };
  return { level: 'normal', label: '관찰', message: '데이터를 더 수집해 보세요.' };
}

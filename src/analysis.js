export const DEFAULT_SETTINGS = {
  marginRate: 35, feeRate: 10.8, shippingCost: 3000, targetRoa: 500,
  roaComfortRate: 30, nonSearchWarningRate: 60,
  leakSuspectClicks: 10, leakHighClicks: 30, leakSuspectCost: 10000, leakHighCost: 30000,
  minImpressions: 500, minClicks: 10, healthyCtr: 0.5, conversionClicks: 20,
};

function reportPeriodFromFileName(name = '') {
  const match = String(name).match(/_(\d{8})_(\d{8})(?:\.[^.]+)?$/i);
  if (!match) return null;
  const fmt = value => `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  return { start: fmt(match[1]), end: fmt(match[2]) };
}

// 쿠팡 광고보고서는 행 안에 기간 컬럼이 없는 경우가 있어 파일명(A..._YYYYMMDD_YYYYMMDD.xlsx)에서 기간을 보존합니다.
if (typeof File !== 'undefined' && File.prototype?.arrayBuffer && !File.prototype.__coupangPeriodPatched) {
  const originalArrayBuffer = File.prototype.arrayBuffer;
  Object.defineProperty(File.prototype, '__coupangPeriodPatched', { value: true, configurable: true });
  File.prototype.arrayBuffer = function (...args) {
    globalThis.__coupangReportContext = reportPeriodFromFileName(this.name) || {};
    return originalArrayBuffer.apply(this, args);
  };
}

const aliases = {
  date: ['날짜', '일자', 'date'],
  productId: ['광고집행 옵션ID', '광고전환매출발생 옵션ID', '상품ID', '상품 아이디', '광고집행 상품 ID', 'productId'],
  product: ['광고집행 상품명', '상품명', 'product'],
  keyword: ['키워드', '검색어', 'keyword'],
  placement: ['광고 노출 지면', '노출지면', '지면', 'placement'],
  impressions: ['노출수', 'impressions'], clicks: ['클릭수', 'clicks'], cost: ['광고비', '총 비용', '비용', 'cost'],
  // 쿠팡 광고센터 기본 성과는 14일 전환 기준을 우선 사용합니다. 14일 컬럼이 없으면 1일 컬럼으로 대체합니다.
  orders: ['총 주문수(14일)', '총 주문수(1일)', '주문수', '구매수', 'orders'],
  sales: ['총 전환매출액(14일)', '총 전환매출액(1일)', '광고 전환 매출액', '전환매출', '매출액', 'sales'],
  orders1d: ['총 주문수(1일)'], orders14d: ['총 주문수(14일)'],
  sales1d: ['총 전환매출액(1일)'], sales14d: ['총 전환매출액(14일)'],
};

const num = value => Number(String(value ?? 0).replace(/[₩원,%\s,]/g, '')) || 0;
export function normalizeRow(row, index = 0) {
  const get = key => { const found = aliases[key].find(name => row[name] !== undefined); return found ? row[found] : ''; };
  const product = get('product') || '미지정 상품';
  const reportContext = globalThis.__coupangReportContext || {};
  const explicitDate = get('date');
  return {
    id: index + 1,
    date: explicitDate || reportContext.end || '',
    periodStart: reportContext.start || explicitDate || '',
    periodEnd: reportContext.end || explicitDate || '',
    productId: String(get('productId') || product),
    product,
    keyword: get('keyword') || '(검색어 없음)',
    placement: get('placement') || '기타',
    impressions: num(get('impressions')),
    clicks: num(get('clicks')),
    cost: num(get('cost')),
    orders: num(get('orders')),
    sales: num(get('sales')),
    orders1d: num(get('orders1d')),
    orders14d: num(get('orders14d')),
    sales1d: num(get('sales1d')),
    sales14d: num(get('sales14d')),
  };
}
export function metrics(rows, settings = DEFAULT_SETTINGS) {
  const sum = key => rows.reduce((a, r) => a + r[key], 0);
  const impressions = sum('impressions'), clicks = sum('clicks'), cost = sum('cost'), orders = sum('orders'), sales = sum('sales');
  const actualCost = cost * 1.1;
  const expectedProfit = sales * (settings.marginRate / 100) - actualCost - orders * settings.shippingCost;
  return { impressions, clicks, cost, actualCost, orders, sales, ctr: impressions ? clicks / impressions * 100 : 0, cpc: clicks ? actualCost / clicks : 0, cvr: clicks ? orders / clicks * 100 : 0, roa: cost ? sales / cost * 100 : 0, actualRoa: actualCost ? sales / actualCost * 100 : 0, cpa: orders ? actualCost / orders : 0, expectedProfit, estimatedVisits: clicks ? Math.round(clicks * 1.12) : 0 };
}

export function leakLevel(row, settings = DEFAULT_SETTINGS) {
  if (row.orders > 0 || (!row.clicks && !row.cost)) return { rank: 0, label: '정상', level: 'good' };
  if (row.clicks >= settings.leakHighClicks || row.cost >= settings.leakHighCost) return { rank: 3, label: '누수 높음', level: 'danger' };
  if (row.clicks >= settings.leakSuspectClicks || row.cost >= settings.leakSuspectCost) return { rank: 2, label: '누수 의심', level: 'warn' };
  return { rank: 1, label: '관찰', level: 'normal' };
}

export function funnelDiagnosis(row, settings = DEFAULT_SETTINGS) {
  const m = metrics([row], settings);
  if (row.impressions < settings.minImpressions) return { label: '노출 부족', hint: '입찰가와 광고 노출 상태를 점검하세요.' };
  if (m.ctr < settings.healthyCtr) return { label: '클릭 부족', hint: '썸네일·상품명·가격 경쟁력을 점검하세요.' };
  if (row.clicks >= settings.conversionClicks && !row.orders) return { label: '전환 개선 필요', hint: '상세페이지·가격·리뷰·상품 경쟁력을 점검하세요.' };
  if (row.orders > 0) return { label: '광고 전환 정상', hint: '운영 유지 또는 확대를 검토하세요.' };
  return { label: '데이터 부족', hint: '조금 더 데이터를 수집하세요.' };
}

export function profitabilityStatus(actualRoa, requiredRoa, settings = DEFAULT_SETTINGS) {
  if (!requiredRoa) return { label: '기준 미설정', level: 'normal' };
  const ratio = (actualRoa - requiredRoa) / requiredRoa * 100;
  if (ratio >= settings.roaComfortRate) return { label: '여유 있음', level: 'good' };
  if (actualRoa >= requiredRoa * (1 - settings.roaComfortRate / 100)) return { label: '경계', level: 'warn' };
  return { label: '수익성 주의', level: 'danger' };
}

export function actionStatus(row, requiredRoa, settings = DEFAULT_SETTINGS) {
  const m = metrics([row], settings), target = requiredRoa || settings.targetRoa;
  if (row.impressions < settings.minImpressions || row.clicks < settings.minClicks) return { label: '데이터 부족', level: 'normal', icon: '⚪' };
  if (!row.orders && (row.clicks >= settings.leakHighClicks || row.cost >= settings.leakHighCost)) return { label: '광고 축소 검토', level: 'danger', icon: '🔴' };
  if (!row.orders && row.clicks >= settings.conversionClicks) return { label: '전환 개선 필요', level: 'orange', icon: '🟠' };
  if (row.orders && m.actualRoa >= target * (1 + settings.roaComfortRate / 100)) return { label: '확대 검토', level: 'good', icon: '🟢' };
  if (row.orders && m.actualRoa >= target) return { label: '유지', level: 'blue', icon: '🔵' };
  if (row.orders && m.actualRoa < target) return { label: '광고 축소 검토', level: 'danger', icon: '🔴' };
  return { label: '관찰', level: 'warn', icon: '🟡' };
}

export function placementCategory(name = '') {
  const value = String(name).toLowerCase();
  if (value.includes('오디언스')) return '오디언스 플러스';
  // '비검색' 안에 '검색'이 포함되므로 반드시 비검색을 먼저 판별합니다.
  if (value.includes('비검색') || value.includes('상품') || value.includes('발견')) return '비검색';
  if (value.includes('검색')) return '검색';
  return '기타';
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

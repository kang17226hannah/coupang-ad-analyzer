export const DEFAULT_SETTINGS = { marginRate: 35, feeRate: 10.8, shippingCost: 3000, targetRoa: 500, vatRate: 10 };

const aliases = {
  date: ['날짜', '일자', 'date'], product: ['광고집행 상품명', '상품명', 'product'], productId: ['상품ID', '상품 아이디', '노출상품 ID', 'productId'], keyword: ['키워드', '검색어', 'keyword'],
  placement: ['광고 노출 지면', '노출지면', '지면', 'placement'], impressions: ['노출수', 'impressions'], clicks: ['클릭수', 'clicks'],
  cost: ['광고비', '총 비용', '비용', 'cost'], orders: ['주문수', '구매수', 'orders'], sales: ['광고 전환 매출액', '전환매출', '매출액', 'sales'],
};
const num = value => Number(String(value ?? 0).replace(/[₩원,%\s,]/g, '')) || 0;
export function normalizeRow(row, index = 0) {
  const get = key => { const found = aliases[key].find(name => row[name] !== undefined); return found ? row[found] : ''; };
  const product = get('product') || '미지정 상품';
  return { id: index + 1, date: get('date'), product, productId: String(get('productId') || product), keyword: get('keyword') || '(검색어 없음)', placement: get('placement') || '기타', impressions: num(get('impressions')), clicks: num(get('clicks')), cost: num(get('cost')), orders: num(get('orders')), sales: num(get('sales')) };
}
export function metrics(rows, settings = DEFAULT_SETTINGS) {
  settings = {...DEFAULT_SETTINGS, ...settings};
  const sum = key => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  const impressions = sum('impressions'), clicks = sum('clicks'), cost = sum('cost'), orders = sum('orders'), sales = sum('sales');
  const actualCost = cost * (1 + settings.vatRate / 100);
  const contributionProfit = sales * ((settings.marginRate - settings.feeRate) / 100) - orders * settings.shippingCost;
  const expectedProfit = contributionProfit - actualCost;
  const averageOrderValue = orders ? sales / orders : 0;
  const contributionRate = sales ? contributionProfit / sales * 100 : settings.marginRate - settings.feeRate;
  return { impressions, clicks, cost, actualCost, orders, sales, ctr: impressions ? clicks / impressions * 100 : 0, cpc: clicks ? actualCost / clicks : 0, cvr: clicks ? orders / clicks * 100 : 0, roa: cost ? sales / cost * 100 : 0, actualRoa: actualCost ? sales / actualCost * 100 : 0, cpa: orders ? cost / orders : 0, actualCpa: orders ? actualCost / orders : 0, expectedProfit, estimatedVisits: clicks ? Math.round(clicks * 1.12) : 0, averageOrderValue, requiredRoa: contributionRate > 0 ? 10000 / contributionRate : Infinity };
}
export function groupRows(rows, key, settings = DEFAULT_SETTINGS) {
  const groups = Object.groupBy ? Object.groupBy(rows, r => r[key] || '미지정') : rows.reduce((a, r) => ((a[r[key] || '미지정'] ||= []).push(r), a), {});
  return Object.entries(groups).map(([name, items]) => ({ name, count: items.length, rows: items, ...metrics(items, settings) })).sort((a, b) => b.cost - a.cost);
}
export function weekKey(value) {
  const date = new Date(`${value}T00:00:00Z`); if (Number.isNaN(date.getTime())) return '날짜 없음';
  const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear(); const start = new Date(Date.UTC(year, 0, 1)); const week = Math.ceil((((date - start) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function weeklyGroups(rows, settings = DEFAULT_SETTINGS) { return groupRows(rows.map(r => ({...r, week: weekKey(r.date)})), 'week', settings).sort((a,b)=>b.name.localeCompare(a.name)); }
export function compareMetrics(current, previous) {
  const keys=['actualCost','sales','orders','actualRoa','actualCpa','clicks'];
  return Object.fromEntries(keys.map(key => [key, previous?.[key] ? (current[key]-previous[key])/previous[key]*100 : current[key] ? 100 : 0]));
}
export function placementType(value='') { const v=value.toLowerCase(); if(v.includes('오디언스')) return '오디언스 플러스'; if(v.includes('검색')) return '검색'; return '비검색'; }
export function actionDiagnosis(m) {
  if (m.clicks < 10 || m.cost <= 0) return {level:'normal', label:'데이터 부족', message:'클릭 10회 이상 데이터를 수집하세요.'};
  const ratio=m.actualRoa/(m.requiredRoa || Infinity);
  if(m.orders===0 && m.clicks>=30) return {level:'danger',label:'전환 개선 필요',message:'상세페이지·가격·리뷰를 점검하세요.'};
  if(ratio>=1.3 && m.orders>0) return {level:'good',label:'확대 검토',message:'예산과 입찰 확대를 검토하세요.'};
  if(ratio>=1) return {level:'good',label:'유지',message:'현재 효율을 유지하며 추이를 확인하세요.'};
  if(ratio>=.7) return {level:'warn',label:'관찰',message:'성과 변화를 한 주 더 관찰하세요.'};
  return {level:'danger',label:'광고 축소 검토',message:'저효율 광고비 축소를 검토하세요.'};
}
export function funnelDiagnosis(m) { if(m.impressions<100) return '노출 부족'; if(m.ctr<.3) return '클릭 개선 필요'; if(m.clicks>=20 && m.cvr<2) return '전환 개선 필요'; return '퍼널 양호'; }
export function cpcDiagnosis(m, unitMargin, marginStatus = 'missing') {
  const hasMargin = Number(unitMargin) > 0;
  const breakEvenCpc = hasMargin ? Number(unitMargin) * (m.cvr / 100) : null;
  const cpcHigh = hasMargin && m.cpc > breakEvenCpc;
  if (marginStatus === 'ambiguous') return { kind: 'info', priority: 5, group: 'insufficient', badges: ['마진 연결 필요', '판단 보류'], diagnosis: '동일 상품명이 있어 상품ID 연결이 필요합니다.', actions: ['상품ID 연결', '상품 마스터 확인'], breakEvenCpc, hasMargin };
  if (m.clicks < 10) return { kind: 'info', priority: 5, group: 'insufficient', badges: ['판단 보류'], diagnosis: '데이터가 부족해 판단을 보류합니다.', actions: ['데이터 수집', '노출 추이 확인'], breakEvenCpc, hasMargin };
  if (!hasMargin) return { kind: 'info', priority: 5, group: 'insufficient', badges: ['마진 입력 필요'], diagnosis: '상품 마진 입력 후 손익분기 CPC를 판단합니다.', actions: ['상품 마진 입력', '상품 마스터 확인'], breakEvenCpc, hasMargin };
  if (!m.orders && cpcHigh) return { kind: 'critical', priority: 1, group: 'check', badges: ['전환 누수', 'CPC 높음'], diagnosis: '클릭은 발생하지만 전환이 없습니다.', actions: ['가격 점검', '키워드 제외 검토', '상세/영상 점검'], breakEvenCpc };
  if (!m.orders) return { kind: 'warning', priority: 2, group: 'check', badges: ['전환 누수'], diagnosis: '클릭은 발생하지만 전환이 없습니다.', actions: ['가격 점검', '썸네일 점검', '경쟁상품 비교'], breakEvenCpc };
  if (m.actualRoa < m.requiredRoa) return { kind: 'warning', priority: 2, group: 'check', badges: ['최소 ROAS 미달', ...(cpcHigh ? ['CPC 높음'] : [])], diagnosis: '전환은 있으나 손익 기준을 못 넘깁니다.', actions: ['ROAS 상향 검토', '입찰가 점검', '경쟁상품 비교'], breakEvenCpc };
  if (m.ctr < .5) return { kind: 'watch', priority: 3, group: 'check', badges: ['CTR 낮음'], diagnosis: '클릭률이 낮아 소재 개선이 필요합니다.', actions: ['썸네일 점검', '상품명 점검'], breakEvenCpc };
  if (m.actualRoa >= m.requiredRoa * 1.3 && m.orders > 0) return { kind: 'good', priority: 4, group: 'scale', badges: ['확대 검토'], diagnosis: '성과가 좋아 예산 확대 검토 대상입니다.', actions: ['예산 확대', '키워드 확장'], breakEvenCpc, hasMargin };
  return { kind: 'neutral', priority: 4, group: 'stable', badges: ['유지'], diagnosis: '현재 손익 기준을 충족하고 있습니다.', actions: ['성과 유지', '주간 추이 확인'], breakEvenCpc };
}
const itemProductId = item => String(item?.productId ?? item?.id ?? '');
const itemProductName = item => String(item?.productName ?? item?.product ?? item?.name ?? '');
const masterRecords = master => {
  if (Array.isArray(master)) return master.map((item, index) => ({item, index, collectionKey: null, objectKey: null}));
  if (!master || typeof master !== 'object') return [];
  const nested = ['items', 'products'].flatMap(collectionKey => Array.isArray(master[collectionKey]) ? master[collectionKey].map((item, index) => ({item, index, collectionKey, objectKey: null})) : []);
  const keyed = Object.entries(master).filter(([key, item]) => !['items', 'products'].includes(key) && item && typeof item === 'object' && !Array.isArray(item)).map(([objectKey, item]) => ({item, index: null, collectionKey: null, objectKey}));
  return [...nested, ...keyed];
};
export function productMarginResolution(master, productId, productName = '') {
  const id = String(productId || ''), name = String(productName || '');
  const records = masterRecords(master);
  const exactId = records.find(record => id && (itemProductId(record.item) === id || record.objectKey === id));
  if (exactId) return { status: 'matched', entry: exactId.item, record: exactId, matchedBy: 'productId' };
  const nameMatches = records.filter(record => name && (itemProductName(record.item) === name || record.objectKey === name));
  if (nameMatches.length === 1) return { status: 'matched', entry: nameMatches[0].item, record: nameMatches[0], matchedBy: 'productName' };
  if (nameMatches.length > 1) return { status: 'ambiguous', entry: undefined, record: undefined, matchedBy: null };
  return { status: 'missing', entry: undefined, record: undefined, matchedBy: null };
}
export function productMasterEntry(master, productId, productName = '') {
  return productMarginResolution(master, productId, productName).entry;
}
export function productContributionMargin(master, productId, productName = '') {
  const margin = Number(productMasterEntry(master, productId, productName)?.contributionMargin);
  return margin > 0 ? margin : null;
}
export function updateProductContributionMargin(master, productId, productName, contributionMargin) {
  const nextMargin = Math.max(0, Number(contributionMargin) || 0);
  const identity = String(productId || productName);
  const resolution = productMarginResolution(master, identity, productName);
  const record = resolution.record;
  if (Array.isArray(master)) return record ? master.map((item, index) => index === record.index ? {...item, contributionMargin: nextMargin} : item) : [...master, { productId: identity, productName, contributionMargin: nextMargin }];
  const source = master && typeof master === 'object' ? master : {};
  if (record?.collectionKey) {
    const collection = source[record.collectionKey];
    return {...source, [record.collectionKey]: collection.map((item, index) => index === record.index ? {...item, contributionMargin: nextMargin} : item)};
  }
  const collectionKey = ['items', 'products'].find(candidate => Array.isArray(source[candidate]));
  if (!record && collectionKey) return {...source, [collectionKey]: [...source[collectionKey], {productId: identity, productName, contributionMargin: nextMargin}]};
  const key = record?.objectKey ?? identity;
  return {...source, [key]: {...(source[key] || {}), productId: source[key]?.productId ?? identity, productName: source[key]?.productName ?? productName, contributionMargin: nextMargin}};
}
export function leakStage(m) { if(m.orders>0 || !m.cost) return 0; if(m.clicks>=30) return 3; if(m.clicks>=10) return 2; return 1; }
export function classify(row, settings = DEFAULT_SETTINGS) { const m=metrics([row],settings); if(leakStage(m)) return {level:leakStage(m)===3?'danger':'warn',label:`누수 ${leakStage(m)}단계`,message:'비용이 발생했지만 주문이 없습니다.'}; if(m.actualRoa>=settings.targetRoa&&row.orders>0)return {level:'good',label:'효자',message:'목표 ROAS를 달성했습니다.'}; return actionDiagnosis(m); }

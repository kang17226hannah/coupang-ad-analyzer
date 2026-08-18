import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { actionStatus, DEFAULT_SETTINGS, funnelDiagnosis, leakLevel, metrics, normalizeRow, placementCategory, productContributionMargin, productMarginResolution, profitabilityStatus } from './analysis.js';
import { compareValue, periodsOverlap, previousNonOverlappingWeek, productComparison, reportPeriod, reportPeriodFromFileName, saveWeek, weekRange } from './weekly.js';
const row=(extra={})=>({id:1,date:'2026-08-10',periodStart:'2026-08-10',periodEnd:'2026-08-10',productId:'P1',product:'상품 A',keyword:'검색어',placement:'검색 영역',impressions:1000,clicks:20,cost:10000,orders:2,sales:100000,orders1d:0,orders14d:0,sales1d:0,sales14d:0,...extra});
describe('v1 regression: import and core analysis',()=>{
 it('keeps RAW/Coupang column normalization including product ID and formatted numbers',()=>{const r=normalizeRow({'날짜':'2026-08-10','상품ID':'P1','상품명':'A','광고비':'1,200원','주문수':2});assert.equal(r.date,'2026-08-10');assert.equal(r.productId,'P1');assert.equal(r.product,'A');assert.equal(r.cost,1200);assert.equal(r.orders,2)});
 it('normalizes English/CSV column aliases',()=>assert.equal(normalizeRow({product:'A',keyword:'K',cost:'2,000'}).cost,2000));
 it('normalizes a hyphen keyword as missing keyword data',()=>assert.equal(normalizeRow({product:'A',keyword:'-'}).keyword,'(검색어 없음)'));
 it('calculates VAT cost at exactly 1.1',()=>assert.equal(metrics([row()]).actualCost,11000));
 it('keeps CPA, ROAS, profit and visit metrics',()=>{const m=metrics([row()],{...DEFAULT_SETTINGS,marginRate:40,shippingCost:0});assert.equal(m.cpa,5500);assert.equal(m.roa,1000);assert.ok(Math.abs(m.actualRoa-909.0909)<.01);assert.equal(m.expectedProfit,29000);assert.equal(m.estimatedVisits,22)});
 it('recalculates all metrics after rows are replaced',()=>assert.equal(metrics([row({cost:20000,sales:50000})]).actualRoa,50_000/22_000*100));
});
describe('real Coupang report parsing',()=>{
 it('uses option ID and 14-day conversion columns from the actual report format',()=>{const r=normalizeRow({'광고집행 옵션ID':'123456','광고집행 상품명':'상품 A','총 주문수(1일)':2,'총 주문수(14일)':5,'총 전환매출액(1일)':20000,'총 전환매출액(14일)':50000,'광고비':10000,'광고 노출 지면':'비검색 영역'});assert.equal(r.productId,'123456');assert.equal(r.orders,5);assert.equal(r.sales,50000);assert.equal(r.orders1d,2);assert.equal(r.orders14d,5);assert.equal(r.sales1d,20000);assert.equal(r.sales14d,50000)});
 it('also accepts the spaced 광고집행 옵션 ID header',()=>assert.equal(normalizeRow({'광고집행 옵션 ID':'987654','광고집행 상품명':'상품 B'}).productId,'987654'));
 it('falls back to 1-day conversion columns when 14-day columns are absent',()=>{const r=normalizeRow({'총 주문수(1일)':3,'총 전환매출액(1일)':30000});assert.equal(r.orders,3);assert.equal(r.sales,30000)});
 it('classifies 비검색 영역 before matching the substring 검색',()=>assert.equal(placementCategory('비검색 영역'),'비검색'));
});
describe('analysis period comparison and storage models',()=>{
 it('creates a dated snapshot without mutating rows',()=>{const weeks=saveWeek([], [row()]);assert.equal(weeks.length,1);assert.equal(weeks[0].label,'2026-08-10 ~ 2026-08-10');assert.equal(weeks[0].rows[0].productId,'P1')});
 it('loads the prior period into KPI comparison',()=>assert.deepEqual(compareValue(120,100),{direction:'up',rate:20,difference:20}));
 it('compares products by stable product ID',()=>{const data=productComparison([row({cost:20000})],[row({cost:10000})],DEFAULT_SETTINGS);assert.equal(data[0].now.cost,20000);assert.equal(data[0].before.cost,10000)});
 it('finds a multi-day analysis range',()=>assert.equal(weekRange([row({date:'2026-08-16',periodStart:'2026-08-16',periodEnd:'2026-08-16'}),row({date:'2026-08-10',periodStart:'2026-08-10',periodEnd:'2026-08-10'})]),'2026-08-10 ~ 2026-08-16'));
 it('prefers report period metadata when the report has no daily date column',()=>assert.equal(weekRange([row({date:'2026-08-17',periodStart:'2026-08-01',periodEnd:'2026-08-17'})]),'2026-08-01 ~ 2026-08-17'));
 it('parses the analysis period from a Coupang report filename',()=>assert.deepEqual(reportPeriodFromFileName('A015_pa_20260801_20260817.xlsx'),{start:'2026-08-01',end:'2026-08-17'}));
 it('detects overlapping and separate analysis periods',()=>{assert.equal(periodsOverlap({start:'2026-08-01',end:'2026-08-07'},{start:'2026-08-07',end:'2026-08-14'}),true);assert.equal(periodsOverlap({start:'2026-08-01',end:'2026-08-07'},{start:'2026-08-08',end:'2026-08-14'}),false)});
 it('chooses the latest saved period that does not overlap the current period',()=>{const weeks=[{id:'A',rows:[row({periodStart:'2026-08-08',periodEnd:'2026-08-14'})]},{id:'B',rows:[row({periodStart:'2026-08-01',periodEnd:'2026-08-07'})]}];const previous=previousNonOverlappingWeek(weeks,[row({periodStart:'2026-08-10',periodEnd:'2026-08-17'})]);assert.equal(previous.id,'B');assert.deepEqual(reportPeriod(previous.rows),{start:'2026-08-01',end:'2026-08-07'})});
});
describe('configurable period decisions',()=>{
 it('treats required ROAS as a hard minimum with a comfort band above it',()=>{assert.equal(profitabilityStatus(700,500,DEFAULT_SETTINGS).label,'여유 있음');assert.equal(profitabilityStatus(520,500,DEFAULT_SETTINGS).label,'기준 통과');assert.equal(profitabilityStatus(480,500,DEFAULT_SETTINGS).label,'최소 ROAS 미달')});
 it('suggests expansion when conversions beat required ROAS',()=>assert.equal(actionStatus(row({clicks:40,sales:200000}),500,DEFAULT_SETTINGS).label,'확대 검토'));
 it('suggests reduction for expensive zero-order traffic',()=>assert.equal(actionStatus(row({clicks:40,orders:0,sales:0,cost:40000}),500,DEFAULT_SETTINGS).label,'광고 축소 검토'));
 it('classifies all three leak stages from settings',()=>{assert.equal(leakLevel(row({clicks:3,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'관찰');assert.equal(leakLevel(row({clicks:12,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'누수 의심');assert.equal(leakLevel(row({clicks:35,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'누수 높음')});
 it('separates search, non-search, audience plus and other placements',()=>{assert.equal(placementCategory('검색 영역'),'검색');assert.equal(placementCategory('비검색 영역'),'비검색');assert.equal(placementCategory('오디언스 플러스'),'오디언스 플러스');assert.equal(placementCategory('브랜드 영역'),'기타')});
 it('diagnoses the product funnel using settings',()=>assert.equal(funnelDiagnosis(row({clicks:30,orders:0,sales:0}),DEFAULT_SETTINGS).label,'전환 개선 필요'));
});
describe('product margin matching',()=>{
 it('prioritizes exact productId over duplicate product names',()=>{const master={'P1':{name:'동일 상품',contributionMargin:1000},'P2':{name:'동일 상품',contributionMargin:2000}};assert.equal(productContributionMargin(master,'P2','동일 상품'),2000);assert.equal(productMarginResolution(master,'P2','동일 상품').matchedBy,'productId')});
 it('falls back only when the exact product name is unique',()=>{const master={'P1':{name:'고유 상품',contributionMargin:3000}};assert.equal(productContributionMargin(master,'UNKNOWN','고유 상품'),3000);assert.equal(productMarginResolution(master,'UNKNOWN','고유 상품').matchedBy,'productName')});
 it('defers when duplicate product names are ambiguous',()=>{const master={'P1':{name:'동일 상품',contributionMargin:1000},'P2':{name:'동일 상품',contributionMargin:2000}};assert.equal(productMarginResolution(master,'UNKNOWN','동일 상품').status,'ambiguous');assert.equal(productContributionMargin(master,'UNKNOWN','동일 상품'),null)});
});

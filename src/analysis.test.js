import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { actionStatus, DEFAULT_SETTINGS, funnelDiagnosis, leakLevel, metrics, normalizeRow, placementCategory, profitabilityStatus } from './analysis.js';
import { compareValue, productComparison, saveWeek, weekRange } from './weekly.js';
const row=(extra={})=>({id:1,date:'2026-08-10',productId:'P1',product:'상품 A',keyword:'검색어',placement:'쿠팡 검색',impressions:1000,clicks:20,cost:10000,orders:2,sales:100000,...extra});
describe('v1 regression: import and core analysis',()=>{
 it('keeps RAW/Coupang column normalization including product ID and formatted numbers',()=>assert.deepEqual(normalizeRow({'날짜':'2026-08-10','상품ID':'P1','상품명':'A','광고비':'1,200원','주문수':2}),{id:1,date:'2026-08-10',productId:'P1',product:'A',keyword:'(검색어 없음)',placement:'기타',impressions:0,clicks:0,cost:1200,orders:2,sales:0}));
 it('normalizes English/CSV column aliases',()=>assert.equal(normalizeRow({product:'A',keyword:'K',cost:'2,000'}).cost,2000));
 it('calculates VAT cost at exactly 1.1',()=>assert.equal(metrics([row()]).actualCost,11000));
 it('keeps CPA, ROAS, profit and visit metrics',()=>{const m=metrics([row()],{...DEFAULT_SETTINGS,marginRate:40,shippingCost:0});assert.equal(m.cpa,5500);assert.equal(m.roa,1000);assert.ok(Math.abs(m.actualRoa-909.0909)<.01);assert.equal(m.expectedProfit,29000);assert.equal(m.estimatedVisits,22)});
 it('recalculates all metrics after rows are replaced',()=>assert.equal(metrics([row({cost:20000,sales:50000})]).actualRoa,50_000/22_000*100));
});
describe('weekly comparison and storage models',()=>{
 it('creates a dated weekly snapshot without mutating rows',()=>{const weeks=saveWeek([], [row()]);assert.equal(weeks.length,1);assert.equal(weeks[0].label,'2026-08-10 ~ 2026-08-10');assert.equal(weeks[0].rows[0].productId,'P1')});
 it('loads the prior week into KPI comparison',()=>assert.deepEqual(compareValue(120,100),{direction:'up',rate:20,difference:20}));
 it('compares products by stable product ID',()=>{const data=productComparison([row({cost:20000})],[row({cost:10000})],DEFAULT_SETTINGS);assert.equal(data[0].now.cost,20000);assert.equal(data[0].before.cost,10000)});
 it('finds a multi-day week range',()=>assert.equal(weekRange([row({date:'2026-08-16'}),row({date:'2026-08-10'})]),'2026-08-10 ~ 2026-08-16'));
});
describe('configurable weekly decisions',()=>{
 it('compares required ROAS with configurable comfort band',()=>{assert.equal(profitabilityStatus(700,500,DEFAULT_SETTINGS).label,'여유 있음');assert.equal(profitabilityStatus(480,500,DEFAULT_SETTINGS).label,'경계');assert.equal(profitabilityStatus(200,500,DEFAULT_SETTINGS).label,'수익성 주의')});
 it('suggests expansion when conversions beat required ROAS',()=>assert.equal(actionStatus(row({clicks:40,sales:200000}),500,DEFAULT_SETTINGS).label,'확대 검토'));
 it('suggests reduction for expensive zero-order traffic',()=>assert.equal(actionStatus(row({clicks:40,orders:0,sales:0,cost:40000}),500,DEFAULT_SETTINGS).label,'광고 축소 검토'));
 it('classifies all three leak stages from settings',()=>{assert.equal(leakLevel(row({clicks:3,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'관찰');assert.equal(leakLevel(row({clicks:12,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'누수 의심');assert.equal(leakLevel(row({clicks:35,cost:1000,orders:0}),DEFAULT_SETTINGS).label,'누수 높음')});
 it('separates search, non-search, audience plus and other placements',()=>{assert.equal(placementCategory('쿠팡 검색'),'검색');assert.equal(placementCategory('상품 페이지'),'비검색');assert.equal(placementCategory('오디언스 플러스'),'오디언스 플러스');assert.equal(placementCategory('브랜드 영역'),'기타')});
 it('diagnoses the product funnel using settings',()=>assert.equal(funnelDiagnosis(row({clicks:30,orders:0,sales:0}),DEFAULT_SETTINGS).label,'전환 개선 필요'));
});

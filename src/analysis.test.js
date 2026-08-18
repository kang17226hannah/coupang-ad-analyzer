import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { actionDiagnosis, compareMetrics, cpcDiagnosis, funnelDiagnosis, leakStage, metrics, normalizeRow, placementType, productContributionMargin, productMarginResolution, updateProductContributionMargin, weekKey, weeklyGroups } from './analysis.js';

describe('advertising analysis', () => {
  it('normalizes legacy rows and preserves a product identifier fallback', () => { const row=normalizeRow({'상품명':'A','광고비':'1,200원','주문수':2}); assert.equal(row.productId,'A'); assert.equal(row.cost,1200); });
  it('calculates VAT-inclusive actual cost, ROAS, CPA and profit', () => { const m=metrics([{impressions:100,clicks:10,cost:1000,orders:2,sales:5000}],{marginRate:40,feeRate:10,shippingCost:0,vatRate:10}); assert.equal(m.actualCost,1100); assert.equal(m.actualRoa,5000/1100*100); assert.equal(m.actualCpa,550); assert.equal(m.expectedProfit,400); });
  it('groups ISO weeks and calculates comparisons', () => { const rows=[normalizeRow({날짜:'2026-08-03',상품명:'A',광고비:100,매출액:200}),normalizeRow({날짜:'2026-08-10',상품명:'A',광고비:200,매출액:400})]; assert.equal(weekKey('2026-08-10'),'2026-W33'); const weeks=weeklyGroups(rows); assert.equal(weeks.length,2); assert.equal(compareMetrics(weeks[0],weeks[1]).sales,100); });
  it('classifies placements, three leak stages, funnels and actions', () => { assert.equal(placementType('쿠팡 검색'),'검색'); assert.equal(placementType('오디언스 플러스'),'오디언스 플러스'); assert.equal(placementType('상품 페이지'),'비검색'); assert.equal(leakStage({orders:0,cost:100,clicks:31}),3); assert.equal(funnelDiagnosis({impressions:500,ctr:.1,clicks:1,cvr:0}),'클릭 개선 필요'); assert.equal(actionDiagnosis({clicks:5,cost:10}).label,'데이터 부족'); assert.deepEqual(cpcDiagnosis({clicks:5}).badges,['판단 보류']); });
  it('prioritizes conversion leaks and identifies profitable scale candidates', () => {
    const leaking=metrics([{impressions:1000,clicks:40,cost:20000,orders:0,sales:0}],{marginRate:40,feeRate:10,shippingCost:0,vatRate:10});
    assert.deepEqual(cpcDiagnosis(leaking,10000).badges,['전환 누수','CPC 높음']);
    const profitable=metrics([{impressions:10000,clicks:200,cost:50000,orders:10,sales:1000000}],{marginRate:40,feeRate:10,shippingCost:0,vatRate:10});
    assert.equal(cpcDiagnosis(profitable,30000).group,'scale');
    assert.equal(cpcDiagnosis(profitable,30000).priority,4);
  });
  it('uses unit margin times CVR and defers CPC judgment when margin is missing', () => {
    const m={clicks:100,orders:5,cvr:5,cpc:600,actualRoa:200,requiredRoa:300};
    assert.equal(cpcDiagnosis(m,10000).breakEvenCpc,500);
    assert.equal(cpcDiagnosis(m,10000).badges.includes('CPC 높음'),true);
    assert.equal(cpcDiagnosis(m).badges[0],'마진 입력 필요');
    assert.equal(cpcDiagnosis(m).breakEvenCpc,null);
  });
  it('does not require three orders for a scale recommendation', () => assert.equal(actionDiagnosis({clicks:20,cost:100,orders:1,actualRoa:650,requiredRoa:500}).label,'확대 검토'));
  it('reads and updates contributionMargin without replacing the existing product master', () => {
    const arrayMaster=[{productId:'P1',name:'상품',contributionMargin:12000,custom:'keep'}];
    const updatedArray=updateProductContributionMargin(arrayMaster,'P1','상품',15000);
    assert.equal(productContributionMargin(updatedArray,'P1'),15000);
    assert.equal(updatedArray[0].custom,'keep');
    const nestedMaster={version:2,products:[{id:'P2',contributionMargin:8000,custom:'keep'}]};
    const updatedNested=updateProductContributionMargin(nestedMaster,'P2','상품 2',9000);
    assert.equal(productContributionMargin(updatedNested,'P2'),9000);
    assert.equal(updatedNested.version,2);
    assert.equal(updatedNested.products[0].custom,'keep');
  });
  it('prioritizes exact productId and only falls back to a unique exact product name', () => {
    const master=[
      {productId:'P1',productName:'동일 상품',contributionMargin:1000},
      {productId:'P2',productName:'동일 상품',contributionMargin:2000},
      {productId:'P3',productName:'고유 상품',contributionMargin:3000},
    ];
    assert.equal(productContributionMargin(master,'P2','동일 상품'),2000);
    assert.equal(productMarginResolution(master,'UNKNOWN','고유 상품').matchedBy,'productName');
    assert.equal(productContributionMargin(master,'UNKNOWN','고유 상품'),3000);
    assert.equal(productMarginResolution(master,'UNKNOWN','동일 상품').status,'ambiguous');
    assert.equal(productContributionMargin(master,'UNKNOWN','동일 상품'),null);
    assert.deepEqual(cpcDiagnosis({clicks:20,cvr:2,cpc:100},null,'ambiguous').badges,['마진 연결 필요','판단 보류']);
  });
});

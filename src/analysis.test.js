import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classify, metrics, normalizeRow } from './analysis.js';
describe('advertising analysis', () => {
  it('normalizes Coupang column names and formatted numbers', () => assert.deepEqual({...normalizeRow({'상품명':'A','광고비':'1,200원','주문수':2}), id:undefined}, {id:undefined,date:'',product:'A',keyword:'(검색어 없음)',placement:'기타',impressions:0,clicks:0,cost:1200,orders:2,sales:0}));
  it('calculates core metrics safely', () => { const result=metrics([{impressions:100,clicks:10,cost:1000,orders:2,sales:5000}], {marginRate:40,shippingCost:0}); assert.deepEqual({ctr:result.ctr,cpc:result.cpc,cvr:result.cvr,roa:result.roa,cpa:result.cpa,expectedProfit:result.expectedProfit},{ctr:10,cpc:100,cvr:20,roa:500,cpa:500,expectedProfit:1000}) });
  it('finds leaking rows', () => assert.equal(classify({impressions:10,clicks:2,cost:100,orders:0,sales:0}).label,'누수'));
});

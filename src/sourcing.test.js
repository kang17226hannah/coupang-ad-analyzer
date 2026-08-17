import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSourcing } from './SourcingCalculator.jsx';

describe('sourcing calculator', () => {
  it('matches the existing sheet 50% target example', () => {
    const r = calculateSourcing({ cost: 2300, feeRate: 10.8, growthFee: 3000, targetMargin: 50 });
    assert.equal(r.salePrice, 14700);
    assert.ok(Math.abs(r.margin - 7353.64) < 0.01);
    assert.ok(Math.abs(r.marginRate - 50.0247619) < 0.001);
    assert.ok(Math.abs(r.minimumRoa - 219.8911015) < 0.01);
  });

  it('matches the 40% and 30% selling-price bands', () => {
    assert.equal(calculateSourcing({ cost: 2300, feeRate: 10.8, growthFee: 3000, targetMargin: 40 }).salePrice, 11700);
    assert.equal(calculateSourcing({ cost: 2300, feeRate: 10.8, growthFee: 3000, targetMargin: 30 }).salePrice, 9700);
  });
});

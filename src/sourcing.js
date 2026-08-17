export const ceil100 = n => Math.ceil(n / 100) * 100;

export function calculateSourcing({ cost, feeRate, growthFee, targetMargin }) {
  const c = Number(cost) || 0;
  const fee = (Number(feeRate) || 0) / 100;
  const growth = Number(growthFee) || 0;
  const target = (Number(targetMargin) || 0) / 100;
  const denominator = 1 - fee * 1.1 - target;
  if (c <= 0 || denominator <= 0) return null;
  const salePrice = ceil100((c + growth * 1.1) / denominator);
  const feeCash = salePrice * fee * 1.1;
  const growthCash = growth * 1.1;
  const margin = salePrice - c - feeCash - growthCash;
  const marginRate = salePrice ? margin / salePrice * 100 : 0;
  const minimumRoa = margin > 0 ? salePrice * 1.1 / margin * 100 : 0;
  return { salePrice, feeCash, growthCash, margin, marginRate, minimumRoa };
}

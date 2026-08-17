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
  // 최소 ROAS는 실제 지출 광고비(VAT 포함)를 분모로 보는 손익분기 기준입니다.
  const minimumRoa = margin > 0 ? salePrice / margin * 100 : 0;
  return { salePrice, feeCash, growthCash, margin, marginRate, minimumRoa };
}

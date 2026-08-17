import { groupRows, metrics } from './analysis.js';

export const STORAGE = { weeks: 'coupang-weekly-v2', master: 'coupang-product-master-v2', notes: 'coupang-action-notes-v2' };
export function weekRange(rows) {
  const starts = rows.map(r => r.periodStart || r.date).filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.valueOf())).sort((a,b)=>a-b);
  const ends = rows.map(r => r.periodEnd || r.date).filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.valueOf())).sort((a,b)=>a-b);
  const fmt = d => d.toISOString().slice(0,10);
  if (starts.length && ends.length) return `${fmt(starts[0])} ~ ${fmt(ends.at(-1))}`;
  return `저장 ${new Date().toISOString().slice(0,10)}`;
}
export function saveWeek(existing, rows, label = weekRange(rows)) {
  return [{ id: `${Date.now()}`, label, savedAt: new Date().toISOString(), rows }, ...existing.filter(w => w.label !== label)];
}
export function compareValue(current, previous) {
  if (!previous) return { direction: current ? 'up' : 'same', rate: current ? null : 0, difference: current };
  const difference = current - previous;
  return { direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'same', rate: difference / previous * 100, difference };
}
export function productComparison(currentRows, previousRows, settings) {
  const current = groupRows(currentRows, 'productId', settings), previous = groupRows(previousRows || [], 'productId', settings);
  const names = Object.fromEntries(currentRows.map(r => [r.productId, r.product]));
  return current.map(now => ({ productId: now.name, product: names[now.name] || now.name, now, before: previous.find(p => p.name === now.name) || metrics([], settings) }));
}

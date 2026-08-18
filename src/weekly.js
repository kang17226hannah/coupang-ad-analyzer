import { groupRows, metrics } from './analysis.js';

export const STORAGE = { weeks: 'coupang-weekly-v2', master: 'coupang-product-master-v2', notes: 'coupang-action-notes-v2', currentFiles: 'coupang-current-report-files-v1' };

const validDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? date : null;
};
const fmt = d => d.toISOString().slice(0,10);

export function reportPeriod(rows = []) {
  const starts = rows.map(r => r.periodStart || r.date).map(validDate).filter(Boolean).sort((a,b)=>a-b);
  const ends = rows.map(r => r.periodEnd || r.date).map(validDate).filter(Boolean).sort((a,b)=>a-b);
  if (!starts.length || !ends.length) return null;
  return { start: fmt(starts[0]), end: fmt(ends.at(-1)) };
}

export function weekRange(rows) {
  const period = reportPeriod(rows);
  return period ? `${period.start} ~ ${period.end}` : `저장 ${new Date().toISOString().slice(0,10)}`;
}

export function periodsOverlap(a, b) {
  if (!a?.start || !a?.end || !b?.start || !b?.end) return false;
  return a.start <= b.end && b.start <= a.end;
}

export function reportPeriodFromFileName(name = '') {
  const match = String(name).match(/_(\d{8})_(\d{8})(?:\.[^.]+)?$/i);
  if (!match) return null;
  const toDate = value => `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  return { start: toDate(match[1]), end: toDate(match[2]) };
}

export function saveWeek(existing, rows, label = weekRange(rows), meta = {}) {
  return [{ id: `${Date.now()}`, label, savedAt: new Date().toISOString(), rows, sourceFiles: meta.sourceFiles || [] }, ...existing.filter(w => w.label !== label)];
}

export function previousNonOverlappingWeek(weeks = [], currentRows = []) {
  const current = reportPeriod(currentRows);
  return [...weeks]
    .filter(w => !periodsOverlap(reportPeriod(w.rows || []), current))
    .sort((a,b) => String(reportPeriod(b.rows || [])?.end || '').localeCompare(String(reportPeriod(a.rows || [])?.end || '')))[0];
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

// v2.2 이전에 이미 불러온 실제 광고 데이터는 sourceFiles 메타데이터가 없습니다.
// 새 분석기간 업로드 시 기존 데이터가 휘발되지 않도록 한 번만 레거시 출처를 만들어 둡니다.
if (typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE.currentFiles)) {
  try {
    const legacyRows = JSON.parse(localStorage.getItem('coupang-rows') || 'null');
    const looksLikeBuiltInSample = Array.isArray(legacyRows)
      && legacyRows.length === 10
      && legacyRows.every(r => /^P00[1-3]$/.test(String(r?.productId || '')))
      && !legacyRows.some(r => r?.periodStart || r?.periodEnd || r?.sourceFile);
    if (Array.isArray(legacyRows) && legacyRows.length && !looksLikeBuiltInSample) {
      localStorage.setItem(STORAGE.currentFiles, JSON.stringify([{
        key: 'legacy-current-data',
        name: '기존 불러온 광고 데이터',
        size: 0,
        period: reportPeriod(legacyRows),
        legacy: true,
      }]));
    }
  } catch {}
}

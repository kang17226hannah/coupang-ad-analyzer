import React, { useMemo, useState } from 'react';
import { calculateSourcing } from './sourcing.js';
import './sourcing.css';

const won = n => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;
const pct = n => `${(n || 0).toFixed(1)}%`;

export default function SourcingCalculator() {
  const [name, setName] = useState('');
  const [cost, setCost] = useState(2300);
  const [feeRate, setFeeRate] = useState(10.8);
  const [growthFee, setGrowthFee] = useState(3000);
  const [targets, setTargets] = useState([50, 40, 30]);
  const results = useMemo(() => targets.map(targetMargin => ({ targetMargin, result: calculateSourcing({ cost, feeRate, growthFee, targetMargin }) })), [cost, feeRate, growthFee, targets]);
  const changeTarget = (index, value) => setTargets(targets.map((v, i) => i === index ? Number(value) : v));

  return <div className="sourcing-page">
    <section className="panel sourcing-intro">
      <div>
        <span className="eyebrow sourcing-eyebrow">모바일 소싱용 간편 계산기</span>
        <h2>원가만 넣고 판매가·마진·최소 ROAS를 빠르게 확인하세요.</h2>
        <p>기존 시트 계산방식을 그대로 적용합니다. 판매수수료와 그로스비에는 VAT 10%가 반영됩니다.</p>
      </div>
    </section>

    <section className="panel sourcing-inputs">
      <div className="panel-title"><div><h2>기본값 입력</h2><p>상품명은 메모용이라 비워도 됩니다.</p></div></div>
      <div className="sourcing-form">
        <label><span>상품명 / 키워드</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="예: 실리콘 배수구 덮개" /></label>
        <label><span>원가</span><div className="unit-input"><input type="number" inputMode="numeric" value={cost} onChange={e=>setCost(e.target.value)} /><em>원</em></div></label>
        <label><span>판매수수료</span><div className="unit-input"><input type="number" inputMode="decimal" step="0.1" value={feeRate} onChange={e=>setFeeRate(e.target.value)} /><em>%</em></div></label>
        <label><span>그로스비</span><div className="unit-input"><input type="number" inputMode="numeric" value={growthFee} onChange={e=>setGrowthFee(e.target.value)} /><em>원</em></div></label>
      </div>
    </section>

    <section className="sourcing-results">
      {results.map(({targetMargin, result}, index) => <article className="panel sourcing-card" key={index}>
        <div className="sourcing-card-head"><div><small>목표 마진율</small><div className="target-input"><input type="number" inputMode="numeric" value={targetMargin} onChange={e=>changeTarget(index,e.target.value)} /><span>%</span></div></div><strong>{result ? won(result.salePrice) : '—'}</strong></div>
        <div className="sourcing-metrics">
          <div><small>추천 판매가</small><b>{result ? won(result.salePrice) : '—'}</b></div>
          <div><small>예상 마진</small><b>{result ? won(result.margin) : '—'}</b></div>
          <div><small>실제 마진율</small><b>{result ? pct(result.marginRate) : '—'}</b></div>
          <div className="minimum-roa"><small>최소 ROAS</small><b>{result ? pct(result.minimumRoa) : '—'}</b></div>
        </div>
        {result && <details><summary>계산 내역 보기</summary><p>판매수수료(VAT 포함) {won(result.feeCash)} · 그로스비(VAT 포함) {won(result.growthCash)}</p></details>}
      </article>)}
    </section>
    <p className="sourcing-note">판매가는 목표 마진을 충족하도록 100원 단위로 올림합니다. 실제 쿠팡 수수료·물류비는 상품별로 다를 수 있으니 입력값을 맞춰 사용하세요.</p>
  </div>;
}

import React, { useMemo, useState } from 'react';
import { leakLevel, metrics } from './analysis';
import './leak-cpc.css';

const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const pct=n=>`${(n||0).toFixed(1)}%`;

function badge(status){return <span className={`badge ${status.level}`}>{status.icon||''} {status.label}</span>}

export default function LeakCpc({ rows, settings, master }) {
  const [mode,setMode]=useState('issues');
  const groups=useMemo(()=>{
    const map={};
    for(const row of rows){
      const key=`${row.productId}|||${row.keyword}`;
      (map[key] ||= []).push(row);
    }
    return Object.values(map).map(items=>{
      const first=items[0], m=metrics(items,settings);
      const margin=Number(master[first.productId]?.contributionMargin)||0;
      const breakEvenCpc=m.orders>0&&margin>0 ? margin*(m.cvr/100) : null;
      const cpcGap=breakEvenCpc===null ? null : breakEvenCpc-m.cpc;
      let status;
      if(m.orders===0) status=leakLevel(m,settings);
      else if(!margin) status={label:'마진 입력 필요',level:'normal'};
      else if(m.cpc>breakEvenCpc) status={label:'CPC 초과',level:'danger',icon:'🔴'};
      else status={label:'CPC 여유',level:'good',icon:'🟢'};
      return {productId:first.productId,product:first.product,keyword:first.keyword,...m,margin,breakEvenCpc,cpcGap,status};
    }).sort((a,b)=>b.actualCost-a.actualCost);
  },[rows,settings,master]);

  const visible=groups.filter(g=>{
    const zeroLeak=g.orders===0&&leakLevel(g,settings).rank>0;
    const missingMargin=g.orders>0&&!g.margin;
    const cpcOver=g.orders>0&&g.breakEvenCpc!==null&&g.cpc>g.breakEvenCpc;
    if(mode==='zero') return zeroLeak;
    if(mode==='cpc') return cpcOver;
    return zeroLeak||cpcOver||missingMargin;
  });

  return <section className="panel page-panel cpc-page">
    <div className="panel-title"><div><h2>누수 · CPC 분석</h2><p>실제 CPC는 광고비에 VAT 10%를 포함합니다. 손익분기 CPC = 광고 전 개당 마진 × CVR.</p></div></div>
    <div className="cpc-filters">
      <button className={mode==='issues'?'active':''} onClick={()=>setMode('issues')}>점검 대상</button>
      <button className={mode==='zero'?'active':''} onClick={()=>setMode('zero')}>주문 0 누수</button>
      <button className={mode==='cpc'?'active':''} onClick={()=>setMode('cpc')}>손익분기 CPC 초과</button>
    </div>
    <div className="cpc-help">주문이 없는 키워드는 기존 누수 기준으로 보고, 주문이 있는 키워드는 실제 CPC와 손익분기 CPC를 비교합니다. 클릭이 적은 키워드는 바로 제외하기보다 데이터량도 함께 확인하세요.</div>
    <div className="table-wrap wide"><table><thead><tr><th>상품 / 키워드</th><th>상태</th><th>클릭</th><th>주문</th><th>실제 광고비</th><th>실제 CPC</th><th>CVR</th><th>손익분기 CPC</th><th>CPC 여유</th><th>실제 ROAS</th></tr></thead><tbody>
      {visible.map(g=><tr key={`${g.productId}-${g.keyword}`}><td><b>{g.keyword}</b><small className="block">{g.product} · {g.productId}</small></td><td>{badge(g.status)}</td><td>{g.clicks}</td><td>{g.orders}</td><td>{won(g.actualCost)}</td><td>{won(g.cpc)}</td><td>{pct(g.cvr)}</td><td>{g.breakEvenCpc===null?(g.orders>0?'마진 입력 필요':'—'):won(g.breakEvenCpc)}</td><td className={g.cpcGap!==null?(g.cpcGap>=0?'good-text':'bad-text'):''}>{g.cpcGap===null?'—':`${g.cpcGap>=0?'+':''}${won(g.cpcGap)}`}</td><td>{pct(g.actualRoa)}</td></tr>)}
    </tbody></table></div>
    {!visible.length&&<div className="empty"><span>◎</span><h3>현재 조건의 점검 대상이 없습니다</h3><p>다른 필터를 선택하거나 광고 데이터를 더 수집해보세요.</p></div>}
    <p className="cpc-note">손익분기 CPC 계산에는 상품 마스터의 ‘광고 전 개당 마진’이 필요합니다. 주문 0 키워드는 CVR이 0%라 손익분기 CPC 대신 기존 누수 진단을 사용합니다.</p>
  </section>;
}

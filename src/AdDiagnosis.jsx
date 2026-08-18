import React, { useMemo, useState } from 'react';
import './ad-diagnosis.css';

const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const pct=n=>`${(n||0).toFixed(1)}%`;

function Badge({item}){return <span className={`ad-diagnosis-badge ${item.level}`}>{item.icon} {item.label}</span>}

function diagnose(c, master, settings){
  const m=c.now;
  const saved=master[c.productId]||{};
  const required=Number(saved.requiredRoa)||Number(settings.targetRoa)||0;
  const margin=Number(saved.contributionMargin)||0;
  const enoughImpressions=m.impressions>=settings.minImpressions;
  const enoughClicks=m.clicks>=settings.minClicks;
  const ctrLow=enoughImpressions && m.ctr<settings.healthyCtr;
  const breakEvenCpc=m.orders>0&&margin>0 ? margin*(m.cvr/100) : null;
  const breakEvenCvr=m.clicks>0&&margin>0 ? m.cpc/margin*100 : null;
  const cpcOver=breakEvenCpc!==null && m.cpc>breakEvenCpc;
  const roaFail=m.orders>0&&required>0&&m.actualRoa<required;
  const roaComfort=m.orders>0&&required>0&&m.actualRoa>=required*(1+settings.roaComfortRate/100);

  let primary, action;
  if(!enoughImpressions||!enoughClicks){
    primary={label:'데이터 부족',level:'normal',icon:'⚪'};
    action='노출·클릭을 조금 더 모은 뒤 판단하세요. 노출 자체가 부족하면 목표 ROAS·예산·입찰 설정을 점검하세요.';
  }else if(m.orders===0){
    primary={label:'전환 누수',level:'danger',icon:'🔴'};
    action=ctrLow?'클릭률도 낮습니다. 검색결과 가격·썸네일·상품명부터 확인하고, 클릭 후에는 상세·영상·리뷰·경쟁상품 가격을 점검하세요.':'클릭은 발생하지만 주문이 없습니다. 가격·영상·리뷰·비검색 영역의 더 저렴한 경쟁상품을 먼저 확인하세요.';
  }else if(cpcOver){
    primary={label:'CPC 누수',level:'danger',icon:'🔴'};
    action='현재 전환율에서 감당 가능한 CPC를 넘었습니다. 입찰/목표 ROAS 조정 또는 해당 키워드 제외를 검토하세요.';
  }else if(roaFail){
    primary={label:'최소 ROAS 미달',level:'danger',icon:'🔴'};
    action=ctrLow?'수익성과 클릭률이 함께 부족합니다. 가격·썸네일·상품명 경쟁력을 먼저 점검하세요.':'클릭은 받고 있지만 손익기준을 못 넘습니다. 가격·영상·리뷰·경쟁상품 이탈 요인을 우선 확인하세요.';
  }else if(ctrLow){
    primary={label:'클릭 문제',level:'warn',icon:'🟡'};
    action='전환은 나오고 있으나 CTR이 낮습니다. 검색결과에서 내 가격·썸네일·상품명이 주변 상품보다 매력적인지 확인하세요.';
  }else if(roaComfort){
    primary={label:'확대 검토',level:'good',icon:'🟢'};
    action='최소 실제 ROAS를 충분히 넘고 있습니다. 예산을 조금 늘린 뒤 실제 ROAS가 유지되는지 다음 주에 재확인하세요.';
  }else{
    primary={label:'기준 통과',level:'blue',icon:'🔵'};
    action='현재 손익기준은 넘었습니다. 급격히 확대하기보다 ROAS·CPC·CVR이 유지되는지 관찰하세요.';
  }

  return {...c,required,margin,breakEvenCpc,breakEvenCvr,cpcOver,ctrLow,roaFail,primary,action};
}

export default function AdDiagnosis({comparisons,master,settings}){
  const [filter,setFilter]=useState('all');
  const items=useMemo(()=>comparisons.map(c=>diagnose(c,master,settings)).sort((a,b)=>{
    const rank={danger:4,warn:3,normal:2,blue:1,good:0};
    return (rank[b.primary.level]??0)-(rank[a.primary.level]??0) || b.now.actualCost-a.now.actualCost;
  }),[comparisons,master,settings]);
  const visible=items.filter(x=>filter==='all'||(filter==='problem'?['danger','warn'].includes(x.primary.level):filter==='scale'?x.primary.label==='확대 검토':true));
  const counts={problem:items.filter(x=>['danger','warn'].includes(x.primary.level)).length,scale:items.filter(x=>x.primary.label==='확대 검토').length};

  return <section className="panel page-panel ad-diagnosis-page">
    <div className="panel-title"><div><h2>광고 원인 진단</h2><p>CTR → 클릭 문제 · CVR/CPC → 전환/클릭비 문제 · 실제 ROAS → 수익성 문제를 순서대로 봅니다. 광고비는 VAT 포함 실제 지출 기준입니다.</p></div></div>
    <div className="ad-diagnosis-filters">
      <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>전체 {items.length}</button>
      <button className={filter==='problem'?'active':''} onClick={()=>setFilter('problem')}>점검 필요 {counts.problem}</button>
      <button className={filter==='scale'?'active':''} onClick={()=>setFilter('scale')}>확대 검토 {counts.scale}</button>
    </div>
    <div className="ad-diagnosis-grid">
      {visible.map(x=><article key={x.productId} className={`ad-diagnosis-card ${x.primary.level}`}>
        <div className="ad-card-head"><div><small>{x.productId}</small><h3>{x.product}</h3></div><Badge item={x.primary}/></div>
        <div className="ad-metrics">
          <div><small>CTR</small><b className={x.ctrLow?'bad-text':''}>{pct(x.now.ctr)}</b><em>기준 {pct(settings.healthyCtr)}</em></div>
          <div><small>CVR</small><b>{pct(x.now.cvr)}</b><em>{x.breakEvenCvr!==null?`손익기준 ${pct(x.breakEvenCvr)}`:'마진 입력 시 비교'}</em></div>
          <div><small>실제 CPC</small><b className={x.cpcOver?'bad-text':''}>{won(x.now.cpc)}</b><em>{x.breakEvenCpc!==null?`손익분기 ${won(x.breakEvenCpc)}`:'주문·마진 필요'}</em></div>
          <div><small>실제 ROAS</small><b className={x.roaFail?'bad-text':''}>{pct(x.now.actualRoa)}</b><em>최소 {pct(x.required)}</em></div>
        </div>
        <div className="ad-volume"><span>노출 <b>{Math.round(x.now.impressions).toLocaleString('ko-KR')}</b></span><span>클릭 <b>{Math.round(x.now.clicks).toLocaleString('ko-KR')}</b></span><span>주문 <b>{Math.round(x.now.orders).toLocaleString('ko-KR')}</b></span><span>실제 광고비 <b>{won(x.now.actualCost)}</b></span></div>
        <div className="ad-action"><strong>다음 확인</strong><p>{x.action}</p></div>
        {!x.margin&&<div className="ad-warning">상품 마스터에 ‘광고 전 개당 마진’을 입력하면 CVR·손익분기 CPC 진단까지 정확하게 표시됩니다.</div>}
      </article>)}
    </div>
    {!visible.length&&<div className="empty"><span>◎</span><h3>현재 조건의 상품이 없습니다</h3><p>다른 필터를 선택해보세요.</p></div>}
    <p className="ad-diagnosis-note">14일 전환 주문 기준입니다. 경쟁상품 가격·영상·리뷰 여부는 광고보고서만으로 알 수 없으므로 사이트는 ‘확인해야 할 원인’으로 안내하고 자동 단정하지 않습니다.</p>
  </section>;
}

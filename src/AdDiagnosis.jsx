import React, { useMemo, useState } from 'react';
import { productContributionMargin, productMarginResolution } from './analysis';
import './ad-diagnosis.css';

const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const pct=n=>`${(n||0).toFixed(1)}%`;
const number=n=>Math.round(n||0).toLocaleString('ko-KR');

function diagnose(c, master, settings){
  const m=c.now;
  const resolution=productMarginResolution(master,c.productId,c.product);
  const saved=resolution.entry||{};
  const required=Number(saved.requiredRoa)||Number(settings.targetRoa)||0;
  const margin=productContributionMargin(master,c.productId,c.product);
  const enoughImpressions=m.impressions>=settings.minImpressions;
  const enoughClicks=m.clicks>=settings.minClicks;
  const ctrLow=enoughImpressions && m.ctr<settings.healthyCtr;
  const breakEvenCpc=margin ? margin*(m.cvr/100) : null;
  const cpcOver=breakEvenCpc!==null && m.cpc>breakEvenCpc;
  const roaFail=m.orders>0&&required>0&&m.actualRoa<required;
  const roaComfort=m.orders>0&&required>0&&m.actualRoa>=required*(1+settings.roaComfortRate/100);

  let kind='neutral', group='stable', badges=['유지'], diagnosis='현재 손익 기준을 충족하고 있습니다.', actions=['성과 유지','주간 추이 확인'];
  if(resolution.status==='ambiguous'){
    kind='info';group='insufficient';badges=['마진 연결 필요','판단 보류'];diagnosis='동일 상품명이 있어 상품ID 연결이 필요합니다.';actions=['상품ID 연결','상품 마스터 확인'];
  }else if(!enoughClicks || !enoughImpressions){
    kind='info';group='insufficient';badges=['판단 보류'];diagnosis='데이터가 부족해 판단을 보류합니다.';actions=['데이터 수집','노출 추이 확인'];
  }else if(!margin){
    kind='info';group='insufficient';badges=['마진 입력 필요','판단 보류'];diagnosis='상품 마진 입력 후 손익분기 CPC를 판단합니다.';actions=['상품 마진 입력','상품 마스터 확인'];
  }else if(m.orders===0){
    kind=cpcOver?'critical':'warning';group='check';badges=cpcOver?['전환 누수','CPC 높음']:['전환 누수'];diagnosis='클릭은 발생하지만 전환이 없습니다.';actions=ctrLow?['가격 점검','썸네일 점검','상세/영상 점검']:['가격 점검','경쟁상품 비교','상세/영상 점검'];
  }else if(cpcOver){
    kind='critical';group='check';badges=['CPC 높음'];diagnosis='현재 CPC가 손익분기 기준을 넘었습니다.';actions=['입찰가 점검','ROAS 상향 검토','키워드 점검'];
  }else if(roaFail){
    kind='warning';group='check';badges=['최소 ROAS 미달'];diagnosis='전환은 있으나 손익 기준을 못 넘깁니다.';actions=['가격 점검','경쟁상품 비교','상세/영상 점검'];
  }else if(ctrLow){
    kind='watch';group='check';badges=['CTR 낮음'];diagnosis='전환은 있으나 클릭률이 낮습니다.';actions=['썸네일 점검','상품명 점검','검색 가격 점검'];
  }else if(roaComfort){
    kind='good';group='scale';badges=['확대 검토'];diagnosis='성과가 좋아 확대 검토 대상입니다.';actions=['예산 확대 검토','키워드 확장','다음 주 재확인'];
  }

  return {...c,required,margin,resolution,breakEvenCpc,cpcOver,ctrLow,roaFail,kind,group,badges,diagnosis,actions};
}

export default function AdDiagnosis({comparisons,master,settings}){
  const [filter,setFilter]=useState('all');
  const items=useMemo(()=>comparisons.map(c=>diagnose(c,master,settings)).sort((a,b)=>{
    const rank={critical:5,warning:4,watch:3,good:2,neutral:1,info:0};
    const groupRank={check:3,scale:2,stable:1,insufficient:0};
    return (groupRank[b.group]??0)-(groupRank[a.group]??0) || (rank[b.kind]??0)-(rank[a.kind]??0) || b.now.actualCost-a.now.actualCost;
  }),[comparisons,master,settings]);
  const visible=items.filter(x=>filter==='all'||x.group===filter);
  const count=group=>items.filter(x=>x.group===group).length;

  return <section className="panel page-panel ad-diagnosis-page">
    <div className="ad-diagnosis-heading"><div><h2>광고 원인 진단</h2><p>VAT 포함 실제 광고비와 상품별 손익 기준으로 우선 점검할 상품을 보여드립니다.</p></div><div className="ad-summary-chips"><span><small>전체</small><b>{items.length}</b></span><span className="check"><small>우선 점검</small><b>{count('check')}</b></span><span className="scale"><small>확대 후보</small><b>{count('scale')}</b></span><span className="info"><small>판단 보류</small><b>{count('insufficient')}</b></span></div></div>
    <div className="ad-margin-guide"><span>ⓘ</span><p><b>손익분기 CPC</b> 상품 마스터의 ‘광고 전 개당 마진 × CVR’로 계산합니다. 마진이 없거나 상품명이 중복되면 자동 판단하지 않습니다.</p></div>
    <div className="ad-diagnosis-filters">{[['all','전체'],['check','점검 필요'],['scale','확대 후보'],['insufficient','판단 보류']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label} <em>{id==='all'?items.length:count(id)}</em></button>)}</div>
    <div className="ad-diagnosis-grid">
      {visible.map(x=>{
        const ctrText=x.now.ctr<settings.healthyCtr?'낮음':'양호';
        const cvrText=x.now.orders?'전환 있음':'전환 없음';
        const cpcText=x.resolution.status==='ambiguous'?'마진 연결 필요':!x.margin?'마진 입력 필요':x.cpcOver?'손익 기준 초과':'허용 범위';
        const roaText=x.now.actualRoa<x.required?'최소 미달':'기준 충족';
        return <article key={x.productId} className={`ad-diagnosis-card ${x.kind}`}>
          <div className="ad-card-head"><div><small>{x.productId}</small><h3>{x.product}</h3></div><div className="ad-status-badges">{x.badges.slice(0,2).map(label=><span key={label}>{label}</span>)}</div></div>
          <div className="ad-metrics">
            <div><small>CTR</small><b>{pct(x.now.ctr)}</b><em>{ctrText}</em></div>
            <div><small>CVR</small><b>{pct(x.now.cvr)}</b><em>{cvrText}</em></div>
            <div><small>실제 CPC</small><b>{won(x.now.cpc)}</b><em>{cpcText}</em></div>
            <div><small>실제 ROAS</small><b>{pct(x.now.actualRoa)}</b><em>{roaText}</em></div>
          </div>
          <div className="ad-volume"><span>노출 <b>{number(x.now.impressions)}</b></span><span>클릭 <b>{number(x.now.clicks)}</b></span><span>주문 <b>{number(x.now.orders)}</b></span><span>실제 광고비 <b>{won(x.now.actualCost)}</b></span></div>
          <p className="ad-one-diagnosis">{x.diagnosis}</p>
          <div className="ad-next-actions"><small>다음 액션</small>{x.actions.slice(0,3).map(action=><span key={action}>{action}</span>)}</div>
        </article>})}
    </div>
    {!visible.length&&<div className="empty"><span>◎</span><h3>현재 조건의 상품이 없습니다</h3><p>다른 필터를 선택해보세요.</p></div>}
    <p className="ad-diagnosis-note">14일 전환 주문 기준입니다. 경쟁상품 가격·영상·리뷰는 광고보고서만으로 알 수 없어 자동 단정하지 않습니다.</p>
  </section>;
}

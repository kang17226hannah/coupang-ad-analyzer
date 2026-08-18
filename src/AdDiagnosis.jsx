import React, { useMemo, useState } from 'react';
import { productContributionMargin, productMarginResolution } from './analysis';
import './ad-diagnosis.css';

const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const pct=n=>`${(n||0).toFixed(1)}%`;
const number=n=>Math.round(n||0).toLocaleString('ko-KR');
const pp=n=>`${n>=0?'+':''}${n.toFixed(1)}%p`;

function diagnose(c, master, settings){
  const m=c.now;
  const resolution=productMarginResolution(master,c.productId,c.product);
  const saved=resolution.entry||{};
  const required=Number(saved.requiredRoa)||Number(settings.targetRoa)||0;
  const margin=productContributionMargin(master,c.productId,c.product);
  const enoughImpressions=m.impressions>=settings.minImpressions;
  const enoughClicks=m.clicks>=settings.minClicks;
  const ctrLow=enoughImpressions && m.ctr<settings.healthyCtr;
  const breakEvenCpc=m.orders>0&&margin ? margin*(m.cvr/100) : null;
  const cpcGap=breakEvenCpc===null ? null : m.cpc-breakEvenCpc;
  const cpcOver=cpcGap!==null && cpcGap>0;
  const roaGap=required>0 ? m.actualRoa-required : null;
  const roaFail=m.orders>0&&required>0&&m.actualRoa<required;
  const roaComfort=m.orders>0&&required>0&&m.actualRoa>=required*(1+settings.roaComfortRate/100);
  const marginSpendRatio=margin&&m.orders===0 ? m.actualCost/margin : null;

  let kind='neutral', group='stable', headline='광고 유지', diagnosis='현재 손익 기준을 충족하고 있습니다.', actions=['성과 유지','다음 보고서에서 재확인'];
  if(resolution.status==='ambiguous'){
    kind='info';group='insufficient';headline='판단 보류 · 옵션ID 연결 필요';diagnosis='동일 상품명이 있어 정확한 마진을 연결할 수 없습니다.';actions=['옵션ID 연결','상품 마스터 확인'];
  }else if(!enoughClicks || !enoughImpressions){
    kind='info';group='insufficient';headline='판단 보류 · 데이터 수집 중';diagnosis='현재 분석기간의 노출 또는 클릭이 판단 기준보다 적습니다.';actions=['데이터 수집','다음 보고서에서 재확인'];
  }else if(!margin){
    kind='info';group='insufficient';headline='판단 보류 · 마진 입력 필요';diagnosis='상품 마진이 없어 CPC 손익 기준을 계산할 수 없습니다.';actions=['상품 마진 입력','상품 마스터 확인'];
  }else if(m.orders===0){
    if(marginSpendRatio>=1){
      kind='critical';group='check';headline='광고 축소·제외 검토';diagnosis=`주문 없이 실제 광고비가 광고 전 개당 마진 ${won(margin)}을 넘었습니다.`;actions=['누수 키워드 확인','입찰가 점검','제외 여부 검토'];
    }else{
      kind='warning';group='check';headline='관찰 · 전환 확인 필요';diagnosis=`주문은 없지만 아직 1건 마진 한도 내입니다. 현재 ${won(m.actualCost)} 사용했습니다.`;actions=['누수 키워드 확인','다음 보고서에서 재확인'];
    }
  }else if(cpcOver && !roaFail){
    kind='warning';group='check';headline='광고 유지 · CPC 개선 필요';diagnosis=`전체 ROAS는 수익 기준을 충족하지만 실제 CPC가 손익분기 CPC보다 ${won(cpcGap)} 높습니다.`;actions=['손익분기 CPC 초과 키워드 확인','목표 ROAS 상향 검토','다음 보고서에서 재확인'];
  }else if(roaFail){
    kind='critical';group='check';headline='수익성 개선 필요';diagnosis=`실제 ROAS가 최소 실제 ROAS보다 ${Math.abs(roaGap).toFixed(1)}%p 낮습니다.`;actions=['키워드 누수 확인','입찰가 점검','가격·상세 점검'];
  }else if(ctrLow){
    kind='watch';group='check';headline='광고 유지 · 클릭률 개선 필요';diagnosis='수익성은 기준을 넘지만 노출 대비 클릭률이 낮습니다.';actions=['썸네일 점검','상품명 점검','검색 가격 점검'];
  }else if(roaComfort){
    kind='good';group='scale';headline='성과 좋음 · 확대 검토';diagnosis='최소 실제 ROAS보다 충분한 여유가 있습니다.';actions=['예산 확대 검토','키워드 확장','다음 보고서에서 재확인'];
  }

  return {...c,required,margin,resolution,breakEvenCpc,cpcGap,cpcOver,ctrLow,roaFail,roaGap,kind,group,headline,diagnosis,actions,marginSpendRatio};
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
    <div className="ad-diagnosis-heading"><div><h2>광고 원인 진단</h2><p>결론 → 기준 비교 → 다음 행동 순서로 보여드립니다.</p></div><div className="ad-summary-chips"><span><small>전체</small><b>{items.length}</b></span><span className="check"><small>개선 필요</small><b>{count('check')}</b></span><span className="scale"><small>확대 검토</small><b>{count('scale')}</b></span><span className="info"><small>판단 보류</small><b>{count('insufficient')}</b></span></div></div>
    <div className="ad-margin-guide"><span>ⓘ</span><p><b>실제 CPC</b> 클릭 1회당 VAT 포함 실제 광고비입니다. <b>손익분기 CPC</b>는 광고 전 개당 마진 × CVR로 계산합니다.</p></div>
    <div className="ad-diagnosis-filters">{[['all','전체'],['check','개선 필요'],['scale','확대 검토'],['insufficient','판단 보류']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label} <em>{id==='all'?items.length:count(id)}</em></button>)}</div>
    <div className="ad-diagnosis-grid">
      {visible.map(x=>{
        const ctrStatus=x.now.impressions>=settings.minImpressions?(x.now.ctr<settings.healthyCtr?'낮음':'기준 충족'):'판단 보류';
        const cpcDetail=x.breakEvenCpc===null?(x.now.orders===0?'주문 발생 후 손익분기 CPC 계산':x.resolution.status==='ambiguous'?'옵션ID 연결 필요':'마진 입력 필요'):`손익분기 ${won(x.breakEvenCpc)} · ${x.cpcGap>0?`${won(x.cpcGap)} 초과`:`${won(Math.abs(x.cpcGap))} 여유`}`;
        const roaDetail=x.now.orders===0?'주문 없음':`최소 ${pct(x.required)} · ${pp(x.roaGap||0)}`;
        return <article key={x.productId} className={`ad-diagnosis-card ${x.kind}`}>
          <div className="ad-card-head"><div><small>옵션ID {x.productId}</small><h3>{x.product}</h3></div></div>
          <div className="ad-card-verdict"><strong>{x.headline}</strong><p>{x.diagnosis}</p></div>
          <div className="ad-metrics">
            <div><small>CTR</small><b>{pct(x.now.ctr)}</b><em>기준 {pct(settings.healthyCtr)} · {ctrStatus}</em></div>
            <div><small>CVR</small><b>{pct(x.now.cvr)}</b><em>{x.now.orders?`${number(x.now.orders)}건 주문`:'전환 없음'}</em></div>
            <div className={x.cpcOver?'metric-alert':''}><small>실제 CPC</small><b>{won(x.now.cpc)}</b><em>{cpcDetail}</em></div>
            <div className={x.roaFail?'metric-alert':x.now.orders&&!x.roaFail?'metric-good':''}><small>실제 ROAS</small><b>{x.now.orders?pct(x.now.actualRoa):'주문 없음'}</b><em>{roaDetail}</em></div>
          </div>
          <div className="ad-next-actions"><small>추천 액션</small>{x.actions.slice(0,3).map((action,i)=><span key={action}><b>{i+1}</b>{action}</span>)}</div>
          <details className="ad-detail"><summary>상세 데이터 보기</summary><div className="ad-volume"><span>노출 <b>{number(x.now.impressions)}</b></span><span>클릭 <b>{number(x.now.clicks)}</b></span><span>주문 <b>{number(x.now.orders)}</b></span><span>실제 광고비 <b>{won(x.now.actualCost)}</b></span><span>광고매출 <b>{won(x.now.sales)}</b></span></div></details>
        </article>})}
    </div>
    {!visible.length&&<div className="empty"><span>◎</span><h3>현재 조건의 상품이 없습니다</h3><p>다른 필터를 선택해보세요.</p></div>}
    <p className="ad-diagnosis-note">14일 전환 주문 기준입니다. 자동 진단은 광고보고서와 상품 마스터에 입력된 값만 사용합니다.</p>
  </section>;
}

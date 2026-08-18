import React, { useMemo, useState } from 'react';
import { metrics, placementCategory, productContributionMargin, productMarginResolution } from './analysis';
import AdDiagnosis from './AdDiagnosis';
import './leak-cpc.css';

const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const pct=n=>`${(n||0).toFixed(1)}%`;
const pp=n=>`${n>=0?'+':''}${n.toFixed(1)}%p`;
const missingKeyword=value=>!value||value==='-'||value==='(검색어 없음)';

function badge(status){return <span className={`badge ${status.level}`}>{status.icon||''} {status.label}</span>}

export default function LeakCpc({ rows, historyRows=[], settings, master }) {
  const [view,setView]=useState('diagnosis');
  const [mode,setMode]=useState('issues');

  const productComparisons=useMemo(()=>{
    const map={};
    for(const row of rows)(map[row.productId] ||= []).push(row);
    return Object.values(map).map(items=>({
      productId:items[0].productId,
      product:items[0].product,
      now:metrics(items,settings),
      before:metrics([],settings),
    }));
  },[rows,settings]);

  const historyMap=useMemo(()=>{
    const map={};
    for(const row of historyRows){
      const key=`${row.productId}|||${row.keyword}|||${row.placement}`;
      (map[key] ||= []).push(row);
    }
    return map;
  },[historyRows]);

  const groups=useMemo(()=>{
    const map={};
    for(const row of rows){
      const key=`${row.productId}|||${row.keyword}|||${row.placement}`;
      (map[key] ||= []).push(row);
    }
    return Object.entries(map).map(([key,items])=>{
      const first=items[0], m=metrics(items,settings), cumulative=metrics([...(historyMap[key]||[]),...items],settings);
      const resolution=productMarginResolution(master,first.productId,first.product);
      const margin=productContributionMargin(master,first.productId,first.product)||0;
      const required=Number(resolution.entry?.requiredRoa)||Number(settings.targetRoa)||0;
      const noKeyword=missingKeyword(first.keyword);
      const placement=placementCategory(first.placement);
      const breakEvenCpc=m.orders>0&&margin>0 ? margin*(m.cvr/100) : null;
      const cpcGap=breakEvenCpc===null ? null : m.cpc-breakEvenCpc;
      const neededCvr=cumulative.orders===0&&margin>0&&cumulative.cpc>0 ? cumulative.cpc/margin*100 : null;
      const remainingSpend=cumulative.orders===0&&margin>0 ? margin-cumulative.actualCost : null;
      const remainingClicks=remainingSpend!==null&&remainingSpend>0&&cumulative.cpc>0 ? Math.floor(remainingSpend/cumulative.cpc) : 0;
      let status, action, rationale;

      if(noKeyword){
        status={label:`${placement} · 키워드 없음`,level:'normal'};
        action='키워드 제외 대상 아님';
        rationale=`광고보고서에 검색어가 없는 ${placement} 지면 데이터입니다.`;
      }else if(resolution.status==='ambiguous'){
        status={label:'마진 연결 필요',level:'normal'}; action='옵션ID 연결'; rationale='정확한 손익 기준을 계산하려면 상품 마스터 연결이 필요합니다.';
      }else if(!margin){
        status={label:'마진 입력 필요',level:'normal'}; action='상품 마스터 입력'; rationale='광고 전 개당 마진이 없어 손익 경계를 계산할 수 없습니다.';
      }else if(m.orders>0){
        if(cpcGap>0){status={label:'CPC 개선 필요',level:'warn'};action='입찰·키워드 점검';rationale=`실제 CPC가 손익분기 CPC보다 ${won(cpcGap)} 높습니다.`}
        else if(required&&m.actualRoa<required){status={label:'ROAS 미달',level:'danger'};action='수익성 개선 검토';rationale=`실제 ROAS가 최소 기준보다 ${Math.abs(m.actualRoa-required).toFixed(1)}%p 낮습니다.`}
        else {status={label:'유지',level:'good'};action='유지 · 다음 보고서 확인';rationale='주문이 있고 CPC와 ROAS가 현재 손익 기준을 충족합니다.'}
      }else if(cumulative.orders>0){
        status={label:'재관찰',level:'normal'};action='다음 보고서에서 재확인';rationale=`현재 기간 주문은 0건이지만 직전 분석기간을 포함하면 ${cumulative.orders}건의 전환이 있습니다.`;
      }else if(cumulative.actualCost>=margin){
        status={label:'제외 검토',level:'danger'};action='입찰 축소·키워드 제외 검토';rationale=`누적 주문 0건인데 실제 광고비 ${won(cumulative.actualCost)}가 1건 마진 ${won(margin)}을 넘었습니다.`;
      }else if(cumulative.actualCost>=margin*.7 || remainingClicks===0){
        status={label:'주의',level:'warn'};action='추가 클릭 전 입찰 점검';rationale=remainingClicks===0?'현재 CPC 수준이면 추가 1클릭으로 1건 마진 경계를 넘을 수 있습니다.':`1건 마진 경계까지 ${won(Math.max(remainingSpend,0))} 남았습니다.`;
      }else{
        status={label:'관찰',level:'normal'};action='다음 보고서에서 재확인';rationale=`1건 마진 경계까지 ${won(Math.max(remainingSpend,0))} 남아 있습니다.`;
      }
      return {productId:first.productId,product:first.product,keyword:first.keyword,placement:first.placement,noKeyword,...m,cumulative,margin,required,resolution,breakEvenCpc,cpcGap,neededCvr,remainingSpend,remainingClicks,status,action,rationale};
    }).sort((a,b)=>b.actualCost-a.actualCost);
  },[rows,settings,master,historyMap]);

  const visible=groups.filter(g=>{
    if(mode==='zero') return !g.noKeyword&&g.orders===0;
    if(mode==='cpc') return !g.noKeyword&&g.orders>0&&g.cpcGap>0;
    if(mode==='placement') return g.noKeyword;
    return g.noKeyword||g.status.label!=='유지';
  });

  return <div className="cpc-page-wrap">
    <div className="cpc-view-tabs">
      <button className={view==='diagnosis'?'active':''} onClick={()=>setView('diagnosis')}>광고 진단</button>
      <button className={view==='keyword'?'active':''} onClick={()=>setView('keyword')}>키워드 누수 · CPC</button>
    </div>

    {view==='diagnosis'&&<AdDiagnosis comparisons={productComparisons} master={master} settings={settings}/>} 

    {view==='keyword'&&<section className="panel page-panel cpc-page">
      <div className="panel-title"><div><h2>키워드 누수 · CPC 분석</h2><p>실제 CPC는 클릭 1회당 VAT 포함 실제 광고비입니다. 주문 0 키워드는 직전 비중복 분석기간까지 이어서 판단합니다.</p></div></div>
      <div className="cpc-filters">
        <button className={mode==='issues'?'active':''} onClick={()=>setMode('issues')}>점검 대상</button>
        <button className={mode==='zero'?'active':''} onClick={()=>setMode('zero')}>주문 0</button>
        <button className={mode==='cpc'?'active':''} onClick={()=>setMode('cpc')}>CPC 개선 필요</button>
        <button className={mode==='placement'?'active':''} onClick={()=>setMode('placement')}>키워드 없음 지면</button>
      </div>
      <div className="cpc-help"><b>판단 방법</b> 주문이 있으면 실제 CPC와 손익분기 CPC, 실제 ROAS와 최소 실제 ROAS를 비교합니다. 주문이 계속 0이면 누적 실제 광고비가 ‘광고 전 개당 마진’에 얼마나 가까운지 보고 관찰 → 주의 → 제외 검토로 표시합니다.</div>
      <div className="table-wrap wide"><table><thead><tr><th>상품 / 키워드</th><th>판단</th><th>현재 클릭 / 주문</th><th>실제 광고비</th><th>실제 CPC</th><th>손익 기준</th><th>실제 ROAS</th><th>추천 액션</th></tr></thead><tbody>
        {visible.map(g=>{
          const keywordLabel=g.noKeyword?`${placementCategory(g.placement)} 영역 · 키워드 없음`:g.keyword;
          const breakEvenText=g.orders>0&&g.breakEvenCpc!==null?<><b>손익 CPC {won(g.breakEvenCpc)}</b><small className={`block ${g.cpcGap>0?'bad-text':'good-text'}`}>{g.cpcGap>0?`${won(g.cpcGap)} 초과`:`${won(Math.abs(g.cpcGap))} 여유`}</small></>:g.noKeyword?<><b>지면 성과</b><small className="block">키워드 단위 판단 불가</small></>:g.margin?<><b>필요 CVR {g.neededCvr===null?'—':pct(g.neededCvr)}</b><small className="block">누적비 {won(g.cumulative.actualCost)} / 1건 마진 {won(g.margin)}</small>{g.cumulative.orders===0&&g.remainingSpend>0&&<small className="block">경계까지 {won(g.remainingSpend)}{g.remainingClicks===0?' · 추가 1클릭 주의':` · 약 ${g.remainingClicks}클릭 여유`}</small>}</>:<b>마진 입력 필요</b>;
          const roaText=g.orders===0?'주문 없음':<><b>{pct(g.actualRoa)}</b><small className={`block ${g.actualRoa>=g.required?'good-text':'bad-text'}`}>최소 {pct(g.required)} · {pp(g.actualRoa-g.required)}</small></>;
          return <tr key={`${g.productId}-${g.keyword}-${g.placement}`}><td><b>{keywordLabel}</b><small className="block">{g.product}</small><small className="block">옵션ID {g.productId} · {g.placement}</small></td><td>{badge(g.status)}<small className="block decision-reason">{g.rationale}</small></td><td><b>{g.clicks} / {g.orders}</b>{g.historyRows!==0&&g.cumulative.clicks!==g.clicks&&<small className="block">직전 포함 누적 {g.cumulative.clicks}클릭 / {g.cumulative.orders}주문</small>}</td><td>{won(g.actualCost)}{g.cumulative.actualCost!==g.actualCost&&<small className="block">누적 {won(g.cumulative.actualCost)}</small>}</td><td><b>{won(g.cpc)}</b><small className="block">클릭 1회당</small></td><td>{breakEvenText}</td><td>{roaText}</td><td><b>{g.action}</b></td></tr>
        })}
      </tbody></table></div>
      {!visible.length&&<div className="empty"><span>◎</span><h3>현재 조건의 점검 대상이 없습니다</h3><p>다른 필터를 선택해보세요.</p></div>}
      <p className="cpc-note">‘제외 검토’는 자동 삭제가 아니라 운영 판단 신호입니다. 키워드 없음 지면은 실제 광고비가 발생할 수 있지만 키워드 제외 대상으로 취급하지 않습니다.</p>
    </section>}
  </div>;
}

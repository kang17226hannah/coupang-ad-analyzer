import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as XLSX from 'xlsx';
import { classify, DEFAULT_SETTINGS, groupRows, metrics, normalizeRow } from './analysis';
import { sampleRows } from './sample';
import './styles.css';

const nav = [
  ['dashboard','▦','대시보드'], ['leak','⌁','누수 키워드'], ['hero','✦','효자 키워드'], ['product','◇','상품 진단'],
  ['placement','▤','지면 분석'], ['rows','☷','행별 진단'], ['master','□','상품 마스터'], ['settings','⚙','설정']
];
const won = n => `₩${Math.round(n || 0).toLocaleString('ko-KR')}`;
const pct = n => `${(n || 0).toFixed(1)}%`;
const number = n => Math.round(n || 0).toLocaleString('ko-KR');

function Metric({label,value,sub,tone,icon}) { return <article className="metric"><div className={`metric-icon ${tone}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{sub}</small></div></article> }
function Empty({children}) { return <div className="empty"><span>⌁</span><h3>표시할 데이터가 없습니다</h3><p>{children}</p></div> }
function Table({groups, first='키워드'}) { return <div className="table-wrap"><table><thead><tr><th>{first}</th><th>클릭</th><th>광고비</th><th>주문</th><th>매출</th><th>ROAS</th><th>CPA</th></tr></thead><tbody>{groups.map(g=><tr key={g.name}><td><b>{g.name}</b></td><td>{number(g.clicks)}</td><td>{won(g.cost)}</td><td>{number(g.orders)}</td><td>{won(g.sales)}</td><td><span className={g.roa>=500?'positive':''}>{pct(g.roa)}</span></td><td>{won(g.cpa)}</td></tr>)}</tbody></table></div> }

function App() {
  const [page,setPage] = useState('dashboard');
  const [rows,setRows] = useState(()=>JSON.parse(localStorage.getItem('coupang-rows')||'null') || sampleRows);
  const [settings,setSettings] = useState(()=>JSON.parse(localStorage.getItem('coupang-settings')||'null') || DEFAULT_SETTINGS);
  const [uploadOpen,setUploadOpen] = useState(false), [raw,setRaw] = useState(''), [query,setQuery] = useState(''), [notice,setNotice] = useState('');
  const fileRef=useRef();
  useEffect(()=>localStorage.setItem('coupang-rows',JSON.stringify(rows)),[rows]);
  useEffect(()=>localStorage.setItem('coupang-settings',JSON.stringify(settings)),[settings]);
  const m=useMemo(()=>metrics(rows,settings),[rows,settings]);
  const keywords=useMemo(()=>groupRows(rows,'keyword',settings),[rows,settings]);
  const products=useMemo(()=>groupRows(rows,'product',settings),[rows,settings]);
  const placements=useMemo(()=>groupRows(rows,'placement',settings),[rows,settings]);
  const filtered=rows.filter(r=>[r.keyword,r.product,r.placement].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  const importWorkbook = async file => { try { const data=await file.arrayBuffer(); const wb=XLSX.read(data); const sheet=wb.Sheets[wb.SheetNames[0]]; const parsed=XLSX.utils.sheet_to_json(sheet).map(normalizeRow); if(!parsed.length) throw Error('데이터가 없습니다.'); setRows(parsed); setUploadOpen(false); flash(`${parsed.length}개 행을 불러왔습니다.`); } catch(e){flash(`업로드 실패: ${e.message}`)} };
  const parseRaw=()=>{ try { const text=raw.trim(); if(!text) return; const delim=text.includes('\t')?'\t':','; const lines=text.split(/\r?\n/).map(l=>l.split(delim)); const headers=lines.shift(); setRows(lines.filter(x=>x.some(Boolean)).map((line,i)=>normalizeRow(Object.fromEntries(headers.map((h,j)=>[h.trim(),line[j]?.trim()])),i))); setUploadOpen(false); flash('RAW 데이터를 분석했습니다.'); }catch(e){flash('RAW 데이터 형식을 확인해주세요.')} };
  const flash=t=>{setNotice(t);setTimeout(()=>setNotice(''),3000)};
  const title=nav.find(n=>n[0]===page)?.[2];
  return <div className="app">
    <aside><div className="brand"><div className="logo">C</div><div><b>쿠팡 광고 분석기</b><small>AD INTELLIGENCE</small></div></div><nav>{nav.map(([id,icon,label])=><button className={page===id?'active':''} onClick={()=>setPage(id)} key={id}><span>{icon}</span>{label}{id==='leak'&&<em>{keywords.filter(k=>k.cost>0&&!k.orders).length}</em>}</button>)}</nav><div className="side-help"><b>분석이 처음이신가요?</b><p>쿠팡 광고 보고서를 올리면 자동으로 진단해 드려요.</p><button onClick={()=>setUploadOpen(true)}>데이터 업로드</button></div><div className="version">v1.0.0 · 데이터는 브라우저에만 저장</div></aside>
    <main><header><div><h1>{title}</h1><p>광고 성과를 한눈에 확인하고, 개선 포인트를 발견하세요.</p></div><div className="head-actions"><button className="icon-btn" aria-label="알림">♢</button><button className="upload" onClick={()=>setUploadOpen(true)}>↑ &nbsp;데이터 업로드</button></div></header>
      {page==='dashboard'&&<Dashboard m={m} keywords={keywords} placements={placements} />}
      {page==='leak'&&<ListPage title="누수 키워드" hint="비용이 발생했지만 주문으로 연결되지 않은 키워드입니다." groups={keywords.filter(k=>k.cost>0&&!k.orders)} first="누수 키워드" empty="현재 누수로 진단된 키워드가 없습니다." />}
      {page==='hero'&&<ListPage title="효자 키워드" hint={`목표 ROAS ${settings.targetRoa}% 이상인 키워드입니다.`} groups={keywords.filter(k=>k.orders>0&&k.roa>=settings.targetRoa)} first="효자 키워드" empty="목표를 달성한 키워드가 아직 없습니다." />}
      {page==='product'&&<ListPage title="상품별 성과 진단" hint="상품 단위로 광고 효율과 예상 수익을 비교합니다." groups={products} first="상품명" />}
      {page==='placement'&&<Placement groups={placements}/>} 
      {page==='rows'&&<Rows rows={filtered} query={query} setQuery={setQuery} settings={settings}/>} 
      {page==='master'&&<Master groups={products} />}
      {page==='settings'&&<Settings value={settings} setValue={setSettings} reset={()=>{setSettings(DEFAULT_SETTINGS);flash('기본 설정으로 복원했습니다.')}}/>}
    </main>{notice&&<div className="toast">✓ {notice}</div>}
    {uploadOpen&&<div className="modal-back" onMouseDown={e=>e.target===e.currentTarget&&setUploadOpen(false)}><section className="modal"><button className="close" onClick={()=>setUploadOpen(false)}>×</button><div className="modal-icon">↑</div><h2>광고 데이터 불러오기</h2><p>XLSX, XLS, CSV 파일을 올리거나 원본 데이터를 붙여넣으세요.</p><div className="drop" onClick={()=>fileRef.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();importWorkbook(e.dataTransfer.files[0])}}><b>파일을 끌어다 놓거나 클릭하세요</b><small>.xlsx · .xls · .csv (최대 20MB)</small><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={e=>importWorkbook(e.target.files[0])}/></div><div className="or"><span/>또는 RAW 붙여넣기<span/></div><textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'날짜\t상품명\t키워드\t노출수\t클릭수\t광고비\t주문수\t매출액\n2026-08-01\t상품 A\t검색어 A\t1000\t30\t12000\t2\t90000'}/><button className="primary full" disabled={!raw.trim()} onClick={parseRaw}>붙여넣은 데이터 분석</button><button className="sample" onClick={()=>{setRows(sampleRows);setUploadOpen(false);flash('샘플 데이터를 불러왔습니다.')}}>샘플 데이터로 둘러보기 →</button></section></div>}
  </div>
}

function Dashboard({m,keywords,placements}) { const max=Math.max(...placements.map(p=>p.sales),1); return <><div className="period"><button>최근 전체 기간⌄</button><span>마지막 업데이트: 방금 전</span></div><section className="metric-grid"><Metric label="광고비" value={won(m.cost)} sub={`평균 CPC ${won(m.cpc)}`} icon="₩" tone="blue"/><Metric label="광고 매출" value={won(m.sales)} sub={`ROAS ${pct(m.roa)}`} icon="↗" tone="green"/><Metric label="주문수" value={number(m.orders)} sub={`전환율 ${pct(m.cvr)}`} icon="▢" tone="purple"/><Metric label="예상 순이익" value={won(m.expectedProfit)} sub={`CPA ${won(m.cpa)}`} icon="✦" tone="orange"/></section><div className="info-strip"><span>◎</span><div><b>유입 추정 {number(m.estimatedVisits)}명</b><p>광고 클릭과 일반적인 중복 유입률을 반영한 참고 지표입니다.</p></div><strong>CTR {pct(m.ctr)}</strong></div><div className="two-col"><section className="panel"><div className="panel-title"><div><h2>지면별 광고 매출</h2><p>노출 지면에 따른 매출 기여도</p></div><button onClick={()=>{}}>전체 보기</button></div><div className="bars">{placements.map((p,i)=><div className="bar-row" key={p.name}><span>{p.name}</span><div><i style={{width:`${p.sales/max*100}%`}} className={`bar c${i}`}/></div><b>{won(p.sales)}</b></div>)}</div></section><section className="panel"><div className="panel-title"><div><h2>키워드 성과 TOP 5</h2><p>광고 매출 기준 상위 키워드</p></div></div><div className="ranking">{keywords.slice(0,5).map((k,i)=><div key={k.name}><em>{i+1}</em><span><b>{k.name}</b><small>{number(k.clicks)} 클릭 · {number(k.orders)} 주문</small></span><strong>{won(k.sales)}<small>ROAS {pct(k.roa)}</small></strong></div>)}</div></section></div><section className="panel health"><div className="panel-title"><div><h2>오늘의 광고 진단</h2><p>지금 바로 확인하면 좋은 개선 포인트예요.</p></div></div><div className="health-grid"><div className="danger-card"><span>!</span><div><b>누수 키워드</b><strong>{keywords.filter(k=>k.cost>0&&!k.orders).length}개</strong><small>광고비만 쓰고 주문이 없어요</small></div></div><div className="good-card"><span>✦</span><div><b>효자 키워드</b><strong>{keywords.filter(k=>k.roa>=500&&k.orders).length}개</strong><small>목표 ROAS를 넘었어요</small></div></div><div className="neutral-card"><span>◉</span><div><b>분석 데이터</b><strong>{number(m.clicks)} 클릭</strong><small>충분한 데이터가 쌓이고 있어요</small></div></div></div></section></> }
function ListPage({title,hint,groups,first,empty}) { return <section className="panel page-panel"><div className="panel-title"><div><h2>{title}</h2><p>{hint}</p></div><span className="count">총 {groups.length}개</span></div>{groups.length?<Table groups={groups} first={first}/>:<Empty>{empty}</Empty>}</section> }
function Placement({groups}) {return <><div className="metric-grid compact">{groups.slice(0,4).map((g,i)=><Metric key={g.name} label={g.name} value={won(g.sales)} sub={`ROAS ${pct(g.roa)} · ${number(g.orders)}건`} icon={['⌕','▦','◎','◇'][i]||'◇'} tone={['blue','green','purple','orange'][i%4]}/>)}</div><ListPage title="지면별 상세 성과" hint="광고 지면마다 투자 효율을 비교해보세요." groups={groups} first="광고 지면"/></>}
function Rows({rows,query,setQuery,settings}) {return <section className="panel page-panel"><div className="panel-title"><div><h2>행별 진단</h2><p>원본 데이터 한 행씩 진단 결과와 개선 방향을 확인합니다.</p></div><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="⌕ 상품, 키워드 검색"/></div><div className="table-wrap"><table><thead><tr><th>날짜 / 상품</th><th>키워드</th><th>광고비</th><th>주문</th><th>ROAS</th><th>진단</th></tr></thead><tbody>{rows.map(r=>{const d=classify(r,settings), mm=metrics([r],settings);return <tr key={r.id}><td><b>{r.product}</b><small className="block">{r.date}</small></td><td>{r.keyword}</td><td>{won(r.cost)}</td><td>{r.orders}</td><td>{pct(mm.roa)}</td><td><span className={`badge ${d.level}`} title={d.message}>{d.label}</span></td></tr>})}</tbody></table></div></section>}
function Master({groups}) {return <section className="panel page-panel"><div className="panel-title"><div><h2>상품 마스터</h2><p>등록된 광고 상품과 누적 성과입니다.</p></div><button className="outline">+ 상품 추가</button></div><div className="product-grid">{groups.map((g,i)=><article className="product-card" key={g.name}><div className={`product-thumb t${i%3}`}>◇</div><div><small>상품 #{String(i+1).padStart(3,'0')}</small><h3>{g.name}</h3><p>{number(g.impressions)}회 노출 · {number(g.clicks)}회 클릭</p><div><span>누적 매출 <b>{won(g.sales)}</b></span><span>ROAS <b>{pct(g.roa)}</b></span></div></div></article>)}</div></section>}
function Settings({value,setValue,reset}) { const fields=[['marginRate','평균 마진율','상품 매출에서 원가를 제외한 비율','%'],['feeRate','쿠팡 수수료율','카테고리 평균 판매 수수료','%'],['shippingCost','건당 배송비','주문 1건당 부담하는 평균 배송비','원'],['targetRoa','목표 ROAS','효자 키워드를 판단하는 기준','%']]; return <section className="panel settings"><div className="panel-title"><div><h2>분석 기준 설정</h2><p>CPA와 예상 순이익 계산에 적용됩니다.</p></div></div>{fields.map(([key,label,hint,unit])=><label key={key}><span><b>{label}</b><small>{hint}</small></span><div><input type="number" value={value[key]} onChange={e=>setValue({...value,[key]:Number(e.target.value)})}/><em>{unit}</em></div></label>)}<div className="setting-actions"><button onClick={reset}>기본값 복원</button><span>변경사항은 자동으로 저장됩니다.</span></div></section>}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);

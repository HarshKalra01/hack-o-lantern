/* Derry Incident Watch — app. Plain JS, no build. Hooks: DW.addCase(c), DW.renderAll(), DW.openCase(id), DW.links(id) */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS="derryWatch.reports.v1";
const locById=Object.fromEntries(DW.LOCATIONS.map(l=>[l.id,l]));
const tagIcon=Object.fromEntries(DW.TAGS.map(t=>[t.id,t.icon]));
const yearOf=c=>+c.date.slice(0,4);
const cycleOf=y=>{let best=null,d=99;DW.CYCLES.forEach(c=>{const k=Math.abs(c.year-y);if(k<d){d=k;best=c.year}});return d<=4?best:null};
function loadUser(){try{return JSON.parse(localStorage.getItem(LS)||"[]")}catch(e){return[]}}
function saveUser(a){try{localStorage.setItem(LS,JSON.stringify(a))}catch(e){}}
let userCases=loadUser();
let ALL=[];
const state={status:"all",q:"",loc:"",year:"",tags:new Set(),selected:null,cycle:null};
function rebuild(){ALL=[...DW.CASES,...userCases].sort((a,b)=>b.date.localeCompare(a.date));DW.ALL=ALL}

/* ---------- pattern engine ---------- */
function score(a,b){
  if(a.id===b.id)return 0;
  let s=0,why=[];
  const shared=a.tags.filter(t=>b.tags.includes(t));
  if(shared.length){s+=shared.length;why.push("shared clue"+(shared.length>1?"s":"")+": "+shared.join(", "))}
  if(a.loc===b.loc){s+=2;why.push("same location")}
  const ya=yearOf(a),yb=yearOf(b);
  const dy=Math.abs(ya-yb);if(dy>=26&&(dy%27<=1||dy%27>=26)){s+=1;why.push("27-year echo ("+Math.min(ya,yb)+" → "+Math.max(ya,yb)+")")}
  return {s,why};
}
function links(id,min=2){
  const a=ALL.find(c=>c.id===id);if(!a)return[];
  return ALL.map(b=>({c:b,...(score(a,b)||{s:0,why:[]})})).filter(x=>x.s>=min).sort((x,y)=>y.s-x.s);
}
DW.links=links;
function detectPatterns(list){
  const pats=[];
  // by location
  const byLoc={};list.forEach(c=>(byLoc[c.loc]=byLoc[c.loc]||[]).push(c));
  Object.entries(byLoc).filter(([,v])=>v.length>=2).sort((a,b)=>b[1].length-a[1].length).forEach(([k,v])=>{
    const ys=v.map(yearOf);pats.push({title:`${locById[k]?.name||k}: ${v.length} incidents, ${Math.min(...ys)}–${Math.max(...ys)}`,body:"Same place, decades apart. Reports here keep coming back.",ids:v.map(c=>c.id)})});
  // by tag across cycles
  DW.TAGS.forEach(t=>{const v=list.filter(c=>c.tags.includes(t.id));const cy=new Set(v.map(c=>cycleOf(yearOf(c))).filter(Boolean));
    if(v.length>=3&&cy.size>=2)pats.push({title:`${t.icon} "${t.id}" appears in ${v.length} cases across ${cy.size} cycles`,body:"Cycles: "+[...cy].sort().join(", ")+". The same detail recurring every 27 years is not coincidence.",ids:v.map(c=>c.id)})});
  // co-occurrence
  const pairs={};list.forEach(c=>{for(let i=0;i<c.tags.length;i++)for(let j=i+1;j<c.tags.length;j++){const k=[c.tags[i],c.tags[j]].sort().join(" + ");(pairs[k]=pairs[k]||[]).push(c.id)}});
  Object.entries(pairs).filter(([,v])=>v.length>=2).sort((a,b)=>b[1].length-a[1].length).slice(0,3).forEach(([k,v])=>pats.push({title:`Linked clues: ${k} (${v.length} cases)`,body:"These details show up together. Treat them as one phenomenon.",ids:v}));
  return pats;
}

/* ---------- stats ---------- */
function renderStats(){
  $("#stOpen").textContent=ALL.filter(c=>c.status==="Open").length;
  $("#stMissing").textContent=ALL.filter(c=>c.status==="Missing").length;
  $("#stBalloon").textContent=ALL.filter(c=>c.tags.includes("red balloon")).length;
  const y=2043-new Date().getFullYear();$("#stCycle").textContent=y>0?y+" yrs":"now";
}

/* ---------- map ---------- */
function renderMap(){
  const g=$("#pins");const counts={};ALL.forEach(c=>(counts[c.loc]=counts[c.loc]||[]).push(c));
  const linkedLocs=new Set();let selLoc=null;
  if(state.selected){const s=ALL.find(c=>c.id===state.selected);if(s){selLoc=s.loc;links(s.id).forEach(x=>linkedLocs.add(x.c.loc))}}
  g.innerHTML=DW.LOCATIONS.filter(l=>counts[l.id]).map(l=>{
    const v=counts[l.id],miss=v.some(c=>c.status==="Missing"),bal=v.some(c=>c.tags.includes("red balloon"));
    const cls=["pin",miss?"missing":bal?"balloon":"",l.id===selLoc?"sel":"",linkedLocs.has(l.id)&&l.id!==selLoc?"linked":"",state.selected&&!linkedLocs.has(l.id)&&l.id!==selLoc?"dim":""].join(" ");
    return `<g class="${cls}" data-loc="${l.id}" tabindex="0" role="button" aria-label="${esc(l.name)}, ${v.length} cases" transform="translate(${l.x} ${l.y})">
      <circle class="halo" r="16"/><circle class="dot" r="10"/><text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#1a0b00" pointer-events="none">${v.length}</text>
      <title>${esc(l.name)} — ${v.length} case(s)</title></g>`}).join("");
  // link lines
  const lg=$("#links");lg.innerHTML="";
  if(selLoc){const a=locById[selLoc];linkedLocs.forEach(id=>{if(id===selLoc)return;const b=locById[id];lg.insertAdjacentHTML("beforeend",`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`)})}
  // hotspots
  $("#hotspots").innerHTML=Object.entries(counts).sort((a,b)=>b[1].length-a[1].length).slice(0,7).map(([k,v])=>`<li data-loc="${k}"><span>${esc(locById[k]?.name||k)}</span><b>${v.length}</b></li>`).join("");
}
function openLocation(id){
  const l=locById[id];const v=ALL.filter(c=>c.loc===id);
  if(v.length===1)return openCase(v[0].id);
  showModal(`<p class="m-id">LOCATION FILE</p><h3 id="mTitle">${esc(l.name)}</h3><p>${v.length} incidents on record here.</p>
   <div class="m-links" style="flex-direction:column">${v.map(c=>`<button data-case="${c.id}"><b>${c.id}</b> · ${esc(c.title)} <span class="st ${c.status}">${c.status}</span></button>`).join("")}</div>`);
}

/* ---------- cases ---------- */
function caseCard(c,linked){
  return `<article class="glass case ${linked?"linked":""}" data-case="${c.id}" tabindex="0">
   ${c.user?'<span class="new-badge">YOUR REPORT</span>':""}
   <div class="id">${c.id}</div><h3>${esc(c.title)}</h3><p>${esc(c.desc.slice(0,110))}${c.desc.length>110?"…":""}</p>
   <div class="meta"><span class="st ${c.status}">${c.status}</span><span>📅 ${c.date}</span><span>📍 ${esc(locById[c.loc]?.name||c.loc)}</span></div>
   <div class="chips">${c.tags.map(t=>`<span class="chip">${tagIcon[t]||"•"} ${esc(t)}</span>`).join("")}</div></article>`;
}
function renderCases(){
  const linkedIds=new Set(state.selected?links(state.selected).map(x=>x.c.id):[]);
  const v=ALL.filter(c=>state.status==="all"||c.status===state.status);
  $("#caseCount").textContent=ALL.length;
  $("#caseGrid").innerHTML=v.map(c=>caseCard(c,linkedIds.has(c.id))).join("")||'<p class="empty">No cases with that status.</p>';
}
function openCase(id){
  const c=ALL.find(x=>x.id===id);if(!c)return;
  state.selected=id;renderMap();renderCases();
  const L=links(id);
  showModal(`<p class="m-id">${c.id}${c.user?" · CITIZEN REPORT":""}</p><h3 id="mTitle">${esc(c.title)}</h3>
   <span class="st ${c.status}">${c.status}</span>
   <div class="m-grid"><div><small>Date</small>${c.date}</div><div><small>Location</small>${esc(locById[c.loc]?.name||c.loc)}</div>
   <div><small>Witness</small>${esc(c.witness||"Anonymous")}</div><div><small>Cycle</small>${cycleOf(yearOf(c))||"Between cycles"}</div></div>
   <p>${esc(c.desc)}</p>
   <h4 style="margin-top:14px">Evidence &amp; clues</h4><ul class="ev">${(c.evidence||[]).map(e=>`<li>${esc(e)}</li>`).join("")||"<li>No evidence logged yet.</li>"}</ul>
   <div class="chips">${c.tags.map(t=>`<span class="chip">${tagIcon[t]||"•"} ${esc(t)}</span>`).join("")}</div>
   <h4 style="margin-top:16px">🔗 Pattern detector: ${L.length} linked case${L.length===1?"":"s"}</h4>
   <div class="m-links">${L.slice(0,8).map(x=>`<button data-case="${x.c.id}" title="${esc(x.why.join(" · "))}"><b>${x.c.id}</b> · ${esc(x.why.join(" · "))}</button>`).join("")||"<span class='det-out'>No strong links yet.</span>"}</div>
   <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-showmap>Show links on map</button><button class="btn" data-clear>Clear highlight</button></div>`);
}
DW.openCase=openCase;

/* ---------- modal ---------- */
let lastFocus=null;
function showModal(html){lastFocus=document.activeElement;$("#mBody").innerHTML=html;$("#modal").hidden=false;document.body.style.overflow="hidden";$(".modal-card .x").focus({preventScroll:true})}
function closeModal(){$("#modal").hidden=true;document.body.style.overflow="";lastFocus&&lastFocus.focus&&lastFocus.focus({preventScroll:true})}
$("#modal").addEventListener("click",e=>{
  if(e.target.closest("[data-close]"))return closeModal();
  const b=e.target.closest("[data-case]");if(b)return openCase(b.dataset.case);
  if(e.target.closest("[data-showmap]")){closeModal();$("#map").scrollIntoView({behavior:"smooth"});return}
  if(e.target.closest("[data-clear]")){state.selected=null;renderMap();renderCases();closeModal()}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#modal").hidden)closeModal()});

/* ---------- timeline ---------- */
function renderTimeline(){
  const cyc=DW.CYCLES.map(c=>({...c,n:ALL.filter(x=>cycleOf(yearOf(x))===c.year).length}));
  const recent=ALL.filter(x=>yearOf(x)>2020).length;
  const max=Math.max(1,...cyc.map(c=>c.n),recent);
  const cell=(y,n,lab,fut)=>`<div class="cy ${fut?"future":""} ${state.cycle==y?"on":""}" data-cy="${y}"><b>${y==="recent"?"Now":y}</b><small>${lab}</small><div class="bar" style="width:${Math.max(14,n/max*100)}%"></div></div>`;
  $("#cycleBar").innerHTML=cyc.map(c=>cell(c.year,c.future?max*.5:c.n,c.future?"projected":c.n+" cases",c.future)).join("")+cell("recent",recent,recent+" recent");
  let items=[...ALL];
  if(state.cycle==="recent")items=items.filter(x=>yearOf(x)>2020);
  else if(state.cycle)items=items.filter(x=>cycleOf(yearOf(x))==state.cycle);
  items.sort((a,b)=>a.date.localeCompare(b.date));
  const marks=DW.CYCLES.filter(c=>!state.cycle||state.cycle==c.year);
  const rows=[];
  marks.forEach(m=>rows.push({date:m.year+"",cy:m}));items.forEach(c=>rows.push({date:c.date,c}));
  rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.cy?-1:1));
  $("#tl").innerHTML=rows.map(r=>r.cy?`<div class="glass tl-item cyclemark" data-cy="${r.cy.year}"><div class="d">CYCLE · ${r.cy.year}</div><h4>${r.cy.future?"Next cycle (projected)":"The "+r.cy.year+" cycle"}</h4><p>${esc(r.cy.note)}</p></div>`
    :`<div class="glass tl-item" data-case="${r.c.id}"><div class="d">${r.c.date} · ${r.c.id}</div><h4>${esc(r.c.title)}</h4><p>📍 ${esc(locById[r.c.loc]?.name||r.c.loc)} · <span class="st ${r.c.status}">${r.c.status}</span></p></div>`).join("");
}

/* ---------- clues search ---------- */
function clueIndex(){
  const out=[];ALL.forEach(c=>{out.push({c,text:c.desc,kind:"Statement"});(c.evidence||[]).forEach(e=>out.push({c,text:e,kind:"Evidence"}))});return out;
}
function hi(text,q){if(!q)return esc(text);const t=esc(text);const words=q.split(/\s+/).filter(Boolean).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));return words.length?t.replace(new RegExp("("+words.join("|")+")","gi"),"<mark>$1</mark>"):t}
function filteredCases(){
  const q=state.q.toLowerCase().trim();
  return ALL.filter(c=>{
    if(state.loc&&c.loc!==state.loc)return false;
    if(state.year&&String(cycleOf(yearOf(c)))!==state.year&&String(yearOf(c))!==state.year)return false;
    for(const t of state.tags)if(!c.tags.includes(t))return false;
    if(q){const hay=[c.id,c.title,c.desc,c.witness,c.date,locById[c.loc]?.name,...c.tags,...(c.evidence||[])].join(" ").toLowerCase();return q.split(/\s+/).every(w=>hay.includes(w))}
    return true});
}
function renderClues(){
  const fc=new Set(filteredCases().map(c=>c.id));const q=state.q.trim();
  let rows=clueIndex().filter(r=>fc.has(r.c.id));
  if(q){const ws=q.toLowerCase().split(/\s+/);const m=rows.filter(r=>ws.some(w=>r.text.toLowerCase().includes(w)));if(m.length)rows=m}
  $("#clueResults").innerHTML=rows.slice(0,60).map(r=>`<div class="glass clue" data-case="${r.c.id}"><div class="src">${r.kind.toUpperCase()} · ${r.c.id} · ${esc(locById[r.c.loc]?.name||"")}</div><p>${hi(r.text,q)}</p></div>`).join("")||'<p class="empty glass">No clues match. Derry is good at hiding things — try fewer filters.</p>';
  $("#detectOut").textContent=`${fc.size} case${fc.size===1?"":"s"} match. Run the detector to connect them.`;
}
function runDetector(){
  const list=filteredCases();const pats=detectPatterns(list);const p=$("#patterns");
  p.hidden=false;
  p.innerHTML=`<h3>🔍 ${pats.length} pattern${pats.length===1?"":"s"} found in ${list.length} cases</h3>`+(pats.map(x=>`<div class="pat"><b>${esc(x.title)}</b><p class="det-out">${esc(x.body)}</p><div class="ids">${x.ids.map(i=>`<button data-case="${i}">${i}</button>`).join("")}</div></div>`).join("")||'<p class="det-out">Not enough overlap in this selection. Widen the filters.</p>');
  $("#detectOut").textContent=`Detector linked ${pats.reduce((n,x)=>n+x.ids.length,0)} case references into ${pats.length} patterns.`;
  p.scrollIntoView({behavior:"smooth",block:"nearest"});
}

/* ---------- filters / form setup ---------- */
function setupControls(){
  const locOpts=DW.LOCATIONS.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("");
  $("#fLoc").insertAdjacentHTML("beforeend",locOpts);$("#formLoc").innerHTML=locOpts;
  const years=[...new Set(DW.CYCLES.map(c=>c.year).filter(y=>y<2043))];
  $("#fYear").insertAdjacentHTML("beforeend",years.map(y=>`<option value="${y}">${y} cycle</option>`).join("")+'<option value="2026">2026 (recent)</option>');
  $("#tagRow").innerHTML=DW.TAGS.map(t=>`<button class="tag" data-tag="${esc(t.id)}">${t.icon} ${esc(t.id)}</button>`).join("");
  $("#tagPick").insertAdjacentHTML("beforeend",DW.TAGS.map(t=>`<label><input type="checkbox" name="tags" value="${esc(t.id)}"> ${t.icon} ${esc(t.id)}</label>`).join(""));
  $("#reportForm").date.value=new Date().toISOString().slice(0,10);
}
let qT;$("#q").addEventListener("input",e=>{clearTimeout(qT);qT=setTimeout(()=>{state.q=e.target.value;renderClues()},120)});
$("#fLoc").addEventListener("change",e=>{state.loc=e.target.value;renderClues()});
$("#fYear").addEventListener("change",e=>{state.year=e.target.value;renderClues()});
$("#tagRow").addEventListener("click",e=>{const b=e.target.closest(".tag");if(!b)return;const t=b.dataset.tag;state.tags.has(t)?state.tags.delete(t):state.tags.add(t);b.classList.toggle("on");renderClues()});
$("#detectBtn").addEventListener("click",runDetector);
$("#heroDetect").addEventListener("click",e=>{e.preventDefault();$("#clues").scrollIntoView({behavior:"smooth"});setTimeout(runDetector,450)});
$("#statusSeg").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$$("#statusSeg button").forEach(x=>x.classList.toggle("on",x===b));state.status=b.dataset.s;renderCases()});
$("#cycleBar").addEventListener("click",e=>{const c=e.target.closest(".cy");if(!c)return;const v=c.dataset.cy==="recent"?"recent":+c.dataset.cy;state.cycle=state.cycle===v?null:v;renderTimeline()});
document.addEventListener("click",e=>{
  if(e.target.closest("#modal"))return;
  const pin=e.target.closest("[data-loc]");if(pin){openLocation(pin.dataset.loc);return}
  const cc=e.target.closest("[data-case]");if(cc){openCase(cc.dataset.case)}
});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.closest&&e.target.closest("[data-go]")&&window.balloonGo){e.preventDefault();window.balloonGo(e.target.closest("[data-go]").dataset.go);return}if(e.key!=="Enter"&&e.key!==" ")return;const t=e.target.closest&&e.target.closest(".pin,.case");if(!t)return;e.preventDefault();t.dataset.loc?openLocation(t.dataset.loc):openCase(t.dataset.case)});


function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,3200)}
DW.toast=toast;
$("#reportForm").addEventListener("submit",e=>{
  e.preventDefault();const f=e.target;const fd=new FormData(f);
  const tags=fd.getAll("tags");const y=(fd.get("date")||"").slice(0,4);
  const n=String(userCases.length+1).padStart(3,"0");
  const c=DW.addCase({id:`DRY-${y}-U${n}`,title:fd.get("title").trim(),date:fd.get("date"),loc:fd.get("loc"),status:"Open",witness:(fd.get("witness")||"").trim()||"Anonymous",desc:fd.get("desc").trim(),evidence:["Filed by a citizen through Derry Incident Watch"],tags:tags.length?tags:["sewer voices"]});
  const L=links(c.id);
  $("#formMsg").textContent=`Filed as ${c.id}. Pattern detector found ${L.length} linked case${L.length===1?"":"s"}.`;
  toast(`📁 ${c.id} added to the board`);f.reset();f.date.value=new Date().toISOString().slice(0,10);
  setTimeout(()=>openCase(c.id),500);
});
DW.addCase=function(c){c.user=true;c.evidence=c.evidence||[];c.tags=c.tags||[];userCases.push(c);saveUser(userCases);rebuild();DW.renderAll();return c};
DW.clearReports=function(){userCases=[];saveUser([]);rebuild();DW.renderAll()};

$("#balloon").addEventListener("click",()=>{const c=ALL.filter(x=>x.tags.includes("red balloon"));const r=c[Math.floor(Math.random()*c.length)];toast("🎈 It floated toward "+(locById[r.loc]?.name||"the drains")+"…");setTimeout(()=>openCase(r.id),900)});

DW.renderAll=function(){renderStats();renderMap();renderCases();renderTimeline();renderClues();(DW.hooks||[]).forEach(h=>{try{h()}catch(e){}})};
DW.hooks=DW.hooks||[];

/* ---------- fog canvas (light, pauses when hidden) ---------- */
(function fog(){
  const cv=$("#fog");if(!cv)return;const ctx=cv.getContext("2d");
  const small=matchMedia("(max-width:640px)").matches,reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
  const N=small?10:18;let W,H,P=[],run=true;
  const dpr=1;
  function size(){W=cv.width=innerWidth*dpr;H=cv.height=innerHeight*dpr}
  size();addEventListener("resize",size,{passive:true});
  // pre-render one soft puff
  const pc=document.createElement("canvas");pc.width=pc.height=256;const p=pc.getContext("2d");
  const g=p.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,"rgba(210,190,240,.22)");g.addColorStop(1,"rgba(210,190,240,0)");p.fillStyle=g;p.fillRect(0,0,256,256);
  for(let i=0;i<N;i++)P.push({x:Math.random()*W,y:H*(.45+Math.random()*.6),s:(200+Math.random()*380)*dpr,v:(.08+Math.random()*.25)*(Math.random()<.5?-1:1),o:.4+Math.random()*.6});
  function draw(){ctx.clearRect(0,0,W,H);P.forEach(q=>{q.x+=q.v;if(q.x<-q.s)q.x=W+q.s/2;if(q.x>W+q.s)q.x=-q.s/2;ctx.globalAlpha=q.o;ctx.drawImage(pc,q.x-q.s/2,q.y-q.s/2,q.s,q.s*.6)})}
  function loop(){if(!run)return;draw();requestAnimationFrame(loop)}
  if(reduce)draw();else loop();
  document.addEventListener("visibilitychange",()=>{run=!document.hidden&&!reduce;if(run)loop()});
})();

setupControls();rebuild();DW.renderAll();
})();

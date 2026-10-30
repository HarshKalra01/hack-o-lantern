/* Balloon Nav — "Lost a Limb" twist: there is no nav bar. A floating red balloon opens a radial "where to?" menu.
   Config: window.BALLOON_NAV = {items:[{href:"#map",label:"Map",icon:"🗺️",key:"1"}...], side:"right"} before this script. Keys 0-9 jump too. */
(function(){
  var cfg=window.BALLOON_NAV||{items:[]}, items=cfg.items, inFrame=false;
  try{inFrame=window.self!==window.top}catch(e){inFrame=true}
  var side=cfg.side||(inFrame?"left":"right");
  var css='.bn-wrap{position:fixed;bottom:18px;'+side+':18px;z-index:9000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'+
  '.bn-btn{position:relative;width:62px;height:76px;border:0;background:none;cursor:pointer;padding:0;animation:bnBob 3.2s ease-in-out infinite;-webkit-tap-highlight-color:transparent}'+
  '.bn-btn i{position:absolute;left:3px;top:0;width:56px;height:66px;border-radius:50% 50% 48% 48%/55% 55% 45% 45%;background:radial-gradient(circle at 32% 28%,#ff9a9a,#e01b33 45%,#7a0614);box-shadow:0 0 26px rgba(224,27,51,.6),inset -6px -8px 14px rgba(0,0,0,.25)}'+
  '.bn-btn i::after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-5px;border:5px solid transparent;border-bottom:7px solid #a30d20;transform:rotate(180deg)}'+
  '.bn-btn b{position:absolute;left:0;right:0;top:20px;color:#fff;font-size:11px;font-weight:800;letter-spacing:.5px;text-shadow:0 1px 2px rgba(0,0,0,.5);pointer-events:none}'+
  '.bn-btn s{position:absolute;left:31px;top:72px;width:1px;height:40px;background:linear-gradient(#ddd,transparent);text-decoration:none}'+
  '@keyframes bnBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}'+
  '.bn-menu{position:absolute;'+side+':31px;bottom:40px;width:0;height:0}'+
  '.bn-item{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;color:#fff;font-size:22px;line-height:1;'+
   'background:linear-gradient(135deg,rgba(155,92,255,.55),rgba(255,138,42,.35));border:1px solid rgba(255,255,255,.35);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 6px 20px rgba(0,0,0,.45);'+
   'transform:translate(0,0) scale(.2);opacity:0;pointer-events:none;transition:transform .32s cubic-bezier(.2,1.4,.4,1),opacity .2s}'+
  '.bn-item small{font-size:9.5px;font-weight:700;margin-top:3px;white-space:nowrap;text-shadow:0 1px 2px #000}'+
  '.bn-item kbd{position:absolute;top:-4px;right:-4px;font:700 9px ui-monospace,monospace;background:#ff8a2a;color:#1a0b00;border-radius:6px;padding:1px 4px}'+
  '.bn-open .bn-item{opacity:1;pointer-events:auto}'+
  '.bn-item:hover,.bn-item:focus{outline:none;border-color:#fff;box-shadow:0 0 0 3px rgba(255,138,42,.6)}'+
  '.bn-tip{position:absolute;bottom:84px;'+side+':0;white-space:nowrap;font-size:11px;color:#efe7f7;background:rgba(20,10,30,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);padding:4px 8px;border-radius:8px;opacity:.9;transition:opacity .3s}'+
  '.bn-open .bn-tip{opacity:0}'+
  '.bn-scrim{position:fixed;inset:0;z-index:8999;background:rgba(5,2,10,.35);display:none}.bn-scrim.on{display:block}'+
  '@media (hover:none){.bn-item kbd{display:none}}@media (prefers-reduced-motion:reduce){.bn-btn{animation:none}.bn-item{transition:none}}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var scrim=document.createElement('div');scrim.className='bn-scrim';
  var w=document.createElement('div');w.className='bn-wrap';
  w.innerHTML='<div class="bn-menu" role="menu">'+items.map(function(it){return '<a class="bn-item" role="menuitem" href="'+it.href+'" data-bn="'+it.href+'" aria-label="'+it.label+' (key '+it.key+')">'+it.icon+'<small>'+it.label+'</small>'+(it.key?'<kbd>'+it.key+'</kbd>':'')+'</a>'}).join('')+'</div>'+
   '<div class="bn-tip">'+(cfg.tip||'tap the balloon · keys '+items[0].key+'–'+items[items.length-1].key)+'</div>'+
   '<button class="bn-btn" aria-haspopup="true" aria-expanded="false" aria-label="Where to? Open the balloon menu"><i></i><b>WHERE<br>TO?</b><s></s></button>';
  document.body.appendChild(scrim);document.body.appendChild(w);
  var btn=w.querySelector('.bn-btn'),els=[].slice.call(w.querySelectorAll('.bn-item')),open=false;
  var n=els.length,R=n>6?210:n>5?165:145,a0=side==='right'?180:0,a1=side==='right'?270:-90;
  function place(on){els.forEach(function(el,i){var t=(a0+(a1-a0)*(n===1?0:i/(n-1)))*Math.PI/180;var x=Math.cos(t)*R,y=Math.sin(t)*R;
    el.style.transform=on?'translate('+x+'px,'+y+'px) scale(1)':'translate(0,0) scale(.2)';el.style.transitionDelay=on?(i*30)+'ms':'0ms';el.tabIndex=on?0:-1})}
  function toggle(v){open=v===undefined?!open:v;w.classList.toggle('bn-open',open);scrim.classList.toggle('on',open);btn.setAttribute('aria-expanded',open);place(open);if(open&&els[0])setTimeout(function(){els[0].focus({preventScroll:true})},60)}
  function go(href){var t=href==='#top'?document.getElementById('top')||document.body:document.querySelector(href);if(!t)return;
    if(window.__lenis){window.__lenis.scrollTo(t,{duration:1.6})}else{t.scrollIntoView({behavior:'smooth',block:'start'})}
    if(history.replaceState)history.replaceState(null,'',href)}
  window.balloonGo=go;
  btn.addEventListener('click',function(){toggle()});
  scrim.addEventListener('click',function(){toggle(false)});
  els.forEach(function(el){el.addEventListener('click',function(e){e.preventDefault();toggle(false);go(el.dataset.bn)})});
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a.trail,[data-go]');if(!a)return;var h=a.getAttribute('href')||a.dataset.go;if(h&&h.charAt(0)==='#'){e.preventDefault();go(h)}},true);
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&open)return toggle(false);
    var tg=e.target&&e.target.tagName;if(/INPUT|TEXTAREA|SELECT/.test(tg)||e.metaKey||e.ctrlKey||e.altKey)return;
    for(var i=0;i<items.length;i++)if(items[i].key===e.key){e.preventDefault();toggle(false);go(items[i].href);return}
  });
  place(false);
})();

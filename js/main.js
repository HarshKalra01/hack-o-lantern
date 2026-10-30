/* Hack-O'-Lantern · Pennywise: The Dilemma — main interactions
   Audio files live in assets/audio (fixed names, swap freely — see README). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const isTouch = matchMedia('(hover: none)').matches;
  // phones / touch-first / small screens get the light build (native scroll, fewer critters, no heavy CSS effects)
  const LITE = !!window.HOL_LITE || document.documentElement.classList.contains('lite') || (!/[?&]q=2/.test(location.search) && (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 760));
  if (LITE) document.documentElement.classList.add('lite');

  /* ================= AUDIO ================= */
  const AUDIO_DIR = 'assets/audio/';
  const FILES = ['music', 'drone', 'drips', 'musicbox', 'scream', 'clown-scream', 'giggle', 'creak', 'pop', 'secret', 'whoosh',
    'voice-come-down', 'voice-see-you', 'voice-sleep', 'voice-stopped-scared', 'voice-lonely',
    'voice-choice', 'voice-fed', 'voice-free'];
  // Sounds load after the gate (phones download nothing up front; desktops prefetch the small files idly).
  // The music streams through an <audio> element instead of being decoded whole; the short effects are
  // decoded a few at a time, ambience first, so entering the site never waits on audio.
  const STREAM = ['music'];
  const ORDER = ['drone', 'drips', 'musicbox', 'giggle', 'clown-scream', 'scream', 'whoosh', 'creak', 'pop',
    'voice-come-down', 'voice-see-you', 'voice-sleep', 'voice-stopped-scared', 'voice-lonely', 'voice-choice', 'voice-fed', 'voice-free', 'secret'];
  const PREFETCH = {};
  const fetchBuf = n => PREFETCH[n] || (PREFETCH[n] = fetch(AUDIO_DIR + n + '.mp3').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }));
  if (!LITE) { const idle = window.requestIdleCallback || (f => setTimeout(f, 1500)); idle(() => ORDER.slice(0, 9).forEach(n => fetchBuf(n).catch(() => {}))); }
  const SFX = {
    ctx: null, master: null, buffers: {}, els: {}, loops: {}, muted: false, ready: false, voiceBusy: false,
    async init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        // unlock (iOS): play a silent buffer inside the gesture
        const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.master); s.start(0);
        if (this.ctx.state === 'suspended') await this.ctx.resume();
      } catch (e) { this.ctx = null; }
      // decode the short sounds in the background, 3 at a time (no blocking the entry)
      this.pending = {};
      if (this.ctx) {
        const q = ORDER.slice(); const ctx = this.ctx;
        const next = () => { const n = q.shift(); if (!n) return;
          this.pending[n] = fetchBuf(n).then(ab => new Promise((ok, no) => ctx.decodeAudioData(ab.slice(0), ok, no)))
            .then(b => { this.buffers[n] = b; }, () => {}).finally(next); };
        next(); next(); next();
      }
      this.ready = true;
    },
    // lazy <audio> fallback (file://, no Web Audio, or a sound that is not decoded yet)
    el(name) { let a = this.els[name]; if (!a) { a = new Audio(AUDIO_DIR + name + '.mp3'); a.preload = 'auto'; this.els[name] = a; } return a; },
    play(name, { vol = 1, rate = 1 } = {}) {
      if (this.muted) return null;
      if (this.ctx && this.buffers[name]) {
        const src = this.ctx.createBufferSource(); const g = this.ctx.createGain();
        src.buffer = this.buffers[name]; src.playbackRate.value = rate; g.gain.value = vol;
        src.connect(g).connect(this.master); src.start();
        return { src, g, duration: src.buffer.duration / rate };
      }
      if (!FILES.includes(name)) return null;
      const el = this.el(name);
      const c = el.cloneNode(); c.volume = Math.min(1, vol); c.playbackRate = rate; c.play().catch(() => {});
      return { el: c, duration: el.duration || 3 };
    },
    loop(name, vol) {
      if (this.loops[name]) return;
      if (this.ctx && STREAM.includes(name)) {
        // streamed: <audio> -> Web Audio gain (so fades, ducking and mute still work, incl. iOS)
        try {
          const el = new Audio(AUDIO_DIR + name + '.mp3'); el.loop = true; el.preload = 'auto';
          const src = this.ctx.createMediaElementSource(el), g = this.ctx.createGain(); g.gain.value = 0;
          src.connect(g).connect(this.master); el.play().catch(() => {});
          g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 3);
          this.loops[name] = { g, vol, media: el }; return;
        } catch (e) { /* fall through to the plain element */ }
      }
      if (this.ctx && !this.buffers[name] && this.pending && this.pending[name]) {
        this.loops[name] = { g: null, vol, waiting: true };
        this.pending[name].then(() => { const l = this.loops[name]; if (l && l.waiting) { delete this.loops[name]; if (this.buffers[name]) this.loop(name, l.vol); } });
        return;
      }
      if (this.ctx && this.buffers[name]) {
        const src = this.ctx.createBufferSource(); const g = this.ctx.createGain();
        src.buffer = this.buffers[name]; src.loop = true; g.gain.value = 0;
        src.connect(g).connect(this.master); src.start();
        g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 3);
        this.loops[name] = { g, vol };
      } else if (FILES.includes(name)) {
        const el = this.el(name); el.loop = true; el.volume = vol; el.play().catch(() => {});
        this.loops[name] = { el, vol };
      }
    },
    loopVol(name, vol, t = 2) {
      const l = this.loops[name]; if (!l) return; l.vol = vol;
      if (l.waiting) return;
      if (l.g) { l.g.gain.cancelScheduledValues(this.ctx.currentTime); l.g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + t); }
      else if (l.el) l.el.volume = vol;
    },
    voice(name) {
      if (this.muted || this.voiceBusy) return;
      const h = this.play(name, { vol: 1 });
      if (!h) return;
      this.voiceBusy = true;
      // duck the score + music box under the voice
      this.duck((h.duration || 4) + 0.3);
      setTimeout(() => { this.voiceBusy = false; }, (h.duration || 4) * 1000 + 300);
    },
    duck(sec) {
      ['music', 'musicbox'].forEach(n => { const l = this.loops[n]; if (!l) return; const base = l.base ?? l.vol; l.base = base; this.loopVol(n, base * 0.25, 0.25); l.vol = base; });
      clearTimeout(this._duckT);
      this._duckT = setTimeout(() => ['music', 'musicbox'].forEach(n => { const l = this.loops[n]; if (l) this.loopVol(n, l.base ?? l.vol, 1.5); }), sec * 1000);
    },
    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
      Object.values(this.loops).forEach(l => { if (l.el) l.el.muted = m; });
    }
  };
  window.HOL = { SFX, entered: false, toast };

  /* ================= GATE ================= */
  const gate = $('#gate');
  async function enter(muted) {
    if (window.HOL.entered) return;
    window.HOL.entered = true;
    gate.classList.add('gone');
    document.body.classList.remove('locked');
    await SFX.init();
    if (muted) { SFX.setMuted(true); $('#muteBtn').textContent = '🔇'; }
    SFX.loop('music', 0.55);
    SFX.loop('drone', 0.3);
    SFX.loop('drips', 0.3);
    SFX.loop('musicbox', 0.1);
    SFX.play('giggle', { vol: 0.8 });
    startAmbientLife();
    if (window.__lenis) window.__lenis.start();
    window.dispatchEvent(new Event('hol:entered'));
  }
  $('#enterBtn').addEventListener('click', () => enter(false));
  $('#enterSilent').addEventListener('click', () => enter(true));
  $('#muteBtn').addEventListener('click', () => {
    if (!window.HOL.entered) return;
    SFX.setMuted(!SFX.muted);
    $('#muteBtn').textContent = SFX.muted ? '🔇' : '🔊';
    toast(SFX.muted ? 'Sound off. He can still hear you.' : 'Sound on. Welcome back.');
  });

  /* ================= TOAST ================= */
  let toastT;
  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  /* ================= FLASHLIGHT CURSOR ================= */
  // vars live on the flashlight / wall elements (not :root, which would restyle the whole page), applied once per frame,
  // with the wall's rect read before any write (no forced layout)
  const flEl = $('#flashlight'), wallEl = $('#wall');
  function setLight(x, y) {
    let r = null;
    if (wallEl) { r = wallEl.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) r = null; }
    if (flEl) { flEl.style.setProperty('--mx', x + 'px'); flEl.style.setProperty('--my', y + 'px'); }
    if (r) { wallEl.style.setProperty('--lx', (x - r.left) + 'px'); wallEl.style.setProperty('--ly', (y - r.top) + 'px'); }
  }
  let lightQ = null;
  const queueLight = (x, y) => { if (!lightQ) requestAnimationFrame(() => { setLight(lightQ[0], lightQ[1]); lightQ = null; }); lightQ = [x, y]; };
  addEventListener('pointermove', e => queueLight(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) queueLight(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; if (t) queueLight(t.clientX, t.clientY); }, { passive: true });
  if (isTouch) { const w = $('#wall'); if (w) w.style.setProperty('--r', '110px'); }

  /* ================= SCROLL: depth, voices, jumpscares ================= */
  const depthVal = $('#depthVal'), depthFill = $('#depthFill');
  // one scroll pass per frame: all layout reads first (incl. the jumpscare triggers), then the writes
  const fadeProse = $('.fade-prose');
  let lastDepth = -1, scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    const fpTop = fadeProse ? fadeProse.getBoundingClientRect().top : 0;
    checkScares();
    const d = Math.round(p * 27);
    if (d !== lastDepth) { lastDepth = d; depthVal.textContent = d + 'm'; }
    depthFill.style.transform = 'scaleY(' + p.toFixed(3) + ')';
    // the drone grows as you go deeper
    const dv = Math.round((0.22 + p * 0.4) * 50) / 50;
    if (SFX.loops.drone && SFX.loops.drone.vol !== dv && !document.body.classList.contains('ending-free')) SFX.loopVol('drone', dv, 0.5);
    if (fadeProse) { const f = fpTop < innerHeight * 0.35; if (f !== fadeProse.classList.contains('faded')) fadeProse.classList.toggle('faded', f); }
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });

  // Voice lines: each section plays its line once when it is well into view
  const voiced = new Set();
  const vio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const n = en.target.dataset.voice;
      if (en.isIntersecting && window.HOL.entered && !voiced.has(en.target)) {
        voiced.add(en.target);
        setTimeout(() => SFX.voice(n), 600);
      }
    });
  }, { threshold: 0.45 });
  $$('[data-voice]').forEach(s => vio.observe(s));

  // Story beats drive the 3D clown's actions (tilt, wave, balloon, crouch...)
  window.HOL.beat = 'face';
  const beatSfx = { tilt: ['creak', 0.7], wave: ['giggle', 0.6], balloon: ['pop', 0.0], crouch: ['creak', 0.5] };
  const bio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const b = en.target.dataset.beat;
      if (b && b !== window.HOL.beat) {
        window.HOL.beat = b;
        const s = beatSfx[b]; if (s && s[1] > 0 && window.HOL.entered) SFX.play(s[0], { vol: s[1] });
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  $$('[data-beat]').forEach(s => bio.observe(s));

  // Jumpscares: once each, at the trigger markers
  const scared = new Set();
  const jsEl = $('#jumpscare');
  function jumpscare(kind = 'scream') {
    if (window.HOL_CLOWN) window.HOL_CLOWN.lunge();
    SFX.duck(2.5);
    SFX.play(kind, { vol: 1 });
    setTimeout(() => { jsEl.classList.remove('on'); void jsEl.offsetWidth; jsEl.classList.add('on'); }, 260);
    if (navigator.vibrate) navigator.vibrate([120, 40, 200]);
    setTimeout(() => jsEl.classList.remove('on'), 1160);
  }
  window.HOL.jumpscare = jumpscare;
  // checked on every scroll (robust to fast flings): fire each trigger once, at least 3 s apart
  const triggers = $$('.js-trigger');
  triggers.forEach(t => { t.style.cssText = 'width:1px;height:1px;'; });
  let lastScare = 0;
  function checkScares() {
    if (!window.HOL.entered) return;
    for (const t of triggers) {
      if (scared.has(t)) continue;
      if (t.getBoundingClientRect().top < innerHeight * 0.5 && performance.now() - lastScare > 3000) {
        scared.add(t); lastScare = performance.now();
        jumpscare(t.dataset.scare === '1' ? 'clown-scream' : 'scream');
        break;
      }
    }
  }
  setInterval(() => { if (!document.hidden) checkScares(); }, 500);   // safety net; the per-frame scroll pass above does the work

  // Whoosh on each chapter title
  const tio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && window.HOL.entered) { SFX.play('whoosh', { vol: 0.35 }); tio.unobserve(e.target); }
  }), { threshold: 0.9 });
  $$('.chap-title').forEach(t => tio.observe(t));

  /* ================= GSAP REVEALS ================= */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.chap-title').forEach(el => gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 88%' }, y: 60, opacity: 0, skewY: 3, duration: 1.4, ease: 'expo.out'
    }));
    gsap.utils.toArray('.panel, .prose p, .side, .big-q, .choice-btns').forEach(el => gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 90%' }, y: 40, opacity: 0, duration: 1.2, ease: 'power2.out'
    }));
    gsap.to('.hero-copy', { scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: LITE ? 0.3 : 1.2 }, yPercent: -30, opacity: 0.1, ease: 'none' });
    if (LITE) ScrollTrigger.config({ ignoreMobileResize: true });
    // Lenis smooth scrolling on desktop, driven by GSAP's ticker so ScrollTrigger stays in sync.
    // Phones keep native (momentum) scrolling: Lenis on touch feels laggy.
    if (window.Lenis && !LITE) {
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
      window.__lenis = lenis; lenis.stop();
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 2.2 }); } }));
    }
  }

  /* ================= BALLOONS ================= */
  const balloonsEl = $('#balloons');
  const popLines = ['pop!', 'that one had a name on it...', 'he heard that', 'one less', 'do NOT pop the next one', '🎈→💀', 'he ties them himself'];
  let popped = 0;
  function spawnBalloon(fast) {
    if (balloonsEl.children.length > (LITE ? (fast ? 14 : 4) : (fast ? 30 : 6))) return;
    const b = document.createElement('div');
    b.className = 'balloon';
    b.innerHTML = '<div class="b"></div><div class="s"></div>';
    b.style.left = rand(4, 92) + 'vw';
    b.style.setProperty('--sx', rand(-60, 60) + 'px');
    const dur = fast ? rand(6, 10) : rand(16, 26);
    b.style.animationDuration = dur + 's';
    const sc = rand(0.65, 1.15); b.firstChild.style.transform = `scale(${sc})`;
    b.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (b.classList.contains('popped')) return;
      const r = b.getBoundingClientRect();
      b.style.transform = getComputedStyle(b).transform; b.classList.add('popped');
      SFX.play('pop', { vol: 0.9, rate: rand(0.9, 1.15) });
      popped++;
      const t = document.createElement('div'); t.className = 'pop-txt';
      t.textContent = popLines[Math.floor(Math.random() * popLines.length)];
      t.style.left = (r.left) + 'px'; t.style.top = (r.top) + 'px';
      document.body.appendChild(t); setTimeout(() => t.remove(), 1600);
      if (Math.random() < 0.18) setTimeout(() => SFX.play('giggle', { vol: 0.7 }), 400);
      if (popped === 13) { toast('13 balloons popped. He is keeping count.'); SFX.play('creak'); }
      setTimeout(() => b.remove(), 300);
    });
    b.addEventListener('animationend', () => b.remove());
    balloonsEl.appendChild(b);
  }

  /* ================= BATS / SPIDERS / DROPS ================= */
  const critters = $('#critters');
  const batSVG = '<svg viewBox="0 0 100 50"><path fill="currentColor" d="M50 18c3-6 5-8 5-8l2 6c6-1 9 2 9 2s9-12 34-8c-10 4-14 12-14 20-6-4-13-3-17 3-3-4-7-5-9-2-2-3-6-2-9 2-4-6-11-7-17-3 0-8-4-16-14-20 25-4 34 8 34 8s3-3 9-2l2-6s2 2 5 8z"/></svg>';
  function spawnBat() {
    const b = document.createElement('div'); b.className = 'bat'; b.innerHTML = batSVG;
    const ltr = Math.random() < 0.5, y0 = rand(5, 60), y1 = y0 + rand(-25, 25), s = rand(0.6, 1.4);
    critters.appendChild(b);
    const anim = b.animate([
      { transform: `translate(${ltr ? -80 : innerWidth + 80}px, ${y0}vh) scale(${s})` },
      { transform: `translate(${innerWidth / 2}px, ${(y0 + y1) / 2 - 10}vh) scale(${s * 1.2})` },
      { transform: `translate(${ltr ? innerWidth + 80 : -80}px, ${y1}vh) scale(${s})` }
    ], { duration: rand(3500, 7000), easing: 'ease-in-out' });
    anim.onfinish = () => b.remove();
  }
  function spawnSpider() {
    const s = document.createElement('div'); s.className = 'spider';
    s.style.left = rand(8, 92) + 'vw'; s.style.setProperty('--h', rand(12, 45) + 'vh');
    critters.appendChild(s); setTimeout(() => s.remove(), 9200);
  }
  const drops = $('#drops');
  function spawnDrop() {
    const d = document.createElement('div'); d.className = 'drop';
    d.style.left = rand(0, 100) + 'vw'; d.style.animationDuration = rand(1.2, 2.4) + 's';
    drops.appendChild(d); d.addEventListener('animationend', () => d.remove());
  }

  function startAmbientLife() {
    spawnBalloon(); setTimeout(spawnBat, 2500);
    // phones: fewer critters on screen at once
    const crit = $('#critters');
    setInterval(() => { if (!document.hidden) spawnBalloon(); }, LITE ? 6000 : 4200);
    setInterval(() => { if (!document.hidden && Math.random() < 0.6 && (!LITE || crit.children.length < 2)) spawnBat(); }, LITE ? 9000 : 6500);
    setInterval(() => { if (!document.hidden && Math.random() < 0.5 && (!LITE || crit.children.length < 2)) spawnSpider(); }, LITE ? 16000 : 11000);
    setInterval(() => { if (!document.hidden && (!LITE || drops.children.length < 6)) spawnDrop(); }, LITE ? 1400 : 700);
    (function creak() {
      setTimeout(() => { if (!document.hidden) SFX.play(Math.random() < 0.7 ? 'creak' : 'giggle', { vol: rand(0.25, 0.5), rate: rand(0.85, 1.1) }); creak(); }, rand(14000, 28000));
    })();
  }

  /* ================= DRAIN EYES EASTER EGG ================= */
  let eyeClicks = 0;
  $$('.wall-eyes').forEach(eyes => eyes.addEventListener('click', () => {
    eyeClicks++;
    SFX.play('giggle', { vol: 0.5 + eyeClicks * 0.2, rate: 1 + eyeClicks * 0.05 });
    if (eyeClicks === 3) {
      eyeClicks = 0;
      toast('He likes you. Have some balloons. 🎈');
      for (let i = 0; i < 14; i++) setTimeout(() => spawnBalloon(true), i * 120);
    }
  }));

  /* ================= KONAMI CODE ================= */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = (k === KONAMI[kpos]) ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; secret(); }
  });
  // mobile secret: tap the code on the tunnel wall 5 times
  let codeTaps = 0; const codeMsg = $('.msg.code');
  if (codeMsg) { codeMsg.style.pointerEvents = 'auto'; codeMsg.addEventListener('click', () => { if (++codeTaps >= 5) { codeTaps = 0; secret(); } }); }
  function secret() {
    if (!window.HOL.entered) return;
    $('#secret').classList.add('on'); document.body.classList.add('clown-mode');
    SFX.play('secret', { vol: 1 });
    for (let i = 0; i < 20; i++) setTimeout(() => spawnBalloon(true), i * 100);
  }
  $('#secretClose').addEventListener('click', () => $('#secret').classList.remove('on'));

  /* ================= THE CHOICE ================= */
  const choice = $('#choice'), ending = $('#ending');
  function showEnding(kind) {
    choice.classList.add('decided');
    document.body.classList.remove('ending-fed', 'ending-free');
    ending.classList.remove('show', 'fed', 'free');
    if (kind === 'fed') {
      jumpscare('clown-scream');
      setTimeout(() => SFX.voice('voice-fed'), 1000);
      SFX.loopVol('drone', 0.9, 1); SFX.loopVol('musicbox', 0.0, 1); SFX.loopVol('music', 0.8, 1);
      document.body.classList.add('ending-fed');
      ending.innerHTML = `<h3>He Feeds.</h3>
        <p>You lean over the grate and let him have it: every nightmare, every shadow on the stairs. The drains of Derry roar like a stomach.</p>
        <p>Down below, the clown grows tall and strong and grinning. He will sleep well this time. Twenty-seven years.</p>
        <p><em>But somewhere under all that fear, he's still alone. Monsters always are.</em></p>
        <button class="btn-ghost again">↺ try the other ending</button>`;
    } else {
      SFX.voice('voice-free');
      SFX.loopVol('drone', 0.08, 3); SFX.loopVol('drips', 0.1, 3); SFX.loopVol('music', 0.15, 3); SFX.loopVol('musicbox', 0.35, 3);
      document.body.classList.add('ending-free');
      for (let i = 0; i < 9; i++) setTimeout(() => spawnBalloon(true), i * 260);
      ending.innerHTML = `<h3>He Rests.</h3>
        <p>You sit down by the drain. You don't scream. You just talk: about school, about the rain, about nothing.</p>
        <p>The glowing eyes go soft. The stitched grin loosens into something almost like a smile. Piece by piece, like paint flaking off in the rain, the clown fades. No hunger. No hiding. For the first time in centuries, someone stayed.</p>
        <p><em>The next morning, every red balloon in Derry floats away into the sky. None of them have names on them.</em></p>
        <button class="btn-ghost again">↺ try the other ending</button>`;
    }
    ending.className = 'ending ' + kind;
    requestAnimationFrame(() => ending.classList.add('show'));
    ending.querySelector('.again').addEventListener('click', () => {
      choice.classList.remove('decided'); ending.classList.remove('show'); ending.innerHTML = '';
      document.body.classList.remove('ending-fed', 'ending-free');
      SFX.loopVol('drone', 0.3); SFX.loopVol('drips', 0.3); SFX.loopVol('musicbox', 0.1); SFX.loopVol('music', 0.55);
    });
    window.dispatchEvent(new CustomEvent('hol:ending', { detail: kind }));
  }
  $('#feedBtn').addEventListener('click', () => showEnding('fed'));
  $('#freeBtn').addEventListener('click', () => showEnding('free'));

  onScroll();
})();

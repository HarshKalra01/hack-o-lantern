/* Hack-O'-Lantern · procedural 3D clown (original design)
   chalk-white greasepaint face · red nose · wide toothy grin · orange side tufts · amber glowing eyes
   pale grey-blue puffy suit with puffed sleeves · big layered ruff · three red pom-poms
   Eyes + head follow the cursor (or finger). Point at him and he SCREAMS. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const canvas = document.getElementById('clown3d');
const wrap = document.getElementById('stage3d');
const flash = document.getElementById('clownFlash');
const SCREAM_SOUND = 'clown-scream';   // assets/audio/clown-scream.mp3 (swap the file to change his scream)
const COOLDOWN = 2.4;                   // seconds between screams

/* ---------- renderer / scene ---------- */
// phones get a lighter build: lower pixel ratio, lower-poly head, fewer particles, softer bloom, no shadows
// LITE = any touch-first or small screen (most phones/tablets): no post-processing, no shadows, Lambert materials,
// pixel ratio 1, capped particles, lower-poly meshes, the lighter fan model, throttled raycasts and idle frame-skipping.
// Quality then steps down further on its own if the first seconds run under 45 fps. (?q=2 forces full, ?q=1 lite, ?q=0 lowest)
const QS = new URLSearchParams(location.search).get('q');
const LITE_DEVICE = !!window.HOL_LITE || document.documentElement.classList.contains('lite') || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 760;
let QUALITY = QS !== null && /^[012]$/.test(QS) ? +QS : (LITE_DEVICE ? 1 : 2);
const IS_PHONE = QUALITY < 2;
const SEG = IS_PHONE ? 0.5 : 1;
const SG = n => IS_PHONE ? Math.max(8, Math.round(n * 0.5)) : n;   // segment counts for small parts on phones
const LAMBERT_KEYS = ['color', 'map', 'emissive', 'emissiveIntensity', 'emissiveMap', 'transparent', 'opacity', 'side', 'alphaTest', 'depthWrite', 'name'];
function liteMat(p = {}) { const q = {}; for (const k of LAMBERT_KEYS) if (p[k] !== undefined) q[k] = p[k]; return new THREE.MeshLambertMaterial(q); }
const PHYS = p => IS_PHONE ? liteMat(p) : new THREE.MeshPhysicalMaterial(p);
const STD = p => IS_PHONE ? liteMat(p) : new THREE.MeshStandardMaterial(p);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_PHONE, powerPreference: 'high-performance', stencil: false });
let PR = IS_PHONE ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = IS_PHONE ? 1.0 : 0.92;   // phones: no bloom, so a touch more exposure
renderer.shadowMap.enabled = !IS_PHONE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020403);
scene.fog = new THREE.FogExp2(0x030806, 0.032);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 120);
camera.position.set(0, 0.45, 3.0);

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const k = IS_PHONE && w >= 512 ? 0.5 : 1;
  const c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g2 = c.getContext('2d'); if (k !== 1) g2.scale(k, k);
  draw(g2, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = IS_PHONE ? 1 : 8; return t;
}
function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const R = seeded(1337);
function drawCracks(ctx, w, h, color, width, n) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let x = R() * w, y = h * (0.15 + R() * 0.7), a = R() * Math.PI * 2;
    const len = 6 + Math.floor(R() * 16);
    for (let j = 0; j < len; j++) {
      const nx = x + Math.cos(a) * (8 + R() * 22), ny = y + Math.sin(a) * (8 + R() * 22);
      ctx.lineWidth = width * (1 - j / len) + 0.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      if (R() < 0.25) { // branch
        const ba = a + (R() - 0.5) * 2.2; ctx.lineWidth *= 0.6;
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(ba) * 26, ny + Math.sin(ba) * 26); ctx.stroke();
      }
      x = nx; y = ny; a += (R() - 0.5) * 1.1;
    }
  }
}
const porcelainMap = canvasTex(2048, 1024, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#f4f3ef'); grd.addColorStop(0.5, '#fbfaf7'); grd.addColorStop(1, '#e6e3db');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${90 + R() * 60},${80 + R() * 50},${60 + R() * 40},${R() * 0.05})`; g.fillRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 6); }
  // grime toward the bottom (sewer water stains)
  for (let i = 0; i < 70; i++) { const x = R() * w, y = h * (0.45 + R() * 0.5); g.fillStyle = 'rgba(60,70,40,0.06)'; g.fillRect(x, y, 3 + R() * 8, 40 + R() * 220); }
  // chalky greasepaint: powdery speckle + a few faint hairline creases (no porcelain cracks)
  for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
  drawCracks(g, w, h, 'rgba(70,60,55,0.12)', 1.0, 18);
});
const porcelainBump = canvasTex(2048, 1024, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.35})`; g.fillRect(R() * w, R() * h, 2, 2); }
}, false);
const stripeTex = canvasTex(512, 512, (g, w, h) => {
  const n = 12; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#e8e2d2' : '#0d0b0b'; g.fillRect(i * w / n, 0, w / n + 1, h); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(30,20,10,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 2, 2 + R() * 10); }
});
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
const stockingTex = canvasTex(256, 256, (g, w, h) => {
  const n = 10; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#7a0614' : '#0b0a0b'; g.fillRect(0, i * h / n, w, h / n + 1); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.25})`; g.fillRect(R() * w, R() * h, 3, 3); }
});
stockingTex.wrapS = stockingTex.wrapT = THREE.RepeatWrapping; stockingTex.repeat.set(2, 3);
const suitTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#aab5c2'; g.fillRect(0, 0, w, h);
  // soft vertical folds + woven speckle + a little sewer grime at the hem
  for (let x = 0; x < w; x += 2) { const v = Math.sin(x * 0.07) * 10 + Math.sin(x * 0.023) * 8; g.fillStyle = `rgba(${v > 0 ? 255 : 20},${v > 0 ? 255 : 30},${v > 0 ? 255 : 50},${Math.abs(v) / 120})`; g.fillRect(x, 0, 2, h); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '30,40,60'},${R() * 0.08})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(50,60,40,0.07)'; g.fillRect(R() * w, h * (0.75 + R() * 0.25), 4 + R() * 10, 20 + R() * 60); }
});
suitTex.wrapS = suitTex.wrapT = THREE.RepeatWrapping; suitTex.repeat.set(2, 1);
const harlequinTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#120f12'; g.fillRect(0, 0, w, h);
  const s = 64; for (let y = 0; y < h / s * 2; y++) for (let x = 0; x < w / s; x++) {
    if ((x + y) % 2) continue; const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s / 2;
    g.fillStyle = (x + Math.floor(y / 2)) % 3 === 0 ? '#5e0a12' : '#2a2a30';
    g.beginPath(); g.moveTo(cx, cy - s / 2); g.lineTo(cx + s / 2, cy); g.lineTo(cx, cy + s / 2); g.lineTo(cx - s / 2, cy); g.fill();
  }
});
harlequinTex.wrapS = harlequinTex.wrapT = THREE.RepeatWrapping; harlequinTex.repeat.set(3, 2);
const brickTex = canvasTex(1024, 512, (g, w, h) => {
  g.fillStyle = '#0b0d0a'; g.fillRect(0, 0, w, h);
  const bw = 128, bh = 48;
  for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw; x++) {
    const ox = (y % 2) * bw / 2, v = 22 + R() * 22;
    g.fillStyle = `rgb(${v + 8},${v + 10},${v})`; g.fillRect(x * bw + ox + 4, y * bh + 4, bw - 8, bh - 8);
    if (R() < 0.35) { g.fillStyle = 'rgba(40,80,40,0.25)'; g.fillRect(x * bw + ox + 4, y * bh + 4 + R() * 20, bw - 8, 30); }
  }
});
brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping; brickTex.repeat.set(10, 3);
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});

/* ---------- materials ---------- */
const porcelain = PHYS({ map: porcelainMap, bumpMap: porcelainBump, bumpScale: 0.004, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.6, emissive: 0x15151a, emissiveIntensity: 1 });  // chalk-white greasepaint
const black = STD({ color: 0x050405, roughness: 0.6 });
const lidMat = porcelain.clone(); lidMat.side = THREE.DoubleSide;
const socketMat = STD({ color: 0x4a3640, roughness: 0.9 });
const mouthMat = STD({ color: 0x1a0003, roughness: 0.7, side: THREE.BackSide, emissive: 0x200003 });
const toothMat = PHYS({ color: 0xd9cfae, roughness: 0.3, clearcoat: 0.6 });
const threadMat = STD({ color: 0xcfc2bb, roughness: 0.2, transparent: true, opacity: 0.55 });  // drool strands
const noseMat = PHYS({ color: 0xb0001a, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4, emissive: 0x2a0004 });
const hatMat = STD({ map: stripeTex, roughness: 0.85 });
const hatBand = STD({ color: 0x6a0010, roughness: 0.5 });
const hairMat = STD({ color: 0xd8561c, roughness: 0.8, emissive: 0x2a0a00 });
const coatMat = PHYS({ color: 0xc8d6f0, map: suitTex, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xdfe8ff) });
const ruffA = PHYS({ color: 0xe9e6de, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
const ruffB = PHYS({ color: 0xb9c3cf, roughness: 0.65, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
const pomMat = STD({ color: 0xc0101e, roughness: 1, emissive: 0x220003 });
const collarW = PHYS({ color: 0xd8d0bf, roughness: 0.5, clearcoat: 0.3 });
const collarB = PHYS({ color: 0x0c0a0c, roughness: 0.45, clearcoat: 0.3 });
const collarR = PHYS({ color: 0x8a0012, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xff4060) });
const lipMat = PHYS({ color: 0xd0081c, roughness: 0.35, clearcoat: 0.8, emissive: 0x3a0006 });
const stockingMat = STD({ map: stockingTex, roughness: 0.8 });
const gloveMat = PHYS({ color: 0xebe8e0, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
const shoeMat = PHYS({ color: 0x0a0809, roughness: 0.25, clearcoat: 1 });
const buttonMat = PHYS({ color: 0x7a0010, roughness: 0.2, clearcoat: 1, emissive: 0x1a0003 });
const eyeL = STD({ color: 0x000000, emissive: 0xffa514, emissiveIntensity: 3 });
const eyeR = PHYS({ color: 0xe9d68a, roughness: 0.15, clearcoat: 1, emissive: 0xb07000, emissiveIntensity: 1.1 });
const pupilR = STD({ color: 0xff0a20, emissive: 0xff0a20, emissiveIntensity: 3 });
const pupilL = STD({ color: 0x000000, roughness: 0.2 });

/* ---------- the head (deformed sphere, split at the mouth for a hinged jaw) ---------- */
const SX = 0.95, SY = 1.22, SZ = 0.98;
function deform(geo) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y = v.y;
    let sx = SX * (1 - Math.max(0, -y) * 0.32 + Math.max(0, y - 0.3) * 0.05); // narrow, pointed chin
    let sz = SZ * (1 - Math.max(0, -y - 0.5) * 0.25);
    // gaunt cheeks: pinch the sides just below the cheekbones
    const cheek = Math.exp(-((y + 0.25) ** 2) / 0.02) * 0.06 * (Math.abs(v.x) > 0.5 ? 1 : 0);
    const dome = Math.max(0, y - 0.15);           // high, bulbous greasepaint forehead
    v.x *= sx * (1 - cheek) * (1 + dome * 0.1); v.z *= sz * (1 + dome * 0.06); v.y *= SY * (1 + dome * 0.16);
    // brow ridge
    if (v.z > 0.4 && y > 0.15 && y < 0.38) v.z += 0.04 * Math.sin((y - 0.15) / 0.23 * Math.PI);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
const CUT = 0.655 * Math.PI;            // mouth line (polar angle)
const mouthY = Math.cos(CUT) * SY;       // ≈ -0.59
// point on the (deformed) face surface for given unit-sphere x,y (front)
function face(xu, yu, out = 1) {
  const zu = Math.sqrt(Math.max(0, 1 - xu * xu - yu * yu));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([xu, yu, zu], 3));
  deform(g); const a = g.attributes.position;
  return new THREE.Vector3(a.getX(0) * out, a.getY(0) * out, a.getZ(0) * out);
}

const clown = new THREE.Group(); scene.add(clown);
const hips = new THREE.Group(); hips.position.set(0, -4.0, 0); clown.add(hips);
const torsoG = new THREE.Group(); hips.add(torsoG);
const headPivot = new THREE.Group(); headPivot.position.set(0, 4.55, 0); torsoG.add(headPivot);
const head = new THREE.Group(); headPivot.add(head);

const skull = new THREE.Mesh(deform(new THREE.SphereGeometry(1, 128 * SEG, 96 * SEG, 0, Math.PI * 2, 0, CUT)), porcelain);
skull.castShadow = true; head.add(skull);
// jaw: pivots near the ears so the mouth drops open
const jawPivot = new THREE.Group(); jawPivot.position.set(0, mouthY + 0.05, -0.35); head.add(jawPivot);
const jaw = new THREE.Mesh(deform(new THREE.SphereGeometry(1, 128 * SEG, 48 * SEG, 0, Math.PI * 2, CUT, Math.PI - CUT)), porcelain);
jaw.position.set(0, -(mouthY + 0.05), 0.35); jawPivot.add(jaw);
// dark mouth cavity, seen only when the jaw opens
const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.86, SG(48), SG(32)), mouthMat);
cavity.scale.set(SX * 0.95, SY * 0.9, SZ * 0.9); head.add(cavity);
const throatGlow = new THREE.PointLight(0xff1530, 0, 2.2); throatGlow.position.set(0, mouthY - 0.05, 0.3); head.add(throatGlow);

// teeth: needle-thin, uneven
function teethRow(parent, up, offsetY, toLocal) {
  const n = 15;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), xu = (t - 0.5) * 1.05;
    const yu = Math.cos(CUT) + (up ? -0.02 : 0.02);
    const p = face(xu, yu, 0.94);
    const len = 0.1 + Math.abs(Math.sin(i * 12.9898)) * 0.17 * (1 - Math.abs(t - 0.5));
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022 + (i % 3) * 0.006, len, 6), toothMat);
    tooth.position.copy(p).add(new THREE.Vector3(0, up ? len / 2 : -len / 2, 0));
    if (!up) tooth.rotation.z = Math.PI;
    tooth.rotation.x += (Math.sin(i * 7.3) * 0.25); tooth.rotation.z += Math.sin(i * 3.1) * 0.15;
    if (toLocal) toLocal(tooth);
    parent.add(tooth);
  }
}
teethRow(head, false, 0);
teethRow(jaw, true, 0);

// wide red greasepaint grin: big upturned lips curling into the cheeks, crowded with teeth
const lipPts = [];
for (let i = 0; i <= 48; i++) { const t = i / 48, xu = (t - 0.5) * 1.42; const yu = Math.cos(CUT) + 0.025 + Math.pow(Math.abs(xu) / 0.71, 2.4) * 0.3; lipPts.push(face(xu, yu, 1.012)); }
const lipCurve = new THREE.CatmullRomCurve3(lipPts);
const lip = new THREE.Mesh(new THREE.TubeGeometry(lipCurve, 96, 0.042, 10), lipMat); head.add(lip);
for (let i = 0; i < 17; i++) {
  const t = 0.1 + i / 16 * 0.8, p = lipCurve.getPointAt(t), mid = 1 - Math.abs(t - 0.5) * 2;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.075 + mid * 0.025, 0.13 + mid * 0.07 + (i % 3) * 0.02, 0.035), toothMat);
  tooth.position.copy(p).add(new THREE.Vector3(0, -0.08 - mid * 0.035, 0.0)); tooth.rotation.z = Math.sin(i * 5.3) * 0.12;
  tooth.lookAt(tooth.position.clone().add(p.clone().setY(0).normalize())); tooth.rotateZ(Math.sin(i * 5.3) * 0.12); head.add(tooth);
}
// drool strands across the open mouth (they stretch, then snap when he screams)
const threads = [];
for (let i = 0; i < 6; i++) {
  const xu = -0.38 + i * 0.152;
  const a = face(xu, Math.cos(CUT) + 0.03, 0.995), b = face(xu, Math.cos(CUT) - 0.03, 0.995);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 4), threadMat);
  head.add(m); threads.push({ m, a, bLocal: jaw.worldToLocal ? b.clone() : b, snapped: false, snapAt: 0.18 + Math.random() * 0.2 });
}

// eye sockets + mismatched eyes
const eyes = [];
for (const side of [-1, 1]) {
  const ec = face(0.34 * side, 0.2, 1.0);
  const socket = new THREE.Mesh(new THREE.SphereGeometry(0.2, SG(32), SG(24)), socketMat);
  socket.scale.set(0.95, 0.85, 0.14); socket.position.copy(ec).add(new THREE.Vector3(0, 0, -0.03));
  socket.rotation.z = side * -0.25; head.add(socket);
  const eyeG = new THREE.Group(); eyeG.position.copy(ec).add(new THREE.Vector3(0, 0, -0.06)); head.add(eyeG);
  const isLeft = side < 0;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(isLeft ? 0.125 : 0.115, SG(32), SG(24)), isLeft ? eyeL : eyeR);
  eyeG.add(ball);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(isLeft ? 0.04 : 0.028, 16, 12), isLeft ? pupilL : pupilR);
  pupil.scale.set(isLeft ? 0.55 : 1, isLeft ? 1.5 : 1, 0.5);
  pupil.position.set(0, 0, 0.115); eyeG.add(pupil);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: isLeft ? 0xffb030 : 0xff6a10, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: isLeft ? 0.6 : 0.3 }));
  halo.scale.setScalar(isLeft ? 0.42 : 0.26); halo.position.z = 0.08; halo.visible = false; eyeG.add(halo);
  const light = new THREE.PointLight(isLeft ? 0xffa020 : 0xff7020, isLeft ? 0.9 : 0.35, 1.6); light.position.z = 0.25; if (!IS_PHONE) eyeG.add(light);   // phones: emissive eyes + halos carry the glow
  // heavy greasepaint lids slanting in toward the nose: the menacing squint
  const lid = new THREE.Mesh(new THREE.SphereGeometry(isLeft ? 0.15 : 0.14, SG(32), SG(16), 0, Math.PI * 2, 0, Math.PI * 0.5), lidMat);
  lid.position.copy(eyeG.position); lid.rotation.order = 'ZXY'; lid.rotation.z = side * 0.45; lid.rotation.x = -0.18; head.add(lid);
  const lash = new THREE.Mesh(new THREE.TorusGeometry(isLeft ? 0.15 : 0.14, 0.014, 6, 32, Math.PI), STD({ color: 0x24080c, roughness: 0.7 }));
  lash.position.copy(eyeG.position); lash.rotation.order = 'ZXY'; lash.rotation.z = side * 0.45; lash.rotation.x = -0.18 - Math.PI / 2; head.add(lash);
  eyes.push({ g: eyeG, ball, pupil, halo, light, isLeft });
}
// thin, high-arched painted brows (sinister surprise)
for (const side of [-1, 1]) {
  const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(face(side * (0.14 + t * 0.4), 0.36 + Math.sin(t * Math.PI) * 0.16 - t * 0.02, 1.006)); }
  head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.024, 5), STD({ color: 0x3a0a10, roughness: 0.6 })));
}
// nose
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.17, SG(40), SG(30)), noseMat);
nose.position.copy(face(0, -0.08, 1.0)).add(new THREE.Vector3(0, 0, 0.07)); nose.castShadow = true; head.add(nose);

// bald greasepaint dome with big tufts of orange hair bursting out at the sides
const crown = skull, brim = nose;   // (hit targets; he no longer wears a hat)
{
  const RH = seeded(77), NT = IS_PHONE ? 70 : 140;
  const clumps = [];
  for (const side of [-1, 1]) for (const [a, y, r] of [[1.05, 0.55, 0.28], [1.35, 0.3, 0.3], [1.55, 0.72, 0.24], [1.75, 0.08, 0.22], [2.0, 0.5, 0.22], [1.2, 0.85, 0.2]]) clumps.push({ side, a, y, r });
  const dir = new THREE.Vector3();
  for (let i = 0; i < NT; i++) {
    const c = clumps[i % clumps.length];
    const a = c.side * (c.a + (RH() - 0.5) * 0.35), y = c.y + (RH() - 0.5) * c.r;
    const len = 0.28 + RH() * 0.42, rad = 0.035 + RH() * 0.03;
    const s = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 5), hairMat);
    const base = new THREE.Vector3(Math.sin(a) * SX * 0.93, y * SY, Math.cos(a) * SZ * 0.9);
    dir.set(Math.sin(a) * 1.0 + (RH() - 0.5) * 0.7, 0.45 + RH() * 0.7, Math.cos(a) * 0.35 + (RH() - 0.5) * 0.5).normalize();
    s.position.copy(base).addScaledVector(dir, len * 0.42);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    s.userData.base = s.rotation.z; head.add(s);
  }
  // a few wispy strands on top of the bald dome
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.35, 4), hairMat);
    s.position.set((i - 2) * 0.12, SY * 1.3, 0.05); s.rotation.set(0.3, 0, (i - 2) * 0.35 + 0.1); s.userData.base = s.rotation.z; head.add(s);
  }
}

// neck + big layered ruff collar (three rings of pleated frills)
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.9, 24), porcelain); neck.position.y = 3.05; torsoG.add(neck);
const collar = new THREE.Group(); collar.position.y = 2.78; torsoG.add(collar);
{
  const petalGeo = new THREE.SphereGeometry(1, IS_PHONE ? 12 : 18, IS_PHONE ? 8 : 10);
  [[1.22, 0.0, 30, 0.5, ruffA], [1.02, 0.16, 26, 0.42, ruffB], [0.8, 0.3, 22, 0.34, ruffA]].forEach(([rr, y, n, sz, mat], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i + ring * 0.5) / n * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, mat);
      petal.castShadow = !IS_PHONE && ring === 0;
      petal.position.set(Math.cos(a) * rr, y + Math.sin(i * 2.3) * 0.035 + (i % 2 ? 0.05 : -0.05), Math.sin(a) * rr);
      petal.rotation.order = 'YXZ'; petal.rotation.y = -a + Math.PI / 2; petal.rotation.x = 0.25 + ring * 0.12; petal.rotation.z = (i % 2 ? 0.25 : -0.25);
      petal.scale.set(sz * 0.42, sz * 0.5, sz * 1.25); collar.add(petal);
    }
  });
}

// puffy, baggy one-piece suit (lathe profile with soft fabric folds)
const prof = [[0.05, -1.4], [0.98, -1.3], [1.08, -0.7], [1.0, 0.1], [0.98, 0.9], [1.08, 1.7], [1.0, 2.35], [0.55, 2.75], [0.05, 2.82]].map(([r, y]) => new THREE.Vector2(r, y));
const coatGeo = new THREE.LatheGeometry(prof, IS_PHONE ? 40 : 64);
{ const p = coatGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), k = 1 + 0.03 * Math.sin(a * 14 + v.y * 0.8) + 0.02 * Math.sin(v.y * 5); p.setXYZ(i, v.x * k, v.y, v.z * k); }
  coatGeo.computeVertexNormals(); }
const coat = new THREE.Mesh(coatGeo, coatMat);
coat.scale.set(1.12, 1, 0.8); coat.castShadow = true; torsoG.add(coat);
// three fuzzy red pom-poms down the front
{
  const pg = new THREE.IcosahedronGeometry(1, IS_PHONE ? 2 : 3), p = pg.attributes.position, v = new THREE.Vector3(), RP = seeded(9);
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(0.85 + RP() * 0.3); p.setXYZ(i, v.x, v.y, v.z); }
  pg.computeVertexNormals();
  [[1.62, 0.25], [0.92, 0.25], [0.22, 0.24]].forEach(([y, r]) => {
    const b = new THREE.Mesh(pg, pomMat); b.scale.setScalar(r); b.castShadow = !IS_PHONE;
    b.position.set(0, y, 0.86 + r * 0.55); torsoG.add(b);
  });
}

// arms: big puffed sleeves, frilled wrist ruffs, white gloves
function ruffRing(parent, y, r, n, mat) {
  const g = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, m = new THREE.Mesh(g, i % 2 ? ruffA : (mat || ruffB));
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); m.rotation.order = 'YXZ'; m.rotation.y = -a + Math.PI / 2; m.rotation.x = -0.6;
    m.scale.set(0.07, 0.1, 0.2); parent.add(m); }
}
function makeArm(side) {
  const shoulder = new THREE.Group(); shoulder.position.set(side * 1.05, 2.15, 0); torsoG.add(shoulder);
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.46, SG(24), SG(16)), coatMat); pad.scale.set(1, 0.9, 0.95); pad.position.y = -0.1; shoulder.add(pad);
  const upper = new THREE.Mesh(new THREE.SphereGeometry(1, SG(20), SG(14)), coatMat); upper.scale.set(0.34, 0.72, 0.34); upper.position.y = -0.68; upper.castShadow = true; shoulder.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = -1.35; shoulder.add(elbow);
  const fore = new THREE.Mesh(new THREE.SphereGeometry(1, SG(20), SG(14)), coatMat); fore.scale.set(0.3, 0.66, 0.3); fore.position.y = -0.58; fore.castShadow = true; elbow.add(fore);
  ruffRing(elbow, -1.18, 0.2, IS_PHONE ? 10 : 14);
  const hand = new THREE.Group(); hand.position.y = -1.38; elbow.add(hand);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.2, SG(24), SG(16)), gloveMat); palm.scale.set(1, 1.2, 0.55); hand.add(palm);
  for (let f = 0; f < 4; f++) {
    const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26 + (f === 1 || f === 2 ? 0.08 : 0), 4, 8), gloveMat);
    fg.position.set((f - 1.5) * 0.1, -0.33, 0.02); fg.rotation.x = 0.25 + f * 0.05; fg.rotation.z = (f - 1.5) * 0.08; hand.add(fg);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 8), gloveMat); thumb.position.set(-side * 0.17, -0.1, 0.08); thumb.rotation.z = side * 0.9; hand.add(thumb);
  return { shoulder, elbow, hand, side };
}
const armR = makeArm(1), armL = makeArm(-1);

// legs: baggy suit trousers, ankle ruffs, big clown shoes
function makeLeg(side) {
  const hip = new THREE.Group(); hip.position.set(side * 0.42, -0.9, 0); hips.add(hip);
  const thigh = new THREE.Mesh(new THREE.SphereGeometry(1, SG(20), SG(14)), coatMat); thigh.scale.set(0.42, 0.85, 0.42); thigh.position.y = -0.72; thigh.castShadow = true; hip.add(thigh);
  const knee = new THREE.Group(); knee.position.y = -1.5; hip.add(knee);
  const shin = new THREE.Mesh(new THREE.SphereGeometry(1, SG(20), SG(14)), coatMat); shin.scale.set(0.36, 0.8, 0.36); shin.position.y = -0.66; shin.castShadow = true; knee.add(shin);
  ruffRing(knee, -1.32, 0.24, IS_PHONE ? 10 : 14);
  const foot = new THREE.Group(); foot.position.y = -1.48; knee.add(foot);
  const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.3, SG(32), SG(16)), shoeMat); shoe.scale.set(0.95, 0.5, 1.6); shoe.position.set(0, -0.05, 0.3); shoe.castShadow = true; foot.add(shoe);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), pomMat); pom.position.set(0, 0.12, 0.62); foot.add(pom);
  return { hip, knee, foot };
}
const legR = makeLeg(1), legL = makeLeg(-1);

// the red balloon he offers (appears at the balloon beat)
const balloonG = new THREE.Group(); scene.add(balloonG);
const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.55, SG(40), SG(30)), PHYS({ color: 0xc8001a, roughness: 0.15, clearcoat: 1, emissive: 0x3a0006, transmission: 0 }));
balloon.scale.set(1, 1.18, 1); balloonG.add(balloon);
const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 8), balloon.material); knot.position.y = -0.68; balloonG.add(knot);
const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -3, 0)]);
const stringLine = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.7 }));
scene.add(stringLine);

/* ---------- the sewer around him ---------- */
const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 90, SG(56), 1, true), STD({ map: brickTex, roughness: 0.95, side: THREE.BackSide, color: 0x8a9a88 }));
tunnel.rotation.x = Math.PI / 2; tunnel.position.set(0, 1, -12); scene.add(tunnel);
brickTex.repeat.set(14, 5);
const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 100), STD({ color: 0x06100a, roughness: 0.06, metalness: 0.9 }));
water.rotation.x = -Math.PI / 2; water.position.set(0, -7.02, -15); water.receiveShadow = true; scene.add(water);
const ledge = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 10), STD({ color: 0x1a1d18, roughness: 0.9, map: brickTex }));
ledge.position.set(0, -7.25, 0); ledge.receiveShadow = true; scene.add(ledge);
// the storm drain pipe (with something inside)
const drain = new THREE.Group(); drain.position.set(-5.2, -5.2, -2.6); drain.rotation.y = 0.5; scene.add(drain);
const pipeMat = STD({ color: 0x2b2f28, roughness: 0.6, metalness: 0.5 });
const pipeRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.3, 20, 48), pipeMat); drain.add(pipeRing);
const pipeTube = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 6, SG(40), 1, true), STD({ color: 0x050605, side: THREE.BackSide, roughness: 1 }));
pipeTube.rotation.x = Math.PI / 2; pipeTube.position.z = -3; drain.add(pipeTube);
for (let i = -3; i <= 3; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2 * Math.sqrt(1.7 ** 2 - (i * 0.45) ** 2), 8), pipeMat); bar.position.x = i * 0.45; bar.position.z = 0.1; bar.rotation.z = (i === 1 ? 0.25 : 0); drain.add(bar); }
const drainEyes = [];
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), STD({ color: 0xc8ff40, emissive: s < 0 ? 0xb0ff30 : 0xff2030, emissiveIntensity: 4 }));
  e.scale.y = 0.55; e.position.set(s * 0.32, 0.1, -1.6); drain.add(e); drainEyes.push(e);
}
const drainGlow = new THREE.PointLight(0x7dff4a, 3, 6); drainGlow.position.set(0, 0, -0.5); drain.add(drainGlow);

/* ---------- light ---------- */
scene.add(new THREE.AmbientLight(0x1a2a22, 0.35));
scene.add(new THREE.HemisphereLight(0x223a30, 0x200006, 0.25));
const key = new THREE.SpotLight(0xd6e4ff, 40, 50, 0.55, 0.6, 1.2); key.position.set(-4, 9, 9); key.target.position.set(0, -2, 0);
key.castShadow = true; key.shadow.mapSize.set(512, 512); key.shadow.bias = -0.0005; scene.add(key, key.target);
const faceLight = new THREE.SpotLight(0xffe8d0, 1.6, 12, 0.35, 0.8, 1.5); faceLight.position.set(1.5, 2.5, 6); faceLight.target.position.set(0, 0.5, 0); scene.add(faceLight, faceLight.target);
const under = new THREE.PointLight(0x44ff66, 26, 14, 1.4); under.position.set(0, -5.5, 3.5); scene.add(under);
const rim = new THREE.SpotLight(0xff1530, 160, 30, 0.7, 0.5, 1.1); rim.position.set(5, 3, -6); rim.target.position.set(0, -1, 0); scene.add(rim, rim.target);
const suitFill = new THREE.PointLight(0xcfdcff, 8, 14, 1.5); suitFill.position.set(1.5, -2.5, 5.5); scene.add(suitFill);
const rim2 = new THREE.SpotLight(0x30ff90, 70, 30, 0.7, 0.5, 1.1); rim2.position.set(-5, 1, -5); rim2.target.position.set(0, -1, 0); scene.add(rim2, rim2.target);

// volumetric-feeling light shafts from grates above
const shafts = [];
const shaftMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x9fd8b0) }, uI: { value: 0.12 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying vec3 vN;
    float h(float x){return fract(sin(x*91.3)*47453.5);}
    void main(){ float edge=pow(abs(vN.z),1.6); float fall=smoothstep(0.,1.,vUv.y);
      float bars=0.65+0.35*sin(vUv.x*60.+uTime*0.3); float flick=0.85+0.15*sin(uTime*7.)*h(floor(uTime*8.));
      gl_FragColor=vec4(uColor, edge*fall*bars*uI*flick); }`
});
for (let i = 0; i < 3; i++) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 3, 17, SG(32), 1, true), shaftMat);
  s.position.set(-4 + i * 4, 1.5, -4 - i * 2); s.rotation.z = (i - 1) * 0.18; scene.add(s); shafts.push(s);
}
// floating dust / spores
const NP = IS_PHONE ? 110 : 600, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP * 3);
for (let i = 0; i < NP; i++) { pp[i * 3] = (Math.random() - 0.5) * 24; pp[i * 3 + 1] = (Math.random() - 0.5) * 14 - 1.5; pp[i * 3 + 2] = (Math.random() - 0.5) * 22 - 2; }
pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const dust = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, size: 0.07, color: 0xbfffcf, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(dust);

/* ---------- post-processing: bloom + grain/vignette/chromatic ---------- */
// full quality only: phones render straight to the screen (no bloom/film passes); the scream's red flare is a DOM overlay there
let composer = null, bloom = null;
const filmPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uShift: { value: 0.0012 }, uRed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uShift; uniform float uRed; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233))+uTime)*43758.5453); }
    void main(){ vec2 d=vUv-.5; float r2=dot(d,d);
      vec2 off=d*uShift*(1.+r2*8.);
      vec3 c=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      c+= (rnd(vUv*vec2(1920.,1080.))-.5)*0.06;
      c*= smoothstep(0.9,0.2,r2*1.5);
      c = mix(c, c*vec3(1.6,0.35,0.35)+vec3(0.08,0.,0.), uRed);
      gl_FragColor=vec4(c,1.); }`
});
function buildComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.25, 0.95); composer.addPass(bloom);
  composer.addPass(filmPass);
  composer.addPass(new OutputPass());
}
if (QUALITY >= 2) buildComposer();
let redEl = null;
if (QUALITY < 2) {
  redEl = document.createElement('div');
  redEl.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,20,30,.18) 0%,rgba(120,0,8,.55) 100%)';
  wrap.appendChild(redEl);
}
let redOp = 0;

/* ---------- sizing ---------- */
let distK = 1, scrollMax = 1;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); if (composer) composer.setSize(w, h);
  scrollMax = document.documentElement.scrollHeight - h;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  distK = camera.aspect < 1 ? Math.min(2.1, 0.78 / camera.aspect) : 1;  // portrait phones: step back
}
addEventListener('resize', resize); resize();

/* ---------- scroll → camera path (close-up face → full body in the sewer) ---------- */
const KEYS = [
  [0.00, [0, 0.5, 3.75], [0, 0.42, 0]],
  [0.08, [0.3, 0.35, 5.0], [0, 0.32, 0]],
  [0.20, [1.6, -0.4, 8.5], [0, -0.5, 0]],
  [0.34, [-1.6, -1.2, 13], [0, -2.0, 0]],
  [0.50, [2.2, -1.6, 19], [-0.4, -2.4, 0]],
  [0.68, [-1.5, -2.4, 17], [-1.6, -3.4, -1]],
  [0.85, [1.5, -2.0, 16], [-1.4, -3.6, -1]],
  [1.00, [0, -1.0, 21], [-0.8, -2.6, 0]],
];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
// scroll height is cached (re-read on scroll/resize, outside the render loop) so frames never force a layout
let scrollYc = scrollY, covered = false, lastInput = performance.now();
function readScroll() {
  scrollYc = scrollY; scrollMax = document.documentElement.scrollHeight - innerHeight;
  // the 3D stage is hidden behind the opaque black of the dark zone / credits: stop rendering there
  let cov = false;
  for (const el of coverEls) { const r = el.getBoundingClientRect(), pad = r.height * (el.classList.contains('credits') ? 0.2 : 0.12); if (r.top + pad <= 0 && r.bottom - pad >= innerHeight) cov = true; }
  covered = cov;
}
const coverEls = Array.from(document.querySelectorAll('.dark-zone, .credits'));
let scrollQ = false;
addEventListener('scroll', () => { lastInput = performance.now(); if (!scrollQ) { scrollQ = true; requestAnimationFrame(() => { scrollQ = false; readScroll(); }); } }, { passive: true });
if (window.ResizeObserver) new ResizeObserver(() => { scrollMax = document.documentElement.scrollHeight - innerHeight; }).observe(document.body);
readScroll();
function scrollP() { const max = scrollMax; return max > 0 ? Math.min(1, Math.max(0, scrollYc / max)) : 0; }
function pathAt(p) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const [p0, a0, l0] = KEYS[i], [p1, a1, l1] = KEYS[i + 1];
  let t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0))); t = t * t * (3 - 2 * t);
  tgtPos.set(...a0).lerp(new THREE.Vector3(...a1), t);
  tgtLook.set(...l0).lerp(new THREE.Vector3(...l1), t);
  tgtPos.sub(tgtLook).multiplyScalar(distK).add(tgtLook);
}
pathAt(scrollP()); camPos.copy(tgtPos); camLook.copy(tgtLook);

/* ---------- input: cursor / touch ---------- */
const pointer = new THREE.Vector2(0, 0), target = new THREE.Vector2(0, 0);
let pointerFree = true;  // false while the pointer is over a text panel / button
const ray = new THREE.Raycaster();
const hitMeshes = [skull, jaw, nose, coat, ...eyes.map(e => e.ball)];
const classicHits = hitMeshes.slice();
const BLOCK = '.panel, button, a, .wall, #gate, #secret, .balloon, .credits, .hero-copy';
// moves are coalesced: the latest position is applied once per rendered frame (no per-event DOM work)
let pendingPtr = null, pointerMoved = false;
function applyPointer(cx, cy, el) {
  pointer.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  pointerFree = !(el && el.closest && el.closest(BLOCK));
  pointerMoved = true;
}
function setPointer(cx, cy, el) { lastInput = performance.now(); applyPointer(cx, cy, el); pendingPtr = null; }
function queuePointer(cx, cy, el) { lastInput = performance.now(); if (pendingPtr) { pendingPtr[0] = cx; pendingPtr[1] = cy; pendingPtr[2] = el; } else pendingPtr = [cx, cy, el]; }
addEventListener('pointermove', e => queuePointer(e.clientX, e.clientY, e.target), { passive: true });
addEventListener('pointerdown', e => { setPointer(e.clientX, e.clientY, e.target); checkHover(true); }, { passive: true });
// touch: the finger is the cursor; tap or hold a finger on him to make him scream
let touching = false;
addEventListener('touchstart', e => { const t = e.touches[0]; if (t) { touching = true; setPointer(t.clientX, t.clientY, e.target); checkHover(true); } }, { passive: true });
addEventListener('touchmove', e => { const t = e.touches[0]; if (t) queuePointer(t.clientX, t.clientY, e.target); }, { passive: true });
addEventListener('touchend', () => { touching = false; }, { passive: true });

/* ---------- actions ---------- */
let scream = 0, screamT = -99, now = performance.now() / 1000, hovering = false, lungeT = -99, lunge = 0;
function checkHover(force) {
  if (!pointerFree || !(window.HOL && window.HOL.entered)) { hovering = false; return; }
  pointerMoved = false;
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(hitMeshes, false).length > 0;
  if (hit && (!hovering || force || touching)) triggerScream(true);
  hovering = hit;
}
function triggerScream(withSound) {
  if (now - screamT < COOLDOWN) return false;
  screamT = now;
  const H = window.HOL;
  if (withSound && H && H.SFX && H.entered) { H.SFX.duck && H.SFX.duck(2); H.SFX.play(SCREAM_SOUND, { vol: 1, rate: 0.95 + Math.random() * 0.1 }); }
  if (navigator.vibrate) navigator.vibrate(180);
  flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 380);
  return true;
}
const lungeFrom = new THREE.Vector3(), lungeTo = new THREE.Vector3();
window.HOL_CLOWN = {
  scream: () => { screamT = -99; triggerScream(true); },
  lunge: () => { lungeT = now; screamT = now; },   // the page plays the jumpscare sound itself
  debug: () => ({ model: modelMode, clown: clown.position.toArray(), cam: camera.position.toArray(), look: camLook.toArray(), lunge, pose: { ...pose }, distK })
};


/* ---------- optional custom model slot ----------
   Put your own clown.glb in assets/models/ and set "model": "clown.glb" in assets/models/config.json.
   It replaces the procedural clown (auto-centred and scaled), keeps the scroll camera, turns toward
   the cursor and reacts to the scream with a pulse, red flare and shake. */
let custom = null, customHit = null, customBase = 1, modelMode = 'classic', modelCfg = null, customSettled = false;
// The fan model is always the clown. The procedural clown stays hidden while the GLB loads and only
// appears as an automatic fallback if the file fails to load (or config.json sets "model": null).
try { localStorage.removeItem('hol-model'); } catch (e) {}   // old Classic/Fan choice from the removed switch
clown.visible = false;
function setModelMode(m) {
  if (m === 'fan' && !custom) m = 'classic';
  modelMode = m;
  clown.visible = m === 'classic';
  if (custom) custom.visible = m === 'fan';
  hitMeshes.length = 0;
  if (m === 'fan') hitMeshes.push(customHit);   // one invisible box instead of raycasting the skinned meshes
  else hitMeshes.push(...classicHits);
}
fetch('assets/models/config.json').then(r => r.ok ? r.json() : null).then(cfg => {
  modelCfg = cfg;
  if (!cfg || !cfg.model) { setModelMode('classic'); customSettled = true; return; }
  const draco = new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  // phones load the lighter copy (hair/ruff simplified, ~60k instead of ~230k triangles); falls back to the full one
  const file = IS_PHONE && cfg.mobileModel ? cfg.mobileModel : cfg.model;
  const onErr = err => {
    if (file !== cfg.model && !onErr.retried) { onErr.retried = true; loader.load('assets/models/' + cfg.model, onLoad, undefined, onErr); return; }
    setModelMode('classic'); customSettled = true; console.info('Fan model not loaded, using the procedural clown:', err && err.message);
  };
  const onLoad = gltf => {
    const m = gltf.scene;
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = !IS_PHONE; o.receiveShadow = !IS_PHONE; o.frustumCulled = false;
      if (IS_PHONE && o.material && !o.material.isMeshLambertMaterial) {
        const om = o.material;
        o.material = liteMat({ color: om.color, map: om.map, emissive: om.emissive, emissiveMap: om.emissiveMap, emissiveIntensity: om.emissiveIntensity, side: om.side, transparent: om.transparent, opacity: om.opacity, alphaTest: om.alphaTest, name: om.name });
        if (om.map) om.map.anisotropy = 1;
        om.dispose();
      }
    });
    m.updateMatrixWorld(true);
    // some fan rigs ship a part whose skin binding is broken (it flies off, huge, when posed):
    // bake that part's posed shape, then scale and seat it at the neck of the rest of the body
    {
      const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o); });
      const boxes = meshes.map(o => new THREE.Box3().setFromObject(o, true));
      meshes.forEach((o, i) => {
        const others = new THREE.Box3(); boxes.forEach((bx, j) => { if (j !== i) others.union(bx); });
        if (others.isEmpty()) return;
        const os = others.getSize(new THREE.Vector3()), c = boxes[i].getCenter(new THREE.Vector3()), sz = boxes[i].getSize(new THREE.Vector3());
        const grown = others.clone().expandByVector(os.clone().multiplyScalar(0.5));
        if (grown.containsPoint(c) && sz.x < os.x * 3) return;
        const g = o.geometry, pos = g.attributes.position, out = new Float32Array(pos.count * 3), v = new THREE.Vector3();
        const k = (os.x * 0.8) / Math.max(sz.x, 1e-6), neck = new THREE.Vector3(others.getCenter(v).x, others.min.y + os.y * 0.86, (others.min.z + others.max.z) / 2);
        const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
        for (let n = 0; n < pos.count; n++) {
          o.getVertexPosition(n, v); v.applyMatrix4(o.matrixWorld).sub(c).multiplyScalar(k).add(neck).applyMatrix4(inv);
          out[n * 3] = v.x; out[n * 3 + 1] = v.y; out[n * 3 + 2] = v.z;
        }
        const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(out, 3));
        for (const key of ['uv', 'normal']) if (g.attributes[key]) ng.setAttribute(key, g.attributes[key]);
        if (g.index) ng.setIndex(g.index); ng.computeVertexNormals();
        const p = new THREE.Mesh(ng, o.material); p.name = o.name + '_fixed'; p.frustumCulled = false; p.castShadow = o.castShadow;
        o.parent.remove(o); m.add(p);
      });
    }
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m, true), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    // scale so the head lands where the camera's close-up looks (~y 0.45) and the feet on the floor (y -7)
    customBase = (cfg.height || 8.2) / Math.max(size.y, 1e-6);
    const pivot = new THREE.Group();
    m.position.set(-ctr.x, -box.min.y, -ctr.z); pivot.add(m);
    if (cfg.rotateY) m.rotation.y = cfg.rotateY;
    // invisible hit box (head + torso) for the scream raycast
    pivot.updateMatrixWorld(true);
    { const lb = new THREE.Box3().setFromObject(pivot, true), ls = lb.getSize(new THREE.Vector3()), lc = lb.getCenter(new THREE.Vector3());
      customHit = new THREE.Mesh(new THREE.BoxGeometry(ls.x * 0.55, ls.y * 0.62, ls.z * 0.7), new THREE.MeshBasicMaterial({ visible: false }));
      customHit.position.set(lc.x, lb.min.y + ls.y * 0.66, lc.z); pivot.add(customHit); }
    custom = new THREE.Group(); custom.add(pivot); custom.scale.setScalar(customBase);
    scene.add(custom);
    setModelMode('fan');
    customSettled = true;
  };
  loader.load('assets/models/' + file, onLoad, undefined, onErr);
}).catch(() => { setModelMode('classic'); customSettled = true; });
function updateCustom(dt) {
  if (!custom || modelMode !== 'fan') return;
  custom.position.set(0, -7 + Math.sin(now * 1.1) * 0.03 - pose.crouch * 1.2, 0);
  if (lunge > 0.001) {
    const fwd = tmpA.copy(camLook).sub(camPos).normalize();
    const to = tmpB.copy(camPos).addScaledVector(fwd, 3.2).add(new THREE.Vector3(0, -7.45, 0));
    custom.position.lerp(to, lunge);
  }
  custom.rotation.y = target.x * 0.6 + pose.crouch * -0.55 + twitch;
  custom.rotation.x = -target.y * 0.12 + pose.crouch * 0.15 + lunge * 0.2;
  custom.rotation.z = pose.tilt * 0.25;
  custom.scale.setScalar(customBase * (1 + scream * 0.12 * (0.8 + Math.random() * 0.4)));
}

/* ---------- animate ---------- */
const clock = new THREE.Clock();
let ready = false, twitch = 0, twitchTo = 0, nextTwitch = 2, hoverTick = 0;
const pose = { tilt: 0, wave: 0, balloon: 0, crouch: 0 };
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), handW = new THREE.Vector3();
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- adaptive quality: measure the first ~2 s of real frames, step down while under 45 fps ---------- */
const perf = { phase: QS !== null ? 'done' : 'wait', t0: 0, frames: 0, steps: 0, log: [] };
window.HOL_PERF = perf;
function setQuality(q) {
  QUALITY = q;
  if (q < 2 && composer) { composer.dispose && composer.dispose(); composer = null; bloom = null;
    renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.isLight && o.shadow) o.castShadow = false; });
    if (!redEl) { redEl = document.createElement('div'); redEl.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,20,30,.18) 0%,rgba(120,0,8,.55) 100%)'; wrap.appendChild(redEl); } }
  PR = q >= 2 ? Math.min(devicePixelRatio, 1.5) : q === 1 ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 0.75);
  renderer.setPixelRatio(PR); resize();
  if (q < 1) { shafts.forEach(s => s.visible = false); dust.visible = false; }
}
function perfTick(t) {
  if (perf.phase === 'done') return;
  if (perf.phase === 'wait') {   // start once the clown (and the fan model, if any) is on screen
    if (ready && (customSettled || t > 9000)) { perf.phase = 'warm'; perf.t0 = t; }
    return;
  }
  if (perf.phase === 'warm') { if (t - perf.t0 > 500) { perf.phase = 'measure'; perf.t0 = t; perf.frames = 0; } return; }
  perf.frames++;
  const el = t - perf.t0;
  if (el >= 2000) {
    const fps = perf.frames * 1000 / el; perf.log.push({ q: QUALITY, fps: +fps.toFixed(1) });
    if (fps < 45 && QUALITY > (LITE_DEVICE ? 0 : 1) && perf.steps < 2) { perf.steps++; setQuality(QUALITY - 1); perf.phase = 'warm'; perf.t0 = t; }
    else perf.phase = 'done';
  }
}

let frameN = 0, lastRender = 0;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) { clock.getDelta(); return; }   // pause while the tab is hidden
  const tnow = performance.now();
  const entered = !!(window.HOL && window.HOL.entered);
  // skip frames nobody can see or that change nothing: behind the opaque gate (after the first seconds),
  // behind the black dark zone / credits, and (phones) ~30 fps while nothing is moving
  if (ready && perf.phase === 'done' && !entered && tnow - lastRender < 250) return;
  if (ready && covered && entered && tnow - lastRender < 500) return;
  if (IS_PHONE && ready && perf.phase === 'done' && entered && tnow - lastInput > 2500 && scream < 0.01 && lunge < 0.001 && tnow - lastRender < 30) return;
  lastRender = tnow;
  if (pendingPtr) { applyPointer(pendingPtr[0], pendingPtr[1], pendingPtr[2]); pendingPtr = null; }
  const dt = Math.min(clock.getDelta(), 0.1); now = tnow / 1000;
  const beat = (window.HOL && window.HOL.beat) || 'face';
  const damp = (rate) => 1 - Math.exp(-rate * dt);   // frame-rate independent smoothing
  for (const k in pose) pose[k] += ((beat === k ? 1 : 0) - pose[k]) * damp(1.8);

  // scream envelope
  const st = now - screamT;
  const s01 = st < 1.2 ? 1 : 0;
  scream += (s01 - scream) * Math.min(1, (s01 > scream ? 20 : 4.5) * dt);
  // lunge envelope: rush in, hold, retreat
  const lt = now - lungeT;
  const l01 = lt < 0 ? 0 : lt < 0.22 ? lt / 0.22 : lt < 0.95 ? 1 : lt < 2.2 ? 1 - (lt - 0.95) / 1.25 : 0;
  lunge = l01 * l01 * (3 - 2 * l01);

  // follow the pointer, with creepy twitches
  target.lerp(pointer, damp(4));
  if (now > nextTwitch) { twitchTo = (Math.random() - 0.5) * 0.35; nextTwitch = now + 1.8 + Math.random() * 3.5; }
  twitchTo *= Math.exp(-dt * 1.5); twitch += (twitchTo - twitch) * damp(9);
  const near = Math.max(0, Math.min(1, (camPos.distanceTo(camLook) - 3.5) / 5));  // calmer head turns in the close-up
  headPivot.rotation.y = target.x * (0.28 + 0.27 * near) + Math.sin(now * 0.6) * 0.04;
  headPivot.rotation.x = -0.2 - target.y * (0.16 + 0.16 * near) + Math.sin(now * 0.8) * 0.02 - scream * 0.25 + pose.crouch * -0.25;
  // the unnatural head tilt (with a little snap)
  headPivot.rotation.z = twitch + Math.sin(now * 0.45) * 0.05 + pose.tilt * (1.05 + Math.sin(now * 9) * 0.03 * (Math.sin(now * 1.3) > 0.8 ? 1 : 0)) + (Math.random() - 0.5) * 0.06 * scream;
  headPivot.position.z = scream * Math.min(0.4, Math.max(0, (camPos.distanceTo(camLook) - 3.2) * 0.12));

  // body: breathing, crouch by the drain, lean into lunges
  const breath = Math.sin(now * 1.1);
  hips.position.y = lerp(-4.0, -5.42, pose.crouch) + breath * 0.03;
  torsoG.rotation.x = 0.2 + pose.crouch * 0.3 + lunge * 0.35 + breath * 0.012;   // menacing hunch
  clown.rotation.y = pose.crouch * -0.55 + target.x * 0.12;
  torsoG.rotation.z = Math.sin(now * 0.5) * 0.02 + pose.tilt * -0.06;
  for (const [leg, side] of [[legR, 1], [legL, -1]]) {
    leg.hip.rotation.x = -1.3 * pose.crouch + (side > 0 ? 0.15 : 0) * pose.crouch;
    leg.knee.rotation.x = 2.0 * pose.crouch;
    leg.foot.rotation.x = -0.7 * pose.crouch;
    leg.hip.rotation.z = side * (0.04 + pose.crouch * 0.25);
  }
  // arms: rest → wave (right) / hold balloon (left) / reach on lunge
  const sway = Math.sin(now * 0.9) * 0.05;
  armR.shoulder.rotation.set(-0.45 * (1 - pose.wave) - lunge * 1.1 - pose.crouch * 0.4, 0, 0.22 + sway + pose.wave * 2.3);
  armR.elbow.rotation.set(-0.75 * (1 - pose.wave) - lunge * 0.2, 0, pose.wave * (0.35 + Math.sin(now * 3.2) * 0.45));
  armR.hand.rotation.set(0, pose.wave * Math.sin(now * 3.2) * 0.3, 0);
  armL.shoulder.rotation.set(-0.45 - lunge * 1.1 - pose.balloon * 0.8 - pose.crouch * 0.6, 0, -0.22 - sway - pose.balloon * 0.25);
  armL.elbow.rotation.set(-0.75 + pose.balloon * 0.2 - pose.crouch * 0.2, 0, 0);
  // creepy finger-crawl while idle
  armL.hand.rotation.z = Math.sin(now * 2.1) * 0.08;

  // lunge: carry the whole clown toward the camera
  if (lunge > 0.001) {
    // where is his face right now (pose + hunch included), relative to his feet?
    clown.position.set(0, 0, 0); clown.updateMatrixWorld(true);
    const headOff = headPivot.getWorldPosition(new THREE.Vector3());
    const fwd = tmpA.copy(camLook).sub(camPos).normalize();
    lungeTo.copy(camPos).addScaledVector(fwd, IS_PHONE || camera.aspect < 1 ? 4.2 : 3.4).sub(headOff);
    lungeFrom.set(0, 0, 0);
    clown.position.lerpVectors(lungeFrom, lungeTo, lunge);
  } else clown.position.set(0, Math.sin(now * 1.1) * 0.03, 0);

  // eyes look at the pointer
  eyes.forEach((e, i) => {
    const lx = target.x * 0.5 + (i ? 0.08 * Math.sin(now * 3) : 0), ly = target.y * 0.4;
    e.pupil.position.set(lx * 0.06, ly * 0.06, 0.112);
    e.g.rotation.set(-ly * 0.4, lx * 0.5, 0);
    e.g.scale.setScalar(1 + scream * 0.35);
    if (e.isLeft) { eyeL.emissive.setRGB(1, 0.62 * (1 - scream) + 0.03, 0.06 * (1 - scream)); eyeL.emissiveIntensity = 1.5 + scream * 1.5; e.halo.material.color.setRGB(1, 0.72 - scream * 0.65, 0.2 * (1 - scream)); }
    else { pupilR.emissiveIntensity = 1.5 + scream * 3; e.halo.material.opacity = 0.35 + scream * 0.6; }
    e.halo.scale.setScalar((e.isLeft ? 0.42 : 0.26) * (1 + scream * 1.0) * (0.95 + Math.random() * 0.1));
    e.light.intensity = (e.isLeft ? 0.12 : 0.05) + scream * 0.8;
    e.light.color.setRGB(1, e.isLeft ? 0.65 - scream * 0.55 : 0.4 - scream * 0.3, 0.1);
  });

  // jaw + throat + snapping stitches
  jawPivot.rotation.x = scream * 0.8 + Math.max(0, Math.sin(now * 2.3)) * 0.02;
  throatGlow.intensity = scream * 4;
  if (modelMode === 'classic') clown.updateMatrixWorld(true);
  if (modelMode === 'classic') threads.forEach(t => {
    if (scream > t.snapAt && !t.snapped) { t.snapped = true; t.m.visible = false; }
    if (scream < 0.05) { t.snapped = false; t.m.visible = true; }
    if (!t.m.visible) return;
    tmpA.copy(t.a);
    tmpB.copy(t.a).setY(t.a.y - 0.06); jaw.localToWorld(tmpB); head.worldToLocal(tmpB);
    const len = tmpA.distanceTo(tmpB);
    t.m.position.copy(tmpA).add(tmpB).multiplyScalar(0.5); t.m.scale.set(1, Math.max(len, 0.001), 1);
    t.m.quaternion.setFromUnitVectors(up, tmpB.clone().sub(tmpA).normalize());
  });

  // hair quiver
  if (modelMode === 'classic') head.children.forEach(c => { if (c.userData.base !== undefined) c.rotation.z = c.userData.base + Math.sin(now * 3 + c.id) * 0.04 + scream * (Math.random() - 0.5) * 0.3; });

  // balloon follows his left hand
  armL.hand.getWorldPosition(handW);
  const bs = Math.max(0.001, pose.balloon);
  balloonG.visible = stringLine.visible = pose.balloon > 0.02 && modelMode === 'classic';
  balloonG.scale.setScalar(bs);
  balloonG.position.set(handW.x + Math.sin(now * 0.8) * 0.25, handW.y + 3.2 * bs, handW.z + Math.cos(now * 0.6) * 0.2);
  const sp = stringGeo.attributes.position; sp.setXYZ(0, handW.x, handW.y, handW.z); sp.setXYZ(1, balloonG.position.x, balloonG.position.y - 0.7 * bs, balloonG.position.z); sp.needsUpdate = true;

  // drain eyes blink
  const blink = (now % 5.5) > 5.35 ? 0.05 : 0.55; drainEyes.forEach(e => e.scale.y = blink);
  drainGlow.intensity = 2.5 + Math.sin(now * 3) * 0.8 + pose.crouch * 3;

  // flickering lights
  const fl = Math.random() < 0.03 ? 0.25 : 1;
  key.intensity = (40 + Math.sin(now * 13) * 3) * fl;
  under.intensity = 26 + Math.sin(now * 2) * 4 - scream * 10;
  under.color.setRGB(0.27 + scream * 0.73, 1 - scream * 0.9, 0.4 - scream * 0.3);
  rim.intensity = 160 + scream * 400;
  shaftMat.uniforms.uTime.value = now; shaftMat.uniforms.uI.value = (0.12 + Math.sin(now * 0.7) * 0.03) * fl;
  dust.rotation.y = now * 0.015; dust.position.y = Math.sin(now * 0.3) * 0.2;

  updateCustom(dt);
  // camera: scroll path + sway + scream shake
  pathAt(scrollP());
  camPos.lerp(tgtPos, damp(3.2)); camLook.lerp(tgtLook, damp(3.2));
  const shake = scream * 0.1 + lunge * 0.06;
  camera.position.set(camPos.x + Math.sin(now * 0.4) * 0.06 + (Math.random() - 0.5) * shake, camPos.y + Math.sin(now * 0.3) * 0.04 + (Math.random() - 0.5) * shake, camPos.z);
  camera.lookAt(camLook);

  const red = Math.max(scream * 0.55, lunge * 0.4);
  if (composer) {
    filmPass.uniforms.uTime.value = now;
    filmPass.uniforms.uShift.value = 0.0012 + scream * 0.012;
    filmPass.uniforms.uRed.value = red;
    bloom.strength = 0.5 + scream * 0.4;
  } else if (redEl && Math.abs(red - redOp) > 0.02) { redOp = red < 0.02 ? 0 : red; redEl.style.opacity = (redOp * 1.2).toFixed(2); }

  // raycast throttle: desktop every 4th frame when the pointer or camera moved; phones only while a finger is down
  hoverTick++;
  if (IS_PHONE ? (touching && hoverTick % 6 === 0) : (hoverTick % 4 === 0 && (pointerMoved || hovering || tnow - lastInput < 1500))) checkHover(false);
  if (composer) composer.render(); else renderer.render(scene, camera);
  perfTick(tnow);
  if (!ready) { ready = true; const l = document.getElementById('clownLoading'); if (l) l.remove(); window.dispatchEvent(new Event('hol:clown-ready')); }
}
frame();

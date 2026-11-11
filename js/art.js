// art.js — every picture in the game is drawn here, in code. No image files.
// Sprites are drawn at double detail (2 "HD pixels" per logical pixel), baked once into an offscreen canvas,
// outlined automatically, then blitted. Per-frame work is drawImage only, which keeps mid-range phones smooth.
export const Z = 2;                      // HD pixels per logical pixel
export const INK = '#2B1D12';

/* ---------- colour + pixel helpers ---------- */
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shadeMemo = new Map();
/** f<0 darkens (slightly towards blue), f>0 lightens (slightly towards warm white). */
export function shade(h, f) {
  const k = h + f; let v = shadeMemo.get(k); if (v) return v;
  const [r, g, b] = hex(h), a = Math.abs(f);
  v = f < 0 ? toHex([r * (1 - a), g * (1 - a * .95), b * (1 - a * .8)]) : toHex([r + (255 - r) * a, g + (255 - g) * a, b + (245 - b) * a]);
  shadeMemo.set(k, v); return v;
}
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function E(g, cx, cy, rx, ry, c) { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + .5) * (ry + .5))))); if (w > 0) g.fillRect(cx - w, cy + y, w * 2, 1); } }

/* ---------- bake cache ---------- */
const cache = new Map();
function outline(g, w, h) {
  const im = g.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] > 100) continue;
    let n = -1;
    if (y < h - 1 && d[i + w * 4 + 3] > 200) n = i + w * 4; else if (x > 0 && d[i - 1] > 200) n = i - 4;
    else if (x < w - 1 && d[i + 4 + 3] > 200) n = i + 4; else if (y > 0 && d[i - w * 4 + 3] > 200) n = i - w * 4;
    if (n < 0) continue;
    o[i] = d[n] * .36; o[i + 1] = d[n + 1] * .32; o[i + 2] = d[n + 2] * .4; o[i + 3] = 255;
  }
  im.data.set(o); g.putImageData(im, 0, 0);
}
/** Bake a sprite. w,h are HD pixels. fn(g) draws with 1 unit = 1 HD pixel. */
export function bake(key, w, h, fn, plain) {
  let s = cache.get(key); if (s) return s;
  const pad = plain ? 0 : 1, cv = document.createElement('canvas'); cv.width = w + pad * 2; cv.height = h + pad * 2;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(pad, pad); fn(g); g.setTransform(1, 0, 0, 1, 0, 0);
  if (pad) outline(g, cv.width, cv.height);
  s = { cv, pad, w: cv.width, h: cv.height }; cache.set(key, s); return s;
}
/** Draw a baked sprite with its top-left at logical (x,y). */
export function blit(c, s, x, y) { c.drawImage(s.cv, x - s.pad / Z, y - s.pad / Z, s.w / Z, s.h / Z); }

/* ---------- looks: how a person is described ---------- */
export const SKIN = ['#FAD9B5', '#F1C27D', '#D9A066', '#A56B3F', '#7A4A2A'];
export const HAIRC = ['#2B1D12', '#3B2A1A', '#5A3820', '#8A5A33', '#1A1A22', '#B5793C', '#D9B45A', '#9A9A9A'];
export const SCARFC = ['#E56B8A', '#F2F2F2', '#3AA6A0', '#7B3FA0', '#3A78C9', '#F2A23A', '#5FA85B', '#2B2B3B'];
export const TOPC = ['#3A78C9', '#F2A23A', '#E2483B', '#3A9D6A', '#8D5BB5', '#F4C430', '#F2F2F2', '#2B2B3B'];
export const BOTTOMC = ['#2B4C7E', '#5A3820', '#3B3B4A', '#2F5E5B', '#8A3B5A', '#C9B48A'];
export const HAIR_STYLES = ['Pendek', 'Berponi', 'Keriting', 'Cepak', 'Panjang', 'Kuncir dua', 'Kerudung', 'Kerudung panjang'];
/** A "look" is a small object of indexes into the palettes above, safe to store as JSON:
    { skin, hs (hair style), hair (colour), top, bottom, skirt: 0|1, cap: 0|1, glasses: 0|1 } */
export const defaultLook = () => ({ skin: 1, hs: 0, hair: 1, top: 0, bottom: 0, skirt: 0, cap: 0, glasses: 0 });
const pick = (arr, i) => arr[((i | 0) % arr.length + arr.length) % arr.length];
/** Turn a look into the concrete colours the drawing code needs. */
export function resolveLook(o) {
  o = Object.assign(defaultLook(), o || {});
  const hs = ((o.hs | 0) % 8 + 8) % 8;
  return { skin: pick(SKIN, o.skin), hs, hair: pick(hs >= 6 ? SCARFC : HAIRC, o.hair), top: pick(TOPC, o.top), bottom: pick(BOTTOMC, o.bottom),
    skirt: !!o.skirt, cap: o.cap && hs < 6 ? pick(TOPC, (o.top | 0) + 3) : null, glasses: !!o.glasses };
}
/** A stable look made from a name, so every colleague in the content file gets a face without anyone designing it. */
export function lookFromName(name) {
  let h = 2166136261; for (const ch of String(name)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  const r = n => { h = Math.imul(h ^ h >>> 13, 1274126177); return (h >>> 0) % n; };
  return { skin: r(5), hs: r(8), hair: r(8), top: r(8), bottom: r(6), skirt: r(3) === 0 ? 1 : 0, cap: r(6) === 0 ? 1 : 0, glasses: r(4) === 0 ? 1 : 0 };
}
export const randomLook = () => ({ skin: Math.random() * 5 | 0, hs: Math.random() * 8 | 0, hair: Math.random() * 8 | 0, top: Math.random() * 8 | 0, bottom: Math.random() * 6 | 0, skirt: Math.random() < .35 ? 1 : 0, cap: Math.random() < .2 ? 1 : 0, glasses: Math.random() < .25 ? 1 : 0 });

/* ---------- characters (24×36 HD box, feet on the bottom edge) ---------- */
export const CW = 24, CH = 36;
function drawChar(g, L, dir, f) {
  const P = (x, y, w, h, c) => R(g, x, y, w, h, c);
  const skin = L.skin || '#F1C27D', skD = shade(skin, -.14), hs = L.hs | 0, girl = !!L.skirt;   // girl = skirt body shape
  const scarf = hs >= 6, style = scarf ? hs - 6 : hs, buzz = hs === 3, long = hs === 4, pig = hs === 5;
  const capStyle = long ? 3 : pig ? 2 : style, capGirl = long || pig;
  const hc = L.hair || '#2B1D12', hL = shade(hc, .2), hD = shade(hc, -.22);
  const top = L.shirt || '#3A78C9', topD = shade(top, -.18), topL = shade(top, .28);
  const bot = L.bottom || '#2B4C7E', botD = shade(bot, -.2);
  const shoe = '#4A3222', eye = '#2B1D12';
  const step = f === 1 ? -1 : f === 3 ? 1 : 0, o = step ? -1 : 0;     // o: upper body bobs up on a step
  E(g, 12, 34, 8, 2, 'rgba(0,0,0,.2)');
  const side = dir === 1 || dir === 3, back = dir === 2;

  if (side) {
    // legs
    if (girl) { P(7, 26 + o, 10, 3, bot); P(6, 29 + o, 12, 4, bot); P(6, 32 + o, 12, 1, botD);
      if (step < 0) { P(6, 33, 5, 2, shoe); P(13, 32, 4, 2, shoe); } else if (step > 0) { P(8, 32, 4, 2, shoe); P(12, 33, 5, 2, shoe); } else P(8, 33, 7, 2, shoe); }
    else { P(8, 27 + o, 8, 3, bot);
      if (step < 0) { P(13, 30, 4, 2, botD); P(13, 32, 5, 2, shoe); P(7, 30, 4, 3, bot); P(5, 33, 6, 2, shoe); }
      else if (step > 0) { P(7, 30, 4, 2, botD); P(6, 32, 5, 2, shoe); P(12, 30, 4, 3, bot); P(11, 33, 6, 2, shoe); }
      else { P(9, 30, 6, 3, bot); P(7, 33, 8, 2, shoe); } }
    // body + arm
    P(8, 19 + o, 8, 8 + (girl ? 0 : 0), top); P(14, 20 + o, 2, 7, topD);
    const ax = 11 - step * 2; P(ax, 20 + o, 3, 5, topD); P(ax, 25 + o, 3, 2, skin);
    // head
    P(5, 9 + o, 14, 9, skin); P(6, 8 + o, 12, 1, skin); P(7, 18 + o, 10, 1, skD); P(4, 13 + o, 1, 2, skin);
    if (!scarf) P(13, 12 + o, 2, 3, skD);
    { P(7, 12 + o, 2, 3, eye); P(7, 12 + o, 1, 1, '#fff'); g.fillStyle = 'rgba(235,110,100,.5)'; g.fillRect(5, 15 + o, 2, 1); P(5, 16 + o, 2, 1, '#B5534A'); }
    if (L.beard) { P(4, 16 + o, 6, 3, hc); P(5, 19 + o, 4, 1, hc); }
    if (scarf) {
      P(6, 4 + o, 12, 1, hc); P(5, 5 + o, 14, 1, hc); P(4, 6 + o, 16, 3, hc); P(11, 9 + o, 9, 10, hc); P(5, 9 + o, 2, 1, hD);
      P(6, 18 + o, 12, 1, hD); P(6, 19 + o, 12, style ? 8 : 4, hc); if (style) P(5, 23 + o, 14, 4, hc);
      P(8, 5 + o, 5, 1, hL); P(15, 12 + o, 1, 6, hD);
    } else {
      hairCap(P, capStyle, capGirl, hc, hL, o, true);
      P(15, 9 + o, 5, 5, hc); P(16, 14 + o, 4, 2, hc); P(11, 9 + o, 2, 2, hc);
      if (long) P(14, 14 + o, 6, 10, hc);
      if (pig) { P(18, 9 + o, 4, 8, hc); P(18, 10 + o, 2, 1, '#E56B8A'); }
    }
  } else {
    // legs
    const lL = step < 0 ? 2 : 0, rL = step > 0 ? 2 : 0;
    if (girl) { P(6, 26 + o, 12, 3, bot); P(5, 29 + o, 14, 4, bot); P(5, 32 + o, 14, 1, botD); P(7, 33 - lL / 2, 4, 2, shoe); P(13, 33 - rL / 2, 4, 2, shoe); }
    else { P(7, 27 + o, 10, 4, bot); P(7, 30, 4, 3 - lL, bot); P(13, 30, 4, 3 - rL, bot); P(11, 30, 2, 1, botD); P(6, 33 - lL, 5, 2, shoe); P(13, 33 - rL, 5, 2, shoe); }
    // body + arms
    P(6, 19 + o, 12, 9 - (girl ? 2 : 1), top); P(16, 20 + o, 2, 6, topD);
    if (!back && !girl) P(10, 19 + o, 4, 1, topL);
    if (girl) P(6, 25 + o, 12, 1, topD);
    const al = step;   // arms swing opposite to each other
    P(4, 20 + o + al, 2, 5, topD); P(4, 25 + o + al, 2, 2, skin); P(18, 20 + o - al, 2, 5, topD); P(18, 25 + o - al, 2, 2, skin);
    // head
    P(5, 9 + o, 14, 9, skin); P(6, 8 + o, 12, 1, skin); P(7, 18 + o, 10, 1, skD);
    if (!scarf) { P(4, 13 + o, 1, 2, skin); P(19, 13 + o, 1, 2, skin); }
    if (!back) {
      {
        P(8, 12 + o, 2, 3, eye); P(14, 12 + o, 2, 3, eye); P(8, 12 + o, 1, 1, '#fff'); P(14, 12 + o, 1, 1, '#fff');
        g.fillStyle = 'rgba(235,110,100,.5)'; g.fillRect(6, 15 + o, 2, 1); g.fillRect(16, 15 + o, 2, 1);
        P(11, 16 + o, 2, 1, '#B5534A');
      }
      if (L.beard) { P(6, 15 + o, 2, 3, hc); P(16, 15 + o, 2, 3, hc); P(7, 17 + o, 10, 3, hc); P(9, 20 + o, 6, 1, hc); P(11, 16 + o, 2, 1, '#B5534A'); }
    }
    if (scarf) {
      P(6, 4 + o, 12, 1, hc); P(5, 5 + o, 14, 1, hc); P(4, 6 + o, 16, 3, hc);
      if (back) { P(4, 9 + o, 16, 10, hc); P(8, 6 + o, 1, 12, hD); }
      else { P(4, 9 + o, 3, 10, hc); P(17, 9 + o, 3, 10, hc); P(7, 9 + o, 10, 1, hD); P(7, 18 + o, 10, 1, hD); }
      P(4, 19 + o, 16, 3, hc); P(5, 22 + o, 14, 2, hc);
      if (style) { P(3, 20 + o, 18, 5, hc); P(4, 25 + o, 16, 2, hc); P(3, 24 + o, 18, 1, hD); }
      P(7, 5 + o, 5, 1, hL); if (!back) P(11, 20 + o, 1, 3, hD);
    } else {
      hairCap(P, capStyle, capGirl, hc, hL, o, false);
      if (back) { P(4, 9 + o, 16, buzz ? 3 : 6, hc); P(6, 15 + o, 12, 1, hc); }
      else if (!buzz) { P(4, 9 + o, 2, 3, hc); P(18, 9 + o, 2, 3, hc); }
      if (long) { P(3, 8 + o, 2, 15, hc); P(19, 8 + o, 2, 15, hc); if (back) P(4, 9 + o, 16, 14, hc); }
      if (pig) { P(1, 10 + o, 3, 8, hc); P(20, 10 + o, 3, 8, hc); P(3, 11 + o, 1, 2, '#E56B8A'); P(20, 11 + o, 1, 2, '#E56B8A'); if (back) P(4, 9 + o, 16, 7, hc); }
    }
  }
  // headwear
  if (L.hat) { const hb = shade(L.hat, -.3); P(6, 2 + o, 12, 5, L.hat); P(7, 1 + o, 10, 1, L.hat); P(6, 6 + o, 12, 1, hb); P(2, 7 + o, 20, 2, L.hat); P(2, 8 + o, 20, 1, hb); P(8, 2 + o, 4, 1, shade(L.hat, .3)); }
  if (L.cap) { const c = L.cap, cd = shade(c, -.28); P(6, 2 + o, 12, 5, c); P(7, 1 + o, 10, 1, c); P(7, 2 + o, 6, 1, shade(c, .3));
    if (side) P(1, 6 + o, 9, 2, cd); else if (!back) P(5, 6 + o, 14, 2, cd); else P(6, 6 + o, 12, 1, cd); }
  if (L.glasses && !back) { const fr = '#2F2F3A';
    if (side) { P(6, 11 + o, 4, 1, fr); P(6, 15 + o, 4, 1, fr); P(6, 11 + o, 1, 5, fr); P(9, 11 + o, 1, 5, fr); P(10, 12 + o, 4, 1, fr); }
    else { [7, 13].forEach(x => { P(x, 11 + o, 4, 1, fr); P(x, 15 + o, 4, 1, fr); P(x, 11 + o, 1, 5, fr); P(x + 3, 11 + o, 1, 5, fr); }); P(11, 12 + o, 2, 1, fr); } }
}
function hairCap(P, style, girl, hc, hL, o, side) {
  if (!girl && style === 3) { const c = shade(hc, .12); P(6, 5 + o, 12, 1, c); P(5, 6 + o, 14, 2, c); P(4, 8 + o, 16, 1, c); return; }
  if (!girl && style === 2) {
    P(3, 6 + o, 18, 4, hc); P(5, 4 + o, 3, 2, hc); P(9, 3 + o, 3, 3, hc); P(13, 3 + o, 3, 3, hc); P(17, 5 + o, 2, 2, hc); P(3, 10 + o, 2, 3, hc); P(19, 10 + o, 2, 3, hc);
    P(6, 5 + o, 1, 1, hL); P(10, 4 + o, 1, 1, hL); P(14, 4 + o, 1, 1, hL); P(7, 8 + o, 2, 1, hL); P(13, 7 + o, 2, 1, hL); return;
  }
  P(6, 4 + o, 12, 1, hc); P(5, 5 + o, 14, 1, hc); P(4, 6 + o, 16, 3, hc); P(8, 5 + o, 5, 1, hL); P(7, 6 + o, 2, 1, hL);
  if (!girl && style === 1) { P(8, 3 + o, 2, 1, hc); P(12, 3 + o, 3, 1, hc); P(16, 4 + o, 2, 1, hc); if (!side) { P(5, 9 + o, 10, 1, hc); P(5, 10 + o, 4, 1, hc); } else P(5, 9 + o, 4, 1, hc); }
  else if (!side) { P(6, 9 + o, 3, 1, hc); P(12, 9 + o, 3, 1, hc); if (girl) P(15, 9 + o, 3, 1, hc); }
}
const keyMemo = new WeakMap();
const lookKey = L => { let k = keyMemo.get(L); if (!k) { k = JSON.stringify(L); keyMemo.set(L, k); } return k; };
/** dir: 0 down, 1 left, 2 up, 3 right. frame: 0..3 (0 and 2 stand, 1 and 3 step). */
export function charSprite(L, dir = 0, frame = 0) {
  return bake('c' + lookKey(L) + dir + frame, CW, CH, g => {
    if (dir === 3) { g.translate(CW, 0); g.scale(-1, 1); }
    drawChar(g, L, dir === 3 ? 1 : dir, frame);
  });
}
/** Draw a character whose classic 12×16 box starts at logical (x,y). */
export function drawChar16(c, x, y, L, dir, frame) { blit(c, charSprite(L, dir, frame), x, y - 2); }

/* ---------- portraits (dialog faces) ---------- */
const portraits = new Map();
export function portraitURL(L) {
  const k = lookKey(L); let u = portraits.get(k); if (u) return u;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const sky = g.createLinearGradient(0, 0, 0, 64); sky.addColorStop(0, '#9EDCF8'); sky.addColorStop(.7, '#DDF3FB'); g.fillStyle = sky; g.fillRect(0, 0, 64, 64);
  E(g, 14, 60, 26, 12, '#8AD277'); E(g, 52, 62, 24, 10, '#74C365');
  const s = charSprite(L, 0, 0); g.drawImage(s.cv, s.pad, s.pad, CW, 27, -4, 1, CW * 3, 27 * 3);
  u = cv.toDataURL(); portraits.set(k, u); return u;
}

/* ---------- ground (one big canvas, rebuilt only when the map opens up) ---------- */
const G1 = '#74C365', G2 = '#68B85A', G3 = '#82CD72', GD = '#4F9E4A', P1 = '#E3C58F', P2 = '#D3B079', P3 = '#EFDAB0';
export function buildGround(COLS, ROWS, isPath) {
  const cv = document.createElement('canvas'), W = COLS * 32, H = ROWS * 32; cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), rnd = rng(20261110);
  R(g, 0, 0, W, H, G1);
  for (let i = 0; i < COLS * ROWS * 1.1; i++) E(g, rnd() * W | 0, rnd() * H | 0, 5 + rnd() * 11 | 0, 3 + rnd() * 5 | 0, rnd() < .5 ? G2 : G3);
  for (let i = 0; i < COLS * ROWS * 3; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; R(g, x, y, 1, 3, GD); R(g, x + 2, y + 1, 1, 2, GD); if (rnd() < .5) R(g, x - 2, y + 1, 1, 2, GD); }
  for (let i = 0; i < COLS * ROWS * .45; i++) { const x = 4 + rnd() * (W - 8) | 0, y = 4 + rnd() * (H - 8) | 0, c = ['#FFFFFF', '#FFE98A', '#F7A8C0', '#CFE8FF'][rnd() * 4 | 0];
    R(g, x - 1, y, 3, 1, c); R(g, x, y - 1, 1, 3, c); R(g, x, y, 1, 1, '#F4B400'); R(g, x, y + 2, 1, 2, GD); }
  for (let i = 0; i < COLS * ROWS * .12; i++) { const x = rnd() * W | 0, y = rnd() * H | 0; R(g, x, y, 3, 2, '#B9B9B0'); R(g, x, y, 2, 1, '#DADAD2'); R(g, x, y + 2, 3, 1, 'rgba(0,0,0,.15)'); }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!isPath(x, y)) continue; const X = x * 32, Y = y * 32;
    R(g, X, Y, 32, 32, P1);
    for (let i = 0; i < 9; i++) { const a = rnd() * 29 | 0, b = rnd() * 30 | 0; R(g, X + a, Y + b, 2 + (rnd() * 2 | 0), 1, rnd() < .6 ? P2 : P3); }
    if (rnd() < .5) { const a = 4 + rnd() * 22 | 0, b = 4 + rnd() * 22 | 0; R(g, X + a, Y + b, 3, 2, '#C2A26C'); R(g, X + a, Y + b, 2, 1, '#F5E6C4'); }
    const n = !isPath(x, y - 1), s = !isPath(x, y + 1), w = !isPath(x - 1, y), e = !isPath(x + 1, y);
    for (let k = 0; k < 32; k += 2) {
      const d = () => 1 + (rnd() < .45 ? 1 : 0) + (rnd() < .15 ? 1 : 0);
      if (n) { const q = d(); R(g, X + k, Y, 2, q, G2); R(g, X + k, Y + q, 2, 1, P2); }
      if (s) { const q = d(); R(g, X + k, Y + 32 - q, 2, q, G1); R(g, X + k, Y + 31 - q, 2, 1, P3); }
      if (w) { const q = d(); R(g, X, Y + k, q, 2, G2); R(g, X + q, Y + k, 1, 2, P2); }
      if (e) { const q = d(); R(g, X + 32 - q, Y + k, q, 2, G1); R(g, X + 31 - q, Y + k, 1, 2, P3); }
    }
    const corner = (cx, cy, sx, sy) => { R(g, cx, cy, 4 * sx, 2 * sy, G1); R(g, cx, cy, 2 * sx, 4 * sy, G1); R(g, cx, cy, 6 * sx, 1 * sy, G1); R(g, cx, cy, 1 * sx, 6 * sy, G1); };
    if (n && w) corner(X, Y, 1, 1); if (n && e) corner(X + 32, Y, -1, 1); if (s && w) corner(X, Y + 32, 1, -1); if (s && e) corner(X + 32, Y + 32, -1, -1);
  }
    return cv;
}

/* ---------- nature ---------- */
const TREES = [['#2E8B47', '#3FA654', '#5CC068', '#226C3A'], ['#2E8B47', '#3FA654', '#5CC068', '#226C3A'], ['#3C9440', '#58B04A', '#80CC5E', '#2C7434'], ['#267F56', '#35A06C', '#55BE86', '#1B6344']];
/** 32×42, the tile is the bottom 32 rows. v: 0 plain, 1 red fruit, 2 light, 3 teal, 4 fruit tree (orange + red). */
export const treeSprite = v => bake('tree' + v, 32, 42, g => {
  const [d, m, l, u] = TREES[v % 4], rnd = rng(77 + v);
  E(g, 16, 39, 11, 2, 'rgba(0,0,0,.22)');
  R(g, 13, 26, 6, 14, '#8A5A33'); R(g, 13, 26, 2, 14, '#6E4426'); R(g, 17, 29, 1, 9, '#A8743F'); R(g, 11, 39, 3, 1, '#6E4426'); R(g, 18, 39, 3, 1, '#8A5A33');
  E(g, 16, 25, 11, 4, u); E(g, 16, 16, 14, 12, d); E(g, 15, 14, 12, 9, m); E(g, 11, 10, 7, 4, l); E(g, 21, 12, 4, 2, l); E(g, 9, 8, 3, 1, shade(l, .25));
  for (let i = 0; i < 14; i++) { const x = 5 + rnd() * 22 | 0, y = 8 + rnd() * 16 | 0; R(g, x, y, 2, 1, i % 3 ? d : u); }
  if (v === 1 || v === 4) [[8, 17], [20, 9], [23, 19], [13, 22]].forEach(([x, y], i) => { const c = v === 4 && i % 2 ? '#F4A300' : '#E2483B'; R(g, x, y, 3, 3, c); R(g, x, y, 1, 1, '#FFD0C4'); });
});
/** 32×38 hedge (tile = bottom 32 rows). */
export const hedgeSprite = v => bake('hedge' + v, 32, 38, g => {
  E(g, 16, 36, 13, 1, 'rgba(0,0,0,.2)'); E(g, 16, 22, 15, 13, '#2E8B47'); E(g, 16, 31, 14, 4, '#226C3A');
  E(g, 9, 15, 7, 6, '#3FA654'); E(g, 22, 14, 8, 7, '#3FA654'); E(g, 15, 9, 6, 3, '#5CC068'); E(g, 24, 9, 3, 2, '#5CC068'); E(g, 7, 12, 2, 1, '#80D680');
  const rnd = rng(5 + v); for (let i = 0; i < 10; i++) R(g, 4 + rnd() * 24 | 0, 12 + rnd() * 18 | 0, 2, 1, '#226C3A');
  if (v % 3 === 0) [[8, 22], [22, 25], [15, 17]].forEach(([x, y]) => { R(g, x, y, 2, 2, v % 2 ? '#F7A8C0' : '#FFFFFF'); R(g, x, y, 1, 1, '#FFE98A'); });
});
export const gateSprite = open => bake('gate' + (open ? 1 : 0), 32, 38, g => {
  [1, 26].forEach(x => { R(g, x, 8, 5, 29, '#8A5A33'); R(g, x, 8, 2, 29, '#6E4426'); R(g, x + 4, 10, 1, 25, '#A8743F'); R(g, x - 1, 6, 7, 3, '#B5793C'); R(g, x, 5, 5, 1, '#D29A58'); });
  if (open) { R(g, 6, 12, 2, 24, '#C98A52'); R(g, 24, 12, 2, 24, '#C98A52'); return; }
  [14, 26].forEach(y => { R(g, 6, y, 20, 4, '#D29A58'); R(g, 6, y + 3, 20, 1, '#A86B3C'); R(g, 6, y, 20, 1, '#E8B878'); });
  for (let i = 0; i < 9; i++) R(g, 7 + i * 2, 17 + i, 3, 2, '#B5793C');
  R(g, 13, 18, 6, 8, '#F4B400'); R(g, 13, 18, 6, 1, '#FFE07A'); R(g, 15, 21, 2, 3, '#7A5A00'); R(g, 14, 15, 4, 3, '#C9C9C9'); R(g, 15, 16, 2, 2, '#D29A58');
});
export const fenceSprite = () => bake('fence', 32, 30, g => {
  R(g, 0, 28, 32, 2, 'rgba(0,0,0,.18)');
  [12, 21].forEach(y => { R(g, 0, y, 32, 3, '#D9A866'); R(g, 0, y + 2, 32, 1, '#B5833F'); R(g, 0, y, 32, 1, '#EFC98A'); });
  [2, 10, 18, 26].forEach(x => { R(g, x, 7, 5, 21, '#EBC88E'); R(g, x + 1, 5, 3, 2, '#EBC88E'); R(g, x + 2, 4, 1, 1, '#EBC88E'); R(g, x, 7, 1, 21, '#FBE3B4'); R(g, x + 4, 8, 1, 20, '#C99A5E'); });
});

/* ---------- buildings ---------- */
function planks(g, x, y, w, h, base) {
  R(g, x, y, w, h, base); const d = shade(base, -.14), l = shade(base, .16), rnd = rng(x * 31 + y * 7 + w);
  for (let r = y + 5; r < y + h; r += 6) { R(g, x, r, w, 1, d); for (let k = 0; k < 3; k++) R(g, x + 3 + (rnd() * (w - 8) | 0), r - 3, 2, 1, k ? d : l); }
  R(g, x, y, w, 3, shade(base, -.2)); R(g, x + w - 2, y, 2, h, d); R(g, x, y + 3, 1, h - 3, l);
}
function roof(g, x, y, w, h, slope, c) {
  const c2 = shade(c, -.14), l = shade(c, .25), d = shade(c, -.32);
  for (let r = 0; r < h; r++) { const ins = Math.round((h - 1 - r) * slope), band = (r / 4 | 0), col = band % 2 ? c2 : c; R(g, x + ins, y + r, w - 2 * ins, 1, col);
    if (r % 4 === 3) for (let k = x + ins + (band % 2 ? 2 : 5); k < x + w - ins - 1; k += 6) R(g, k, y + r - 2, 1, 3, d);
    if (r % 4 === 0) R(g, x + ins + 1, y + r, w - 2 * ins - 2, 1, l); }
  R(g, x, y + h - 2, w, 2, d); R(g, x + Math.round((h - 1) * slope), y, w - 2 * Math.round((h - 1) * slope), 1, l);
}
function win(g, x, y, w, h, lit) {
  R(g, x - 1, y - 1, w + 2, h + 2, '#5A3820'); R(g, x, y, w, h, lit ? '#FFE38A' : '#9FD8F5');
  if (lit) { R(g, x, y, w, 2, '#FFF4C2'); R(g, x, y + h - 3, w, 3, '#F8C456'); } else { R(g, x + 1, y + 1, 3, 1, '#fff'); R(g, x + 1, y + 2, 1, 2, '#fff'); R(g, x, y + h - 3, w, 3, '#7CC3EA'); }
  R(g, x + (w >> 1), y, 1, h, '#5A3820'); R(g, x, y + (h >> 1), w, 1, '#5A3820'); R(g, x - 2, y + h + 1, w + 4, 2, '#E8D6A8'); R(g, x - 2, y + h + 3, w + 4, 1, '#B79F74');
}
function door(g, x, y, w, h) {
  R(g, x - 1, y - 1, w + 2, h + 1, '#5A3820'); R(g, x, y, w, h, '#9A6035'); R(g, x + 1, y + 1, w - 2, 2, '#B87A45'); R(g, x + 2, y + 5, w - 4, h / 2 - 5 | 0, '#84502B'); R(g, x + 2, y + h / 2 + 2 | 0, w - 4, h / 2 - 4 | 0, '#84502B');
  R(g, x + w - 4, y + h / 2 | 0, 2, 3, '#F4C430'); R(g, x - 3, y + h, w + 6, 3, '#C9C2B4'); R(g, x - 3, y + h, w + 6, 1, '#E6E0D2');
}
function flowerBox(g, x, y, w, c) { R(g, x, y + 3, w, 4, '#8E5A33'); R(g, x, y + 3, w, 1, '#B5793C'); for (let k = 1; k < w - 1; k += 4) { R(g, x + k, y + 1, 3, 2, '#3FA654'); R(g, x + k, y - 1, 3, 3, k % 8 < 4 ? c : '#FFFFFF'); R(g, x + k + 1, y, 1, 1, '#F4B400'); } }
/** Office building, drawn for any width. wPx/hPx are HD pixels; the building stands on the bottom edge.
    floors = rows of windows above the ground floor. color = the team colour. icon = an emoji for the sign. */
export const officeSprite = (wPx, hPx, floors, color, icon, lit) => bake('office' + [wPx, hPx, floors, color, icon, lit ? 1 : 0].join('|'), wPx, hPx, g => {
  const W = wPx, H = hPx, base = H - 4, wallTop = base - 24 - floors * 20, cx = W >> 1, dk = shade(color, -.28), lt = shade(color, .3);
  E(g, cx, H - 2, (W >> 1) - 2, 2, 'rgba(0,0,0,.22)');
  R(g, 4, wallTop, W - 8, base - wallTop, '#F4EFE6'); R(g, W - 8, wallTop, 4, base - wallTop, '#DDD5C6'); R(g, 4, wallTop, 1, base - wallTop, '#FFFDF7');
  for (let y = wallTop + 19; y < base - 24; y += 20) R(g, 4, y, W - 8, 1, '#DDD5C6');
  R(g, 2, base, W - 4, 4, '#A7ADB6'); R(g, 2, base, W - 4, 1, '#C9CED6');
  // flat roof with a coloured band
  R(g, 2, wallTop - 8, W - 4, 8, color); R(g, 2, wallTop - 8, W - 4, 2, lt); R(g, 2, wallTop - 2, W - 4, 2, dk); R(g, 0, wallTop - 1, W, 2, dk);
  R(g, W - 22, wallTop - 14, 12, 6, '#B9BEC6'); R(g, W - 22, wallTop - 14, 12, 1, '#DDE1E7'); R(g, W - 20, wallTop - 12, 8, 1, '#8D939C');
  if (floors >= 2) { R(g, 10, wallTop - 24, 2, 16, '#6E4426'); R(g, 12, wallTop - 24, 11, 7, color); R(g, 12, wallTop - 24, 11, 2, lt); R(g, 12, wallTop - 18, 11, 1, dk); }
  // windows: mirrored columns, the middle of the lowest row is kept free for the sign
  const xs = []; for (let x = 8; x + 12 <= cx - 12; x += 16) xs.push(x, W - x - 12);
  for (let r = 0; r < floors; r++) { const y = wallTop + 5 + r * 20; xs.forEach(x => win(g, x, y, 12, 10, lit)); if (r < floors - 1 && floors > 1) win(g, cx - 6, y, 12, 10, lit); }
  // sign
  const sy = base - 24 - 15; R(g, cx - 11, sy, 22, 13, dk); R(g, cx - 10, sy + 1, 20, 11, '#FFFFFF');
  if (icon) { g.font = '9px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = dk; g.fillText(icon, cx, sy + 7); }
  // ground floor: glass doors, shop windows, awning, planters
  const gy = base - 21;
  [[8, cx - 13 - 8], [cx + 13, W - 8 - cx - 13]].forEach(([x, w]) => { if (w < 6) return; R(g, x - 1, gy + 1, w + 2, 13, '#5A6470'); R(g, x, gy + 2, w, 11, lit ? '#FFE38A' : '#A9DCF5'); R(g, x + 1, gy + 3, 3, 1, '#fff'); R(g, x, gy + 10, w, 3, lit ? '#F8C456' : '#7CC3EA'); });
  R(g, cx - 9, gy, 18, 21, '#5A6470'); R(g, cx - 8, gy + 1, 7, 20, lit ? '#FFE9A8' : '#BFE7FA'); R(g, cx + 1, gy + 1, 7, 20, lit ? '#FFE9A8' : '#BFE7FA'); R(g, cx - 3, gy + 10, 1, 4, '#fff'); R(g, cx + 2, gy + 10, 1, 4, '#fff');
  R(g, cx - 12, gy - 3, 24, 4, color); R(g, cx - 12, gy - 3, 24, 1, lt); R(g, cx - 12, gy, 24, 1, dk);
  R(g, cx - 12, base, 24, 3, '#D9DDE3');
});
/** An empty plot waiting for its building: 64×64. */
export const lotSprite = () => bake('lot', 64, 64, g => {
  E(g, 32, 46, 27, 13, '#C9B48A'); E(g, 32, 46, 24, 11, '#D9C59C');
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; R(g, 32 + Math.round(Math.cos(a) * 26) - 1, 46 + Math.round(Math.sin(a) * 12), 3, 1, '#A8946C'); }
  R(g, 30, 26, 4, 22, '#8A5A33'); R(g, 30, 26, 1, 22, '#6E4426'); R(g, 16, 10, 32, 18, '#2B2B3B');
  for (let k = -18; k < 32; k += 12) for (let y = 0; y < 16; y++) { const x = 17 + k + y; const a = Math.max(17, x), b = Math.min(47, x + 6); if (b > a) R(g, a, 11 + y, b - a, 1, '#F4C430'); }
  [[12, 50], [46, 52]].forEach(([x, y]) => { R(g, x, y, 8, 2, '#E0702F'); R(g, x + 1, y - 4, 6, 4, '#F2843A'); R(g, x + 2, y - 8, 4, 4, '#F2843A'); R(g, x + 1, y - 3, 6, 1, '#fff'); R(g, x + 3, y - 10, 2, 2, '#F2843A'); });
});
/** Fountain, 32×44 (the tile is the bottom 32 rows). f = 0/1 animation frame. */
export const fountainSprite = f => bake('fountain' + f, 32, 44, g => {
  E(g, 16, 41, 15, 2, 'rgba(0,0,0,.22)');
  E(g, 16, 32, 15, 8, '#9A9AA4'); E(g, 16, 30, 15, 7, '#C3C3CC'); E(g, 16, 30, 12, 5, '#3F86D0'); E(g, 14 + f * 3, 29, 4, 1, '#9CCBF5'); E(g, 20 - f * 4, 32, 3, 1, '#9CCBF5');
  R(g, 14, 14, 4, 16, '#B9B9C2'); R(g, 14, 14, 1, 16, '#DADAE0'); E(g, 16, 14, 6, 2, '#C3C3CC'); E(g, 16, 13, 4, 1, '#3F86D0');
  const w = '#CFE8FF'; R(g, 15, 5 + f, 2, 8 - f, w); R(g, 11 - f, 9, 2, 3, w); R(g, 19 + f, 9, 2, 3, w); R(g, 9 - f, 12, 2, 4 + f, w); R(g, 21 + f, 12, 2, 4 + f, w); R(g, 15, 3 + f * 2, 2, 1, '#fff');
});
export const benchSprite = () => bake('bench', 32, 24, g => {
  E(g, 16, 22, 13, 1, 'rgba(0,0,0,.2)'); R(g, 3, 6, 26, 4, '#B5793C'); R(g, 3, 6, 26, 1, '#D9A866'); R(g, 3, 12, 26, 4, '#C98A52'); R(g, 3, 12, 26, 1, '#E3A96C');
  [4, 25].forEach(x => { R(g, x, 6, 3, 15, '#5A6470'); R(g, x, 6, 1, 15, '#8D939C'); });
});
export const lampSprite = lit => bake('lamp' + (lit ? 1 : 0), 14, 40, g => {
  E(g, 7, 38, 5, 1, 'rgba(0,0,0,.2)'); R(g, 6, 10, 2, 28, '#4A5460'); R(g, 4, 36, 6, 2, '#4A5460'); R(g, 2, 2, 10, 8, '#4A5460'); R(g, 3, 3, 8, 6, lit ? '#FFE07A' : '#E8EEF2'); R(g, 3, 3, 8, 1, lit ? '#FFF4C2' : '#fff'); R(g, 4, 0, 6, 2, '#4A5460');
});
/** Café stall, 96×72 (tile area = bottom 64 rows). */
export const cafeSprite = () => bake('cafe', 96, 72, g => {
  E(g, 48, 70, 44, 2, 'rgba(0,0,0,.22)');
  R(g, 6, 30, 84, 38, '#8A5A33'); planks(g, 6, 48, 84, 20, '#B5793C'); R(g, 4, 44, 88, 5, '#D9A866'); R(g, 4, 44, 88, 1, '#F0CC92'); R(g, 4, 48, 88, 1, '#8A5A33');
  R(g, 6, 30, 84, 14, '#6E4426');
  [['#E0702F', 12], ['#F4C430', 32], ['#FFFFFF', 52], ['#D23A2A', 72]].forEach(([c, x]) => { R(g, x, 34, 14, 10, '#E8D6A8'); R(g, x, 34, 14, 2, '#F6EACB'); R(g, x, 42, 14, 2, '#B79F74'); E(g, x + 4, 37, 2, 2, c); E(g, x + 9, 38, 2, 2, c); E(g, x + 7, 35, 2, 1, shade(c, .2)); });
  [5, 87].forEach(x => { R(g, x, 26, 4, 42, '#6E4426'); R(g, x, 26, 1, 42, '#8A5A33'); });
  for (let i = 0; i < 8; i++) { const c = i % 2 ? '#FFF6DC' : '#D2503F', x = i * 12; R(g, x, 10, 12, 16, c); R(g, x, 10, 12, 2, shade(c, .3)); R(g, x, 22, 12, 4, shade(c, -.14)); E(g, x + 6, 27, 6, 3, c); R(g, x + 11, 10, 1, 16, shade(c, -.2)); }
  R(g, 0, 8, 96, 3, '#6E4426'); R(g, 0, 8, 96, 1, '#A8743F');
  R(g, 36, 0, 24, 11, '#C98A52'); R(g, 36, 0, 24, 2, '#E3A96C'); R(g, 38, 3, 20, 6, '#FFF6DC'); R(g, 44, 4, 7, 4, '#8A5A33'); R(g, 45, 8, 5, 1, '#8A5A33'); R(g, 51, 5, 2, 2, '#8A5A33'); R(g, 45, 4, 5, 1, '#5A3820');
});
export const signSprite = () => bake('sign', 32, 32, g => {
  E(g, 16, 30, 7, 1, 'rgba(0,0,0,.2)'); R(g, 14, 16, 4, 14, '#8A5A33'); R(g, 14, 16, 1, 14, '#6E4426');
  R(g, 3, 4, 26, 15, '#C98A52'); R(g, 3, 4, 26, 2, '#E3A96C'); R(g, 3, 17, 26, 2, '#A86B3C'); R(g, 7, 8, 18, 2, '#6E4426'); R(g, 9, 12, 14, 2, '#6E4426');
  R(g, 10, 29, 1, 2, '#3FA654'); R(g, 20, 28, 1, 3, '#3FA654');
});
export const trophySprite = col => bake('trophy' + col, 28, 28, g => {
  const l = shade(col, .45), d = shade(col, -.25);
  R(g, 7, 2, 14, 12, col); R(g, 9, 14, 10, 2, col); R(g, 12, 16, 4, 5, d); R(g, 3, 4, 4, 2, col); R(g, 3, 4, 2, 7, col); R(g, 3, 9, 5, 2, col); R(g, 21, 4, 4, 2, col); R(g, 23, 4, 2, 7, col); R(g, 20, 9, 5, 2, col);
  R(g, 9, 4, 2, 7, l); R(g, 7, 2, 14, 1, l); R(g, 18, 4, 2, 9, d); R(g, 8, 21, 12, 4, '#6E4426'); R(g, 8, 21, 12, 1, '#A8743F'); R(g, 10, 25, 8, 1, '#4A2E18');
});

/* ---------- soft effects (not outlined) ---------- */
export const glowSprite = () => bake('glow', 64, 64, g => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,225,130,.55)'); r.addColorStop(1, 'rgba(255,225,130,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, true);
export const cloudSprite = () => bake('cloud', 160, 80, g => { [[50, 44, 46, 26], [96, 36, 50, 30], [120, 52, 34, 20]].forEach(([x, y, a, b]) => { g.fillStyle = 'rgba(20,40,60,.07)'; g.beginPath(); g.ellipse(x, y, a, b, 0, 0, 7); g.fill(); }); }, true);
export const vignetteSprite = () => bake('vig', 96, 88, g => { const r = g.createRadialGradient(48, 44, 30, 48, 44, 70); r.addColorStop(0, 'rgba(30,20,10,0)'); r.addColorStop(1, 'rgba(30,20,10,.28)'); g.fillStyle = r; g.fillRect(0, 0, 96, 88); }, true);
export const butterflySprite = (c, f) => bake('bf' + c + f, 8, 6, g => { R(g, 3, 1, 1, 4, '#3A2A1E'); if (f) { R(g, 1, 1, 2, 3, c); R(g, 4, 1, 2, 3, c); } else { R(g, 0, 0, 3, 3, c); R(g, 4, 0, 3, 3, c); R(g, 1, 3, 2, 2, c); R(g, 4, 3, 2, 2, c); } }, true);

/* ---------- canvas sizing + quality governor ---------- */
const GFX_KEY = 'onboarderr-gfx';
let lite = false; try { lite = localStorage.getItem(GFX_KEY) === 'lite'; } catch (e) {}
export const gfxLite = () => lite;
export function setGfxLite(v) { lite = !!v; try { localStorage.setItem(GFX_KEY, lite ? 'lite' : 'auto'); } catch (e) {} window.dispatchEvent(new Event('ob-gfx')); }
let cap = 6;   // lowered at runtime when frames are slow
export const lowerCap = () => { if (cap > 2) { cap -= 2; return true; } return false; };
/** Backing-store pixels per logical pixel for a canvas shown `cssW` wide with `logW` logical pixels. Always even. */
export function pickScale(cssW, logW) {
  const want = cssW * (window.devicePixelRatio || 1) / logW;
  return Math.max(2, Math.min(lite ? 4 : cap, Math.ceil(want / 2) * 2));
}
/** Size a canvas for logical W×H and return its context, scaled so drawing code keeps using logical pixels. */
export function hdCanvas(cv, W, H, scale) {
  const k = scale || pickScale(cv.clientWidth || 360, W);
  if (cv.width !== W * k || cv.height !== H * k) { cv.width = W * k; cv.height = H * k; }
  cv.style.imageRendering = 'auto';
  const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.imageSmoothingEnabled = false; cv._k = k;
  return c;
}

/* ---------- convenience: draw a person from a stored look ---------- */
const resolved = new Map();
/** Stored look (indexes) → resolved colours, memoised so sprites are reused. */
export function lookOf(o) { const k = JSON.stringify(o || {}); let L = resolved.get(k); if (!L) { L = resolveLook(o); resolved.set(k, L); } return L; }
export const drawPerson = (c, x, y, look, dir = 0, frame = 0) => drawChar16(c, x, y, lookOf(look), dir, frame);
export const portraitOf = look => portraitURL(lookOf(look));

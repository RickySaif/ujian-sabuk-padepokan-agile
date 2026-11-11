// world.js — the campus: map, drawing, walking, and what happens when you tap things.
// The map is fixed (22×17 tiles). What stands on it comes from the content: one plot per mission, in order.
import * as A from './art.js';
import { S, save, today } from './state.js';
import { C, missions, levelNames, levelFor, levelProgress, questionsOf, settings } from './content.js';
import { $, esc, root, toast, panelOpen, shuffle, celebrate } from './ui.js';
import { sfx } from './audio.js';
import { playMission, playReview } from './mission.js';
import { playUjian, halamanSertifikat, LULUS } from './ujian.js';
import { hooks } from './hooks.js';

/* ---------- map ---------- */
export const T = 16, COLS = 22, ROWS = 17, VC = 12, VR = 11;     // tile size (logical px), map size, visible tiles
const HQ = { x: 2, y: 1, w: 3, h: 3, door: [3, 4] };
const CAFE = { x: 8, y: 2, w: 3, h: 2, door: [9, 4] };
const BOARD = { x: 6, y: 3 }, FOUNTAIN = { x: 7, y: 7 }, CEO_AT = [5, 4], START = { x: 3, y: 5 };
/** One plot per mission, in content order. Each is 2×2 tiles; its guide stands on the street just below it. */
export const LOTS = [[12, 3], [15, 3], [18, 3], [1, 9], [6, 9], [12, 9], [18, 9], [1, 12], [6, 12], [12, 12], [18, 12]];
const guideTile = i => [LOTS[i][0] + (i % 2), LOTS[i][1] + 2];
const TREES = [[13, 7], [14, 7], [18, 7], [19, 7], [1, 7], [2, 7], [20, 7], [12, 1], [20, 1], [6, 1], [20, 9], [9, 12], [15, 12], [20, 15], [1, 15]];
const BENCHES = [[6, 7], [8, 7], [13, 8]], LAMPS = [[5, 6], [11, 6], [17, 6], [3, 12], [11, 15], [17, 12]];
const PATHS = new Set();
{ const p = (x, y) => PATHS.add(x + ',' + y);
  [5, 11, 14].forEach(y => { for (let x = 1; x <= 20; x++) p(x, y); });
  [4, 10, 16].forEach(x => { for (let y = 5; y <= 14; y++) p(x, y); });
  p(...HQ.door); p(...CAFE.door); }
const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const lotAt = (x, y) => LOTS.findIndex(([a, b], i) => i < missions().length && x >= a && x < a + 2 && y >= b && y < b + 2);
const STATIC = new Set();
[...TREES, ...BENCHES, ...LAMPS, [BOARD.x, BOARD.y], [FOUNTAIN.x, FOUNTAIN.y]].forEach(([x, y]) => STATIC.add(x + ',' + y));

/* ---------- mission status ---------- */
export const isDone = m => !!S.missions[m.id];
export const doneCount = () => missions().filter(isDone).length;
/** A mission is open once you have met the CEO and (in sequential order) finished the one before it. */
export function isOpen(i) { return S.metCeo && (settings().order === 'free' || i === 0 || isDone(missions()[i - 1])); }
const lookOfGuide = g => g.look || A.lookFromName(g.name);
const ceo = () => ({ name: C.welcome.from, role: C.welcome.role || 'Guru Besar', look: C.welcome.look || A.lookFromName(C.welcome.from) });
/** People standing on the campus right now. */
function people() {
  const list = [{ kind: 'ceo', x: CEO_AT[0], y: CEO_AT[1], look: ceo().look, mark: !S.metCeo || (doneCount() === missions().length && !S.sertifikat) }];
  missions().forEach((m, i) => { if (i < LOTS.length && (isDone(m) || isOpen(i))) { const [x, y] = guideTile(i); list.push({ kind: 'guide', i, x, y, look: lookOfGuide(m.guide), mark: !isDone(m) }); } });
  return list;
}
function blocked(x, y) {
  if (x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1) return true;
  if (STATIC.has(x + ',' + y) || inRect(x, y, HQ) || inRect(x, y, CAFE) || lotAt(x, y) >= 0) return true;
  return people().some(p => p.x === x && p.y === y);
}
/** What is at this tile, if anything you can interact with. */
function hit(x, y) {
  const p = people().find(p => p.x === x && p.y === y);
  if (p) return p.kind === 'ceo' ? { type: 'hq', near: [[x, y]] } : { type: 'mission', i: p.i, near: [[x, y]] };
  const li = lotAt(x, y);
  if (li >= 0) { const [a, b] = LOTS[li]; return { type: 'mission', i: li, near: [guideTile(li), [a, b + 1], [a + 1, b + 1]] }; }
  if (inRect(x, y, HQ)) return { type: 'hq', near: [CEO_AT, [HQ.door[0], HQ.door[1] - 1]] };
  if (inRect(x, y, CAFE)) return { type: 'cafe', near: [[CAFE.door[0], CAFE.door[1] - 1]] };
  if (x === BOARD.x && y === BOARD.y) return { type: 'board', near: [[x, y]] };
  if (x === FOUNTAIN.x && y === FOUNTAIN.y) return { type: 'fountain', near: [[x, y]] };
  return null;
}
/** Shortest walkable path from (sx,sy) to any goal tile; null when there is none. */
function bfs(sx, sy, goals) {
  const key = (x, y) => x + ',' + y, G = new Set(goals.map(([x, y]) => key(x, y))), q = [[sx, sy]], prev = { [key(sx, sy)]: null };
  while (q.length) {
    const [x, y] = q.shift();
    if (G.has(key(x, y))) { const path = []; let k = key(x, y); while (k) { path.unshift(k.split(',').map(Number)); k = prev[k]; } return path.slice(1); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!(k in prev) && !blocked(nx, ny)) { prev[k] = key(x, y); q.push([nx, ny]); } }
  }
  return null;
}
const freeNextTo = tiles => tiles.flatMap(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])).filter(([x, y]) => !blocked(x, y));

/* ---------- scene state ---------- */
let cv, ctx, raf = 0, lastT = 0, camX = 0, camY = 0, ground = null, tapFx = null, lastStep = 0, emaDt = 16, slow = 0, fxOff = false;
const me = { x: 3, y: 5, fx: 3, fy: 5, path: [], dir: 0, onArrive: null };
let env = { signedIn: false, isAdmin: false, onSettings: null, onJournal: null };
const hourNow = () => { const q = new URLSearchParams(location.search).get('hour'); return q !== null ? +q : new Date().getHours() + new Date().getMinutes() / 60; };
const fit = () => { if (cv && cv.isConnected) ctx = A.hdCanvas(cv, VC * T, VR * T); };
window.addEventListener('resize', fit); window.addEventListener('ob-gfx', () => { fxOff = false; fit(); });

/* ---------- screen ---------- */
/** Show the campus. `e` carries callbacks for the two HUD buttons. */
export function startWorld(e) {
  env = Object.assign(env, e || {});
  layerClear();
  const pos = blocked(S.pos.x, S.pos.y) ? START : S.pos;
  Object.assign(me, { x: pos.x, y: pos.y, fx: pos.x, fy: pos.y, path: [], onArrive: null });
  root.replaceChildren($(`<div class="game">
    <div class="hud"><img class="me" alt="" src="${A.portraitOf(S.look)}"><div class="grow">${esc(S.name)}</div>
      <div class="chip" id="lvl"></div><div class="chip" id="streak" title="Runtunan latihan harian"></div>
      <button class="btn ghost icon" id="journal" aria-label="Catatan latihan">📋</button>
      <button class="btn ghost icon" id="gear" aria-label="Pengaturan">⚙</button></div>
    <div class="hud2"><span>${esc(C.company.campus || C.company.name)}</span><div class="track"><div class="fillb" id="bar"></div></div><span id="count"></span></div>
    <div class="stage"><canvas id="campus" aria-label="Padepokan. Ketuk sebuah tempat untuk berjalan ke sana."></canvas></div>
    <div class="frame dialog" id="dlg"></div>
    <p class="hint">Ketuk tanah untuk berjalan. Ketuk orang atau bangunan untuk menghampirinya.</p></div>`));
  cv = document.getElementById('campus'); fit();
  cv.onclick = onTap;
  document.getElementById('gear').onclick = () => env.onSettings && env.onSettings();
  document.getElementById('journal').onclick = () => env.onJournal && env.onJournal();
  refreshHud(); idle();
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
}
const layerClear = () => document.getElementById('layer').replaceChildren();
export function refreshHud() {
  const L = levelFor(S.xp), el = id => document.getElementById(id); if (!el('lvl')) return;
  el('lvl').innerHTML = `<span>Lv ${L + 1} · ${esc(levelNames()[L])}</span><span class="minibar"><i style="width:${Math.round(levelProgress(S.xp) * 100)}%"></i></span>`;
  el('streak').textContent = `🔥 ${S.review.streak || 0}`;
  const n = doneCount(), t = missions().length;
  el('bar').style.width = (n / t * 100) + '%'; el('count').textContent = `${n}/${t}`;
}

/* ---------- loop ---------- */
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!cv.isConnected) { cancelAnimationFrame(raf); return; }
  const dt = Math.min(100, t - lastT); lastT = t;
  if (me.path.length) {
    const [nx, ny] = me.path[0], sp = 0.13 * dt / 16.7, dx = nx - me.fx, dy = ny - me.fy;
    if (dx || dy) me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 2 : 0);
    me.fx += Math.sign(dx) * Math.min(sp, Math.abs(dx)); me.fy += Math.sign(dy) * Math.min(sp, Math.abs(dy));
    if (Math.abs(me.fx - nx) < .01 && Math.abs(me.fy - ny) < .01) {
      me.fx = me.x = nx; me.fy = me.y = ny; me.path.shift();
      if (t - lastStep > 180) { sfx.step(); lastStep = t; }
      if (!me.path.length) { S.pos = { x: me.x, y: me.y }; save(); const f = me.onArrive; me.onArrive = null; f && f(); }
    }
  }
  if (panelOpen()) return;                         // a mission covers the campus: don't spend frames on it
  draw(t);
  // if frames stay slow, lower the canvas resolution, then switch the ambient effects off
  emaDt += (dt - emaDt) * .05; if (emaDt > 24) { if (++slow > 120) { slow = 0; emaDt = 16; if (A.lowerCap()) fit(); else fxOff = true; } } else slow = 0;
}
function walkTo(goals, then) {
  const p = bfs(me.x, me.y, goals);
  if (p === null) { toast('Tidak bisa ke sana.'); return; }
  me.path = p; me.onArrive = then; if (!p.length) { me.onArrive = null; then && then(); }
}
function onTap(e) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width * VC * T + camX) / T), y = Math.floor(((e.clientY - r.top) / r.height * VR * T + camY) / T);
  const o = hit(x, y);
  if (o || !blocked(x, y)) tapFx = { x, y, t: performance.now() };
  if (o) { const goals = freeNextTo(o.near); walkTo(goals.length ? goals : [[me.x, me.y]], () => interact(o)); }
  else if (!blocked(x, y)) walkTo([[x, y]], null);
}
window.addEventListener('keydown', e => {
  if (!cv || !cv.isConnected || panelOpen() || me.path.length) return;
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (!d) return;
  e.preventDefault(); const nx = me.x + d[0], ny = me.y + d[1];
  if (!blocked(nx, ny)) me.path = [[nx, ny]]; else { const o = hit(nx, ny); if (o) interact(o); }
});

/* ---------- drawing ---------- */
const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const TREEV = [0, 2, 3, 0, 2, 1];
function marker(c, X, Y, t, col) {
  const bob = Math.round(Math.sin(t / 220) * 2) / 2;
  px(c, X + 4.5, Y - 13.5 + bob, 7, 10, '#2B1D12'); px(c, X + 5, Y - 13 + bob, 6, 9, col); px(c, X + 7, Y - 4 + bob, 2, 1.5, '#2B1D12'); px(c, X + 7.5, Y - 4 + bob, 1, 1, col);
  px(c, X + 7, Y - 11.5 + bob, 2, 4.5, '#C8463A'); px(c, X + 7, Y - 6 + bob, 2, 1.5, '#C8463A');
}
function draw(t) {
  const c = ctx, k = cv._k || 2, VW = VC * T, VH = VR * T, night = hourNow() >= 18 || hourNow() < 6;
  camX = Math.round(Math.max(0, Math.min(COLS * T - VW, me.fx * T + 8 - VW / 2)) * k) / k;
  camY = Math.round(Math.max(0, Math.min(ROWS * T - VH, me.fy * T + 8 - VH / 2)) * k) / k;
  c.setTransform(k, 0, 0, k, -camX * k, -camY * k); c.imageSmoothingEnabled = false;
  if (!ground) ground = A.buildGround(COLS, ROWS, (x, y) => PATHS.has(x + ',' + y));
  c.drawImage(ground, camX * 2, camY * 2, VW * 2, VH * 2, camX, camY, VW, VH);
  const vis = (x, y, w, h) => x < camX + VW && x + w > camX && y < camY + VH && y + h > camY;
  const items = [], put = (base, fn) => items.push({ base, fn });
  if (tapFx) { const a = (t - tapFx.t) / 450; if (a >= 1) tapFx = null; else { const X = tapFx.x * T, Y = tapFx.y * T, o = 2 + a * 3; c.fillStyle = `rgba(255,255,255,${(.85 * (1 - a)).toFixed(2)})`; [[o, o], [13 - o, o], [o, 13 - o], [13 - o, 13 - o]].forEach(([x, y]) => { c.fillRect(X + x, Y + y, 3, 1); c.fillRect(X + x + 1, Y + y - 1, 1, 3); }); } }
  // border trees and decorations
  for (let x = 0; x < COLS; x++) { if (vis(x * T, -6, 16, 22)) put(15, () => A.blit(c, A.treeSprite(TREEV[(x * 5) % 6]), x * T, -5)); if (vis(x * T, (ROWS - 1) * T - 6, 16, 22)) put(ROWS * T - 1, () => A.blit(c, A.treeSprite(TREEV[(x * 5 + 3) % 6]), x * T, (ROWS - 1) * T - 5)); }
  for (let y = 1; y < ROWS - 1; y++) { put(y * T + 15, () => A.blit(c, A.treeSprite(TREEV[(y * 3) % 6]), 0, y * T - 5)); put(y * T + 15, () => A.blit(c, A.treeSprite(TREEV[(y * 3 + 2) % 6]), (COLS - 1) * T, y * T - 5)); }
  TREES.forEach(([x, y], i) => vis(x * T, y * T - 6, 16, 22) && put(y * T + 15, () => A.blit(c, A.treeSprite(TREEV[i % 6]), x * T, y * T - 5)));
  BENCHES.forEach(([x, y]) => put(y * T + 12, () => A.blit(c, A.benchSprite(), x * T, y * T + 3)));
  LAMPS.forEach(([x, y]) => put(y * T + 15, () => A.blit(c, A.lampSprite(night), x * T + 4.5, y * T - 5)));
  put(FOUNTAIN.y * T + 15, () => A.blit(c, A.fountainSprite(Math.floor(t / 300) % 2), FOUNTAIN.x * T, FOUNTAIN.y * T - 6));
  put(BOARD.y * T + 15, () => A.blit(c, A.signSprite(), BOARD.x * T, BOARD.y * T));
  // buildings
  put((HQ.y + HQ.h) * T - 1, () => A.blit(c, A.officeSprite(96, 104, 2, C.company.color || '#3A78C9', '★', night), HQ.x * T, (HQ.y + HQ.h) * T - 52));
  put((CAFE.y + CAFE.h) * T - 1, () => A.blit(c, A.cafeSprite(), CAFE.x * T, CAFE.y * T - 4));
  missions().forEach((m, i) => {
    if (i >= LOTS.length) return; const [lx, ly] = LOTS[i], X = lx * T, Y = ly * T; if (!vis(X - 2, Y - 8, 36, 44)) return;
    if (isDone(m)) put(Y + 31, () => A.blit(c, A.officeSprite(64, 72, 1, m.color || '#3A78C9', m.icon || '', night), X, Y - 4));
    else put(Y + 20, () => { if (!isOpen(i)) c.globalAlpha = .55; A.blit(c, A.lotSprite(), X, Y); c.globalAlpha = 1; });
  });
  // people
  const folk = people(), wf = Math.floor(t / 120) % 4;
  folk.forEach(p => put(p.y * T + 16, () => A.drawPerson(c, p.x * T + 2, p.y * T, p.look, 0, 0)));
  put(me.fy * T + 16.5, () => A.drawPerson(c, Math.round(me.fx * T * 2) / 2 + 2, Math.round(me.fy * T * 2) / 2, S.look, me.dir, me.path.length ? wf : 0));
  items.sort((a, b) => a.base - b.base); for (const it of items) it.fn();
  folk.forEach(p => p.mark && marker(c, p.x * T, p.y * T, t, p.kind === 'ceo' ? '#F4B400' : '#FFFFFF'));
  // ambient effects
  const lite = A.gfxLite() || fxOff;
  if (!lite) {
    if (!night) {
      for (let i = 0; i < 3; i++) { const bx = (60 + i * 110 + Math.sin(t / 2300 + i * 2) * 40) % (COLS * T), by = 40 + i * 70 + Math.sin(t / 1700 + i) * 18; if (vis(bx, by, 5, 4)) A.blit(c, A.butterflySprite(['#FFFFFF', '#FFD23F', '#F7A8C0'][i], Math.floor(t / 140 + i) % 2), Math.round(bx * 2) / 2, Math.round(by * 2) / 2); }
      const cs = A.cloudSprite(); for (let i = 0; i < 2; i++) { const cx = ((t * .006 + i * 330) % (COLS * T + 260)) - 200, cy = 30 + i * 120; if (vis(cx, cy, 160, 80)) c.drawImage(cs.cv, cx, cy, 160, 80); }
    } else for (let i = 0; i < 10; i++) { const fx = (37 + i * 97) % (COLS * T - 20) + 10 + Math.sin(t / 900 + i) * 6, fy = (53 + i * 61) % (ROWS * T - 30) + 14 + Math.cos(t / 1100 + i * 1.7) * 5, a = .35 + .65 * Math.abs(Math.sin(t / 500 + i * 1.3)); if (vis(fx, fy, 2, 2)) { c.fillStyle = `rgba(255,240,140,${a.toFixed(2)})`; c.fillRect(Math.round(fx * 2) / 2, Math.round(fy * 2) / 2, 1, 1); } }
  }
  // light: evening glow, night tint with lit lamps
  const h = hourNow(); let tint = null;
  if (h >= 16 && h < 18) tint = `rgba(255,140,40,${((h - 16) / 2 * .16).toFixed(3)})`; else if (night) tint = 'rgba(24,30,96,.36)';
  if (tint) { c.fillStyle = tint; c.fillRect(camX, camY, VW, VH); }
  if (night) { const gl = A.glowSprite(); c.globalCompositeOperation = 'lighter'; LAMPS.forEach(([x, y]) => vis(x * T - 12, y * T - 20, 40, 40) && c.drawImage(gl.cv, x * T - 9, y * T - 18, 34, 34)); c.globalCompositeOperation = 'source-over'; }
  c.setTransform(k, 0, 0, k, 0, 0);
  if (!lite) { const vg = A.vignetteSprite(); c.imageSmoothingEnabled = true; c.drawImage(vg.cv, 0, 0, VW, VH); c.imageSmoothingEnabled = false; }
}

/* ---------- dialog box under the campus ---------- */
const fill = t => String(t).replaceAll('{name}', S.name || 'kawan');
let typing = 0;
/** who: { name, role?, look? | emoji }. lines: strings shown one at a time. actions: [[label, fn, cssClass], …] on the last line. */
export function dialog(who, lines, actions) {
  const d = document.getElementById('dlg'); if (!d) return; let i = 0;
  const show = () => {
    const face = who.look ? `<img class="portrait" alt="" src="${A.portraitOf(who.look)}">` : `<div class="portrait emoji">${esc(who.emoji || '💬')}</div>`;
    d.replaceChildren($(`<div style="display:contents">${face}<div class="body"><div class="who">${esc(who.name)}${who.role ? ` <span>· ${esc(who.role)}</span>` : ''}</div><div class="txt"></div><div class="row act"></div></div></div>`));
    const txt = d.querySelector('.txt'), act = d.querySelector('.act'), full = fill(lines[i]); let n = 0; clearInterval(typing);
    typing = setInterval(() => { n += 2; txt.textContent = full.slice(0, n); if (n >= full.length) clearInterval(typing); }, 18);
    txt.onclick = () => { clearInterval(typing); txt.textContent = full; };
    if (i < lines.length - 1) { const b = $(`<button class="btn">Lanjut ▸</button>`); b.onclick = () => { i++; show(); }; act.append(b); }
    else { const list = actions && actions.length ? actions : [['OK', idle, 'ghost']]; list.forEach(([label, fn, cls]) => { const b = $(`<button class="btn ${cls || ''}">${esc(label)}</button>`); b.onclick = fn; act.append(b); }); }
  };
  show();
}
/** The hint shown when nobody is talking: always the next useful thing to do. */
export function idle() {
  const d = document.getElementById('dlg'); if (!d) return; clearInterval(typing);
  const next = missions().findIndex((m, i) => !isDone(m) && isOpen(i));
  const msg = !S.metCeo ? `${ceo().name} menunggumu di pendopo besar. Cari tanda “!”.`
    : next >= 0 ? `${missions()[next].guide.name} (${missions()[next].building}) ingin mengajarimu sesuatu. Cari tanda “!”.`
    : doneCount() === missions().length && !S.sertifikat ? `Semua sabuk sudah kamu raih! Temui ${ceo().name} di pendopo untuk Ujian Sabuk.`
    : doneCount() === missions().length ? 'Kamu sudah lulus Ujian Sabuk. Buka sertifikatmu lewat Eyang Guru, atau mampir ke warung untuk latihan harian.'
    : 'Selesaikan latihan yang terbuka untuk membuka bangunan berikutnya.';
  d.replaceChildren($(`<div style="display:contents"><img class="portrait" alt="" src="${A.portraitOf(S.look)}"><div class="body"><div class="who">${esc(S.name)}</div><div class="txt">${esc(msg)}</div></div></div>`));
}

/* ---------- interactions ---------- */
function interact(o) {
  if (o.type === 'hq') return talkCeo();
  if (o.type === 'mission') return talkGuide(o.i);
  if (o.type === 'cafe') return cafe();
  if (o.type === 'board') return env.onJournal && env.onJournal();
  if (o.type === 'fountain') { const f = C.facts && C.facts.length ? C.facts[Math.floor(Math.random() * C.facts.length)] : 'Airnya dingin sekali.'; return dialog({ name: 'Pancuran', emoji: '⛲' }, [f]); }
}
function talkCeo() {
  const first = !S.metCeo, all = doneCount() === missions().length;
  if (!first && S.sertifikat) return dialog(ceo(), ['Selamat, Pendekar {name}. Sertifikatmu tersimpan di padepokan. Tunjukkan dengan bangga!'],
    [['Lihat sertifikat ▸', () => { history.pushState(null, '', `?s=${encodeURIComponent(S.sertifikat)}`); halamanSertifikat(S.sertifikat); }, 'green'], ['Nanti', idle, 'ghost']]);
  if (!first && all) {
    const lagi = S.ujian ? [`Nilaimu terakhir ${S.ujian.skor} dari ${S.ujian.total}. Sudah mengulang materinya? Ayo coba sekali lagi.`] : ['Semua sabuk sudah kamu raih, {name}. Saatnya Ujian Sabuk.'];
    return dialog(ceo(), [...lagi, `Ada 10 soal tentang visi, misi, ikrar, dan profil padepokan. Kamu lulus jika minimal ${LULUS} benar. Jawaban dinilai setelah soal terakhir.`],
      [['Mulai ujian ▸', () => playUjian(() => startWorld()), 'green'], ['Nanti', idle, 'ghost']]);
  }
  dialog(ceo(), first ? C.welcome.lines : ['Teruskan latihanmu, {name}. Setelah semua sabuk kamu raih, kembalilah ke sini untuk Ujian Sabuk.'], [[first ? 'Siap, Eyang! ▸' : 'Siap!', () => {
    if (first) { S.metCeo = true; S.xp += 10; save(); hooks.onProgress && hooks.onProgress(); sfx.good(); refreshHud(); toast('+10 XP · Pelatih pertama siap menemuimu.'); }
    idle();
  }, 'green']]);
}
function talkGuide(i) {
  const m = missions()[i], who = { name: m.guide.name, role: m.guide.role, look: lookOfGuide(m.guide) };
  const back = finished => { startWorld(); if (finished && m.outro && m.outro.length) dialog(who, m.outro); };
  if (isDone(m)) return dialog(who, [m.tip || `Senang bertemu lagi, {name}.`], [['Ulangi latihan', () => playMission(m, back), 'blue'], ['OK', idle, 'ghost']]);
  if (!isOpen(i)) {
    const need = !S.metCeo ? `Temui ${ceo().name} dulu.` : `Tempat ini terbuka setelah “${missions()[i - 1].title}”.`;
    return dialog({ name: m.building, emoji: '🚧' }, [need]);
  }
  const started = (S.step[m.id] || 0) > 0;
  dialog(who, started ? [`Selamat datang kembali, {name}. Kita lanjutkan “${m.title}”?`] : m.intro, [[started ? 'Lanjutkan ▸' : 'Mulai ▸', () => playMission(m, back), 'green'], ['Nanti', idle, 'ghost']]);
}
function cafe() {
  const who = { name: 'Warung Kopi', emoji: '☕' }, pool = missions().filter(isDone).flatMap(questionsOf);
  if (!pool.length) return dialog(who, ['Kopi tubruk siap. Latihan harian dibuka setelah kamu meraih sabuk pertama. Sampai nanti!']);
  if (S.review.last === today()) return dialog(who, [`Latihan hari ini sudah selesai. Runtunan: ${S.review.streak} hari. Datang lagi besok!`]);
  dialog(who, ['Kopi sudah diseduh. Mau latihan singkat? Tiga soal dari materi yang sudah kamu pelajari.'], [['Mulai ▸', () => playReview(shuffle(pool).slice(0, 3), done => {
    if (done) {
      const y = new Date(Date.now() - 864e5), yest = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      S.review = { last: today(), streak: S.review.last === yest ? (S.review.streak || 0) + 1 : 1, total: (S.review.total || 0) + 1 }; S.xp += 10; save(); hooks.onProgress && hooks.onProgress();
      celebrate({ emoji: '☕', title: 'Latihan selesai!', text: `+10 XP · runtunan: ${S.review.streak} hari.`, button: 'Lanjut' }, () => startWorld());
    } else startWorld();
  }), 'green'], ['Nanti', idle, 'ghost']]);
}

/** Where a tile's centre is on screen (may be outside the canvas when the tile is off-camera). Used by the tests. */
export function clientPointOfTile(x, y) {
  const r = cv.getBoundingClientRect();
  return { x: r.left + ((x + .5) * T - camX) / (VC * T) * r.width, y: r.top + ((y + .5) * T - camY) / (VR * T) * r.height };
}
export const guideTileOf = i => guideTile(i);
export const ceoTile = () => CEO_AT;

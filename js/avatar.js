// avatar.js — the character builder and small avatar pictures.
import * as A from './art.js';
import { $ } from './ui.js';

function paint(cv, look, dir = 0, frame = 0) {
  const s = A.charSprite(A.lookOf(look), dir, frame);
  if (cv.width !== s.w || cv.height !== s.h) { cv.width = s.w; cv.height = s.h; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, s.w, s.h); g.drawImage(s.cv, 0, 0);
}
/** A still picture of a look. `h` is the CSS height in px. */
export function avatarCanvas(look, h = 48) {
  const cv = document.createElement('canvas'); cv.className = 'avatar'; paint(cv, look);
  cv.style.height = h + 'px'; cv.style.width = Math.round(h * 26 / 38) + 'px';
  return cv;
}
/** The builder. Calls onChange(look) on every change; `look` is a plain object that can be stored as JSON. */
export function avatarBuilder(start, onChange) {
  let o = Object.assign(A.defaultLook(), start || {});
  const w = $(`<div class="avb"><div class="avb-top"><div class="avb-prev"><canvas aria-label="Karaktermu"></canvas></div>
      <div class="avb-side"><p class="small">Inilah dirimu di padepokan. Bisa diubah nanti lewat ⚙.</p><button class="btn ghost mini" type="button" data-rnd>🎲 Acak</button></div></div>
    <div class="avb-rows"></div></div>`);
  const cv = w.querySelector('canvas'), rows = w.querySelector('.avb-rows');
  let tick = 0;
  const timer = setInterval(() => { if (!w.isConnected) { if (++tick > 40) clearInterval(timer); return; } tick++; paint(cv, o, [0, 3, 2, 1][Math.floor(tick / 16) % 4], tick % 4); }, 140);
  const swatches = (key, cols, label) => `<div class="avb-row"><span>${label}</span><div class="sws" data-k="${key}">${cols.map((c, i) => `<button type="button" data-v="${i}" style="background:${c}" aria-label="${label} ${i + 1}"></button>`).join('')}</div></div>`;
  const seg = (key, names, label) => `<div class="avb-row"><span>${label}</span><div class="seg" data-k="${key}">${names.map((n, i) => `<button type="button" data-v="${i}">${n}</button>`).join('')}</div></div>`;
  function build() {
    const scarf = o.hs >= 6;
    rows.innerHTML = swatches('skin', A.SKIN, 'Kulit') + seg('hs', A.HAIR_STYLES, 'Rambut') + swatches('hair', scarf ? A.SCARFC : A.HAIRC, scarf ? 'Warna kerudung' : 'Warna rambut')
      + swatches('top', A.TOPC, 'Baju') + seg('skirt', ['Celana', 'Rok'], 'Bawahan') + swatches('bottom', A.BOTTOMC, 'Warna bawahan')
      + seg('glasses', ['Tanpa kacamata', 'Kacamata'], 'Kacamata') + (scarf ? '' : seg('cap', ['Tanpa topi', 'Topi'], 'Topi'));
    rows.querySelectorAll('[data-k]').forEach(grp => grp.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (o[grp.dataset.k] | 0) === (b.dataset.v | 0));
      b.onclick = () => { o[grp.dataset.k] = b.dataset.v | 0; build(); paint(cv, o); onChange({ ...o }); };
    }));
  }
  w.querySelector('[data-rnd]').onclick = () => { o = A.randomLook(); build(); paint(cv, o); onChange({ ...o }); };
  build(); paint(cv, o);
  return w;
}

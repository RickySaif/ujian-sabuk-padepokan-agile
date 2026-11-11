// ui.js — tiny DOM helpers shared by every screen.
export const root = document.getElementById('root');
export const layer = document.getElementById('layer');

/** Build one element from an HTML string. */
export const $ = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** Only http(s) and mailto links from the content file are ever rendered as links. */
export const safeUrl = u => /^(https?:\/\/|mailto:)/i.test(String(u || '')) ? String(u) : '';

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

/** Full-screen panel over the campus (missions, journal, settings). Returns the panel element. */
export function panel(title, sub, build, onClose) {
  const p = $(`<div class="panel"><div class="wrap"><div class="ptop">
      <button class="btn ghost icon" aria-label="Kembali">◂</button>
      <div class="t"><b>${esc(title)}</b><span>${esc(sub || '')}</span></div></div><div class="pbody"></div></div></div>`);
  p.querySelector('button').onclick = () => { closePanel(); onClose && onClose(); };
  build(p.querySelector('.pbody'), p);
  layer.replaceChildren(p); p.scrollTop = 0;
  return p;
}
export const closePanel = () => layer.replaceChildren();
export const panelOpen = () => layer.children.length > 0;

/** A celebration card with an optional big emoji, stars and one button. */
export function celebrate({ emoji = '🎉', title, text = '', stars = 0, button = 'Lanjut' }, then) {
  const c = $(`<div class="celebrate"><div class="frame pop">
      <div class="bigemoji">${esc(emoji)}</div>
      ${stars ? `<div class="stars">${[1, 2, 3].map(k => k <= stars ? '<b>★</b>' : '☆').join('')}</div>` : ''}
      <div class="big">${esc(title)}</div><p>${esc(text)}</p>
      <button class="btn green block">${esc(button)}</button></div></div>`);
  c.querySelector('button').onclick = () => { c.remove(); then && then(); };
  document.body.append(c);
}

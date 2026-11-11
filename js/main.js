// main.js — mulai: halaman sertifikat (?s=KODE) atau permainan. Tidak ada login; kemajuan disimpan di browser ini.
import { $, esc, root } from './ui.js';
import { S, openSave, save } from './state.js';
import { C, loadContent } from './content.js';
import { startWorld, refreshHud } from './world.js';
import { profileScreen, journal, settingsPanel } from './screens.js';
import { halamanSertifikat } from './ujian.js';
import { hooks } from './hooks.js';

const message = (title, text, button) => { root.replaceChildren($(`<div><div class="title"><h1>Padepokan Agile</h1></div><div class="frame"><h2>${esc(title)}</h2><div>${text}</div>${button || ''}</div></div>`)); };

async function boot() {
  openSave('guest');
  const kode = new URLSearchParams(location.search).get('s');
  if (kode) return halamanSertifikat(kode);
  const r = await loadContent();
  if (r.errors.length) return message('Berkas materi bermasalah', `<p>Perbaiki hal berikut di <code>content/company.json</code> (lihat <code>docs/CONTENT.md</code>):</p><ul class="err">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`);
  document.title = `Ujian Sabuk · ${C.company.name}`;
  hooks.onProgress = refreshHud;
  const go = () => startWorld({ onJournal: journal, onSettings: () => settingsPanel() });
  if (!S.setup) profileScreen(() => { S.setup = true; save(); go(); }); else go();
}

window.addEventListener('popstate', () => location.reload());
boot().catch(e => { console.error(e); message('Ada yang tidak beres', `<p>${esc(e.message || e)}</p>`, '<button class="btn" onclick="location.reload()">Coba lagi</button>'); });

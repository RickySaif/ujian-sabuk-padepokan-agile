// screens.js — the screens around the campus: first-run profile, journal, settings.
import * as A from './art.js';
import { S, save, setState, fresh } from './state.js';
import { C, missions, levelNames, levelFor } from './content.js';
import { $, esc, root, panel, closePanel, toast } from './ui.js';
import { avatarBuilder } from './avatar.js';
import { isDone, isOpen, startWorld, doneCount } from './world.js';
import { hooks } from './hooks.js';
import { linkSertifikat } from './ujian.js';
import { sfx } from './audio.js';

/** First run (or "Change name / character"): pick a name and a look. */
export function profileScreen(then, { title = 'Siapa calon pendekar kita?', button = 'Masuk padepokan ▸' } = {}) {
  let look = { ...S.look };
  const f = $(`<div><div class="title"><h1>${esc(C.company.name)}</h1><p>${esc(C.company.tagline || 'Selamat datang.')}</p></div>
    <div class="frame"><h2>${esc(title)}</h2>
      <div class="field"><label for="nm"><b>Nama lengkapmu</b> <span class="small">(akan tertulis di sertifikat)</span></label><input id="nm" maxlength="40" autocomplete="name" placeholder="Nama lengkap" value="${esc(S.name)}"></div>
      <b>Buat karaktermu</b><div class="slot" style="margin:8px 0 14px"></div>
      <button class="btn green block" id="go">${esc(button)}</button><p class="err" id="err"></p></div></div>`);
  f.querySelector('.slot').append(avatarBuilder(look, v => { look = v; }));
  f.querySelector('#go').onclick = () => {
    const n = f.querySelector('#nm').value.trim().replace(/\s+/g, ' ');
    if (!n) { f.querySelector('#err').textContent = 'Tulis namamu dulu.'; return; }
    S.name = n; S.look = look; save(); hooks.onProfile && hooks.onProfile(); sfx.good(); then();
  };
  root.replaceChildren(f);
}

/** Journal: every mission with its status, plus badges and the checklist items still open. */
export function journal() {
  const L = levelFor(S.xp), ms = missions();
  panel('Catatan latihan', `${doneCount()} dari ${ms.length} sabuk · ${S.xp} XP`, body => {
    const badges = ms.filter(m => isDone(m) && m.badge);
    body.append($(`<div class="frame"><h2>Tingkat ${L + 1}: ${esc(levelNames()[L])}</h2>
      <div class="levels">${levelNames().map((n, i) => `<span class="${i <= L ? 'on' : ''}">${i + 1}. ${esc(n)}</span>`).join('')}</div>
      <h3>Sabuk</h3><div class="badges">${badges.length ? badges.map(m => `<div class="badge"><span>${esc(m.badge.emoji || '🏅')}</span>${esc(m.badge.name)}</div>`).join('') : '<p class="small">Selesaikan latihan pertama untuk meraih sabukmu.</p>'}</div></div>`));
    const list = $(`<div class="list"></div>`);
    ms.forEach((m, i) => {
      const done = isDone(m), open = isOpen(i), stars = done ? S.missions[m.id].stars || 1 : 0;
      const todo = m.steps.filter(s => s.type === 'checklist').flatMap(s => s.items).filter(it => !(S.checks[m.id] || {})[it.id]);
      list.append($(`<div class="item ${done ? 'done' : open ? 'cur' : 'lock'}"><div class="ico" style="background:${esc(m.color || '#3A78C9')}">${esc(m.icon || '•')}</div>
        <div class="t"><b>${esc(m.title)}</b><span>${esc(m.building)} · ${esc(m.guide.name)}</span>
        <span>${done ? '★'.repeat(stars) + '☆'.repeat(3 - stars) + ' selesai' : open ? 'Terbuka: cari tanda “!” di padepokan' : '🔒 Terbuka setelah latihan sebelumnya'}</span>
        ${!done && open && todo.length ? `<span>Belum: ${todo.map(t => esc(t.text)).join(' · ')}</span>` : ''}</div></div>`));
    });
    body.append(list);
    const all = doneCount() === ms.length;
    body.append($(`<div class="item ${S.sertifikat ? 'done' : all ? 'cur' : 'lock'}" style="margin-top:10px"><div class="ico" style="background:#233F6E">🥋</div>
      <div class="t"><b>Ujian Sabuk</b><span>Pendopo utama · ${esc(C.welcome.from)}</span>
      <span>${S.sertifikat ? `Lulus · nilai ${esc(S.ujian ? S.ujian.skor + '/' + S.ujian.total : '')} · <a class="link" href="${esc(linkSertifikat(S.sertifikat))}">lihat sertifikat</a>` : all ? (S.ujian ? `Belum lulus (nilai ${esc(S.ujian.skor)}/${esc(S.ujian.total)}). Coba lagi di pendopo.` : 'Terbuka: temui Eyang Guru di pendopo') : '🔒 Terbuka setelah semua sabuk diraih'}</span></div></div>`));
  }, () => startWorld());
}

/** Pengaturan: nama dan karakter, suara, grafis ringan, mulai ulang. */
export function settingsPanel() {
  panel('Pengaturan', 'Kemajuan tersimpan di browser ini', body => {
    const b = $(`<div>
      <div class="frame"><h2>Kamu</h2><p>${esc(S.name)}</p>
        <div class="row"><button class="btn ghost" id="edit">Ganti nama / karakter</button></div>
        ${S.sertifikat ? '<p class="small" style="margin-top:8px">Sertifikat yang sudah terbit tetap memakai nama saat kamu lulus.</p>' : ''}</div>
      <div class="frame"><h2>Permainan</h2>
        <label class="toggle"><input type="checkbox" id="snd" ${S.sound ? 'checked' : ''}> Efek suara</label>
        <label class="toggle"><input type="checkbox" id="lite" ${A.gfxLite() ? 'checked' : ''}> Grafis ringan (untuk ponsel lambat)</label></div>
      <div class="frame note"><h2>Tanpa login</h2><p class="small">Kemajuanmu disimpan di browser ini saja. Kalau pindah perangkat atau menghapus data browser, latihan dimulai dari awal. Sertifikat yang sudah terbit tetap aman di database padepokan; simpan tautannya.</p>
        <div class="row" style="margin-top:8px"><button class="btn ghost" id="reset">Mulai dari awal</button></div></div></div>`);
    b.querySelector('#edit').onclick = () => { closePanel(); profileScreen(() => startWorld(), { title: 'Ganti nama / karakter', button: 'Simpan ▸' }); };
    b.querySelector('#snd').onchange = e => { S.sound = e.target.checked; save(); };
    b.querySelector('#lite').onchange = e => A.setGfxLite(e.target.checked);
    const reset = b.querySelector('#reset');
    reset.onclick = () => { if (reset.dataset.sure) { setState(fresh()); save(); location.reload(); } else { reset.dataset.sure = 1; reset.textContent = 'Ketuk sekali lagi untuk menghapus kemajuan'; } };
    body.append(b);
  }, () => startWorld());
}

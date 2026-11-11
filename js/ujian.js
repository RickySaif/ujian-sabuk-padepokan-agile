// ujian.js — Ujian Sabuk (dinilai di server) dan halaman sertifikat yang bisa dibagikan.
// Bank soal dan kunci jawaban hanya ada di database (supabase/setup.sql); browser tidak pernah menerimanya.
import { CONFIG } from './config.js';
import { S, save } from './state.js';
import { C } from './content.js';
import { $, esc, root, panel, closePanel, shuffle, toast, celebrate } from './ui.js';
import { avatarCanvas } from './avatar.js';
import { sfx } from './audio.js';

export const LULUS = 8;   // minimal benar dari 10, sama dengan aturan di padepokan_ujian()

async function rpc(fn, body) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) throw new Error('Ujian belum tersambung ke Supabase (lihat js/config.js).');
  let r;
  try {
    r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
  } catch (e) { throw new Error('Tidak bisa terhubung. Periksa koneksi internet, lalu coba lagi.'); }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && data.message) || `Server menjawab ${r.status}.`);
  return data;
}

/** Alamat yang bisa dibagikan untuk sebuah sertifikat. */
export const linkSertifikat = kode => `${location.origin}${location.pathname}?s=${encodeURIComponent(kode)}`;

/** Mainkan ujian akhir. onExit(hasil | null) dipanggil saat panel ditutup. */
export function playUjian(onExit) {
  panel('Ujian Sabuk', `10 soal · lulus jika minimal ${LULUS} benar`, async body => {
    body.append($(`<div class="frame"><p>Menyiapkan soal…</p></div>`));
    let soal;
    try { soal = await rpc('padepokan_soal'); }
    catch (e) { body.replaceChildren($(`<div class="frame"><h2>Soal belum bisa dimuat</h2><p class="err">${esc(e.message)}</p></div>`)); return; }
    const jawab = {}, dots = $(`<div class="steps"></div>`), box = $(`<div></div>`);
    body.replaceChildren(dots, box);
    let i = 0;
    const tanya = () => {
      const q = soal[i];
      dots.innerHTML = soal.map((_, k) => `<i class="${k < i ? 'past' : k === i ? 'on' : ''}"></i>`).join('');
      box.replaceChildren($(`<div class="frame"><p class="count">Soal ${i + 1} dari ${soal.length}</p><p class="qtext">${esc(q.q)}</p><div class="opts"></div>
        <p class="small" style="margin-top:10px">Jawaban tidak dinilai sekarang. Hasilnya keluar setelah soal terakhir.</p></div>`));
      const opts = box.querySelector('.opts');
      shuffle(q.options.map((label, k) => ({ label, k }))).forEach(o => {
        const b = $(`<button class="opt">${esc(o.label)}</button>`);
        b.onclick = () => { jawab[q.id] = o.k; sfx.tap(); if (++i < soal.length) tanya(); else kirim(); };
        opts.append(b);
      });
      body.closest('.panel').scrollTop = 0;
    };
    const kirim = async () => {
      dots.innerHTML = soal.map(() => '<i class="past"></i>').join('');
      box.replaceChildren($(`<div class="frame"><h2>Menilai jawabanmu…</h2><p class="small">Eyang Guru sedang memeriksa.</p></div>`));
      let h;
      try { h = await rpc('padepokan_ujian', { p_nama: S.name, p_look: S.look, p_jawaban: jawab }); }
      catch (e) {
        box.replaceChildren($(`<div class="frame"><h2>Jawaban belum terkirim</h2><p class="err">${esc(e.message)}</p><button class="btn green block" style="margin-top:10px">Kirim lagi</button></div>`));
        box.querySelector('button').onclick = kirim; return;
      }
      S.ujian = { skor: h.skor, total: h.total, at: new Date().toISOString(), tries: ((S.ujian && S.ujian.tries) || 0) + 1 };
      if (h.lulus) S.sertifikat = h.kode;
      save(); closePanel();
      if (h.lulus) {
        sfx.fanfare();
        celebrate({ emoji: '🥋', stars: h.skor === h.total ? 3 : h.skor >= 9 ? 2 : 1, title: 'Lulus Ujian Sabuk!', text: `Nilaimu ${h.skor} dari ${h.total}. Selamat, ${S.name}, kamu resmi menjadi Pendekar Agile.`, button: 'Lihat sertifikat ▸' },
          () => { history.replaceState(null, '', `?s=${encodeURIComponent(h.kode)}`); halamanSertifikat(h.kode); });
      } else {
        sfx.bad();
        const ulang = (h.ulang || []).join(', ');
        celebrate({ emoji: '🙏', title: 'Belum lulus', text: `Nilaimu ${h.skor} dari ${h.total}; minimal ${LULUS}. ${ulang ? `Ulangi materi: ${ulang}.` : ''} Kunjungi lagi para pelatih, lalu coba ujian sekali lagi.`, button: 'Kembali ke padepokan' }, () => onExit && onExit(h));
      }
    };
    tanya();
  }, () => onExit && onExit(null));
}

const tanggal = iso => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const LOGO = `<svg class="cert-logo" viewBox="0 0 100 116" role="img" aria-label="Logo Padepokan Agile">
  <defs><linearGradient id="pa-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F62C9"/><stop offset="1" stop-color="#1E4396"/></linearGradient></defs>
  <path d="M50 3 L94 17 Q95 72 50 113 Q5 72 6 17 Z" fill="#9CC3EE"/>
  <path d="M50 9 L88 21 Q88 69 50 105 Q12 69 12 21 Z" fill="url(#pa-g)" stroke="#fff" stroke-width="3"/>
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M58 37 A20 20 0 1 0 50 77 L72 77"/><path d="M66 70 L73 77 L66 84"/><circle cx="64" cy="34" r="6"/>
  </g></svg>`;

/** Halaman sertifikat untuk ?s=KODE. Bisa dibuka siapa saja yang memegang tautannya. */
export async function halamanSertifikat(kode) {
  document.title = 'Sertifikat · Padepokan Agile';
  root.replaceChildren($(`<div><p class="boot">Memuat sertifikat…</p></div>`));
  let d = null, gagal = '';
  try { d = await rpc('padepokan_sertifikat', { p_kode: kode }); } catch (e) { gagal = e.message; }
  const balik = `<a class="btn ghost" href="${esc(location.pathname)}">${S.setup ? 'Kembali ke padepokan' : 'Ikuti Ujian Sabuk'}</a>`;
  if (!d) {
    root.replaceChildren($(`<div><div class="title"><h1>Padepokan Agile</h1></div><div class="frame"><h2>Sertifikat tidak ditemukan</h2>
      <p>${gagal ? esc(gagal) : `Tidak ada sertifikat dengan kode <b>${esc(kode)}</b>. Periksa kembali tautannya.`}</p><div class="row" style="margin-top:12px">${balik}</div></div></div>`));
    return;
  }
  const milikku = S.sertifikat && S.sertifikat === d.kode, url = linkSertifikat(d.kode);
  const page = $(`<div class="certpage">
    <article class="cert" aria-label="Sertifikat">
      <div class="cert-in">
        ${LOGO}
        <p class="cert-org">PADEPOKAN AGILE</p>
        <h1 class="cert-h">Sertifikat Pendekar Agile</h1>
        <div class="cert-av"></div>
        <p class="cert-small">dengan ini menyatakan bahwa</p>
        <p class="cert-name">${esc(d.nama)}</p>
        <p class="cert-small">telah <b>LULUS</b> dengan nilai <b>${esc(d.skor)}/${esc(d.total)}</b><br>dan resmi menjadi <b>Pendekar Agile</b></p>
        <blockquote class="cert-visi">“Membangun masyarakat Indonesia yang tangkas dan adaptif”</blockquote>
        <div class="cert-foot"><span>${esc(tanggal(d.terbit_at))}</span><span>Kode: <b>${esc(d.kode)}</b></span></div>
        <p class="cert-verify">Periksa keaslian: ${esc(url.replace(/^https?:\/\//, ''))}</p>
      </div>
    </article>
    <div class="frame cert-actions">
      ${milikku ? '<p><b>Simpan bukti kelulusanmu.</b> Ambil tangkapan layar sertifikat di atas, atau bagikan tautannya. Siapa pun yang membuka tautan itu bisa memeriksa keasliannya.</p>' : '<p class="small">Sertifikat ini tercatat di database Padepokan Agile. Isi di atas diambil langsung dari catatan tersebut.</p>'}
      <div class="row" style="margin-top:10px">${milikku ? '<button class="btn green" id="share">Bagikan</button><button class="btn blue" id="copy">Salin tautan</button>' : ''}${balik}</div>
    </div></div>`);
  page.querySelector('.cert-av').append(avatarCanvas(d.look && Object.keys(d.look).length ? d.look : S.look, 96));
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Tautan disalin.'); } catch (e) { toast(url); } };
  const c = page.querySelector('#copy'); if (c) c.onclick = copy;
  const s = page.querySelector('#share');
  if (s) s.onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Sertifikat Pendekar Agile', text: `${d.nama} resmi menjadi Pendekar Agile!`, url }); } catch (e) { /* dibatalkan */ } }
    else copy();
  };
  root.replaceChildren(page);
}

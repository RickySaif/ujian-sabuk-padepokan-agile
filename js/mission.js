// mission.js — plays one mission: a list of steps (read, cards, quiz, match, order, checklist) inside a panel.
// Each step is a function that draws itself into `box` and calls `done()` when the player may move on.
import { S, save } from './state.js';
import { $, esc, panel, closePanel, shuffle, safeUrl, celebrate } from './ui.js';
import { sfx } from './audio.js';
import { missionXp, questionsOf } from './content.js';
import { hooks } from './hooks.js';

const fill = t => String(t).replaceAll('{name}', S.name || 'kawan');
const para = t => fill(t).split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join('');
const nextBtn = (label = 'Lanjut ▸') => $(`<button class="btn green block next" disabled>${esc(label)}</button>`);

/* ---------- step renderers ---------- */
const STEPS = {
  read(step, box, done) {
    const url = step.link && safeUrl(step.link.url);
    box.append($(`<div class="frame"><h2>${esc(step.title || 'Bacaan')}</h2><div class="prose">${para(step.body)}</div>
      ${url ? `<p><a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(step.link.label || 'Buka tautan')} ↗</a></p>` : ''}</div>`));
    done();
  },

  cards(step, box, done) {
    const f = $(`<div class="frame"><h2>${esc(step.title || 'Kartu')}</h2><p class="lead">Ketuk setiap kartu untuk membaliknya.</p><div class="cards"></div></div>`);
    const seen = new Set();
    step.cards.forEach((c, i) => {
      const b = $(`<button class="card"><span class="e">${esc(c.emoji || '💡')}</span><b>${esc(c.front)}</b><span class="tap">ketuk</span></button>`);
      b.onclick = () => {
        b.classList.add('open'); b.innerHTML = `<span class="e">${esc(c.emoji || '💡')}</span><b>${esc(c.front)}</b><span class="back">${esc(fill(c.back))}</span>`;
        if (!seen.has(i)) { seen.add(i); sfx.tap(); if (seen.size === step.cards.length) done(); }
      };
      f.querySelector('.cards').append(b);
    });
    box.append(f);
  },

  quiz(step, box, done, ctx) {
    const f = $(`<div class="frame"><h2>${esc(step.title || 'Cek pemahaman')}</h2><div class="q"></div></div>`); box.append(f);
    const qbox = f.querySelector('.q'); let i = 0;
    const ask = () => {
      const q = step.questions[i]; let tries = 0;
      qbox.replaceChildren($(`<div><p class="count">Soal ${i + 1} dari ${step.questions.length}</p><p class="qtext">${esc(fill(q.q))}</p><div class="opts"></div><p class="fb" aria-live="polite"></p></div>`));
      const opts = qbox.querySelector('.opts'), fb = qbox.querySelector('.fb');
      shuffle(q.options.map((label, k) => ({ label, ok: k === q.answer }))).forEach(o => {
        const b = $(`<button class="opt">${esc(o.label)}</button>`);
        b.onclick = () => {
          tries++;
          if (tries === 1) recordAnswer(ctx.mission.id, q.id, o.ok);
          if (!o.ok) { b.classList.add('bad'); b.disabled = true; fb.className = 'fb bad'; fb.textContent = 'Belum tepat. Coba lagi.'; sfx.bad(); return; }
          b.classList.add('good'); opts.querySelectorAll('button').forEach(x => { x.disabled = true; }); sfx.good();
          fb.className = 'fb good'; fb.textContent = q.why ? fill(q.why) : 'Betul!';
          const more = i < step.questions.length - 1;
          if (more) { const n = $(`<button class="btn block" style="margin-top:10px">Soal berikutnya ▸</button>`); n.onclick = () => { i++; ask(); }; qbox.firstElementChild.append(n); }
          else done();
        };
        opts.append(b);
      });
    };
    ask();
  },

  match(step, box, done) {
    const f = $(`<div class="frame"><h2>${esc(step.title || 'Pasangkan')}</h2><p class="lead">${esc(step.prompt || 'Ketuk satu di kiri, lalu pasangannya di kanan.')}</p><div class="match"><div class="col l"></div><div class="col r"></div></div><p class="fb" aria-live="polite"></p></div>`);
    const L = f.querySelector('.l'), R = f.querySelector('.r'), fb = f.querySelector('.fb'); let sel = null, left = step.pairs.length;
    const pick = (b, side) => {
      if (side === 'l') { L.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = b; return; }
      if (!sel) { fb.className = 'fb'; fb.textContent = 'Pilih satu di kiri dulu.'; return; }
      if (sel._i === b._i) { [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('good'); x.disabled = true; }); sel = null; sfx.good(); fb.textContent = ''; if (--left === 0) done(); }
      else { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 350); sfx.bad(); fb.className = 'fb bad'; fb.textContent = 'Bukan yang itu.'; }
    };
    shuffle(step.pairs.map((p, i) => [p[0], i])).forEach(([t, i]) => { const b = $(`<button class="chip">${esc(t)}</button>`); b._i = i; b.onclick = () => pick(b, 'l'); L.append(b); });
    shuffle(step.pairs.map((p, i) => [p[1], i])).forEach(([t, i]) => { const b = $(`<button class="chip">${esc(t)}</button>`); b._i = i; b.onclick = () => pick(b, 'r'); R.append(b); });
    box.append(f);
  },

  order(step, box, done) {
    const f = $(`<div class="frame"><h2>${esc(step.title || 'Urutkan')}</h2><p class="lead">${esc(step.prompt || 'Ketuk sesuai urutan yang benar.')}</p><ol class="placed"></ol><div class="pool"></div><p class="fb" aria-live="polite"></p></div>`);
    const placed = f.querySelector('.placed'), pool = f.querySelector('.pool'), fb = f.querySelector('.fb'); let n = 0;
    shuffle(step.items.map((t, i) => [t, i])).forEach(([t, i]) => {
      const b = $(`<button class="chip">${esc(t)}</button>`);
      b.onclick = () => {
        if (i !== n) { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 350); sfx.bad(); fb.className = 'fb bad'; fb.textContent = 'Ada yang seharusnya lebih dulu.'; return; }
        n++; b.remove(); placed.append($(`<li>${esc(t)}</li>`)); sfx.good(); fb.textContent = '';
        if (n === step.items.length) { fb.className = 'fb good'; fb.textContent = 'Urutannya sudah benar.'; done(); }
      };
      pool.append(b);
    });
    box.append(f);
  },

  checklist(step, box, done, ctx) {
    const f = $(`<div class="frame"><h2>${esc(step.title || 'Daftar centang')}</h2><p class="lead">${esc(step.prompt || 'Lakukan sungguh-sungguh, lalu centang.')}</p><div class="checks"></div>
      <p class="small">Centangmu tersimpan, jadi kamu bisa kembali kapan saja.</p></div>`);
    const mine = (S.checks[ctx.mission.id] ||= {});
    const update = () => { if (step.items.every(it => mine[it.id])) done(); };
    step.items.forEach(it => {
      const url = safeUrl(it.link);
      const row = $(`<label class="check"><input type="checkbox" ${mine[it.id] ? 'checked' : ''}><span>${esc(it.text)}${url ? ` <a class="link" href="${esc(url)}" target="_blank" rel="noopener">buka ↗</a>` : ''}</span></label>`);
      row.querySelector('input').onchange = e => { if (e.target.checked) { mine[it.id] = true; sfx.tap(); } else delete mine[it.id]; save(); hooks.onProgress && hooks.onProgress(); update(); };
      f.querySelector('.checks').append(row);
    });
    box.append(f); update();
  },
};

/** Remember whether the first answer to a question was right (used for stars and for the admin statistics). */
function recordAnswer(missionId, qid, ok) {
  if (missionId === '_review' || qid in S.firstTry) return;   // the daily review never changes the record
  S.firstTry[qid] = !!ok; save();
  hooks.onAnswer && hooks.onAnswer(missionId, qid, !!ok);
}
/** 3 stars for 90%+ first-try answers, 2 for 60%+, otherwise 1. Missions without a quiz give 3. */
export function starsFor(mission) {
  const qs = questionsOf(mission); if (!qs.length) return 3;
  const right = qs.filter(q => S.firstTry[q.id]).length / qs.length;
  return right >= 0.9 ? 3 : right >= 0.6 ? 2 : 1;
}

/** Play a mission from the step the player left off at. `onExit(finished)` runs when the panel closes. */
export function playMission(mission, onExit) {
  const replay = !!S.missions[mission.id];
  let i = replay ? 0 : Math.min(S.step[mission.id] || 0, mission.steps.length - 1);
  panel(mission.title, `${mission.building} · bersama ${mission.guide.name}`, body => {
    const dots = $(`<div class="steps"></div>`), box = $(`<div></div>`), nx = nextBtn();
    body.append(dots, box, nx);
    const show = () => {
      dots.innerHTML = mission.steps.map((_, k) => `<i class="${k < i ? 'past' : k === i ? 'on' : ''}"></i>`).join('');
      box.replaceChildren(); nx.disabled = true;
      const last = i === mission.steps.length - 1;
      nx.textContent = last ? 'Selesai ✓' : 'Lanjut ▸';
      STEPS[mission.steps[i].type](mission.steps[i], box, () => { nx.disabled = false; }, { mission });
      body.closest('.panel').scrollTop = 0;
    };
    nx.onclick = () => {
      if (i < mission.steps.length - 1) { i++; if (!replay) { S.step[mission.id] = i; save(); } show(); return; }
      finish(mission, replay, onExit);
    };
    show();
  }, () => onExit && onExit(false));
}

function finish(mission, replay, onExit) {
  const stars = starsFor(mission), gained = replay ? 0 : missionXp(mission);
  if (!replay) { S.missions[mission.id] = { stars, at: new Date().toISOString() }; S.xp += gained; delete S.step[mission.id]; }
  else S.missions[mission.id].stars = Math.max(S.missions[mission.id].stars || 1, stars);
  save(); hooks.onProgress && hooks.onProgress();
  closePanel(); sfx.fanfare();
  const badge = mission.badge;
  celebrate({
    emoji: (badge && badge.emoji) || mission.icon || '🎉', stars,
    title: replay ? `${mission.title}: diulang` : `${mission.badge ? mission.badge.name : mission.title} diraih!`,
    text: replay ? 'Mengulang materi selalu ada gunanya.' : `+${gained} XP · ${mission.title} selesai. ${mission.building} kini berdiri di padepokan.`, button: 'Lanjut',
  }, () => onExit && onExit(true));
}

/** The daily review at the café: a few questions from missions already finished. */
export function playReview(questions, onExit) {
  panel('Latihan harian', 'Beberapa soal dari materi yang sudah kamu pelajari', body => {
    const box = $(`<div></div>`), nx = nextBtn('Selesai ✓'); body.append(box, nx);
    STEPS.quiz({ type: 'quiz', title: 'Latihan harian', questions }, box, () => { nx.disabled = false; }, { mission: { id: '_review' } });
    nx.onclick = () => { closePanel(); onExit && onExit(true); };
  }, () => onExit && onExit(false));
}

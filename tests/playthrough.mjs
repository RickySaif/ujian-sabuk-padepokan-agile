// playthrough.mjs — plays the whole game (5 belts + the final exam) in a real browser at phone size, then checks the result.
// Needs Playwright and Google Chrome:  npm i -D playwright   Then start the app (npm start) and run: npm run test:play
// Options: BASE=http://localhost:4810  SHOTS=1 (save screenshots to tests/shots/)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:4810', HERE = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(fs.readFileSync(path.join(HERE, '../content/company.json'), 'utf8'));
const shots = process.env.SHOTS ? path.join(HERE, 'shots') : null; if (shots) fs.mkdirSync(shots, { recursive: true });
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FAIL  ') + m); if (!c) failed++; };

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = [];
// The final exam and the certificate are served by Supabase. Here they are simulated, so the test never writes to the real database.
const BANK = [['t1', 'Soal satu', ['A', 'B'], 0], ['t2', 'Soal dua', ['A', 'B'], 1], ['t3', 'Soal tiga', ['A', 'B'], 0], ['t4', 'Soal empat', ['A', 'B'], 1], ['t5', 'Soal lima', ['A', 'B'], 0],
  ['t6', 'Soal enam', ['A', 'B'], 1], ['t7', 'Soal tujuh', ['A', 'B'], 0], ['t8', 'Soal delapan', ['A', 'B'], 1], ['t9', 'Soal sembilan', ['A', 'B'], 0], ['t10', 'Soal sepuluh', ['A', 'B'], 1]];
let issued = null;
const fakeSupabase = async route => {
  const fn = route.request().url().split('/').pop(), body = JSON.parse(route.request().postData() || '{}'), json = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'padepokan_soal') return json(BANK.map(([id, q, options]) => ({ id, q, options })));
  if (fn === 'padepokan_ujian') {
    const skor = BANK.filter(([id, , , a]) => body.p_jawaban[id] === a).length;
    if (skor < 8) return json({ lulus: false, skor, total: 10, ulang: ['Visi'] });
    issued = { kode: 'PA-TEST000001', nama: body.p_nama, look: body.p_look, skor, total: 10, terbit_at: new Date().toISOString() };
    return json({ lulus: true, skor, total: 10, kode: issued.kode, ulang: [] });
  }
  if (fn === 'padepokan_sertifikat') return json(issued && body.p_kode === issued.kode ? issued : null);
  return route.abort();
};
await ctx.route('**/rest/v1/rpc/*', fakeSupabase);
/** Answer the exam: the first `wrong` questions wrongly, the rest rightly. */
async function sitExam(wrong) {
  for (let k = 0; k < BANK.length; k++) {
    const text = await page.textContent('.qtext'), item = BANK.find(b => b[1] === text);
    await page.locator('.opt').filter({ hasText: new RegExp('^' + item[2][k < wrong ? 1 - item[3] : item[3]] + '$') }).first().click();
  }
}
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('padepokan:guest')));
/** Tap a map tile the way a finger would (the click lands on the canvas at that tile's position). */
const tapTile = async (x, y) => { await page.evaluate(async ([x, y]) => { const w = await import('./js/world.js'); const p = w.clientPointOfTile(x, y); document.getElementById('campus').dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true })); }, [x, y]); };
/** Press dialog buttons until one whose label matches appears, then press it. */
async function talkUntil(re) { for (let i = 0; i < 12; i++) { const b = page.locator('#dlg button').filter({ hasText: re }); if (await b.count()) { await b.first().click(); return; } await page.locator('#dlg button', { hasText: 'Lanjut' }).first().click(); } throw new Error('dialog button not found: ' + re); }

/* ----- one step of a mission, solved from the content file ----- */
async function solveStep(step, wrongFirst) {
  if (step.type === 'cards') for (const b of await page.locator('.card').all()) await b.click();
  if (step.type === 'quiz') for (let k = 0; k < step.questions.length; k++) {
    const q = step.questions[k];
    if (wrongFirst && k === 0) await page.locator('.opt', { hasText: q.options[(q.answer + 1) % q.options.length] }).first().click();
    await page.locator('.opt').filter({ hasText: q.options[q.answer] }).first().click();
    if (k < step.questions.length - 1) await page.locator('button', { hasText: 'Soal berikutnya' }).click();
  }
  if (step.type === 'match') for (const [l, r] of step.pairs) { await page.locator('.match .l .chip').filter({ hasText: l }).first().click(); await page.locator('.match .r .chip').filter({ hasText: r }).first().click(); }
  if (step.type === 'order') for (const it of step.items) await page.locator('.pool .chip').filter({ hasText: it }).first().click();
  if (step.type === 'checklist') for (const c of await page.locator('.check input').all()) await c.check();
}

await page.goto(BASE + '/'); await page.waitForSelector('#nm');
await shot('1-profile');
await page.fill('#nm', 'Robin  Pendekar'); await page.click('[data-k=hs] button[data-v="2"]'); await page.click('[data-k=glasses] button[data-v="1"]'); await page.click('#go');
await page.waitForSelector('#campus'); await page.waitForTimeout(600);
ok((await page.textContent('#dlg')).includes(content.welcome.from), 'the campus opens and points at the CEO');
await shot('2-campus');

// a building that is not open yet explains why
await page.evaluate(async () => { const w = await import('./js/world.js'); const [x, y] = w.LOTS[0]; const p = w.clientPointOfTile(x, y); document.getElementById('campus').dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true })); });
await page.waitForFunction(() => /Temui/.test(document.getElementById('dlg').textContent), null, { timeout: 15000 });
ok(true, 'a plot explains that you meet Eyang Guru first');

const [cx, cy] = await page.evaluate(async () => (await import('./js/world.js')).ceoTile());
await tapTile(cx, cy);
await page.waitForFunction(n => document.getElementById('dlg').textContent.includes(n) && !!document.querySelector('#dlg button'), content.welcome.from, { timeout: 15000 });
await shot('3-ceo'); await talkUntil(/Siap, Eyang/);
ok((await state()).metCeo === true, 'meeting the CEO is saved');

for (let i = 0; i < content.missions.length; i++) {
  const m = content.missions[i];
  const [gx, gy] = await page.evaluate(async i => (await import('./js/world.js')).guideTileOf(i), i);
  await tapTile(gx, gy);
  await page.waitForFunction(n => document.querySelector('#dlg .who') && document.querySelector('#dlg .who').textContent.includes(n) && !!document.querySelector('#dlg button'), m.guide.name, { timeout: 20000 });
  await talkUntil(/Mulai|Lanjutkan/);
  await page.waitForSelector('.panel');
  for (let s = 0; s < m.steps.length; s++) {
    if (i === 0 && s === 1) await shot('4-cards');
    await solveStep(m.steps[s], i === 1);
    if (i === 0 && m.steps[s].type === 'quiz') await shot('5-quiz');
    if (i === 1 && m.steps[s].type === 'match') await shot('6-match');
    await page.locator('.next:not([disabled])').click();
  }
  await page.waitForSelector('.celebrate'); if (i === 0) await shot('7-done');
  await page.click('.celebrate button'); await page.waitForSelector('#campus');
  const b = page.locator('#dlg button'); if (await b.count()) await b.first().click();
}
const S = await state();
ok(Object.keys(S.missions).length === content.missions.length, `all ${content.missions.length} missions are saved as done`);
ok(S.missions[content.missions[0].id].stars === 3, 'a mission with every first answer right gets 3 stars');
ok(S.missions[content.missions[1].id].stars < 3, 'a mission with a wrong first answer gets fewer stars');
ok(S.xp === 10 + content.missions.reduce((n, m) => n + (m.xp || 100), 0), `XP adds up (${S.xp})`);
ok((await page.textContent('#count')).trim() === `${content.missions.length}/${content.missions.length}`, 'the progress bar shows everything done');
await page.waitForTimeout(500); await shot('8-campus-done');

// reload: progress survives; the journal and the daily review work
await page.reload(); await page.waitForSelector('#campus');
ok((await page.textContent('#lvl')).includes(content.levels[content.levels.length - 1]), 'after a reload the top level is still shown');
await page.click('#journal'); await page.waitForSelector('.badge'); ok(await page.locator('.badge').count() === content.missions.filter(m => m.badge).length, 'the journal shows every belt'); await shot('9-journal');
await page.click('.ptop button'); await page.waitForSelector('#campus');
await tapTile(9, 3); await page.waitForFunction(() => /latihan singkat/i.test(document.getElementById('dlg').textContent), null, { timeout: 20000 });
await page.locator('#dlg button', { hasText: 'Mulai' }).click(); await page.waitForSelector('.opt');
const allQ = content.missions.flatMap(m => m.steps).filter(s => s.type === 'quiz').flatMap(s => s.questions);
for (let k = 0; k < 3; k++) {
  const text = await page.textContent('.qtext'), q = allQ.find(q => q.q.replaceAll('{name}', 'Robin Pendekar') === text);
  await page.locator('.opt').filter({ hasText: q.options[q.answer] }).first().click(); if (k < 2) await page.locator('button', { hasText: 'Soal berikutnya' }).click();
}
await page.locator('.next:not([disabled])').click(); await page.click('.celebrate button'); await page.waitForSelector('#campus');
ok((await state()).review.streak === 1, 'the daily review starts a streak');

// the final exam: failing first, then passing
const examAt = async () => { const [cx, cy] = await page.evaluate(async () => (await import('./js/world.js')).ceoTile()); await tapTile(cx, cy);
  await page.waitForFunction(() => /Eyang Guru/.test(document.querySelector('#dlg .who')?.textContent || '') && !!document.querySelector('#dlg button'), null, { timeout: 20000 }); await talkUntil(/Mulai ujian/); await page.waitForSelector('.qtext'); };
await examAt(); await shot('10-exam'); await sitExam(3);
await page.waitForSelector('.celebrate'); ok((await page.textContent('.celebrate')).includes('Belum lulus'), '7 of 10 does not pass'); ok(!(await state()).sertifikat, '… and no certificate is saved');
await page.click('.celebrate button'); await page.waitForSelector('#campus');
await examAt(); await sitExam(1);
await page.waitForSelector('.celebrate'); ok((await page.textContent('.celebrate')).includes('Lulus'), '9 of 10 passes'); ok((await state()).sertifikat === 'PA-TEST000001', 'the certificate code is saved');
await page.click('.celebrate button'); await page.waitForSelector('.cert');
ok((await page.textContent('.cert-name')).trim() === 'Robin Pendekar', 'the certificate shows the tidied name');
ok(new URL(page.url()).searchParams.get('s') === 'PA-TEST000001', 'the address is the shareable certificate link');
ok(await page.locator('#share').count() === 1, 'the owner sees a share button');
const box = await page.locator('.cert').boundingBox(); ok(box.y + box.height <= 844, `the whole certificate fits one phone screen (${Math.round(box.height)}px)`);
await shot('11-certificate');
// someone else opens the link: no share button, same certificate
const other = await browser.newContext({ viewport: { width: 390, height: 844 } }); await other.route('**/rest/v1/rpc/*', fakeSupabase);
const p2 = await other.newPage(); p2.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await p2.goto(BASE + '/?s=PA-TEST000001'); await p2.waitForSelector('.cert');
ok((await p2.textContent('.cert-name')).trim() === 'Robin Pendekar', 'the shared link opens the certificate'); ok(await p2.locator('#share').count() === 0, '… without the owner\'s share button');
await p2.goto(BASE + '/?s=PA-PALSU'); await p2.waitForSelector('h2'); ok((await p2.textContent('h2')).includes('tidak ditemukan'), 'an unknown code says the certificate was not found');
if (shots) await p2.screenshot({ path: path.join(shots, '12-not-found.png') }); await other.close();
ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed'); process.exit(failed ? 1 : 0);

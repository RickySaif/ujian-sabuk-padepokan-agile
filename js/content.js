// content.js — loads the company content (a JSON document) and checks it before the game uses it.
// The format is documented in docs/CONTENT.md. The same validator runs in the game, in in tests/check.mjs.
import { CONFIG } from './config.js';

export const MAX_MISSIONS = 11;                      // the campus has 11 plots
export const STEP_TYPES = ['read', 'cards', 'quiz', 'match', 'order', 'checklist'];
export let C = null;                                 // the content in use

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isArr = v => Array.isArray(v) && v.length > 0;

/** Returns a list of human-readable problems. An empty list means the content is usable. */
export function validateContent(d) {
  const errs = [], e = m => errs.push(m);
  if (!d || typeof d !== 'object') return ['The content must be a JSON object.'];
  if (!d.company || !isStr(d.company.name)) e('company.name is required.');
  if (!d.welcome || !isStr(d.welcome.from) || !isArr(d.welcome.lines)) e('welcome needs "from" and at least one line in "lines".');
  if (d.levels && (!Array.isArray(d.levels) || d.levels.length < 2 || !d.levels.every(isStr))) e('levels must be a list of at least 2 names.');
  if (!isArr(d.missions)) { e('missions needs at least one mission.'); return errs; }
  if (d.missions.length > MAX_MISSIONS) e(`There are ${d.missions.length} missions; the campus has room for ${MAX_MISSIONS}.`);
  const ids = new Set(), qids = new Set();
  d.missions.forEach((m, i) => {
    const at = `missions[${i}]${m && m.id ? ` (${m.id})` : ''}`;
    if (!m || typeof m !== 'object') return e(`${at} must be an object.`);
    if (!isStr(m.id) || !/^[a-z0-9-]+$/.test(m.id)) e(`${at}: id is required (lowercase letters, numbers, dashes).`);
    else if (ids.has(m.id)) e(`${at}: id is used twice.`); else ids.add(m.id);
    if (!isStr(m.title)) e(`${at}: title is required.`);
    if (!isStr(m.building)) e(`${at}: building (the name on the sign) is required.`);
    if (!m.guide || !isStr(m.guide.name)) e(`${at}: guide.name is required.`);
    if (m.color && !/^#[0-9a-fA-F]{6}$/.test(m.color)) e(`${at}: color must look like #3A78C9.`);
    if (!isArr(m.intro) || !m.intro.every(isStr)) e(`${at}: intro needs at least one line.`);
    if (!isArr(m.steps)) return e(`${at}: steps needs at least one step.`);
    m.steps.forEach((s, j) => {
      const sa = `${at} step ${j + 1}`;
      if (!s || !STEP_TYPES.includes(s.type)) return e(`${sa}: type must be one of ${STEP_TYPES.join(', ')}.`);
      if (s.type === 'read' && !isStr(s.body)) e(`${sa}: read needs "body".`);
      if (s.type === 'cards' && !(isArr(s.cards) && s.cards.every(c => c && isStr(c.front) && isStr(c.back)))) e(`${sa}: every card needs "front" and "back".`);
      if (s.type === 'quiz') {
        if (!isArr(s.questions)) return e(`${sa}: quiz needs "questions".`);
        s.questions.forEach((q, k) => {
          const qa = `${sa} question ${k + 1}`;
          if (!q || !isStr(q.q)) return e(`${qa}: "q" is required.`);
          if (!isStr(q.id)) e(`${qa}: "id" is required.`); else if (qids.has(q.id)) e(`${qa}: id "${q.id}" is used twice.`); else qids.add(q.id);
          if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(isStr)) e(`${qa}: needs at least 2 options.`);
          else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) e(`${qa}: "answer" must be the position of the right option, starting at 0.`);
        });
      }
      if (s.type === 'match' && !(isArr(s.pairs) && s.pairs.length >= 2 && s.pairs.every(p => Array.isArray(p) && p.length === 2 && p.every(isStr)))) e(`${sa}: match needs at least 2 pairs of [left, right].`);
      if (s.type === 'order' && !(isArr(s.items) && s.items.length >= 2 && s.items.every(isStr))) e(`${sa}: order needs at least 2 items, written in the right order.`);
      if (s.type === 'checklist' && !(isArr(s.items) && s.items.every(it => it && isStr(it.id) && isStr(it.text)))) e(`${sa}: every checklist item needs "id" and "text".`);
    });
  });
  return errs;
}

/** Load the content file shipped with the app. */
export async function loadContent() {
  const r = await fetch(CONFIG.contentUrl, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Could not load ${CONFIG.contentUrl} (HTTP ${r.status})`);
  const d = await r.json(), errors = validateContent(d);
  if (errors.length === 0) C = d;
  return { source: 'file', errors, data: d };
}
export function useContent(d) { C = d; }

/* ---------- helpers derived from the content ---------- */
export const missions = () => C.missions;
export const levelNames = () => C.levels || ['Newcomer', 'Explorer', 'Contributor', 'Insider', 'Local legend'];
export const missionXp = m => m.xp || 100;
export const totalXp = () => missions().reduce((n, m) => n + missionXp(m), 0);
/** Level index (0-based) for an XP total: the last level is reached when every mission is done. */
export function levelFor(xp) { const names = levelNames(), per = Math.max(1, Math.ceil(totalXp() / (names.length - 1))); return Math.min(names.length - 1, Math.floor(xp / per)); }
export function levelProgress(xp) { const names = levelNames(), per = Math.max(1, Math.ceil(totalXp() / (names.length - 1))), L = levelFor(xp); return L >= names.length - 1 ? 1 : (xp - L * per) / per; }
/** Every quiz question of a mission (used for the daily review and the admin statistics). */
export const questionsOf = m => m.steps.filter(s => s.type === 'quiz').flatMap(s => s.questions.map(q => ({ ...q, mission: m.id })));
export const settings = () => Object.assign({ order: 'sequential' }, C.settings || {});

// state.js — the player's progress. One plain object, saved to localStorage in this browser.
import { defaultLook } from './art.js';

export const fresh = () => ({
  name: '',
  look: defaultLook(),
  xp: 0,
  missions: {},        // missionId → { stars, at }            (finished missions)
  step: {},            // missionId → index of the step to resume at
  checks: {},          // missionId → { checklistItemId: true }
  firstTry: {},        // questionId → true/false              (was the first answer right?)
  review: { last: '', streak: 0, total: 0 },
  pos: { x: 3, y: 5 },
  sound: true,
  setup: false,        // has the player picked a name and a character?
  metCeo: false,
  ujian: null,         // { skor, total, at, tries } : the last final exam
  sertifikat: '',      // certificate code once the final exam is passed
  startedAt: new Date().toISOString(),
});
export let S = fresh();

let key = 'padepokan:guest', onSave = null;
/** Choose whose save this is (one key per signed-in user) and load it from this browser. */
export function openSave(userId) {
  key = 'padepokan:' + (userId || 'guest');
  let raw = null; try { raw = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
  S = Object.assign(fresh(), raw || {});
  return !!raw;
}
/** Replace the state (e.g. with the copy from the cloud). */
export function setState(obj) { S = Object.assign(fresh(), obj || {}); }
export function setSaveHook(fn) { onSave = fn; }
export function save() {
  try { localStorage.setItem(key, JSON.stringify(S)); } catch (e) {}
  if (onSave) { try { onSave(S); } catch (e) {} }
}
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

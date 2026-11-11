// audio.js — small synthesised sound effects (no audio files). Muted when the player turns sound off.
import { S } from './state.js';
let ctx = null;
function tone(seq) {
  if (!S.sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime + 0.02;
    seq.forEach(([freq, start, dur, type = 'square', vol = 0.06]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0 + start); g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g).connect(ctx.destination); o.start(t0 + start); o.stop(t0 + start + dur + 0.02);
    });
  } catch (e) { /* audio is optional */ }
}
export const sfx = {
  good: () => tone([[784, 0, .09], [1047, .08, .16]]),
  bad: () => tone([[220, 0, .18, 'triangle', .1]]),
  tap: () => tone([[660, 0, .05, 'sine', .05]]),
  step: () => tone([[140, 0, .03, 'triangle', .04]]),
  fanfare: () => tone([[523, 0, .12], [659, .12, .12], [784, .24, .12], [1047, .36, .36], [1319, .74, .4, 'square', .04]]),
};

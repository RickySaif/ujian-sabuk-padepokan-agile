// check.mjs — fast checks that need no browser: every module parses, and the content file is valid.
// Run: npm run check
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, 'js', f)], { stdio: 'pipe' }); }
  catch (e) { failed++; console.log(`FAIL js/${f}\n${e.stderr}`); }
}
const { validateContent, questionsOf } = await import(path.join(ROOT, 'js/content.js'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/company.json'), 'utf8'));
const errs = validateContent(data);
if (errs.length) { failed++; console.log('FAIL content/company.json:'); errs.forEach(e => console.log('  - ' + e)); }
// the validator itself: it must catch the common mistakes
const broken = [
  [d => { delete d.company.name; }, 'company.name'],
  [d => { d.missions[0].steps[2].questions[0].answer = 9; }, '"answer"'],
  [d => { d.missions[1].id = d.missions[0].id; }, 'used twice'],
  [d => { d.missions[0].steps[0].type = 'video'; }, 'type must be'],
  [d => { d.missions = []; }, 'at least one mission'],
];
for (const [mutate, expect] of broken) {
  const d = JSON.parse(JSON.stringify(data)); mutate(d);
  if (!validateContent(d).some(e => e.includes(expect))) { failed++; console.log(`FAIL the validator did not report: ${expect}`); }
}
const questions = data.missions.flatMap(questionsOf).length;
console.log(failed ? `${failed} check(s) failed` : `ok: all modules parse; content has ${data.missions.length} missions and ${questions} questions; the validator catches ${broken.length} kinds of mistake`);
process.exit(failed ? 1 : 0);

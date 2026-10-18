#!/usr/bin/env node
/* Runs the stage check in Node (no browser, no npm):
     node tools/check.js                      stage data, the rules, and the sabotage cases (--verbose lists every rule)
     node tools/check.js --soak [--seeds=N] [--easy | --normal] [--1p | --2p] [--buddy] [--clumsy]
   Without --easy/--normal the soak plays both. Without --1p/--2p it plays 1 player (Teddy and Tommy in turn).
   Loads the game's rules (title, stages, sim, brain, check) into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/stages.js', 'js/sim.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const SKY = ctx.SKY;
const args = process.argv.slice(2);
const has = (a) => args.includes(a);
let bad = 0;

const st = SKY.check.stages();
for (const s of st) {
  if (s.probs.length) bad++;
  console.log(`${s.probs.length ? 'FAIL' : 'ok  '} stage ${String(s.stage).padStart(2)} ${s.name.padEnd(16)} ${String(s.foes).padStart(3)} foes, ${Math.round(s.seconds)} s of waves${s.probs.length ? ': ' + s.probs.join('; ') : ''}`);
}
console.log(`stage check: ${st.length} stages, ${bad} with problems`);

const rules = SKY.check.rules();
console.log(`rules: ${rules.filter((r) => r.ok).length} of ${rules.length} ok`);
for (const r of rules) if (!r.ok || has('--verbose')) console.log(`  ${r.ok ? 'ok' : 'FAIL'}: ${r.name}${r.info ? ' (' + r.info + ')' : ''}`);
if (rules.some((r) => !r.ok)) bad++;

if (!has('--no-sabotage')) {
  const t0 = Date.now();
  const sab = SKY.check.sabotage();
  console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken setups caught (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.probs.length ? ' (' + s.probs.join('; ') + ')' : ''}`);
  if (sab.some((s) => !s.caught)) bad++;
}

if (has('--soak')) {
  const levels = has('--easy') ? ['easy'] : has('--normal') ? ['normal'] : ['easy', 'normal'];
  const groups = has('--2p') ? [['teddy', 'tommy']] : [['teddy'], ['tommy']];
  const seeds = Number((args.find((a) => a.startsWith('--seeds=')) || '').split('=')[1]) || 2;
  const buddyEvery = has('--buddy') ? 14 : 0;
  const clumsy = has('--clumsy'); // a slow, wobbly pilot: not a pass/fail test, a feel for how hard each level is
  for (const level of levels) {
    for (const players of groups) {
      const t0 = Date.now();
      let runs = 0, unfinished = 0, stuck = 0, hits = 0, worst = 99;
      const perStage = {};
      for (let seed = 1; seed <= seeds; seed++) {
        const res = SKY.check.soak({ level, players, clumsy, seed: seed * 101 + players.length * 7 + (players[0] === 'tommy' ? 3 : 0), buddyEvery: players.length === 1 ? buddyEvery : 0 });
        for (const r of res) {
          runs++;
          const ok = r.cleared && !r.died;
          if (!ok) unfinished++;
          if (r.stuck) stuck++;
          hits += r.hits;
          worst = Math.min(worst, r.minHearts);
          const p = perStage[r.stage] || (perStage[r.stage] = { name: r.name, ok: 0, n: 0, hits: 0, time: 0, boss: 0, minHearts: 99, specials: 0 });
          p.n++; if (ok) p.ok++; p.hits += r.hits; p.time += r.time; p.boss += r.bossTime; p.minHearts = Math.min(p.minHearts, r.minHearts); p.specials += r.specials;
          if (!ok || r.stuck) console.log(`  ${level} ${players.join('+')} seed ${seed} stage ${r.stage} ${r.name}: ${r.cleared ? 'cleared' : 'NOT CLEARED'}${r.died ? ' (lost every heart)' : ''}${r.stuck ? ' STUCK enemy ' + r.maxFoeAge + ' s' : ''} at ${r.time} s, hits ${r.hits}`);
        }
      }
      console.log(`soak ${level} ${players.join('+')}: ${runs} runs, ${unfinished} not finished, ${stuck} stuck, ${hits} hits in all, fewest hearts left ${worst} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      for (const [k, p] of Object.entries(perStage)) {
        console.log(`    stage ${k.padStart(2)} ${p.name.padEnd(16)} finished ${p.ok}/${p.n}  ${Math.round(p.time / p.n)} s` +
          `${p.boss ? `  boss ${Math.round(p.boss / p.n)} s` : ''}  hits ${(p.hits / p.n).toFixed(1)}  fewest hearts ${p.minHearts}  specials ${(p.specials / p.n).toFixed(1)}`);
      }
      if ((unfinished && !clumsy) || stuck) bad++;
    }
  }
}
process.exitCode = bad ? 1 : 0;

/* Sky TT: the stage check, the soak and the sabotage cases. Runs in the browser console (game.check(), game.soak())
   and in Node (node tools/check.js). No Three.js in here.

   - stages(): every wave uses a known pattern, foe, count and power-up; boss stages name a known boss.
   - soak(): the autopilot plays stages headlessly, each from a fresh start (3 or 5 hearts, no power-ups, which is
     what TRY AGAIN gives you). A stage counts as finished only if it clears without losing every heart.
   - sabotage(): broken setups that must fail, to prove the checks can fail at all. */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});
  const DT = 1 / 60;

  const PATTERNS = ['snake', 'swoop', 'line', 'vee', 'hover', 'strafe', 'drift', 'dive'];
  const SIDES = { snake: ['L', 'R', 'C'], swoop: ['L', 'R'], strafe: ['L', 'R'] };

  function stages(list = SKY.STAGES) {
    const M = SKY.sim;
    const out = [];
    if (list.length !== 10) out.push({ stage: 0, name: 'ALL', probs: [`expected 10 stages, found ${list.length}`] });
    list.forEach((st, k) => {
      const probs = [];
      if (!st.name) probs.push('no name');
      if (!st.waves || !st.waves.length) probs.push('no waves');
      if (st.boss && !M.BOSSES[st.boss]) probs.push(`unknown boss "${st.boss}"`);
      let total = 0, foes = 0, carriers = 0;
      (st.waves || []).forEach((w, j) => {
        const [gap, pat, type, n, opt] = w;
        const at = `wave ${j + 1}`;
        if (typeof gap !== 'number' || gap < 0 || gap > 12) probs.push(`${at}: odd gap ${gap}`);
        total += gap || 0;
        if (pat === 'carrier') {
          carriers++;
          if (!M.POWERS.includes(type)) probs.push(`${at}: unknown power-up "${type}"`);
          if (typeof n !== 'number' || Math.abs(n) > 4.5) probs.push(`${at}: balloon x ${n} is off the screen`);
          return;
        }
        if (!PATTERNS.includes(pat)) probs.push(`${at}: unknown pattern "${pat}"`);
        if (!M.FOES[type] || type === 'boss' || type === 'balloon') probs.push(`${at}: unknown foe "${type}"`);
        if (!(n >= 1 && n <= 12)) probs.push(`${at}: count ${n} should be 1 to 12`);
        if (SIDES[pat] && !SIDES[pat].includes(opt)) probs.push(`${at}: ${pat} needs ${SIDES[pat].join(' / ')}, got "${opt}"`);
        foes += n || 0;
      });
      if (total < 25 || total > 90) probs.push(`waves last ${total.toFixed(0)} s (want 25 to 90)`);
      if (!carriers) probs.push('no power-up balloons');
      out.push({ stage: k + 1, name: st.name, probs, foes, seconds: total });
    });
    return out;
  }

  // Plays one stage to the end. o: { stage, level, players, seed, auto, immortal, noGuns, bossHpK, buddyEvery, maxT, stageData, tweak }
  function run(o) {
    const M = SKY.sim;
    const S = new M.Sim({
      stage: o.stage, stageData: o.stageData, level: o.level, players: o.players || ['teddy'], seed: o.seed || 1,
      auto: o.auto !== false, immortal: o.immortal, noGuns: o.noGuns, bossHpK: o.bossHpK,
    });
    if (o.clumsy) S.clumsy = true;
    if (o.tweak) o.tweak(S);
    const maxT = o.maxT || 240;
    let nextCall = o.buddyEvery ? 1 : Infinity;
    let minHearts = 99;
    while (!S.cleared && !S.over && S.t < maxT) {
      if (S.t >= nextCall) { S.callBuddy(); nextCall += o.buddyEvery; }
      S.step(DT);
      for (const P of S.players) if (!P.out) minHearts = Math.min(minHearts, P.hearts);
      S.events.length = 0;
    }
    return {
      stage: S.stageNo, name: S.stage.name, level: S.level, cleared: S.cleared, died: S.over, time: Math.round(S.t),
      hits: S.stats.hits, hearts: S.players.map((P) => P.hearts), minHearts, pops: S.stats.pops, specials: S.stats.specials,
      bossTime: Math.round(S.stats.bossTime), maxFoeAge: +S.stats.maxFoeAge.toFixed(1), stuck: S.stats.maxFoeAge > 40,
      saves: S.stats.saves, treats: S.stats.treats, calls: S.stats.calls, buddyPops: S.stats.buddyPops, powers: S.stats.powers,
      score: S.score(),
    };
  }

  function soak(o = {}) {
    const list = o.stages || SKY.STAGES.map((_, k) => k + 1);
    return list.map((stage) => run(Object.assign({}, o, { stage })));
  }

  // Each of these is broken on purpose and must be caught.
  function sabotage() {
    const cases = [];
    const add = (name, caught, probs) => cases.push({ name, caught: !!caught, probs: probs || [] });

    // 1. bad stage data must be reported
    const bad = JSON.parse(JSON.stringify(SKY.STAGES));
    bad[0].waves[0] = [2, 'zigzag', 'drone', 5, 'L'];
    bad[1].waves[1] = [2, 'swoop', 'dragon', 5, 'L'];
    bad[2].waves[3] = [3, 'carrier', 'laser', 2];
    bad[3].waves[0] = [2, 'line', 'drone', 0];
    bad[4].boss = 'kraken';
    const found = stages(bad).filter((s) => s.probs.length);
    add('stage data with an unknown pattern, foe, power-up, count and boss', found.length >= 5, found.map((s) => `stage ${s.stage}: ${s.probs[0]}`));

    // 2. a pilot who never moves gets bonked out (so bullets really do hit)
    const still = run({ stage: 3, level: 'normal', auto: false, seed: 7 });
    add('a pilot who never moves (stage 3, Normal) must lose every heart', still.died, [`died ${still.died}, hits ${still.hits}`]);

    // 3. with no guns the boss can't be beaten, so the stage must not clear
    const noGuns = run({ stage: 3, level: 'easy', immortal: true, noGuns: true, seed: 7, maxT: 150 });
    add('planes that cannot shoot (boss stage) must not clear', !noGuns.cleared, [`cleared ${noGuns.cleared} after ${noGuns.time} s`]);

    // 4. a boss with 50 times the hp runs out the clock
    const iron = run({ stage: 10, level: 'easy', immortal: true, bossHpK: 50, seed: 7, maxT: 200 });
    add('a boss with 50x hp must not be beaten in time', !iron.cleared, [`cleared ${iron.cleared}, boss fight ${iron.bossTime} s`]);

    // 5. an enemy that never leaves the screen must be reported stuck, and the stage must not clear
    const stay = { name: 'STUCK', theme: 'yard', waves: [[2, 'stay', 'drone', 1], [2, 'carrier', 'double', 0]] };
    const stuck = run({ stageData: stay, stage: 1, level: 'easy', noGuns: true, immortal: true, seed: 7, maxT: 90 });
    add('an enemy that never leaves must be caught as stuck', stuck.stuck && !stuck.cleared, [`stuck ${stuck.stuck}, oldest enemy ${stuck.maxFoeAge} s`]);

    // 6. the companion protects while he's there: a still pilot who keeps calling him takes no hits
    const guarded = run({ stage: 3, level: 'normal', auto: false, buddyEvery: 6, seed: 7, maxT: 120 });
    const unguarded = run({ stage: 3, level: 'normal', auto: false, buddyEvery: 6, seed: 7, maxT: 120, tweak(S) {
      const up = S.updateBuddy;
      S.updateBuddy = function (dt) { up.call(this, dt); if (this.buddy) this.buddy.guard = false; };
    } });
    add('keep calling the companion: hits on a still pilot must all be blocked', guarded.hits === 0 && guarded.saves > 0, [`hits ${guarded.hits}, saves ${guarded.saves}`]);
    add('a companion who forgets to guard must let hits through', unguarded.hits > 0 && unguarded.saves === 0, [`hits ${unguarded.hits}, saves ${unguarded.saves}`]);
    return cases;
  }

  // The rules that matter most to the kids, checked one by one: 2-player revives, the companion, power-ups.
  function rules() {
    const M = SKY.sim;
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });
    const step = (S, sec) => { for (let i = 0; i < sec * 60; i++) S.step(DT); const ev = S.events.map((e) => e.type); S.events.length = 0; return ev; };
    const bonk = (S, P) => { P.hearts = 1; P.invulnT = 0; P.shieldT = 0; S.hitPlayer(P, 'test'); };

    let S = new M.Sim({ stage: 2, level: 'normal', players: ['teddy', 'tommy'], seed: 5, auto: true });
    step(S, 3);
    const tom = S.players[1];
    S.auto[1] = false;
    bonk(S, tom);
    ok('2P: a brother with no hearts is out, and the game goes on', tom.out && !S.over && S.phase === 'play');
    S.callBuddy();
    ok('2P: T is a high five that brings him straight back, with a shield', !tom.out && tom.hearts === S.L.reviveHearts && tom.shieldT > 0);
    ok('2P: then the high five rests', S.cheerT > 0 && S.cheerT <= S.L.cheerCool);
    S.events.length = 0;
    S.callBuddy();
    ok('2P: pressing again while it rests says no', S.events.some((e) => e.type === 'cheerNo'));
    bonk(S, tom);
    const back = step(S, S.L.revive + 0.5);
    ok('2P: without a high five he comes back by himself', !tom.out && back.includes('revive'), `after ${S.L.revive} s`);
    bonk(S, S.players[0]);
    bonk(S, tom);
    ok('2P: it is game over only when both are out', S.over);

    S = new M.Sim({ stage: 3, level: 'normal', players: ['teddy'], seed: 9 });
    step(S, 2);
    S.callBuddy();
    ok('1P: T brings the other brother (Tommy for Teddy)', S.buddy && S.buddy.kind === 'tommy');
    const e1 = step(S, 3.5);
    ok('1P: he says hello, then tosses a treat that lands', e1.includes('buddyHello') && e1.includes('treat') && e1.includes('treatGot'));
    const P = S.players[0];
    P.invulnT = 0;
    ok('1P: while he is there, hits are blocked', S.hitPlayer(P, 'test') === 'block' && P.hearts === S.L.hearts);
    S.callBuddy();
    const e2 = step(S, 3.5);
    ok('1P: calling again (no cooldown) says hi again and brings another treat', e2.includes('buddyHello') && e2.includes('treatGot') && S.buddy.left > M.VISIT - 3);
    const e3 = step(S, M.VISIT + 3);
    ok('1P: after his visit he says goodbye and flies off', e3.includes('buddyBye') && e3.includes('buddyOut') && !S.buddy);
    S.callBuddy(); S.callBuddy(); S.callBuddy();
    ok('1P: quick calls never bring two companions', !!S.buddy && S.stats.calls >= 3);
    const S2 = new M.Sim({ stage: 1, level: 'easy', players: ['tommy'], seed: 1 });
    S2.callBuddy();
    ok('1P: Teddy comes when Tommy plays', S2.buddy.kind === 'teddy');

    S = new M.Sim({ stage: 1, level: 'normal', players: ['teddy'], seed: 2 });
    const Q = S.players[0];
    S.applyPower(Q, 'double'); S.applyPower(Q, 'double'); S.applyPower(Q, 'spread');
    ok('power-ups: double twice, then spread, keeps the level', Q.weapon === 'spread' && Q.lvl === 2);
    S.phase = 'play';
    Q.invulnT = 0;
    S.hitPlayer(Q, 'test');
    ok('power-ups: a bonk takes one heart and one level', Q.lvl === 1 && Q.hearts === S.L.hearts - 1);
    S.applyPower(Q, 'super');
    ok('power-ups: a 🌟 gives one more super move', Q.specials === S.L.specials + 1);
    for (let i = 0; i < 9; i++) S.applyPower(Q, 'heart');
    ok('power-ups: hearts stop at the most you can have', Q.hearts === S.L.maxHearts);
    const E = new M.Sim({ stage: 1, level: 'easy' }).L, N = new M.Sim({ stage: 1, level: 'normal' }).L;
    ok('Easy: more hearts, slower, bigger bullets, fewer enemies than Normal',
      E.hearts > N.hearts && E.bulletSpeed < N.bulletSpeed && E.bulletDraw > N.bulletDraw && E.count < N.count && E.fireGap > N.fireGap);
    return out;
  }

  SKY.check = { stages, run, soak, sabotage, rules };
})();

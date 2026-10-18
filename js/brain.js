/* Sky TT: the autopilot. It flies a brother for the title-screen demo, for game.autopilot() and for the headless soak
   (tools/check.js). No Three.js in here.

   Every other tick it tries 17 moves (stay, 8 directions at full and half speed), looks 0.6 s ahead along each one,
   and adds up the danger from every enemy bullet and enemy body near it (moving in a straight line, as they do).
   Then it adds a small pull toward the enemy it wants to shoot, toward power-ups, and toward the bottom of the
   screen. It takes the cheapest move. When every move is a hit, it uses its special if it has one. */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});

  const MOVES = [[0, 0]];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    MOVES.push([Math.cos(a), Math.sin(a)], [Math.cos(a) * 0.45, Math.sin(a) * 0.45]);
  }
  const AHEAD = [0.05, 0.1, 0.17, 0.25, 0.34, 0.45, 0.6];
  const SPEED = 9;

  function drive(S, i) {
    const M = SKY.sim;
    const P = S.players[i], inp = S.input[i];
    inp.tx = inp.ty = null;
    if (P.out || S.phase !== 'play') { inp.dx = inp.dy = 0; return; }
    // S.clumsy (the check's "slow pilot") thinks only every 0.2 s and wobbles, more like a small kid
    const memo = P.bot || (P.bot = { n: 0, dx: 0, dy: 0 });
    if (memo.n++ % (S.clumsy ? 12 : 2)) { inp.dx = memo.dx; inp.dy = memo.dy; return; }

    // what could hit us soon
    const near = [];
    for (const b of S.bullets) {
      if (Math.abs(b.x - P.x) < 6 && b.y - P.y < 7 && b.y - P.y > -3) near.push(b);
    }
    for (const f of S.foes) {
      if (f.y > M.H + 1.5 || Math.abs(f.x - P.x) > 7 || f.y - P.y > 9) continue;
      near.push({ x: f.x, y: f.y, vx: f.vx, vy: f.vy, r: f.r * 0.8 });
    }
    const safe = P.shieldT > 0.6 || P.invulnT > 0.6 || P.specialT > 0.3 || (S.buddy && S.buddy.guard && S.buddy.phase !== 'in');
    const hr = S.L.hitR + 0.1;

    // whom to shoot: the boss, or the lowest enemy on screen (the most dangerous one), or the biggest
    let goal = null;
    if (S.boss && S.boss.inside) goal = S.boss;
    else {
      let best = 1e9;
      for (const f of S.foes) {
        if (!f.inside || f.y < P.y + 1.5) continue;
        const score = f.y * 0.6 + Math.abs(f.x - P.x) * 0.8 - (f.type === 'balloon' ? 6 : 0) - (f.type === 'blimp' ? 2 : 0);
        if (score < best) { best = score; goal = f; }
      }
    }
    // a power-up or a heart worth flying to
    let want = null, wd = 1e9;
    for (const it of S.items) {
      if (it.kind !== 'power' && it.kind !== 'star' && it.kind !== 'fruit') continue;
      const d = Math.hypot(it.x - P.x, it.y - P.y) - (it.kind === 'power' ? 4 : 0);
      if (d < wd && it.y < 12) { wd = d; want = it; }
    }

    let bestCost = 1e18, bx = 0, by = 0, worstHit = true;
    for (const [mx, my] of MOVES) {
      let cost = 0, hit = false;
      let px = P.x, py = P.y;
      for (let k = 0; k < AHEAD.length; k++) {
        const t = AHEAD[k];
        px = M.clamp(P.x + mx * SPEED * t, -M.PX, M.PX);
        py = M.clamp(P.y + my * SPEED * t, M.PY0, M.PY1);
        for (const b of near) {
          const dx = b.x + b.vx * t - px, dy = b.y + b.vy * t - py;
          const d = Math.sqrt(dx * dx + dy * dy) - b.r - hr;
          if (d < 0) { cost += (safe ? 20 : 1000) * (1 - k * 0.1); hit = true; }
          else if (d < 0.8) cost += ((0.8 - d) * 5) / (k + 1);
        }
      }
      if (!hit) worstHit = false;
      const fx = M.clamp(P.x + mx * SPEED * 0.25, -M.PX, M.PX), fy = M.clamp(P.y + my * SPEED * 0.25, M.PY0, M.PY1);
      if (goal) cost += Math.min(4, Math.abs(fx - goal.x)) * 0.7;
      cost += Math.abs(fy - (goal && goal.boss ? 2.4 : 3)) * 0.3;
      if (Math.abs(fx) > M.PX - 0.3) cost += 0.6;
      if (want) cost += Math.min(6, Math.hypot(want.x - fx, want.y - fy)) * (want.kind === 'power' ? 0.9 : 0.25);
      if (cost < bestCost) { bestCost = cost; bx = mx; by = my; }
    }
    if (worstHit && !safe && P.specials > 0) inp.special = true;
    if (S.clumsy) { bx += (S.rand() - 0.5) * 0.8; by += (S.rand() - 0.5) * 0.8; }
    memo.dx = inp.dx = bx;
    memo.dy = inp.dy = by;
  }

  SKY.brain = { drive };
})();

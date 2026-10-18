/* Sky TT: the rules of the game. There is no Three.js in here, so the browser game and the headless check
   (tools/check.js) run the very same code at a fixed 60 ticks a second.

   The screen is W x H = 12 x 16 units. x runs from -6 (left) to 6 (right), y from 0 (bottom) to 16 (top).
   The brothers fly near the bottom and fire upward all the time. Enemies come in from above (y > 16).

   The renderer reads the state (S.players, S.foes, S.shots, S.bullets, S.items, S.blasts, S.buddy...) and drains
   S.events for effects, sounds and toasts. */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});

  const W = 12, H = 16, XMAX = W / 2;
  const TOP = H + 1; // where enemies appear, just above the screen
  const PX = XMAX - 0.65, PY0 = 0.8, PY1 = H - 1.7; // how far the planes can fly

  const LEVELS = {
    easy: {
      hearts: 5, maxHearts: 8, specials: 3, count: 0.7, hp: 0.75, fireGap: 2.0, bulletSpeed: 0.6, bulletDraw: 1.5, bulletHit: 0.2,
      hitR: 0.24, invuln: 3, waveGap: 1.15, bossHp: 0.6, bossGap: 1.6, bossCount: 0.6, foeSpeed: 0.85,
      shield: 14, magnet: 20, cheerCool: 12, revive: 6, reviveHearts: 2, mercy: 3.2, pity: 14,
    },
    normal: {
      hearts: 3, maxHearts: 5, specials: 2, count: 1, hp: 1, fireGap: 1, bulletSpeed: 1, bulletDraw: 1, bulletHit: 0.16,
      hitR: 0.3, invuln: 2, waveGap: 1, bossHp: 1, bossGap: 1, bossCount: 1, foeSpeed: 1,
      shield: 10, magnet: 15, cheerCool: 20, revive: 10, reviveHearts: 1, mercy: 2.2, pity: 28,
    },
  };

  // r: size, hp: hits to pop, speed: units a second, fire: seconds between shots (Normal), drops: what it pops into
  const FOES = {
    drone: { r: 0.45, hp: 1, speed: 4.5, points: 100, fire: 3.4, drops: [['coin', 0.6]] },
    ufo: { r: 0.62, hp: 3, speed: 3.4, points: 300, fire: 2.5, drops: [['star', 1]] },
    cloud: { r: 0.8, hp: 5, speed: 1.6, points: 200, fire: 1.8, drops: [['fruit', 1], ['fruit', 1]] },
    blimp: { r: 1.0, hp: 9, speed: 1.2, points: 400, fire: 2.7, drops: [['fruit', 1], ['fruit', 1], ['fruit', 1], ['coin', 1], ['coin', 1]] },
    balloon: { r: 0.7, hp: 2, speed: 1.4, points: 50, fire: 0, drops: [] },
    boss: { r: 2, hp: 1, speed: 0, points: 5000, fire: 0, drops: [] },
  };
  // The bosses take turns through their moves (5 s each, then a short rest). Below half their hp they hurry up.
  const BOSSES = {
    blimp: { name: 'BIG ZOM BLIMP', hp: 240, r: 1.9, moves: ['fan', 'minions', 'ring', 'aimed'] },
    storm: { name: 'STORMY', hp: 320, r: 2.0, moves: ['rain', 'fan', 'ring', 'rain2'] },
    bolt: { name: 'BIG BOLT', hp: 420, r: 1.8, moves: ['spiral', 'aimed', 'minions', 'ring'] },
    king: { name: 'KING UFO', hp: 560, r: 2.1, moves: ['spiral2', 'ring', 'fan', 'minions', 'rain'] },
  };
  const POWERS = ['double', 'spread', 'shield', 'magnet', 'heart', 'super'];
  const ITEM_POINTS = { coin: 50, fruit: 100, star: 150, bit: 20, power: 500 };
  const FRUIT = ['🍎', '🍊', '🍓', '🍒', '🍌', '🍉', '🍇', '🍑'];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const SPEED = 9, TOUCH_SPEED = 30; // the planes, with keys, and following a finger
  const SHOT_SPEED = 20, FIRE_GAP = 0.13, FAST_GAP = 0.1;
  const VISIT = 12, HELLO = 1.6, BYE = 1.2, TREAT_FLY = 0.9; // the companion's visit, in seconds
  const MAX_SPECIALS = 5;

  // what each weapon fires: [x offset, angle] per shot
  const GUNS = {
    single: [[[0, 0]]],
    double: [null, [[-0.22, 0], [0.22, 0]], [[-0.38, 0], [0, 0], [0.38, 0]], [[-0.55, 0], [-0.18, 0], [0.18, 0], [0.55, 0]]],
    spread: [null, [[0, -0.18], [0, 0], [0, 0.18]], [[0, -0.32], [0, -0.16], [0, 0], [0, 0.16], [0, 0.32]], [[0, -0.32], [0, -0.16], [0, 0], [0, 0.16], [0, 0.32]]],
  };

  // Small seeded random generator, so a check run can be repeated exactly.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const defaultBuddy = (id) => (id === 'tommy' ? 'teddy' : 'tommy');

  // ---------------------------------------------------------------- the game state

  function Sim(o = {}) {
    const S = this;
    S.stageNo = o.stage || 1;
    S.stage = o.stageData || SKY.STAGES[S.stageNo - 1];
    S.level = o.level === 'easy' ? 'easy' : 'normal';
    S.L = LEVELS[S.level];
    S.rand = rng(o.seed || (Math.random() * 1e9) | 0);
    S.buddyFor = o.buddyFor || defaultBuddy;
    const kinds = o.players || ['teddy'];
    S.two = kinds.length === 2;
    S.players = kinds.map((kind, i) => newPlayer(S, kind, i, kinds.length, o.carry && o.carry[i]));
    S.input = kinds.map(() => ({ dx: 0, dy: 0, tx: null, ty: null, special: false }));
    S.auto = kinds.map(() => !!o.auto);
    S.foes = [];
    S.shots = [];
    S.bullets = [];
    S.items = [];
    S.blasts = [];
    S.events = [];
    S.later = [];
    S.t = 0;
    S.phase = 'intro'; // intro, play, clear, over
    S.phaseT = 0;
    S.waveI = 0;
    S.waveT = S.stage.waves.length ? S.stage.waves[0][0] * S.L.waveGap : 0;
    S.bossState = S.stage.boss ? 'waves' : 'none'; // waves, wait, warn, fight, down, done
    S.bossT = 0;
    S.boss = null;
    S.buddy = null;
    S.cheerT = 0;
    S.cleared = false;
    S.over = false;
    S.nextId = 1;
    S.pityN = 0;
    S.ramp = 1 + 0.05 * (S.stageNo - 1);
    S.noGuns = !!o.noGuns; // the check's sabotage: players who can't shoot
    S.immortal = !!o.immortal;
    S.bossHpK = o.bossHpK || 1;
    S.stats = { hits: 0, saves: 0, treats: 0, calls: 0, pops: 0, buddyPops: 0, specials: 0, maxFoeAge: 0, bossTime: 0, items: 0, powers: 0 };
  }

  function newPlayer(S, kind, i, n, carry) {
    const L = S.L;
    const P = {
      i, kind, shot: kind === 'tommy' ? 'peace' : 'ball', special: kind === 'tommy' ? 'wave' : 'slam',
      x: n === 2 ? (i === 0 ? -2.2 : 2.2) : 0, y: -1.6, vx: 0, vy: 0,
      hearts: L.hearts, specials: L.specials, weapon: 'single', lvl: 0,
      fireT: 0.05 * i, shieldT: 0, magnetT: 0, invulnT: 0, specialT: 0, poseT: 0, pose: null,
      out: false, reviveT: 0, score: 0, pops: 0, got: { coin: 0, fruit: 0, star: 0, bit: 0, power: 0 },
    };
    if (carry) {
      P.hearts = Math.max(1, carry.hearts || L.hearts);
      P.specials = Math.max(L.specials, carry.specials || 0);
      P.weapon = carry.weapon || 'single';
      P.lvl = carry.lvl || 0;
      P.score = carry.score || 0;
      if (carry.out) P.hearts = L.reviveHearts;
    }
    return P;
  }

  const proto = Sim.prototype;

  proto.emit = function (type, o) { this.events.push(Object.assign({ type }, o)); };
  proto.alivePlayers = function () { return this.players.filter((P) => !P.out); };

  proto.step = function (dt) {
    const S = this;
    S.t += dt;
    S.phaseT += dt;
    if (S.phase === 'intro' && S.phaseT >= 1.6) { S.phase = 'play'; S.phaseT = 0; S.emit('go', {}); }
    for (let i = 0; i < S.players.length; i++) if (S.auto[i] && SKY.brain) SKY.brain.drive(S, i);
    S.updatePlayers(dt);
    S.updateBuddy(dt);
    if (S.phase === 'play') S.updateScript(dt);
    for (let i = S.later.length - 1; i >= 0; i--) {
      const l = S.later[i];
      l.t -= dt;
      if (l.t <= 0) { S.later.splice(i, 1); l.fn(); }
    }
    S.updateFoes(dt);
    S.updateShots(dt);
    S.updateBullets(dt);
    S.updateItems(dt);
    S.updateBlasts(dt);
    if (S.cheerT > 0) S.cheerT = Math.max(0, S.cheerT - dt);
    S.checkClear();
  };

  proto.after = function (t, fn) { this.later.push({ t, fn }); };

  // ---------------------------------------------------------------- the planes

  proto.updatePlayers = function (dt) {
    const S = this, L = S.L;
    for (const P of S.players) {
      P.poseT = Math.max(0, P.poseT - dt);
      if (P.out) {
        if (S.two && S.phase === 'play') {
          P.reviveT -= dt;
          if (P.reviveT <= 0 && S.alivePlayers().length) S.revive(P, 'time');
        }
        continue;
      }
      const inp = S.input[P.i];
      const px = P.x, py = P.y;
      if (S.phase === 'intro') {
        P.y += (3 - P.y) * Math.min(1, dt * 3.2);
      } else if (S.phase === 'clear') {
        P.y += (3 - P.y) * Math.min(1, dt * 1.5);
      } else if (S.phase === 'play') {
        if (inp.tx !== null && inp.tx !== undefined) {
          const dx = clamp(inp.tx, -PX, PX) - P.x, dy = clamp(inp.ty, PY0, PY1) - P.y;
          const d = Math.hypot(dx, dy), step = TOUCH_SPEED * dt;
          if (d <= step) { P.x += dx; P.y += dy; } else { P.x += (dx / d) * step; P.y += (dy / d) * step; }
        } else {
          let dx = inp.dx || 0, dy = inp.dy || 0;
          const m = Math.hypot(dx, dy);
          if (m > 1) { dx /= m; dy /= m; }
          P.x += dx * SPEED * dt;
          P.y += dy * SPEED * dt;
        }
        P.x = clamp(P.x, -PX, PX);
        P.y = clamp(P.y, PY0, PY1);
      }
      P.vx = (P.x - px) / dt;
      P.vy = (P.y - py) / dt;
      if (P.shieldT > 0) P.shieldT = Math.max(0, P.shieldT - dt);
      if (P.magnetT > 0) P.magnetT = Math.max(0, P.magnetT - dt);
      if (P.invulnT > 0) P.invulnT = Math.max(0, P.invulnT - dt);
      if (P.specialT > 0) P.specialT = Math.max(0, P.specialT - dt);
      if (S.phase === 'play') {
        P.fireT -= dt;
        if (P.fireT <= 0) {
          S.fire(P);
          P.fireT += P.lvl >= 3 ? FAST_GAP : FIRE_GAP;
          if (P.fireT < 0) P.fireT = 0;
        }
        if (inp.special) S.useSpecial(P);
      }
      inp.special = false;
    }
  };

  proto.fire = function (P) {
    const S = this;
    if (S.noGuns) return;
    const set = P.weapon === 'single' ? GUNS.single[0] : GUNS[P.weapon][P.lvl] || GUNS.single[0];
    for (const [ox, a] of set) S.addShot(P.x + ox, P.y + 0.55, a, P.shot, P.i, 1);
    S.emit('shot', { player: P.i, kind: P.shot });
  };

  proto.addShot = function (x, y, a, kind, owner, dmg, speed = SHOT_SPEED) {
    this.shots.push({ id: this.nextId++, x, y, vx: Math.sin(a) * speed, vy: Math.cos(a) * speed, kind, owner, dmg, t: 0 });
  };

  proto.useSpecial = function (P) {
    const S = this;
    if (S.phase !== 'play' || P.out) return;
    if (S.blasts.some((b) => b.owner === P.i)) return;
    if (P.specials <= 0) { S.emit('specialNo', { player: P.i }); return; }
    P.specials--;
    P.specialT = 1.8;
    P.poseT = 1.6;
    P.pose = 'special';
    S.stats.specials++;
    const b = { id: S.nextId++, kind: P.special, owner: P.i, x: P.x, y: P.y + 0.4, t: 0, hit: new Set(), fired: false };
    if (b.kind === 'slam') {
      const tgt = S.boss && S.bossState === 'fight' ? S.boss : null;
      b.tx = tgt ? tgt.x : 0;
      b.ty = tgt ? tgt.y : 9.5;
    }
    S.blasts.push(b);
    S.emit('special', { player: P.i, kind: b.kind, blast: b });
  };

  // Teddy's slam dunk lands after 0.75 s and bonks everything at once. Tommy's peace wave rolls out from his plane.
  proto.updateBlasts = function (dt) {
    const S = this;
    for (let i = S.blasts.length - 1; i >= 0; i--) {
      const b = S.blasts[i];
      b.t += dt;
      if (b.kind === 'slam') {
        if (!b.fired && b.t >= 0.75) {
          b.fired = true;
          S.bulletsToBits(S.bullets.slice());
          for (const f of S.foes.slice()) if (f.inside) S.damage(f, f.boss ? Math.ceil(f.maxHp * 0.1) : 30, b.owner, 'slam');
          S.emit('slam', { x: b.tx, y: b.ty, player: b.owner });
        }
        if (b.t >= 1.4) S.blasts.splice(i, 1);
      } else {
        b.r = b.t * 15;
        const r2 = b.r * b.r;
        const caught = S.bullets.filter((u) => (u.x - b.x) ** 2 + (u.y - b.y) ** 2 < r2);
        if (caught.length) S.bulletsToBits(caught);
        for (const f of S.foes.slice()) {
          if (!f.inside || b.hit.has(f.id)) continue;
          const rr = b.r + f.r;
          if ((f.x - b.x) ** 2 + (f.y - b.y) ** 2 < rr * rr) { b.hit.add(f.id); S.damage(f, f.boss ? Math.ceil(f.maxHp * 0.1) : 30, b.owner, 'wave'); }
        }
        if (b.t >= 1.6) S.blasts.splice(i, 1);
      }
    }
  };

  proto.hitPlayer = function (P, why) {
    const S = this, L = S.L;
    if (P.out || P.invulnT > 0 || P.specialT > 0 || S.phase !== 'play') return 'pass';
    if (S.buddy && S.buddy.guard) {
      S.stats.saves++;
      P.invulnT = 0.6;
      S.emit('buddySave', { player: P.i, x: P.x, y: P.y, who: S.buddy.kind });
      S.mercy(P, 1.6);
      return 'block';
    }
    if (P.shieldT > 0) { S.emit('shieldBlock', { player: P.i, x: P.x, y: P.y }); return 'block'; }
    S.stats.hits++;
    P.invulnT = L.invuln;
    if (!S.immortal) P.hearts--;
    if (P.lvl > 0) { P.lvl--; if (P.lvl === 0) P.weapon = 'single'; }
    S.mercy(P, L.mercy);
    S.emit('bonk', { player: P.i, x: P.x, y: P.y, why });
    if (P.hearts <= 0) {
      P.out = true;
      P.reviveT = L.revive;
      S.emit('playerOut', { player: P.i, x: P.x, y: P.y });
      if (!S.alivePlayers().length) {
        S.over = true;
        S.phase = 'over';
        S.phaseT = 0;
        S.emit('over', {});
      }
    }
    return 'hit';
  };

  // After a bonk, enemy bullets close to you turn into little stars, so you get a moment to breathe.
  proto.mercy = function (P, r) {
    const S = this;
    const near = S.bullets.filter((b) => (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < r * r);
    if (near.length) S.bulletsToBits(near);
  };

  proto.revive = function (P, why) {
    const S = this;
    const mate = S.players.find((Q) => Q !== P && !Q.out);
    P.out = false;
    P.hearts = Math.max(P.hearts, S.L.reviveHearts);
    P.x = mate ? clamp(mate.x + (P.i === 0 ? -1.6 : 1.6), -PX, PX) : 0;
    P.y = mate ? clamp(mate.y, PY0, PY1) : 3;
    P.invulnT = 3;
    P.shieldT = Math.max(P.shieldT, 3);
    S.emit('revive', { player: P.i, why, x: P.x, y: P.y });
  };

  // ---------------------------------------------------------------- the companion (1 player) and the high five (2 players)

  proto.callBuddy = function () {
    const S = this;
    if (S.over || S.cleared || (S.phase !== 'play' && S.phase !== 'intro')) return;
    if (S.two) { S.cheer(); return; }
    const P = S.players[0];
    if (P.out) return;
    const B = S.buddy;
    if (!B) {
      const side = P.x > 0 ? -1 : 1;
      S.buddy = {
        kind: S.buddyFor(P.kind), x: clamp(P.x + side * 1.8, -PX, PX), y: -1.5, side, phase: 'in', t: 0, left: VISIT,
        helloT: 0, treatT: 0, treated: false, fireT: 0.3, guard: true, byeT: 0, vx: 0,
      };
      S.stats.calls++;
      S.emit('buddyIn', { who: S.buddy.kind });
      return;
    }
    if (B.phase === 'bye' || B.phase === 'leave' || B.treated) {
      // another call: he says hi again, brings another treat and stays the whole visit again
      B.phase = 'hello';
      B.helloT = HELLO;
      B.left = VISIT;
      B.treated = false;
      B.treatT = 0;
      B.guard = true;
      S.stats.calls++;
      S.emit('buddyHello', { who: B.kind, again: true });
      return;
    }
    B.left = VISIT; // called again before his treat arrived: he just stays longer
    S.emit('buddyStay', { who: B.kind });
  };

  proto.updateBuddy = function (dt) {
    const S = this, B = S.buddy;
    if (!B) return;
    const P = S.players[0];
    B.t += dt;
    if (P.out && B.phase !== 'leave') { B.phase = 'leave'; B.guard = false; }
    if (P.x > 1.6) B.side = -1;
    else if (P.x < -1.6) B.side = 1;
    const tx = clamp(P.x + B.side * 1.8, -PX, PX), ty = clamp(P.y + 0.35, PY0, PY1);
    const px = B.x;
    const follow = (k) => { B.x += (tx - B.x) * Math.min(1, dt * k); B.y += (ty - B.y) * Math.min(1, dt * k); };
    switch (B.phase) {
      case 'in': {
        const dx = tx - B.x, dy = ty - B.y, d = Math.hypot(dx, dy), step = 14 * dt;
        if (d <= step) { B.x = tx; B.y = ty; } else { B.x += (dx / d) * step; B.y += (dy / d) * step; }
        if (d < 0.4 || B.t > 1.3) { B.phase = 'hello'; B.helloT = HELLO; S.emit('buddyHello', { who: B.kind, again: false }); }
        break;
      }
      case 'hello':
        follow(6);
        B.helloT -= dt;
        if (B.helloT <= 0) {
          B.phase = 'stay';
          const [emoji, name] = TREATS[Math.floor(S.rand() * TREATS.length)];
          B.treatT = TREAT_FLY;
          S.emit('treat', { emoji, name, who: B.kind, player: 0 });
        }
        break;
      case 'stay':
      case 'bye':
        follow(5);
        if (B.treatT > 0) {
          B.treatT -= dt;
          if (B.treatT <= 0) { B.treated = true; S.stats.treats++; P.score += 100; S.emit('treatGot', { who: B.kind, player: 0 }); }
        }
        if (S.phase === 'play') {
          B.fireT -= dt;
          if (B.fireT <= 0) {
            B.fireT = 0.16;
            const kind = B.kind === 'tommy' ? 'peace' : 'ball';
            if (!S.noGuns) { S.addShot(B.x - 0.15, B.y + 0.45, 0, kind, 'buddy', 1); S.addShot(B.x + 0.15, B.y + 0.45, 0, kind, 'buddy', 1); }
          }
        }
        if (B.phase === 'stay') {
          B.left -= dt;
          if (B.left <= 0) { B.phase = 'bye'; B.byeT = BYE; S.emit('buddyBye', { who: B.kind }); }
        } else {
          B.byeT -= dt;
          if (B.byeT <= 0) { B.phase = 'leave'; B.guard = false; }
        }
        break;
      case 'leave':
        B.y += 12 * dt;
        if (B.y > H + 2) { S.buddy = null; S.emit('buddyOut', { who: B.kind }); return; }
        break;
      default:
        break;
    }
    B.vx = (B.x - px) / dt;
    // he grabs things too, for you
    if (!P.out) for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      if ((it.x - B.x) ** 2 + (it.y - B.y) ** 2 < 0.9) S.collect(P, it, i);
    }
  };

  // Two players: a high five. Both planes get a shield, both brothers do their moves, each fires a ring of shots,
  // and a brother who is out of hearts comes straight back. Then it rests.
  proto.cheer = function () {
    const S = this;
    if (S.cheerT > 0) { S.emit('cheerNo', {}); return; }
    S.cheerT = S.L.cheerCool;
    const revived = [];
    for (const P of S.players) if (P.out && S.alivePlayers().length) { S.revive(P, 'five'); revived.push(P.i); }
    for (const P of S.alivePlayers()) {
      P.shieldT = Math.max(P.shieldT, 5);
      P.poseT = 1.6;
      P.pose = 'cheer';
      for (let k = 0; k < 14; k++) S.addShot(P.x, P.y, (k / 14) * Math.PI * 2, P.shot, P.i, 2, 14);
    }
    const A = S.alivePlayers();
    const mx = A.reduce((s, P) => s + P.x, 0) / A.length, my = A.reduce((s, P) => s + P.y, 0) / A.length;
    S.emit('cheer', { x: mx, y: my, revived });
  };

  // ---------------------------------------------------------------- waves

  proto.updateScript = function (dt) {
    const S = this;
    const waves = S.stage.waves;
    if (S.waveI < waves.length) {
      S.waveT -= dt;
      while (S.waveI < waves.length && S.waveT <= 0) {
        S.spawnWave(waves[S.waveI]);
        S.waveI++;
        S.waveT += S.waveI < waves.length ? waves[S.waveI][0] * S.L.waveGap : 0;
      }
      return;
    }
    if (S.bossState === 'waves') { S.bossState = 'wait'; S.bossT = 0; }
    if (S.bossState === 'wait') {
      S.bossT += dt;
      if ((S.foes.length === 0 && !S.later.length) || S.bossT > 7) { S.bossState = 'warn'; S.bossT = 0; S.emit('warning', { name: BOSSES[S.stage.boss].name, kind: S.stage.boss }); }
    } else if (S.bossState === 'warn') {
      S.bossT += dt;
      if (S.bossT >= 2.6) S.spawnBoss();
    } else if (S.bossState === 'fight') {
      S.stats.bossTime += dt;
    } else if (S.bossState === 'down') {
      S.bossT += dt;
      if (S.bossT >= 2.6) S.bossState = 'done';
    }
  };

  proto.spawnWave = function (w) {
    const S = this, L = S.L;
    const [, pat, type, n, opt] = w;
    if (pat === 'carrier') {
      S.addFoe('balloon', { pat: 'drift', x0: clamp(Number(n) || 0, -4.5, 4.5), y0: TOP + 0.5, carry: type });
      return;
    }
    const count = Math.max(1, Math.round((n || 1) * L.count));
    const add = (k, gap, o) => (k === 0 ? S.addFoe(type, o) : S.after(k * gap, () => S.addFoe(type, o)));
    const spread = (k) => (count === 1 ? 0 : -4.5 + (9 * k) / (count - 1));
    for (let k = 0; k < count; k++) {
      switch (pat) {
        case 'snake': {
          const x0 = opt === 'L' ? -3 : opt === 'R' ? 3 : 0;
          add(k, 0.45, { pat, x0, y0: TOP, amp: opt === 'C' ? 2.8 : 2.2, freq: 2.0 });
          break;
        }
        case 'swoop':
          add(k, 0.38, { pat, sx: opt === 'R' ? -1 : 1, dur: 4.2 });
          break;
        case 'line':
          add(k, 0, { pat, x0: spread(k), y0: TOP });
          break;
        case 'vee': {
          const side = k % 2 ? 1 : -1, rank = Math.ceil(k / 2);
          add(k, 0, { pat, x0: (Number(opt) || 0) + side * rank * 1.1, y0: TOP + rank * 0.9, stop: 11.5 + rank * 0.9, hold: 3 });
          break;
        }
        case 'hover':
          add(k, 0, { pat, x0: count === 1 ? 0 : -4 + (8 * k) / (count - 1), y0: TOP + (k % 2) * 0.6, stop: 12.4 - (k % 2) * 1.3, hold: 4.5 });
          break;
        case 'strafe': {
          const dir = opt === 'R' ? -1 : 1;
          add(k, 0.6, { pat, x0: -dir * (XMAX + 1.2), y0: 12.8 - (k % 2) * 1.6, dir });
          break;
        }
        case 'drift': {
          const xs = count === 1 ? [0] : Array.from({ length: count }, (_, j) => -3.6 + (7.2 * j) / (count - 1));
          add(k, 1.2, { pat, x0: xs[k], y0: TOP + 0.5 });
          break;
        }
        case 'dive':
          add(k, 0.35, { pat, x0: -4.6 + S.rand() * 9.2, y0: TOP });
          break;
        default: // unknown patterns fly straight down (the stage check reports them)
          add(k, 0, { pat, x0: spread(k), y0: TOP });
      }
    }
  };

  proto.addFoe = function (type, o) {
    const S = this, L = S.L, D = FOES[type];
    const f = Object.assign({
      id: S.nextId++, type, x: o.x0 || 0, y: o.y0 || TOP, t: 0, hp: Math.max(1, Math.round(D.hp * L.hp)), r: D.r,
      v: D.speed * L.foeSpeed, inside: false, inT: 0, flashT: 0, vx: 0, vy: 0, ph: S.rand() * Math.PI * 2,
      fireT: D.fire * L.fireGap * (0.35 + S.rand() * 0.6) / S.ramp,
    }, o);
    if (f.pat === 'swoop') { f.x = -f.sx * 4.6; f.y = TOP; }
    f.maxHp = f.hp;
    S.foes.push(f);
    S.emit('foeIn', { foe: f });
    return f;
  };

  proto.spawnBoss = function () {
    const S = this, B = BOSSES[S.stage.boss];
    const hp = Math.round(B.hp * S.L.bossHp * (S.two ? 1.4 : 1) * S.bossHpK);
    const f = S.addFoe('boss', { pat: 'boss', kind: S.stage.boss, name: B.name, x0: 0, y0: H + 4, r: B.r });
    Object.assign(f, { hp, maxHp: hp, boss: true, st: 'enter', bt: 0, moveI: 0, moveT: 0, shotT: 1, spin: 0, ringA: 0, burst: 0 });
    S.boss = f;
    S.bossState = 'fight';
    S.bossT = 0;
    S.emit('bossIn', { name: B.name, kind: f.kind, foe: f });
  };

  // ---------------------------------------------------------------- enemies

  function bez(a, b, c, d, u) {
    const v = 1 - u;
    return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
  }

  proto.updateFoes = function (dt) {
    const S = this, L = S.L;
    for (let i = S.foes.length - 1; i >= 0; i--) {
      const f = S.foes[i];
      const px = f.x, py = f.y;
      f.t += dt;
      if (f.flashT > 0) f.flashT -= dt;
      switch (f.pat) {
        case 'snake':
          f.x = f.x0 + f.amp * Math.sin(f.t * f.freq);
          f.y = f.y0 - f.v * f.t;
          break;
        case 'swoop': {
          const u = f.t / f.dur;
          if (u <= 1) {
            f.x = f.sx * bez(-4.6, -4.6, 4.6, 8.5, u);
            f.y = bez(TOP, 5.5, 5.5, 14, u);
          } else { f.x += f.vx * dt; f.y += f.vy * dt; }
          break;
        }
        case 'line':
          f.y = f.y0 - f.v * 0.8 * f.t;
          break;
        case 'vee':
          if (!f.held) {
            f.y -= f.v * 0.9 * dt;
            if (f.y <= f.stop) { f.held = f.t; }
          } else if (f.t - f.held < f.hold) {
            f.x = f.x0 + 0.35 * Math.sin((f.t - f.held) * 2.4 + f.ph);
          } else f.y -= f.v * 0.7 * dt;
          break;
        case 'hover':
          if (!f.held) {
            f.y += (f.stop - 0.05 - f.y) * Math.min(1, dt * 1.6);
            if (f.y <= f.stop) f.held = f.t;
          } else if (f.t - f.held < f.hold) {
            f.x = f.x0 + 0.7 * Math.sin((f.t - f.held) * 1.3 + f.ph);
          } else f.y += f.v * 0.8 * dt;
          break;
        case 'strafe':
          f.x = f.x0 + f.dir * f.v * 0.9 * f.t;
          f.y = f.y0 + 0.4 * Math.sin(f.t * 3 + f.ph);
          break;
        case 'drift':
          f.y = f.y0 - f.v * f.t;
          f.x = f.x0 + 0.8 * Math.sin(f.t * 0.8 + f.ph);
          break;
        case 'dive':
          f.y = f.y0 - f.v * 1.5 * f.t;
          break;
        case 'stay': // only used by the check's sabotage: a foe that never leaves
          f.y += (12 - f.y) * Math.min(1, dt * 2);
          break;
        case 'boss':
          S.updateBoss(f, dt);
          break;
        default:
          f.y -= f.v * dt;
      }
      if (f.pat !== 'swoop' || f.t / f.dur <= 1) { f.vx = (f.x - px) / dt; f.vy = (f.y - py) / dt; }
      if (!f.inside && f.y < H - 0.2 && f.y > 0 && Math.abs(f.x) < XMAX) f.inside = true;
      if (f.inside) f.inT += dt;
      if (!f.boss && f.t > S.stats.maxFoeAge) S.stats.maxFoeAge = f.t;
      // gone off an edge: no points, no fuss
      if (!f.boss && f.t > 1 && (f.y < -2 || f.y > TOP + 3 || Math.abs(f.x) > XMAX + 3)) {
        S.foes.splice(i, 1);
        S.emit('foeGone', { foe: f });
        continue;
      }
      // shooting, only on screen and not right on top of you
      const D = FOES[f.type];
      if (!f.boss && D.fire && f.inside && f.inT > 0.5 && f.y > 4.5 && f.y < H - 0.6 && S.phase === 'play') {
        f.fireT -= dt;
        if (f.fireT <= 0) {
          S.foeFire(f);
          f.fireT = (D.fire * L.fireGap * (0.8 + S.rand() * 0.4)) / S.ramp;
        }
      }
      // bumping into a plane
      if (f.inside && S.phase === 'play') {
        for (const P of S.players) {
          if (P.out) continue;
          const rr = f.r * 0.8 + L.hitR;
          if ((f.x - P.x) ** 2 + (f.y - P.y) ** 2 < rr * rr) {
            const r = S.hitPlayer(P, 'bump');
            if (r !== 'pass' && !f.boss) S.damage(f, 3, P.i, 'bump');
          }
        }
      }
    }
  };

  proto.target = function (x, y) {
    let best = null, bd = 1e9;
    for (const P of this.players) {
      if (P.out) continue;
      const d = (P.x - x) ** 2 + (P.y - y) ** 2;
      if (d < bd) { bd = d; best = P; }
    }
    return best;
  };

  proto.aimAt = function (x, y) {
    const P = this.target(x, y);
    return P ? Math.atan2(P.x - x, P.y - y) : Math.PI; // angle from straight up, so PI is straight down
  };

  // kind: what it looks like (goo, zap, drop, snow, bolt); size: a multiplier on the bullet size
  proto.addBullet = function (x, y, a, speed, kind, size = 1) {
    const S = this, L = S.L;
    const v = speed * L.bulletSpeed * (1 + 0.025 * (S.stageNo - 1));
    S.bullets.push({ id: S.nextId++, x, y, vx: Math.sin(a) * v, vy: Math.cos(a) * v, r: L.bulletHit * size, draw: 0.22 * L.bulletDraw * size, kind, t: 0 });
  };

  proto.foeFire = function (f) {
    const S = this;
    const easy = S.level === 'easy';
    switch (f.type) {
      case 'drone':
        S.addBullet(f.x, f.y - 0.3, S.aimAt(f.x, f.y), 5, 'zap');
        break;
      case 'ufo': {
        const a = S.aimAt(f.x, f.y);
        const n = easy ? 2 : 3, sp = 0.32;
        for (let k = 0; k < n; k++) S.addBullet(f.x, f.y - 0.3, a + (k - (n - 1) / 2) * sp, 4.6, 'zap');
        break;
      }
      case 'cloud': {
        const kind = S.stage.theme === 'snow' ? 'snow' : 'drop';
        S.addBullet(f.x - 0.35, f.y - 0.5, Math.PI, 4.2, kind);
        if (!easy) S.addBullet(f.x + 0.35, f.y - 0.5, Math.PI, 4.2, kind);
        break;
      }
      case 'blimp': {
        const n = easy ? 5 : 8, off = S.rand() * Math.PI;
        for (let k = 0; k < n; k++) S.addBullet(f.x, f.y, off + (k / n) * Math.PI * 2, 3.2, 'goo', 1.2);
        break;
      }
      default:
        break;
    }
    S.emit('foeShot', { foe: f });
  };

  proto.updateBoss = function (f, dt) {
    const S = this, L = S.L;
    if (f.st === 'enter') {
      f.y += (12.2 - f.y) * Math.min(1, dt * 1.1);
      if (f.y < 12.5) { f.st = 'fight'; f.bt = 0; }
      return;
    }
    f.bt += dt;
    const wob = f.kind === 'storm' ? 0.35 : 0.45;
    f.x = 3.2 * Math.sin(f.bt * wob);
    f.y = 12.2 + 0.5 * Math.sin(f.bt * 0.9);
    if (S.phase !== 'play') return;
    const B = BOSSES[f.kind];
    const mv = B.moves[f.moveI % B.moves.length];
    const rage = f.hp < f.maxHp * 0.5 ? 0.75 : 1;
    const gk = L.bossGap * rage;
    const n = (k) => Math.max(3, Math.round(k * L.bossCount));
    const easy = S.level === 'easy';
    f.moveT += dt;
    if (f.moveT > 5) { f.moveI++; f.moveT = -1.2; f.shotT = 0.3; f.burst = 0; return; }
    if (f.moveT < 0) return; // a short rest between moves
    f.shotT -= dt;
    if (f.shotT > 0) return;
    const ox = f.x, oy = f.y - f.r * 0.55;
    const kind = { blimp: 'goo', storm: 'drop', bolt: 'zap', king: 'zap' }[f.kind];
    switch (mv) {
      case 'fan': {
        const k = n(5), a = S.aimAt(ox, oy), spread = 0.9;
        for (let j = 0; j < k; j++) S.addBullet(ox, oy, a + (j / (k - 1) - 0.5) * spread, 4.8, kind);
        f.shotT = 1.0 * gk;
        break;
      }
      case 'ring': {
        const k = n(14);
        f.ringA += 0.17;
        for (let j = 0; j < k; j++) S.addBullet(f.x, f.y, f.ringA + (j / k) * Math.PI * 2, 3.8, kind);
        f.shotT = 1.3 * gk;
        break;
      }
      case 'aimed':
        S.addBullet(ox, oy, S.aimAt(ox, oy), 6, kind);
        f.burst++;
        f.shotT = (f.burst % 3 ? 0.14 : 0.9) * gk;
        break;
      case 'spiral':
      case 'spiral2': {
        const arms = mv === 'spiral2' ? (easy ? 2 : 3) : easy ? 1 : 2;
        for (let j = 0; j < arms; j++) S.addBullet(f.x, f.y, f.spin + (j / arms) * Math.PI * 2 + Math.PI, 3.8, kind);
        f.spin += 0.31;
        f.shotT = (mv === 'spiral2' ? 0.13 : 0.11) * gk;
        break;
      }
      case 'rain':
      case 'rain2': {
        // rain from the cloud's edge across the whole screen, with a dry lane that wanders about
        const gap = 3.2 * Math.sin(f.bt * 0.5);
        let x = -5.6 + S.rand() * 11.2;
        if (Math.abs(x - gap) < 1.5) x = gap + (x < gap ? -1.5 : 1.5) - (x < gap ? S.rand() : -S.rand()) * 0.5;
        S.addBullet(clamp(x, -5.8, 5.8), H + 0.2, Math.PI, 4.2, f.kind === 'storm' ? 'drop' : 'zap');
        f.shotT = 0.13 * gk;
        if (mv === 'rain2') {
          f.burst += 0.13 * gk;
          if (f.burst > 1.3) { f.burst = 0; const a = S.aimAt(ox, oy); for (let j = 0; j < 3; j++) S.addBullet(ox, oy, a + (j - 1) * 0.3, 4.5, 'bolt'); }
        }
        break;
      }
      case 'minions': {
        const side = f.burst % 2 ? 1 : -1;
        f.burst++;
        for (let j = 0; j < 2; j++) S.after(j * 0.35, () => S.addFoe('drone', { pat: 'swoop', sx: side, dur: 4.2 }));
        f.shotT = 1.7 * gk;
        break;
      }
      default:
        f.shotT = 1;
    }
    S.emit('bossShot', { foe: f, move: mv });
  };

  proto.damage = function (f, n, owner, how) {
    const S = this;
    if (f.dead) return;
    f.hp -= n;
    f.flashT = 0.08;
    if (f.hp > 0) { S.emit(f.boss ? 'bossHit' : 'foeHit', { foe: f, how }); return; }
    f.dead = true;
    const i = S.foes.indexOf(f);
    if (i >= 0) S.foes.splice(i, 1);
    const D = FOES[f.type];
    const P = owner === 'buddy' ? S.players[0] : S.players[owner] || S.players[0];
    P.score += D.points;
    if (owner === 'buddy') S.stats.buddyPops++;
    else P.pops++;
    S.stats.pops++;
    S.emit('foePop', { foe: f, by: owner, points: D.points, how });
    for (const [kind, chance] of D.drops) if (S.rand() < chance) S.drop(kind, f.x, f.y);
    if (f.carry) S.drop('power', f.x, f.y, f.carry);
    else if (!f.boss && ++S.pityN >= S.L.pity) {
      // every so often a plain enemy pops into a power-up too (sooner on Easy)
      S.pityN = 0;
      const pick = ['double', 'spread', 'shield', 'heart', 'magnet'];
      S.drop('power', f.x, f.y, pick[Math.floor(S.rand() * pick.length)]);
    }
    if (f.boss) {
      S.bossState = 'down';
      S.bossT = 0;
      S.boss = null;
      S.later.length = 0;
      S.bulletsToBits(S.bullets.slice());
      for (const g of S.foes.slice()) S.damage(g, 99, owner, 'boss');
      for (let k = 0; k < 26; k++) S.drop(['coin', 'fruit', 'star'][k % 3], f.x + (S.rand() - 0.5) * 3, f.y + (S.rand() - 0.5) * 2);
      S.drop('power', f.x, f.y, 'heart');
      S.emit('bossDown', { foe: f, name: f.name, kind: f.kind });
    }
  };

  // ---------------------------------------------------------------- shots and bullets

  proto.updateShots = function (dt) {
    const S = this;
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H + 1 || s.y < -1 || Math.abs(s.x) > XMAX + 1) { S.shots.splice(i, 1); continue; }
      for (const f of S.foes) {
        if (f.y > H + 0.4 || f.dead) continue;
        const rr = f.r + 0.22;
        if ((f.x - s.x) ** 2 + (f.y - s.y) ** 2 < rr * rr) {
          S.shots.splice(i, 1);
          S.damage(f, s.dmg, s.owner, 'shot');
          break;
        }
      }
    }
  };

  proto.updateBullets = function (dt) {
    const S = this, L = S.L;
    for (const b of S.bullets) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    S.bullets = S.bullets.filter((b) => b.y > -1 && b.y < H + 2 && Math.abs(b.x) < XMAX + 1);
    if (S.phase !== 'play') return;
    for (const b of S.bullets.slice()) {
      if (b.gone) continue;
      for (const P of S.players) {
        if (P.out) continue;
        const rr = b.r + L.hitR;
        if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < rr * rr) {
          const r = S.hitPlayer(P, 'bullet');
          if (r === 'block') S.bulletsToBits([b]);
          else if (r === 'hit' && !b.gone) { b.gone = true; S.bullets.splice(S.bullets.indexOf(b), 1); }
          break;
        }
      }
    }
  };

  // Enemy bullets turn into little stars that fly to the nearest brother.
  proto.bulletsToBits = function (list) {
    const S = this;
    let n = 0;
    for (const b of list) {
      if (b.gone) continue;
      b.gone = true;
      n++;
      const k = S.bullets.indexOf(b);
      if (k >= 0) S.bullets.splice(k, 1);
      S.items.push({ id: S.nextId++, kind: 'bit', x: b.x, y: b.y, vx: 0, vy: 0.5, t: 0, homing: 0.35 });
    }
    if (n) S.emit('bits', { n });
  };

  // ---------------------------------------------------------------- things to catch

  proto.drop = function (kind, x, y, ptype) {
    const S = this;
    const it = {
      id: S.nextId++, kind, x: clamp(x, -XMAX + 0.4, XMAX - 0.4), y: Math.min(y, H - 0.3),
      vx: (S.rand() - 0.5) * 3.2, vy: 1 + S.rand() * 2, t: 0, homing: 0, ph: S.rand() * 6,
    };
    if (kind === 'fruit') it.emoji = FRUIT[Math.floor(S.rand() * FRUIT.length)];
    if (kind === 'power') { it.ptype = ptype; it.vx *= 0.4; it.vy = 1.5; }
    S.items.push(it);
    return it;
  };

  proto.updateItems = function (dt) {
    const S = this;
    const alive = S.alivePlayers();
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      it.t += dt;
      let P = null;
      if (alive.length) {
        P = alive.length === 1 ? alive[0] : (alive[0].x - it.x) ** 2 + (alive[0].y - it.y) ** 2 < (alive[1].x - it.x) ** 2 + (alive[1].y - it.y) ** 2 ? alive[0] : alive[1];
        const d2 = (P.x - it.x) ** 2 + (P.y - it.y) ** 2;
        if (!it.homing && (S.phase === 'clear' || (P.magnetT > 0 && d2 < 49))) it.homing = 0.01;
      }
      if (it.homing && P && it.t >= it.homing) {
        const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy) || 1;
        const sp = 8 + Math.min(16, (it.t - it.homing) * 18);
        it.vx = (dx / d) * sp;
        it.vy = (dy / d) * sp;
      } else if (it.kind === 'power') {
        it.vx *= Math.exp(-2 * dt);
        it.vy += (-1.1 - it.vy) * Math.min(1, dt * 1.5);
        it.x += Math.sin(it.t * 2 + it.ph) * 1.4 * dt;
      } else {
        it.vx *= Math.exp(-2.5 * dt);
        it.vy += (-2 - it.vy) * Math.min(1, dt * 2);
      }
      it.x = clamp(it.x + it.vx * dt, -XMAX + 0.3, XMAX - 0.3);
      it.y += it.vy * dt;
      if (it.y < -1) { S.items.splice(i, 1); continue; }
      for (const Q of alive) {
        const rr = it.kind === 'power' ? 1.05 : 0.95;
        if ((Q.x - it.x) ** 2 + (Q.y - it.y) ** 2 < rr * rr) { S.collect(Q, it, i); break; }
      }
    }
  };

  proto.collect = function (P, it, i) {
    const S = this;
    if (S.items[i] !== it) i = S.items.indexOf(it);
    if (i < 0) return;
    S.items.splice(i, 1);
    const pts = ITEM_POINTS[it.kind] || 0;
    P.score += pts;
    P.got[it.kind] = (P.got[it.kind] || 0) + 1;
    S.stats.items++;
    if (it.kind === 'power') S.applyPower(P, it.ptype);
    S.emit('item', { item: it, player: P.i, points: pts });
  };

  proto.applyPower = function (P, type) {
    const S = this, L = S.L;
    let extra = '';
    switch (type) {
      case 'double':
      case 'spread':
        if (P.weapon === type) { if (P.lvl < 3) P.lvl++; else extra = 'max'; }
        else { P.weapon = type; P.lvl = Math.max(1, P.lvl); }
        break;
      case 'shield': P.shieldT = L.shield; break;
      case 'magnet': P.magnetT = L.magnet; break;
      case 'heart':
        if (P.hearts < L.maxHearts) P.hearts++;
        else { P.score += 1000; extra = 'full'; }
        break;
      case 'super':
        if (P.specials < MAX_SPECIALS) P.specials++;
        else { P.score += 1000; extra = 'full'; }
        break;
      default: break;
    }
    S.stats.powers++;
    S.emit('power', { player: P.i, ptype: type, lvl: P.lvl, weapon: P.weapon, extra });
  };

  // ---------------------------------------------------------------- the end of a stage

  proto.checkClear = function () {
    const S = this;
    if (S.phase !== 'play') return;
    if (S.waveI < S.stage.waves.length || S.later.length || S.foes.length) return;
    if (S.stage.boss && S.bossState !== 'done') return;
    S.phase = 'clear';
    S.phaseT = 0;
    S.cleared = true;
    S.bulletsToBits(S.bullets.slice());
    if (S.buddy && S.buddy.phase !== 'leave') { S.buddy.phase = 'bye'; S.buddy.byeT = 2.5; S.buddy.left = 0; }
    S.emit('clear', {});
  };

  // test hooks
  proto.winNow = function () {
    const S = this;
    S.waveI = S.stage.waves.length;
    S.later.length = 0;
    if (S.phase === 'intro') { S.phase = 'play'; S.phaseT = 0; }
    for (const f of S.foes.slice()) S.damage(f, 9999, 0, 'test');
    if (S.stage.boss) { S.bossState = 'done'; S.boss = null; }
  };
  proto.give = function (type, i = 0) {
    const P = this.players[i];
    if (P && POWERS.includes(type)) this.applyPower(P, type);
    return P;
  };
  proto.spawnPower = function (type, x = 0, y = 12) { return this.drop('power', x, y, type); };
  proto.carry = function () {
    return this.players.map((P) => ({ hearts: P.hearts, specials: P.specials, weapon: P.weapon, lvl: P.lvl, score: P.score, out: P.out }));
  };
  proto.score = function () { return this.players.reduce((s, P) => s + P.score, 0); };
  proto.bossName = function () { return this.stage.boss ? BOSSES[this.stage.boss].name : ''; };

  SKY.sim = { Sim, W, H, XMAX, TOP, PX, PY0, PY1, LEVELS, FOES, BOSSES, POWERS, TREATS, FRUIT, ITEM_POINTS, VISIT, HELLO, BYE, MAX_SPECIALS, rng, clamp };
})();

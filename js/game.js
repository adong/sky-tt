/* Sky TT: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, turns the rules'
   events into planes, poofs, sounds, toasts and the HUD, and handles menus, keys and touch.
   Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const A = SKY.art;
  const M = SKY.sim;
  const SFX = SKY.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const AIR = A.AIR;
  const wz = A.wz;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => k * k * (3 - 2 * k);
  const FA = M.W / (M.H * Math.cos(A.TILT)); // the play area's width / height on screen
  const SCROLL = 1.6; // how fast the ground goes by
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const SPECIAL = { teddy: { emoji: '🏀', name: 'SLAM DUNK' }, tommy: { emoji: '✌️', name: 'PEACE WAVE' } };
  const sig = (kind, which) => Kit.roster.signature(Kit.roster.get(kind), which);

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const settings = Object.assign({ level: 'easy', stage: 1, lastPlayers: ['teddy'] }, store.get('skyTT.settings', {}));
  const best = Object.assign({ easy: [], normal: [], hi: 0 }, store.get('skyTT.best', {}));
  const saveSettings = () => store.set('skyTT.settings', settings);
  const saveBest = () => store.set('skyTT.best', best);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  scene.background = new T.Color('#8fd3ff');
  const ch = (M.H / 2) * Math.cos(A.TILT);
  const camera = new T.OrthographicCamera(-M.W / 2, M.W / 2, ch, -ch, 1, 140);
  const CAMD = 50;
  const camBase = new T.Vector3(0, AIR + CAMD * Math.cos(A.TILT), CAMD * Math.sin(A.TILT));
  camera.position.copy(camBase);
  camera.lookAt(0, AIR, 0);
  const hemi = new T.HemisphereLight('#ffffff', '#5b7a3a', 0.85);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff3e0', 1.1);
  sun.position.set(-4, 12, 6);
  scene.add(sun);

  A.initTextures();
  const world = A.makeWorld(scene);
  const fx = A.makeFx(scene);

  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');

  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 152 });

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', modeT: 0, time: 0, sim: null, demo: false, acc: 0,
    players: ['teddy'], level: settings.level === 'normal' ? 'normal' : 'easy',
    stageNo: clamp(settings.stage | 0, 1, SKY.STAGES.length),
    carry: null, carryStart: null, frozen: false, keepAwake: false,
    toasts: [], anims: [], banner: null, sfxAt: {}, shake: 0, theme: null,
    clearAt: 0, overAt: 0, celebrate: null, saveToastAt: -9, treat: null, itemStreak: 0, itemAt: -9,
  };
  let rect = { x: 0, y: 0, w: 100, h: 100 };

  function setTheme(name) {
    const th = world.setTheme(name);
    st.theme = name;
    scene.background.set(th.bg);
    hemi.color.set(th.hemi[0]);
    hemi.groundColor.set(th.hemi[1]);
    hemi.intensity = th.hemi[2];
    sun.color.set(th.sun[0]);
    sun.intensity = th.sun[1];
    document.body.style.background = `linear-gradient(180deg, ${th.page[0]}, ${th.page[1]})`;
    return th;
  }

  // ---------------------------------------------------------------- views of the things in the game

  const shadowGeo = new T.PlaneGeometry(1, 1);
  function makeShadow(size) {
    const m = new T.Mesh(shadowGeo, new T.MeshBasicMaterial({ map: A.tex.shadow, transparent: true, depthWrite: false, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size * 1.6, size, 1);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  }
  function placeShadow(sh, x, y, on) {
    const th = world.theme();
    sh.visible = on && th && th.shadows;
    if (sh.visible) sh.position.set(x + 0.45, 0.04, wz(y) - 1.0);
  }

  // the brothers' planes, kept for the whole game
  const planes = {};
  function planeView(kind, buddy) {
    const key = kind + (buddy ? '-buddy' : '');
    if (planes[key]) return planes[key];
    const v = A.buildPlane(kind);
    A.addShield(v);
    A.addMagnet(v);
    if (buddy) {
      const entry = Kit.roster.get(kind);
      v.root.scale.setScalar(entry.buddyScale || 0.8);
      A.addHalo(v, '#ffd400');
      const tag = G.nameTag(NAMES[kind], entry.tag || '#ffb02e');
      tag.position.set(0, 1.2, -1.25);
      tag.material.depthTest = false;
      tag.renderOrder = 9;
      v.root.add(tag);
      v.tag = tag;
    }
    v.shadowM = makeShadow(1.3);
    v.phase = Math.random() * 10;
    v.roll = 0;
    v.spinT = 0;
    v.root.visible = false;
    scene.add(v.root);
    return (planes[key] = v);
  }

  // enemies, pooled by kind
  const foeViews = new Map();
  const foePool = {};
  function foeKey(f) { return f.boss ? `boss-${f.kind}` : f.type === 'balloon' ? `balloon-${f.carry}` : `${f.type}-${st.theme}`; }
  function takeFoe(f) {
    const key = foeKey(f);
    let v = (foePool[key] || []).pop();
    if (!v) {
      if (f.boss) v = A.buildBoss(f.kind, st.theme);
      else if (f.type === 'drone') v = A.buildDrone(st.theme);
      else if (f.type === 'ufo') v = A.buildUfo();
      else if (f.type === 'cloud') v = A.buildCloud(st.theme);
      else if (f.type === 'blimp') v = A.buildBlimp();
      else v = A.buildBalloon(f.carry);
      v.key = key;
      v.shadowM = makeShadow(f.r * 1.6);
    }
    v.root.visible = true;
    v.root.scale.setScalar(1);
    v.hitK = 0;
    v.phase = Math.random() * 10;
    scene.add(v.root);
    return v;
  }
  function dropFoe(v) {
    scene.remove(v.root);
    v.shadowM.visible = false;
    (foePool[v.key] || (foePool[v.key] = [])).push(v);
  }

  const shotViews = new Map(), shotPool = {};
  const bulletViews = new Map(), bulletPool = {};
  const itemViews = new Map(), itemPool = {};
  const blastViews = new Map();
  function pooled(map, pool, id, key, make) {
    let v = map.get(id);
    if (!v) {
      v = (pool[key] || []).pop() || make();
      v.userData.key = key;
      scene.add(v);
      map.set(id, v);
    }
    return v;
  }
  function sweep(map, pool, live) {
    for (const [id, v] of map) {
      if (live.has(id)) continue;
      scene.remove(v);
      (pool[v.userData.key] || (pool[v.userData.key] = [])).push(v);
      map.delete(id);
    }
  }

  function clearViews() {
    for (const v of foeViews.values()) dropFoe(v);
    foeViews.clear();
    for (const [map, pool] of [[shotViews, shotPool], [bulletViews, bulletPool], [itemViews, itemPool]]) sweep(map, pool, new Set());
    for (const b of blastViews.values()) b.cleanup();
    blastViews.clear();
    for (const v of Object.values(planes)) { v.root.visible = false; v.shadowM.visible = false; }
    for (const a of st.anims) if (a.cleanup) a.cleanup();
    st.anims = [];
    fx.clear();
  }

  // ---------------------------------------------------------------- moving the views to match the rules

  function posePilot(v, mode, dt) {
    v.phase += dt * 6;
    Kit.people.pose(v.pilot.p, v.phase, mode, 1 - Math.exp(-14 * dt));
  }

  function syncPlane(v, P, dt, mode) {
    v.root.visible = true;
    let y = P.y, x = P.x;
    const cel = st.celebrate;
    if (cel && cel.t > 2.4) y += (cel.t - 2.4) ** 2 * 9; // zoom off the top after the celebration
    v.root.position.set(x, AIR, wz(y));
    const roll = -clamp((P.vx || 0) / 9, -1, 1) * 0.55;
    v.roll += (roll - v.roll) * Math.min(1, dt * 8);
    v.body.rotation.z = v.roll;
    v.body.rotation.x = clamp((P.vy || 0) / 9, -1, 1) * -0.12;
    if (v.spinT > 0) { v.spinT -= dt; v.body.rotation.y = (1 - v.spinT / 0.7) * Math.PI * 2; } else v.body.rotation.y = 0;
    v.prop.rotation.z += dt * 45;
    v.disc.material.opacity = 0.2 + Math.sin(st.time * 50) * 0.05;
    posePilot(v, mode, dt);
    placeShadow(v.shadowM, x, y, true);
  }

  function playerMode(P) {
    const cel = st.celebrate;
    if (cel) {
      const s = Kit.roster.get(P.kind).signature || ['wave'];
      return s[Math.floor(cel.t / 1.2) % s.length];
    }
    if (P.poseT > 0) {
      if (P.pose === 'special') return P.kind === 'tommy' ? 'peace' : 'jumpshot';
      return sig(P.kind, 'hello');
    }
    if (P.invulnT > 1 && !P.specialT) return 'fall';
    return 'jet';
  }

  function syncViews(dt) {
    const S = st.sim;
    if (!S) return;
    // the brothers
    S.players.forEach((P) => {
      const v = planeView(P.kind);
      if (P.out) { v.root.visible = false; v.shadowM.visible = false; return; }
      syncPlane(v, P, dt, playerMode(P));
      const blink = P.invulnT > 0 && P.specialT <= 0 && !st.celebrate;
      v.body.visible = !blink || Math.floor(st.time * 14) % 2 === 0;
      v.shield.visible = P.shieldT > 0 && (P.shieldT > 1.5 || Math.floor(st.time * 10) % 2 === 0);
      if (v.shield.visible) { v.cage.rotation.y += dt * 1.6; v.cage.rotation.x += dt * 0.7; }
      v.magnet.visible = P.magnetT > 0;
      if (v.magnet.visible) v.magnet.rotation.z += dt * 4;
    });
    // the companion
    const B = S.buddy;
    const bv = planes[`${S.players[0].kind === 'tommy' ? 'teddy' : 'tommy'}-buddy`];
    if (B) {
      const v = planeView(B.kind, true);
      let mode = 'jet';
      if (v.saveT > 0) v.saveT -= dt;
      if (B.phase === 'hello' || v.saveT > 0) mode = sig(B.kind, 'hello');
      else if (B.phase === 'bye') mode = sig(B.kind, 'goodbye');
      syncPlane(v, { x: B.x, y: B.y, vx: B.vx, vy: 0 }, dt, mode);
      v.shield.visible = false;
      v.magnet.visible = false;
      v.halo.material.opacity = 0.55 + Math.sin(st.time * 6) * 0.2;
      v.halo.rotation.z += dt;
    } else if (bv) { bv.root.visible = false; bv.shadowM.visible = false; }

    // enemies
    const seen = new Set();
    for (const f of S.foes) {
      let v = foeViews.get(f.id);
      if (!v) { v = takeFoe(f); foeViews.set(f.id, v); }
      seen.add(f.id);
      animateFoe(v, f, dt);
    }
    for (const [id, v] of foeViews) if (!seen.has(id)) { dropFoe(v); foeViews.delete(id); }

    // the brothers' shots
    const live = new Set();
    for (const s of S.shots) {
      const kind = s.kind;
      const v = pooled(shotViews, shotPool, s.id, kind, () => A.shotView(kind));
      v.position.set(s.x, AIR + 0.1, wz(s.y));
      if (kind === 'ball') v.userData.spin.material.rotation -= dt * 14;
      else v.userData.spin.material.rotation = Math.sin(st.time * 12 + s.id) * 0.3;
      live.add(s.id);
    }
    sweep(shotViews, shotPool, live);

    // enemy bullets
    live.clear();
    for (const b of S.bullets) {
      const v = pooled(bulletViews, bulletPool, b.id, b.kind, () => A.bulletView(b.kind));
      v.position.set(b.x, AIR + 0.15, wz(b.y));
      const pulse = 1 + Math.sin(st.time * 12 + b.id) * 0.08;
      v.scale.set(b.draw * 2.3 * pulse, b.draw * 2.3 * pulse, 1);
      if (b.kind === 'drop') v.material.rotation = Math.atan2(b.vx, -b.vy); // the tip trails behind
      else v.material.rotation = st.time * 3 + b.id;
      live.add(b.id);
    }
    sweep(bulletViews, bulletPool, live);

    // things to catch
    live.clear();
    for (const it of S.items) {
      const key = it.kind === 'power' ? `p-${it.ptype}` : it.kind === 'fruit' ? `f-${it.emoji}` : it.kind;
      const v = pooled(itemViews, itemPool, it.id, key, () => A.itemView(it));
      v.position.set(it.x, AIR + 0.2, wz(it.y));
      const m = v.userData.main;
      if (it.kind === 'coin') m.scale.x = 0.5 * Math.abs(Math.cos(st.time * 5 + it.id));
      else if (it.kind === 'power') { m.material.rotation = Math.sin(st.time * 3 + it.id) * 0.15; v.children[0].material.opacity = 0.5 + Math.sin(st.time * 6) * 0.25; }
      else m.material.rotation = Math.sin(st.time * 4 + it.id) * 0.25;
      live.add(it.id);
    }
    sweep(itemViews, itemPool, live);

    // the specials
    for (const b of S.blasts) {
      let v = blastViews.get(b.id);
      if (!v) { v = makeBlastView(b); blastViews.set(b.id, v); }
      v.tick(b, dt);
    }
    for (const [id, v] of blastViews) if (!S.blasts.some((b) => b.id === id)) { v.cleanup(); blastViews.delete(id); }
  }

  function animateFoe(v, f, dt) {
    v.phase += dt;
    v.root.position.set(f.x, AIR, wz(f.y));
    if (f.flashT > 0) v.hitK = 1;
    v.hitK = Math.max(0, v.hitK - dt * 7);
    if (v.base === undefined) v.base = v.body.scale.x;
    v.body.scale.setScalar(v.base * (1 + v.hitK * 0.16));
    switch (f.type === 'boss' ? `boss-${f.kind}` : f.type) {
      case 'drone':
        for (const r of v.rotors) r.rotation.y += dt * 30;
        v.body.rotation.z = clamp(-f.vx * 0.06, -0.4, 0.4);
        v.body.rotation.x = clamp(f.vy * 0.03, -0.3, 0.3);
        v.tip.visible = Math.floor(st.time * 4 + f.id) % 2 === 0;
        break;
      case 'ufo':
      case 'boss-king':
        v.spin.rotation.y += dt * 2.2;
        v.lights.forEach((l, i) => { l.visible = (Math.floor(st.time * 6) + i) % 2 === 0; });
        Kit.people.pose(v.pilot.p, v.phase * 6, f.boss ? 'wave' : 'idle', 1 - Math.exp(-10 * dt));
        v.body.position.y = Math.sin(st.time * 3 + f.id) * 0.08;
        break;
      case 'cloud':
      case 'boss-storm':
        v.body.position.y = Math.sin(v.phase * 2) * 0.08;
        if (v.bolts) v.bolts.forEach((b, i) => { b.visible = Math.floor(st.time * 8 + i * 3) % 3 !== 0; });
        break;
      case 'blimp':
      case 'boss-blimp':
        v.prop.rotation[f.boss ? 'x' : 'z'] += dt * 20;
        v.eyes.forEach((e, i) => { e.position.x += Math.sin(st.time * 5 + i * 2) * 0.002; });
        Kit.people.pose(v.rider.p, v.phase * 5, 'walk', 1 - Math.exp(-10 * dt));
        break;
      case 'balloon':
        v.body.rotation.z = Math.sin(v.phase * 1.8) * 0.12;
        v.body.position.y = Math.sin(v.phase * 2.4) * 0.1;
        break;
      case 'boss-bolt':
        for (const r of v.rotors) r.rotation.y += dt * 24;
        v.body.rotation.z = Math.sin(v.phase * 1.3) * 0.08;
        Kit.people.pose(v.pilot.p, v.phase * 6, 'idle', 1);
        break;
      default:
        break;
    }
    placeShadow(v.shadowM, f.x, f.y, f.y < M.H + 1);
  }

  // Teddy's slam dunk: a hoop appears over the target and a giant ball flies up into it.
  // Tommy's peace wave: a rainbow ring of peace signs rolls out across the screen.
  function makeBlastView(b) {
    const S = st.sim;
    const P = S.players[b.owner];
    if (b.kind === 'slam') {
      const hoop = A.buildHoop();
      hoop.position.set(b.tx, AIR + 0.4, wz(b.ty));
      hoop.scale.setScalar(0.01);
      scene.add(hoop);
      const ballS = A.spriteOf(G.emojiTexture('🏀'), 0.6, { depthTest: false });
      ballS.renderOrder = 9;
      scene.add(ballS);
      const x0 = P ? P.x : 0, y0 = P ? P.y : 3;
      return {
        tick(bb) {
          const k = Math.min(1, bb.t / 0.75);
          hoop.scale.setScalar(Math.min(1.6, bb.t * 6) * (bb.t > 1.1 ? Math.max(0.01, 1 - (bb.t - 1.1) * 3) : 1));
          if (k < 1) {
            ballS.visible = true;
            ballS.position.set(lerp(x0, b.tx, smooth(k)), AIR + 0.5 + Math.sin(k * Math.PI) * 3.5, wz(lerp(y0, b.ty, k)) - Math.sin(k * Math.PI) * 1.5);
            const s = 0.7 + k * 2.2;
            ballS.scale.set(s, s, 1);
            ballS.material.rotation = -k * 9;
          } else ballS.visible = false;
        },
        cleanup() { scene.remove(hoop); scene.remove(ballS); },
      };
    }
    const ring = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: A.tex.ring, transparent: true, depthWrite: false, depthTest: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 7;
    ring.position.set(b.x, AIR + 0.3, wz(b.y));
    scene.add(ring);
    const signs = [];
    for (let i = 0; i < 12; i++) {
      const s = A.spriteOf(G.emojiTexture('✌️'), 0.8, { depthTest: false });
      s.renderOrder = 8;
      scene.add(s);
      signs.push(s);
    }
    return {
      tick(bb) {
        const r = Math.max(0.2, bb.t * 15);
        ring.scale.set(r * 2.1, r * 2.1, 1);
        ring.material.opacity = bb.t > 1.1 ? Math.max(0, 1 - (bb.t - 1.1) * 2) : 1;
        signs.forEach((s, i) => {
          const a = (i / signs.length) * Math.PI * 2 + bb.t * 1.5;
          s.position.set(b.x + Math.cos(a) * r, AIR + 0.5, wz(b.y + Math.sin(a) * r));
          s.material.opacity = ring.material.opacity;
          s.material.rotation = Math.sin(bb.t * 10 + i) * 0.3;
        });
      },
      cleanup() { scene.remove(ring); for (const s of signs) scene.remove(s); },
    };
  }

  // ---------------------------------------------------------------- sounds and effects from the rules' events

  function play(name, ...args) {
    if (st.demo) return;
    const now = st.time;
    if (st.sfxAt[name] !== undefined && now - st.sfxAt[name] < 0.06) return;
    st.sfxAt[name] = now;
    SFX[name](...args);
  }
  const POP_WORDS = ['BONK!', 'POP!', 'BOINK!', 'POW!'];
  const POWER_TOAST = {
    double: (e, P) => (e.weapon === 'double' && e.lvl ? `${SPECIAL[P.kind].emoji.repeat(e.lvl + 1)} ${['', 'DOUBLE', 'TRIPLE', 'MEGA'][e.lvl]} SHOT!` : ''),
    spread: (e) => (e.weapon === 'spread' ? ['', '🎆 SPREAD SHOT!', '🎆 BIG SPREAD!', '🎆 SUPER FAST SPREAD!'][e.lvl] : ''),
    shield: () => '🛡️ SHIELD ON!',
    magnet: () => '🧲 MAGNET! EVERYTHING COMES TO YOU!',
    heart: (e) => (e.extra === 'full' ? '❤️ HEARTS FULL! +1000' : '❤️ +1 HEART!'),
  };

  function onEvent(e, S) {
    switch (e.type) {
      case 'shot':
        if (e.player === 0 && Math.random() < 0.3) play('shot', e.kind);
        break;
      case 'foeHit':
        play('tick');
        break;
      case 'bossHit':
        play('bossHit');
        if (Math.random() < 0.3) fx.sparkle(e.foe.x + G.rand(-1, 1), wz(e.foe.y - 0.5), 0.8, 0.3);
        break;
      case 'foePop': {
        const f = e.foe, x = f.x, z = wz(f.y);
        if (f.boss) break;
        const big = f.type === 'blimp' || f.type === 'cloud';
        fx.puff(x, z, big ? 9 : 6, '#ffffff', big ? 2 : 1.4);
        fx.stars(x, z, big ? 10 : 6);
        fx.word(x, z, f.type === 'balloon' ? 'POP!' : G.pick(POP_WORDS), f.type === 'balloon' ? '#ff8fb8' : '#ffd400', big ? 1.6 : 1.2);
        if (e.points && !st.demo) fx.points(x, z - 0.4, e.points);
        play('pop', big);
        break;
      }
      case 'foeShot':
        if (Math.random() < 0.5) play('foeShot', e.foe.type === 'blimp' ? 'goo' : e.foe.type === 'cloud' ? 'drop' : 'zap');
        break;
      case 'bossShot':
        if (Math.random() < 0.25) play('foeShot', 'zap');
        break;
      case 'warning':
        banner(`⚠️ LOOK OUT!<small>${e.name} IS COMING!</small>`, 2.4, 'warn');
        play('warning');
        break;
      case 'bossDown': {
        const f = e.foe, x = f.x, z = wz(f.y);
        for (let i = 0; i < 4; i++) fx.puff(x + G.rand(-1.5, 1.5), z + G.rand(-1, 1), 8, '#ffffff', 2.5);
        fx.stars(x, z, 24, 5);
        fx.word(x, z, 'BONK!!', '#ffd400', 3.2);
        flash('#ffffff', 0.4);
        st.shake = 0.6;
        banner(`${e.name}<small>GOT BONKED!</small>`, 2.4);
        play('bossDown');
        break;
      }
      case 'bonk': {
        const v = planeView(S.players[e.player].kind);
        v.spinT = 0.7;
        fx.word(e.x, wz(e.y), 'BONK!', '#ff8fb8', 1.4);
        fx.stars(e.x, wz(e.y), 10);
        st.shake = 0.3;
        play('bonk');
        bumpCard(e.player, 'hurt');
        break;
      }
      case 'shieldBlock':
        fx.word(e.x, wz(e.y), 'BOING!', '#8ff0ff', 1.0);
        play('boing');
        break;
      case 'buddySave': {
        fx.sparkle(e.x, wz(e.y), 1.8, 0.6);
        fx.word(e.x, wz(e.y), 'SAVED!', '#18d4ff', 1.3);
        if (st.time - st.saveToastAt > 1.4) { toast(`${NAMES[e.who]} SAVED YOU!`, 'save', 1.8); st.saveToastAt = st.time; }
        const bv = planes[`${e.who}-buddy`];
        if (bv) bv.saveT = 1.2;
        play('save');
        break;
      }
      case 'playerOut': {
        const P = S.players[e.player];
        fx.puff(e.x, wz(e.y), 12, '#ffffff', 2);
        fx.stars(e.x, wz(e.y), 14);
        if (S.two && S.alivePlayers().length) toast(`${NAMES[P.kind]} NEEDS A HIGH FIVE! (T)`, 'oops', 2.6);
        break;
      }
      case 'revive': {
        const P = S.players[e.player];
        fx.sparkle(e.x, wz(e.y), 2, 0.7);
        fx.stars(e.x, wz(e.y), 10);
        toast(`${NAMES[P.kind]} IS BACK!`, 'good', 1.8);
        play('back');
        break;
      }
      case 'over':
        st.overAt = st.time + 2;
        if (!st.demo) { play('sad'); Kit.sound.music('over'); }
        break;
      case 'clear':
        st.clearAt = st.time + (S.stage.boss ? 0.6 : 1.0);
        break;
      case 'special': {
        const P = S.players[e.player];
        const sp = SPECIAL[P.kind];
        fx.word(P.x, wz(P.y + 1.2), sp.name + '!', P.kind === 'tommy' ? '#7dff9a' : '#ff9a3d', 2.2);
        if (e.kind === 'slam') play('slamUp');
        else { play('wave'); flash('#fff6c0', 0.25); }
        break;
      }
      case 'specialNo':
        nudge($(`spec${e.player}`));
        toast(`NO ${SPECIAL[S.players[e.player].kind].name} LEFT — CATCH A 🌟`, 'oops', 1.6);
        play('nope');
        break;
      case 'slam':
        fx.add({ map: A.tex.shock, x: e.x, y: AIR + 0.3, z: wz(e.y), life: 0.7, size: 2, grow: 40, fade: 0.6, onTop: true });
        fx.word(e.x, wz(e.y), 'SLAM DUNK!', '#ff9a3d', 3);
        fx.stars(e.x, wz(e.y), 20, 6);
        flash('#ffffff', 0.35);
        st.shake = 0.5;
        play('slam');
        break;
      case 'item': {
        const it = e.item;
        if (it.kind === 'power') { // the toast comes with the 'power' event, which knows the new weapon level
          fx.sparkle(it.x, wz(it.y), 1.6, 0.5);
          play(it.ptype === 'heart' ? 'heart' : it.ptype === 'shield' ? 'shield' : it.ptype === 'magnet' ? 'magnet' : 'power');
          bumpCard(e.player);
        } else {
          if (st.time - st.itemAt > 0.6) st.itemStreak = 0;
          st.itemAt = st.time;
          st.itemStreak = Math.min(8, st.itemStreak + 1);
          if (it.kind !== 'bit' || st.itemStreak % 3 === 1) play('item', st.itemStreak);
        }
        break;
      }
      case 'power': {
        const P = S.players[e.player];
        const fn = POWER_TOAST[e.ptype];
        let msg = fn ? fn(e, P) : '';
        if (e.ptype === 'super') msg = e.extra === 'full' ? `${SPECIAL[P.kind].emoji} +1000` : `${SPECIAL[P.kind].emoji} +1 ${SPECIAL[P.kind].name}!`;
        if (msg) toast(msg, 'good', 1.8);
        break;
      }
      case 'buddyIn':
        play('hello');
        toast(`HERE COMES ${NAMES[e.who]}!`, 'good', 1.5);
        break;
      case 'buddyHello':
        if (e.again) play('hello');
        break;
      case 'buddyStay':
        toast(`${NAMES[e.who]} STAYS LONGER!`, 'good', 1.2);
        break;
      case 'treat':
        throwTreat(e, S);
        break;
      case 'treatGot':
        if (st.treat) {
          const P = S.players[0];
          fx.sparkle(P.x, wz(P.y), 1.4, 0.5);
          fx.stars(P.x, wz(P.y), 6);
          toast(`${st.treat.emoji} ${st.treat.name} FROM ${NAMES[e.who]}!`, 'good', 2.2);
          play('treat');
        }
        break;
      case 'cheer': {
        const z = wz(e.y);
        fx.add({ map: G.emojiTexture('✋'), x: e.x, y: AIR + 1, z, life: 1.1, size: 1.2, grow: 1.5, pop: true, fade: 0.4, onTop: true });
        fx.word(e.x, z - 0.8, 'HIGH FIVE!', '#7dff9a', 2.2);
        fx.stars(e.x, z, 14, 5);
        toast('BROTHER POWER! 🛡️', 'save', 2);
        play('cheer');
        play('shield');
        break;
      }
      case 'cheerNo':
        play('nope');
        nudge($('budBtn'));
        break;
      default:
        break;
    }
  }

  // The companion's treat: it arcs from his plane to yours. The toast comes when it lands (the rules say when).
  function throwTreat(e, S) {
    const B = S.buddy;
    const sprite = A.spriteOf(G.emojiTexture(e.emoji), 0.7, { depthTest: false });
    sprite.renderOrder = 9;
    scene.add(sprite);
    st.treat = e;
    play('swish');
    const x0 = B ? B.x : 0, y0 = B ? B.y : 3;
    st.anims.push({
      t: 0, dur: M.TREAT_FLY || 0.9,
      tick(a, dt) {
        a.t += dt;
        const k = Math.min(1, a.t / 0.9);
        const P = S.players[0];
        sprite.position.set(lerp(x0, P.x, k), AIR + 0.8 + Math.sin(k * Math.PI) * 2.2, wz(lerp(y0, P.y, k)));
        sprite.material.rotation = k * 6;
        return k >= 1;
      },
      cleanup() { scene.remove(sprite); },
    });
  }

  // ---------------------------------------------------------------- toasts, banner, flash

  function toScreen(x, y) { return { x: rect.x + ((x + M.W / 2) / M.W) * rect.w, y: rect.y + ((M.H - y) / M.H) * rect.h }; }

  function toast(text, cls = '', dur = 1.8) {
    if (st.demo) return;
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    st.toasts.unshift({ el, born: st.time, dur });
    while (st.toasts.length > 4) st.toasts.pop().el.remove();
  }

  function updateToasts() {
    const y0 = rect.y + rect.h * 0.62;
    for (let i = st.toasts.length - 1; i >= 0; i--) {
      const o = st.toasts[i];
      const age = st.time - o.born;
      if (age > o.dur) { o.el.remove(); st.toasts.splice(i, 1); continue; }
      const kin = Math.min(1, age / 0.18), kout = clamp((o.dur - age) / 0.3, 0, 1);
      const sc = (kin < 1 ? 1.6 - 0.6 * smooth(kin) : 1) * Math.min(1, (rect.w - 16) / Math.max(1, o.el.offsetWidth));
      o.el.style.opacity = String(Math.min(kin * 1.5, kout));
      o.el.style.left = `${rect.x + rect.w / 2}px`;
      o.el.style.top = `${y0 + i * 44 - (1 - kout) * 20}px`;
      o.el.style.transform = `translateX(-50%) scale(${sc})`;
    }
  }

  function banner(html, dur = 1.6, cls = '') {
    const el = $('banner');
    el.innerHTML = html;
    el.className = 'banner ' + cls;
    st.banner = { born: st.time, dur };
  }

  function updateBanner() {
    const el = $('banner'), b = st.banner;
    if (!b) return;
    const age = st.time - b.born;
    if (age > b.dur) { el.classList.add('hidden'); st.banner = null; return; }
    const kin = Math.min(1, age / 0.3);
    el.style.left = `${rect.x}px`;
    el.style.width = `${rect.w}px`;
    el.style.top = `${rect.y + rect.h * 0.28}px`;
    el.style.opacity = String(Math.min(kin * 2, clamp((b.dur - age) / 0.3, 0, 1)));
    el.style.transform = `scale(${kin < 1 ? 2 - smooth(kin) : 1})`;
  }

  const flashEl = document.createElement('div');
  Object.assign(flashEl.style, { position: 'fixed', pointerEvents: 'none', opacity: '0', borderRadius: '14px' });
  document.body.appendChild(flashEl);
  let flashT = 0, flashDur = 1;
  function flash(color, dur) { if (st.demo) return; flashEl.style.background = color; flashT = dur; flashDur = dur; }

  function nudge(el) {
    if (!el) return;
    el.classList.remove('no');
    void el.offsetWidth;
    el.classList.add('no');
  }

  // a quick flash on a player's card (timed by the game clock, so it also works in a background tab)
  const cardBump = [{ t: -9, hurt: false }, { t: -9, hurt: false }];
  function bumpCard(i, how) { cardBump[i] = { t: st.time, hurt: how === 'hurt' }; }

  // ---------------------------------------------------------------- layout

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h > w * 1.05;
    document.body.classList.toggle('portrait', portrait);
    const two = st.players.length === 2;
    const playing = st.mode !== 'title' && st.mode !== 'loading';
    const L = $('leftCol'), R = $('rightCol'), bud = $('budBtn');
    const c0 = $('card0'), c1 = $('card1'), bar = $('budBar');
    const sp = [$('spec0'), $('spec1')];
    const place = (el, x, y, wd) => { el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.width = wd ? `${wd}px` : ''; };
    sp.forEach((b) => b.classList.remove('show'));
    // the cards live in the columns: Teddy's (or the 1P card) on the left, Tommy's (2P) or the companion bar on the right.
    // Standing up (portrait) both cards share the top-left row.
    L.appendChild(c0);
    if (two) (portrait ? L : R).insertBefore(c1, portrait ? null : R.firstChild);
    else R.insertBefore(bar, R.firstChild);
    c1.classList.toggle('hidden', !two);
    const short = h <= 520;
    const specS = short ? 78 : 96, budS = short ? 84 : 104, m = 12;
    if (!portrait) {
      let fh = h - 20, fw = fh * FA;
      const minSide = 150;
      if (w - fw < 2 * (minSide + 24)) { fw = Math.max(200, w - 2 * (minSide + 24)); fh = fw / FA; }
      rect = { x: Math.round((w - fw) / 2), y: Math.round((h - fh) / 2), w: Math.round(fw), h: Math.round(fh) };
      const side = Math.min(250, rect.x - 26);
      const lx = rect.x - side - 14, rx = rect.x + rect.w + 14;
      place(L, lx, 10, side);
      place(R, rx, 10, side);
      R.style.alignItems = '';
      R.querySelector('.stagebox').classList.toggle('hidden', two && short);
      const bottom = h - m - (short ? 0 : 6);
      if (touch && playing) {
        sp[0].classList.add('show');
        place(sp[0], lx + (side - specS) / 2, bottom - specS);
        if (two) {
          sp[1].classList.add('show');
          place(sp[1], rx + (side - specS) / 2, bottom - specS);
          place(bud, rx + (side - budS) / 2, bottom - specS - budS - 22);
        } else place(bud, rx + (side - budS) / 2, bottom - budS - 8);
      } else place(bud, rx + (side - budS) / 2, bottom - budS - 8);
    } else {
      // standing up: the cards in a row at the top, the stage and buttons under them, then the play area
      R.querySelector('.stagebox').classList.remove('hidden');
      place(L, 8, 8, w - 16);
      const hL = L.getBoundingClientRect().height;
      place(R, 8, 8 + hL + 6, w - 16);
      R.style.alignItems = 'center';
      const top = 8 + hL + 6 + R.getBoundingClientRect().height + 10, bot = touch ? 130 : 120;
      const fw0 = Math.min(w - 16, (h - top - bot) * FA);
      rect = { x: Math.round((w - fw0) / 2), y: Math.round(top), w: Math.round(fw0), h: Math.round(fw0 / FA) };
      const by = h - budS - 18;
      if (touch && playing) {
        sp[0].classList.add('show');
        place(sp[0], 16, h - specS - 22);
        if (two) { sp[1].classList.add('show'); place(sp[1], w - specS - 16, h - specS - 22); place(bud, (w - budS) / 2, by); }
        else place(bud, w - budS - 16, by);
      } else place(bud, w - budS - 16, by);
    }
    renderer.setSize(rect.w, rect.h, false);
    Object.assign(canvas.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    Object.assign(flashEl.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    const bb = $('bossBar');
    place(bb, rect.x + 10, rect.y + 8, rect.w - 20);
  }

  // ---------------------------------------------------------------- input

  const held = new Set();
  const drags = new Map(); // pointerId -> { i, sx, sy, px, py, tx, ty }
  const pressSpecial = [false, false];
  const P1 = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
  const P2 = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  function readInput() {
    const S = st.sim;
    if (!S || st.demo) return;
    const one = S.players.length === 1;
    for (let i = 0; i < S.players.length; i++) {
      const inp = S.input[i];
      if (S.auto[i]) continue;
      let dx = 0, dy = 0;
      const maps = one ? [P1, P2] : [i === 0 ? P1 : P2];
      for (const mp of maps) for (const code in mp) if (held.has(code)) { dx += mp[code][0]; dy += mp[code][1]; }
      inp.dx = clamp(dx, -1, 1);
      inp.dy = clamp(dy, -1, 1);
      inp.tx = inp.ty = null;
      for (const d of drags.values()) if (d.i === i && d.tx !== undefined) { inp.tx = d.tx; inp.ty = d.ty; }
      if (pressSpecial[i]) { inp.special = true; pressSpecial[i] = false; }
    }
  }

  function clearInput() {
    held.clear();
    drags.clear();
    pressSpecial[0] = pressSpecial[1] = false;
  }

  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    const one = st.players.length === 1;
    if (st.mode === 'play') {
      if (c in P1 || c in P2) { e.preventDefault(); held.add(c); return; }
      if (c === 'Space' || c === 'KeyF') { e.preventDefault(); if (!e.repeat) pressSpecial[0] = true; return; }
      if (c === 'KeyL' || c === 'Numpad0') { e.preventDefault(); if (!e.repeat) pressSpecial[one ? 0 : 1] = true; return; }
      if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); callBuddy(); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') restartStage();
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Digit1' || c === 'Numpad1') startGame(['teddy']);
      else if (c === 'Digit2' || c === 'Numpad2') startGame(['tommy']);
      else if (c === 'Digit3' || c === 'Numpad3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyE') setLevel(st.level === 'easy' ? 'normal' : 'easy');
      else if (c === 'ArrowLeft' || c === 'KeyA' || c === 'Comma') pickStage(-1);
      else if (c === 'ArrowRight' || c === 'KeyD' || c === 'Period') pickStage(1);
      else if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(settings.lastPlayers || ['teddy']); }
      return;
    }
    if (st.mode === 'tally') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); nextStage(); }
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode === 'over') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); retry(); }
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode === 'win') {
      if ((c === 'Enter' || c === 'Space' || c === 'Escape') && st.modeT > 0.8) { e.preventDefault(); toMenu(); }
    }
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', clearInput);

  // Drag anywhere: the plane moves as far as your finger does, so your finger never covers it.
  // With two players, the left half of the screen flies Teddy and the right half flies Tommy.
  window.addEventListener('pointerdown', (e) => {
    if (st.mode !== 'play' || !st.sim || st.demo) return;
    if (e.target.closest && e.target.closest('button')) return;
    firstGesture();
    const S = st.sim;
    const i = S.two ? (e.clientX < window.innerWidth / 2 ? 0 : 1) : 0;
    const P = S.players[i];
    if (!P || P.out) return;
    for (const [id, d] of drags) if (d.i === i) drags.delete(id);
    drags.set(e.pointerId, { i, sx: e.clientX, sy: e.clientY, px: P.x, py: P.y });
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('pointermove', (e) => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    const k = (M.W / rect.w) * (rect.w < 520 ? 1.3 : 1.1);
    let tx = d.px + (e.clientX - d.sx) * k, ty = d.py - (e.clientY - d.sy) * k;
    // past an edge: slide the anchor along, so turning back answers at once
    const cx = clamp(tx, -M.PX, M.PX), cy = clamp(ty, M.PY0, M.PY1);
    if (cx !== tx) { d.px += cx - tx; tx = cx; }
    if (cy !== ty) { d.py += cy - ty; ty = cy; }
    d.tx = tx;
    d.ty = ty;
  });
  const endDrag = (e) => { drags.delete(e.pointerId); };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function bindSpecial(el, i) {
    el.addEventListener('pointerdown', (e) => {
      firstGesture();
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('down');
      setTimeout(() => el.classList.remove('down'), 120);
      if (st.mode === 'play') { const one = st.players.length === 1; pressSpecial[one ? 0 : i] = true; }
    });
  }
  bindSpecial($('spec0'), 0);
  bindSpecial($('spec1'), 1);
  $('budBtn').addEventListener('pointerdown', (e) => {
    firstGesture();
    e.preventDefault();
    e.stopPropagation();
    const el = $('budBtn');
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 120);
    callBuddy();
  });

  function callBuddy() {
    if (st.mode !== 'play' || !st.sim || st.demo) return;
    st.sim.callBuddy();
  }

  function toggleMute() {
    Kit.sound.init();
    const m = Kit.sound.toggleMute();
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
  }
  document.querySelectorAll('.muteBtn').forEach((b) => {
    b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    b.addEventListener('click', toggleMute);
  });
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- modes

  const SCREENS = ['title', 'pause', 'tally', 'over', 'win'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }

  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    $('hud').classList.toggle('hidden', m === 'title' || m === 'loading');
    layout();
  }

  function makeSim(stageNo, o = {}) {
    return new M.Sim({
      stage: stageNo, level: st.level, players: st.players, carry: o.carry, auto: o.auto, immortal: o.immortal,
      buddyFor: (id) => Kit.roster.buddyFor(id),
    });
  }

  function loadStage(stageNo, carry) {
    clearViews();
    clearInput();
    st.stageNo = stageNo;
    st.carryStart = carry ? carry.map((c) => Object.assign({}, c)) : null;
    st.sim = makeSim(stageNo, { carry });
    st.demo = false;
    st.acc = 0;
    st.clearAt = st.overAt = 0;
    st.celebrate = null;
    const stage = SKY.STAGES[stageNo - 1];
    setTheme(stage.theme);
    setupHud();
    show(null);
    setMode('play');
    banner(`STAGE ${stageNo}<small>${stage.name} · ${stage.tag}</small>`, 2.4);
    SFX.jingle();
    Kit.sound.music('play');
  }

  function startGame(players, o = {}) {
    firstGesture();
    SFX.click();
    st.players = players;
    settings.lastPlayers = players;
    settings.level = st.level;
    saveSettings();
    loadStage(o.stage || st.stageNo, null);
  }

  function pause() {
    if (st.mode !== 'play') return;
    setMode('pause');
    show('pause');
    clearInput();
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    show(null);
    setMode('play');
    Kit.sound.music('play');
  }
  function restartStage() { loadStage(st.stageNo, st.carryStart); }

  function toMenu() {
    clearViews();
    clearInput();
    startDemo();
    show('title');
    setMode('title');
    refreshTitle();
    Kit.sound.music('title');
  }

  // the title screen: both brothers fly the first stage by themselves behind the menu
  function startDemo() {
    clearViews();
    const players = st.players;
    st.players = ['teddy', 'tommy'];
    st.sim = makeSim(1, { auto: true, immortal: true });
    st.players = players;
    st.demo = true;
    st.celebrate = null;
    st.clearAt = st.overAt = 0;
    setTheme(SKY.STAGES[0].theme);
  }

  function markCleared() {
    const list = best[st.level] || (best[st.level] = []);
    if (!list.includes(st.stageNo)) list.push(st.stageNo);
    best.hi = Math.max(best.hi || 0, st.sim.score());
    saveBest();
    settings.stage = Math.min(SKY.STAGES.length, st.stageNo + 1);
    saveSettings();
  }

  function startCelebrate() {
    st.celebrate = { t: 0 };
    setMode('celebrate');
    markCleared();
    banner(st.stageNo === SKY.STAGES.length ? 'YOU DID IT!' : 'STAGE CLEAR!', 2.6);
    SFX.fanfare();
    for (const P of st.sim.players) if (!P.out) fx.confetti(P.x, wz(P.y), 30);
  }

  function showTally() {
    const S = st.sim;
    st.carry = S.carry();
    if (st.stageNo === SKY.STAGES.length) { showWin(); return; }
    setMode('tally');
    show('tally');
    $('tallyTitle').textContent = `STAGE ${st.stageNo} CLEAR!`;
    const cols = S.players.length;
    const grid = $('tallyGrid');
    grid.style.gridTemplateColumns = `auto ${'auto '.repeat(cols)}`;
    const head = ['<span></span>', ...S.players.map((P) => `<span class="h">${NAMES[P.kind]}</span>`)];
    const row = (label, fn) => [`<span>${label}</span>`, ...S.players.map((P) => `<span>${fn(P)}</span>`)];
    const cells = [
      ...head,
      ...row('💥 bonked', (P) => P.pops),
      ...row(`<img src="${coinIcon}" alt=""> coins`, (P) => P.got.coin || 0),
      ...row('🍎 fruit', (P) => P.got.fruit || 0),
      ...row('⭐ stars', (P) => (P.got.star || 0) + (P.got.bit || 0)),
      ...row('❤️ hearts', (P) => (P.out ? 0 : P.hearts)),
      ...row('<b>score</b>', (P) => `<b class="tot">${P.score}</b>`),
    ];
    grid.innerHTML = cells.join('');
    const st2 = S.stats;
    $('tallySub').textContent = S.two ? 'Great teamwork, brothers!' : st2.saves ? `${NAMES[S.buddy ? S.buddy.kind : Kit.roster.buddyFor(S.players[0].kind)]} saved you ${st2.saves} time${st2.saves > 1 ? 's' : ''}!` : 'Next stop: ' + SKY.STAGES[st.stageNo].name + '!';
    SFX.tally();
  }

  function nextStage() {
    if (st.stageNo >= SKY.STAGES.length) { toMenu(); return; }
    loadStage(st.stageNo + 1, st.carry);
  }

  function showWin() {
    setMode('win');
    show('win');
    const S = st.sim;
    $('winSub').textContent = `The King UFO got bonked! Score ${S.score()}. The zombie blimps say sorry.`;
    SFX.fanfare();
  }

  function showOver() {
    best.hi = Math.max(best.hi || 0, st.sim.score());
    saveBest();
    setMode('over');
    show('over');
    $('overTitle').textContent = 'OH NO!';
    $('overSub').textContent = `The ${SKY.STAGES[st.stageNo - 1].name.toLowerCase()} was too bonky this time. Try again with full hearts!`;
  }

  function retry() {
    const c = st.carryStart ? st.carryStart.map((x) => ({ score: x.score })) : null;
    loadStage(st.stageNo, c);
  }

  // ---------------------------------------------------------------- HUD

  const coinIcon = (() => { const [c, g] = G.makeCanvas(64, 64); g.drawImage(A.tex.coin.image, 0, 0, 64, 64); return c.toDataURL(); })();
  const gunIcons = { single: null, double: A.powerIcon('double', 40), spread: A.powerIcon('spread', 40) };
  const hudCache = new Map();
  function setHtml(el, key, html) {
    if (hudCache.get(el) === key) return;
    hudCache.set(el, key);
    el.innerHTML = html;
  }

  function setupHud() {
    const S = st.sim;
    S.players.forEach((P, i) => {
      const c = $(`card${i}`);
      c.classList.toggle('tm', P.kind === 'tommy');
      c.querySelector('img').src = faces[P.kind];
      c.querySelector('.n').textContent = NAMES[P.kind];
      c.querySelector('.who').textContent = S.two ? `${i + 1}P` : '1P';
      const b = $(`spec${i}`);
      b.classList.toggle('tm', P.kind === 'tommy');
      b.querySelector('.e').textContent = SPECIAL[P.kind].emoji;
      b.querySelector('small').textContent = SPECIAL[P.kind].name;
    });
    hudCache.clear();
    const bud = $('budBtn');
    const imgs = bud.querySelectorAll('img');
    if (S.two) {
      bud.classList.add('two');
      imgs[0].src = faces.teddy;
      imgs[1].src = faces.tommy;
      imgs[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'HIGH FIVE!';
    } else {
      const who = Kit.roster.buddyFor(S.players[0].kind);
      bud.classList.remove('two');
      imgs[0].src = faces[who];
      imgs[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${NAMES[who]}`;
      $('budBar').querySelector('img').src = faces[who];
    }
    const stage = SKY.STAGES[st.stageNo - 1];
    $('stageNo').textContent = `STAGE ${st.stageNo}`;
    $('stageName').textContent = stage.name;
    $('hiScore').textContent = `BEST ${best.hi || 0}`;
    layout();
  }

  function updateHud() {
    const S = st.sim;
    if (!S || st.demo || st.mode === 'title') return;
    S.players.forEach((P, i) => {
      const c = $(`card${i}`);
      const max = Math.max(P.hearts, S.L.hearts);
      setHtml(c.querySelector('.hearts'), `${P.hearts}/${max}`, Array.from({ length: max }, (_, k) => `<i class="${k < P.hearts ? '' : 'gone'}">❤️</i>`).join(''));
      const sp = SPECIAL[P.kind].emoji;
      setHtml(c.querySelector('.specs'), `${P.specials}`, P.specials ? Array.from({ length: P.specials }, () => `<i>${sp}</i>`).join('') : '<i style="opacity:.4">—</i>');
      const timers = [];
      if (P.shieldT > 0) timers.push(`🛡️${Math.ceil(P.shieldT)}`);
      if (P.magnetT > 0) timers.push(`🧲${Math.ceil(P.magnetT)}`);
      const gk = `${P.weapon}${P.lvl}|${timers.join(',')}`;
      setHtml(c.querySelector('.gun'), gk,
        (gunIcons[P.weapon] ? `<img src="${gunIcons[P.weapon]}" alt="">` : `<span>${SPECIAL[P.kind].emoji}</span>`) +
        [1, 2, 3].map((k) => `<b class="${k <= P.lvl ? 'on' : ''}"></b>`).join('') + timers.map((t) => ` <span class="t">${t}</span>`).join(''));
      setHtml(c.querySelector('.score'), `${P.score}`, String(P.score));
      c.classList.toggle('out', P.out);
      const bump = st.time - cardBump[i].t < 0.35;
      c.classList.toggle('bump', bump);
      c.style.background = bump && cardBump[i].hurt ? 'rgba(255, 90, 110, 0.55)' : '';
      const b = $(`spec${i}`);
      setHtml(b.querySelector('em'), String(P.specials), String(P.specials));
      b.classList.toggle('empty', P.specials <= 0);
    });
    // companion bar and button
    const bud = $('budBtn');
    if (S.two) {
      const k = S.cheerT > 0 ? 1 - S.cheerT / S.L.cheerCool : 1;
      bud.style.setProperty('--fill', k.toFixed(3));
      bud.classList.toggle('rest', S.cheerT > 0);
      bud.classList.toggle('on', S.cheerT <= 0);
    } else {
      const B = S.buddy;
      const k = B ? (B.phase === 'leave' ? 0 : B.phase === 'bye' ? 0.02 : B.phase === 'stay' ? B.left / M.VISIT : 1) : 1;
      bud.style.setProperty('--fill', k.toFixed(3));
      bud.classList.toggle('on', !!B);
      bud.classList.remove('rest');
      const bar = $('budBar');
      bar.classList.toggle('hidden', !B);
      if (B) bar.querySelector('i').style.setProperty('--fill', k.toFixed(3));
    }
    // the boss's bar
    const bb = $('bossBar');
    const boss = S.boss;
    bb.classList.toggle('hidden', !boss || boss.st === 'enter');
    if (boss) {
      setHtml($('bossName'), boss.name, boss.name); // only when it changes, so the 中文 translation isn't redone every frame
      bb.querySelector('i').style.setProperty('--fill', clamp(boss.hp / boss.maxHp, 0, 1).toFixed(3));
    }
  }

  // ---------------------------------------------------------------- title screen

  function refreshTitle() {
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === st.level)));
    const s = SKY.STAGES[st.stageNo - 1];
    const done = (best[st.level] || []).includes(st.stageNo);
    $('stageLabel').innerHTML = `STAGE ${st.stageNo}${done ? ' ⭐' : ''}${s.boss ? ' 👑' : ''}<small>${s.name}</small>`;
  }
  function setLevel(l) {
    st.level = l;
    settings.level = l;
    saveSettings();
    refreshTitle();
    SFX.click();
  }
  function pickStage(d) {
    st.stageNo = ((st.stageNo - 1 + d + SKY.STAGES.length) % SKY.STAGES.length) + 1;
    settings.stage = st.stageNo;
    saveSettings();
    refreshTitle();
    SFX.click();
  }

  function setupTitle() {
    $('logoMain').innerHTML = SKY.TITLE.toUpperCase().replace(/TT/, '<span class="a">T</span><span class="b">T</span>');
    document.title = `${SKY.TITLE} · Teddy & Tommy`;
    document.querySelectorAll('[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });
    document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.play;
      startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
    document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => pickStage(Number(b.dataset.s))));
    const help = [['double', 'double shot'], ['spread', 'spread shot'], ['shield', 'shield'], ['magnet', 'magnet'], ['heart', 'extra heart'], ['super', 'one more 🏀 / ✌️ super move']];
    $('powerHelp').innerHTML = help.map(([t, txt]) => `<span><img src="${A.powerIcon(t)}" alt="">${txt}</span>`).join('');
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', restartStage);
    $('quitBtn').addEventListener('click', toMenu);
    $('nextBtn').addEventListener('click', nextStage);
    $('tallyMenuBtn').addEventListener('click', toMenu);
    $('retryBtn').addEventListener('click', retry);
    $('overMenuBtn').addEventListener('click', toMenu);
    $('winMenuBtn').addEventListener('click', toMenu);
    refreshTitle();
  }

  // ---------------------------------------------------------------- main loop

  function simRuns() {
    const m = st.mode;
    return m === 'play' || m === 'celebrate' || (m === 'title' && st.demo) || (m === 'over' && st.modeT < 3);
  }

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    const S = st.sim;
    if (S && simRuns()) {
      st.acc += dt;
      let n = 0;
      while (st.acc >= DT - 1e-9 && n++ < 8) {
        readInput();
        S.step(DT);
        st.acc -= DT;
        for (const e of S.events) onEvent(e, S);
        S.events.length = 0;
      }
      if (st.acc > DT) st.acc = 0;
    }
    if (S && st.mode === 'play' && st.clearAt && st.time >= st.clearAt) { st.clearAt = 0; startCelebrate(); }
    if (st.celebrate) {
      st.celebrate.t += dt;
      if (st.mode === 'celebrate' && st.celebrate.t > 3.4) showTally();
    }
    if (S && st.overAt && st.time >= st.overAt && st.mode === 'play') { st.overAt = 0; if (!st.demo) showOver(); }
    if (st.demo && S && (S.cleared || S.over || S.t > 70)) startDemo();
    for (let i = st.anims.length - 1; i >= 0; i--) {
      const a = st.anims[i];
      if (a.tick(a, dt)) { if (a.cleanup) a.cleanup(); st.anims.splice(i, 1); }
    }
    const scrolling = st.mode !== 'pause' && st.mode !== 'tally' && st.mode !== 'win';
    world.tick(dt, scrolling ? SCROLL : 0);
    syncViews(dt);
    fx.update(dt);
    // a little shake for big moments
    if (st.shake > 0) {
      st.shake = Math.max(0, st.shake - dt);
      const k = st.shake * 0.35;
      camera.position.set(camBase.x + G.rand(-k, k), camBase.y, camBase.z + G.rand(-k, k));
    } else camera.position.copy(camBase);
    updateHud();
    updateToasts();
    updateBanner();
    if (flashT > 0) { flashT -= dt; flashEl.style.opacity = String(Math.max(0, flashT / flashDur) * 0.8); }
  }

  function render() {
    renderer.render(scene, camera);
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  setupTitle();
  $('loading').remove();
  startDemo();
  setMode('title');
  show('title');
  refreshTitle();
  layout();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a game: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], stage, level }
    start(o = {}) {
      if (o.level) st.level = o.level;
      if (o.stage) st.stageNo = o.stage;
      startGame(o.players || ['teddy'], { stage: o.stage });
      return game.state();
    },
    state() {
      const S = st.sim;
      return {
        mode: st.mode, stage: st.stageNo, demo: st.demo, level: st.level, phase: S ? S.phase : null, t: S ? +S.t.toFixed(1) : 0,
        players: S ? S.players.map((P) => ({ kind: P.kind, x: +P.x.toFixed(2), y: +P.y.toFixed(2), hearts: P.hearts, specials: P.specials, weapon: P.weapon, lvl: P.lvl, score: P.score, out: P.out, shield: +P.shieldT.toFixed(1) })) : null,
        buddy: S && S.buddy ? { kind: S.buddy.kind, phase: S.buddy.phase, left: +S.buddy.left.toFixed(1), x: +S.buddy.x.toFixed(2), y: +S.buddy.y.toFixed(2) } : null,
        foes: S ? S.foes.length : 0, bullets: S ? S.bullets.length : 0, items: S ? S.items.length : 0,
        wave: S ? `${S.waveI}/${S.stage.waves.length}` : '', boss: S && S.boss ? { name: S.boss.name, hp: S.boss.hp, maxHp: S.boss.maxHp } : null,
        stats: S ? S.stats : null,
      };
    },
    sim: () => st.sim,
    buddy() { callBuddy(); return game.state().buddy; },
    special(i = 0) { const S = st.sim; if (S) S.useSpecial(S.players[i]); },
    give(type, i = 0) { return st.sim && st.sim.give(type, i); },
    power(type, x, y) { return st.sim && st.sim.spawnPower(type, x, y); },
    clear() { if (st.sim) st.sim.winNow(); },
    // jump to the boss of a boss stage
    boss() { const S = st.sim; if (!S || !S.stage.boss) return null; S.waveI = S.stage.waves.length; S.later.length = 0; for (const f of S.foes.slice()) S.damage(f, 999, 0, 'test'); S.bossState = 'warn'; S.bossT = 2.5; if (S.phase === 'intro') S.phase = 'play'; return true; },
    // hold a player's input: game.input(0, { dx: 1, dy: 0 })
    input(i, o) { const S = st.sim; if (S) Object.assign(S.input[i], o); },
    autopilot(on = true) { if (st.sim) st.sim.auto = st.sim.auto.map(() => on); },
    keepAwake(on = true) { st.keepAwake = on; },
    // close-up for checking details: game.peek(x, y, halfWidth) in game units; game.peek() to go back
    peek(x, y, hw = 2) {
      if (x === undefined) { camera.left = -M.W / 2; camera.right = M.W / 2; camera.top = ch; camera.bottom = -ch; }
      else {
        const hh = hw / FA, cy = (y - M.H / 2) * Math.cos(A.TILT);
        camera.left = x - hw; camera.right = x + hw; camera.top = cy + hh; camera.bottom = cy - hh;
      }
      camera.updateProjectionMatrix();
      render();
    },
    freeze(on = true) { st.frozen = on; },
    menu: toMenu,
    check: () => ({ stages: SKY.check.stages(), rules: SKY.check.rules(), sabotage: SKY.check.sabotage() }),
    soak: (o) => SKY.check.soak(o),
    layout,
    st,
  };
})();

/* Sky TT: everything you see, built from boxes, spheres and canvas textures (no image or model files).
   The game is played on a flat layer at height AIR. The camera looks down at it, tipped 30° toward the bottom of
   the screen, so the kids in their cockpits are leaned back by the same amount to face you.
   World x = game x. World z = 8 - game y (the top of the screen is -z). */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});
  const T = THREE, G = Kit.gfx;
  const INK = '#14121f';
  const W = 12, H = 16;
  const AIR = 3; // the height the game is played at
  const TILT = Math.PI / 6; // camera: 30° from straight down
  const LEAN = Math.PI / 2 - TILT; // people lean back by this much to face the camera
  const wz = (y) => H / 2 - y;
  const R = (a, b) => a + Math.random() * (b - a);
  const tex = {};

  // ---------------------------------------------------------------- shared materials and geometry

  const matCache = {};
  function mat(color, o) {
    const key = color + (o ? JSON.stringify(o) : '');
    return matCache[key] || (matCache[key] = G.std(color, o));
  }
  const glow = (color) => mat(color, { emissive: color, emissiveIntensity: 0.9 });
  const geoCache = {};
  const cached = (key, make) => geoCache[key] || (geoCache[key] = make());
  const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d));
  const sphGeo = (r, a = 16, b = 12) => cached(`s${r},${a},${b}`, () => new T.SphereGeometry(r, a, b));
  const cylGeo = (r1, r2, h, n = 14) => cached(`c${r1},${r2},${h},${n}`, () => new T.CylinderGeometry(r1, r2, h, n));
  const coneGeo = (r, h, n = 12) => cached(`k${r},${h},${n}`, () => new T.ConeGeometry(r, h, n));
  function add(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  const box = (w, h, d, m, x, y, z, parent) => add(boxGeo(w, h, d), m, x, y, z, parent);
  const ball = (r, m, x, y, z, parent) => add(sphGeo(r), m, x, y, z, parent);

  // ---------------------------------------------------------------- canvas textures

  function sparkleTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.2, 'rgba(255,250,200,0.8)');
    gr.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 10 : 62, a = (i * Math.PI) / 4;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    return G.toTexture(c);
  }

  // A comic starburst with a word in it (BONK!, POP!, SAVED!...).
  const burstCache = {};
  function burstTexture(word, fill = '#ffd400') {
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = G.makeCanvas(256, 256);
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 78 : 120, a = (i * Math.PI) / 12 + 0.1;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.font = `${word.length > 6 ? 36 : word.length > 5 ? 46 : 58}px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.strokeText(word, 128, 132);
    g.fillStyle = '#ffffff';
    g.fillText(word, 128, 132);
    return (burstCache[key] = G.toTexture(c));
  }

  const textCache = {};
  function textTexture(text, color = '#ffffff') {
    const key = text + color;
    if (textCache[key]) return textCache[key];
    const [c, g] = G.makeCanvas(256, 96);
    g.font = `56px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.strokeText(text, 128, 52);
    g.fillStyle = color;
    g.fillText(text, 128, 52);
    return (textCache[key] = G.toTexture(c));
  }

  // Enemy bullets: bright, round, with a thick dark outline so they show up on grass, sand, snow and space alike.
  function bulletTexture(kind) {
    const [c, g] = G.makeCanvas(128, 128);
    const cx = 64, cy = 64, r = 44;
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    const shine = () => {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(cx - 14, cy - 16, 11, 7, -0.6, 0, Math.PI * 2);
      g.fill();
    };
    if (kind === 'drop') {
      g.beginPath();
      g.moveTo(cx, 10);
      g.bezierCurveTo(cx + 20, 40, cx + 42, 62, cx + 38, 84);
      g.arc(cx, 82, 38, 0.05, Math.PI - 0.05);
      g.bezierCurveTo(cx - 42, 62, cx - 20, 40, cx, 10);
      g.closePath();
      g.fillStyle = '#41a8ff';
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(cx - 14, 78, 8, 13, 0.3, 0, Math.PI * 2);
      g.fill();
      return G.toTexture(c);
    }
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    if (kind === 'goo') {
      g.fillStyle = '#9dff3c';
      g.fill();
      g.stroke();
      g.fillStyle = '#5fcf1f';
      for (const [x, y, s] of [[80, 76, 9], [52, 84, 6], [84, 50, 5]]) { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }
      shine();
    } else if (kind === 'snow') {
      const gr = g.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r);
      gr.addColorStop(0, '#f2fbff');
      gr.addColorStop(1, '#5fb4ff');
      g.fillStyle = gr;
      g.fill();
      g.stroke();
    } else if (kind === 'bolt') {
      g.fillStyle = '#ffd400';
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(70, 26); g.lineTo(46, 68); g.lineTo(62, 68); g.lineTo(54, 102); g.lineTo(84, 56); g.lineTo(66, 56); g.lineTo(76, 26);
      g.closePath();
      g.fillStyle = '#ffffff';
      g.lineWidth = 5;
      g.fill();
      g.stroke();
    } else { // zap: a pink energy ball
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, '#ffd0fb');
      gr.addColorStop(1, '#ff3fd2');
      g.fillStyle = gr;
      g.fill();
      g.stroke();
    }
    return G.toTexture(c);
  }

  function coinTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.beginPath();
    g.arc(64, 64, 48, 0, Math.PI * 2);
    g.fillStyle = '#ffc531';
    g.fill();
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(64, 64, 34, 0, Math.PI * 2);
    g.lineWidth = 5;
    g.strokeStyle = '#e09a12';
    g.stroke();
    g.font = `54px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff3c0';
    g.fillText('★', 64, 68);
    return G.toTexture(c);
  }

  // Power-up badges: a round coloured badge with a picture, readable without reading.
  const POWER_LOOK = {
    double: { col: '#3f86e8', name: 'DOUBLE' },
    spread: { col: '#ff8a1f', name: 'SPREAD' },
    shield: { col: '#18c4ef', emoji: '🛡️', name: 'SHIELD' },
    magnet: { col: '#ff3d7f', emoji: '🧲', name: 'MAGNET' },
    heart: { col: '#ff7aa2', emoji: '❤️', name: 'HEART' },
    super: { col: '#8d5bd8', emoji: '🌟', name: 'SUPER' },
  };
  function arrow(g, x, y, a, len) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.lineTo(13, -len / 2 + 15);
    g.lineTo(5, -len / 2 + 15);
    g.lineTo(5, len / 2);
    g.lineTo(-5, len / 2);
    g.lineTo(-5, -len / 2 + 15);
    g.lineTo(-13, -len / 2 + 15);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
  }
  function paintPower(g, type, s) {
    const L = POWER_LOOK[type];
    const k = s / 128;
    g.save();
    g.scale(k, k);
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = L.col;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(64, 64, 48, 0, Math.PI * 2);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.stroke();
    if (type === 'double') { arrow(g, 50, 64, 0, 58); arrow(g, 78, 64, 0, 58); }
    else if (type === 'spread') { arrow(g, 40, 70, -0.5, 48); arrow(g, 64, 62, 0, 56); arrow(g, 88, 70, 0.5, 48); }
    else {
      g.font = `62px ${G.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(L.emoji, 64, 70);
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(44, 34, 16, 8, -0.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const powerCache = {};
  function powerTexture(type) {
    if (powerCache[type]) return powerCache[type];
    const [c, g] = G.makeCanvas(128, 128);
    paintPower(g, type, 128);
    return (powerCache[type] = G.toTexture(c));
  }
  function powerIcon(type, size = 64) {
    const [c, g] = G.makeCanvas(size, size);
    paintPower(g, type, size);
    return c.toDataURL();
  }

  // Faces for the grumpy clouds and Stormy.
  function grumpyTexture(storm) {
    const [c, g] = G.makeCanvas(256, 256);
    g.lineCap = 'round';
    g.strokeStyle = INK;
    for (const s of [-1, 1]) {
      const ex = 128 + s * 44, ey = 118;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(ex, ey, 26, 30, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 7;
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(ex - s * 6, ey + 6, 12, 0, Math.PI * 2);
      g.fill();
      // angry brows, slanting down toward the middle
      g.lineWidth = storm ? 18 : 14;
      g.beginPath();
      g.moveTo(ex + s * 30, ey - 44);
      g.lineTo(ex - s * 22, ey - 26);
      g.stroke();
    }
    g.lineWidth = 9;
    g.beginPath();
    if (storm) {
      g.fillStyle = '#ffffff';
      g.rect(92, 172, 72, 26);
      g.fill();
      g.stroke();
      for (let x = 110; x < 164; x += 18) { g.beginPath(); g.moveTo(x, 172); g.lineTo(x, 198); g.lineWidth = 5; g.stroke(); }
    } else {
      g.arc(128, 200, 30, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,120,140,0.35)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 76, 160, 16, 10, 0, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  // The drone's top: two big cyan eyes on a dark screen, and a little smile.
  function droneFaceTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ff8a1f';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2a2633';
    G.roundRect(g, 18, 26, 92, 76, 18);
    g.fill();
    g.fillStyle = '#5ef2ff';
    for (const x of [44, 84]) { G.roundRect(g, x - 11, 44, 22, 28, 9); g.fill(); }
    g.strokeStyle = '#5ef2ff';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(64, 78, 12, 0.3, Math.PI - 0.3);
    g.stroke();
    return G.toTexture(c);
  }

  function puffTexture() {
    const [c, g] = G.makeCanvas(256, 160);
    const blobs = [[70, 95, 50], [120, 75, 62], [175, 92, 52], [140, 110, 46], [95, 112, 42], [205, 110, 34], [45, 115, 30]];
    for (const [x, y, r] of blobs) {
      const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return G.toTexture(c);
  }

  function ringTexture() { // the peace wave: a rainbow ring
    const [c, g] = G.makeCanvas(512, 512);
    const cols = ['#ff3d7f', '#ff8a1f', '#ffd400', '#7dff5a', '#18d4ff', '#8d5bd8'];
    cols.forEach((col, i) => {
      g.beginPath();
      g.arc(256, 256, 236 - i * 9, 0, Math.PI * 2);
      g.lineWidth = 10;
      g.strokeStyle = col;
      g.stroke();
    });
    const gr = g.createRadialGradient(256, 256, 120, 256, 256, 190);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.35)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(256, 256, 190, 0, Math.PI * 2);
    g.fill();
    return G.toTexture(c);
  }

  function shockTexture() { // the slam dunk's shockwave
    const [c, g] = G.makeCanvas(256, 256);
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 124);
    gr.addColorStop(0, 'rgba(255,170,60,0)');
    gr.addColorStop(0.7, 'rgba(255,200,90,0.9)');
    gr.addColorStop(0.85, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return G.toTexture(c);
  }

  function initTextures() {
    tex.glow = G.glowTexture();
    tex.dot = G.dotTexture();
    tex.sparkle = sparkleTexture();
    tex.coin = coinTexture();
    tex.puff = puffTexture();
    tex.ring = ringTexture();
    tex.shock = shockTexture();
    tex.grumpy = grumpyTexture(false);
    tex.stormy = grumpyTexture(true);
    tex.droneFace = droneFaceTexture();
    tex.bullet = {};
    for (const k of ['goo', 'zap', 'drop', 'snow', 'bolt']) tex.bullet[k] = bulletTexture(k);
    tex.shadow = G.radialTexture(64, [[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
  }

  function spriteOf(map, size, opts = {}) {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map, depthWrite: false, transparent: true }, opts)));
    s.scale.set(size, size, 1);
    return s;
  }

  // ---------------------------------------------------------------- people in cockpits

  // A Kit person from the waist up, leaned back so he faces the camera. `at` is where his hips sit.
  function addPilot(parent, id, s, at, o = {}) {
    const p = Kit.people.build(Kit.roster.get(id).look);
    p.legL.visible = p.legR.visible = false;
    p.head.scale.setScalar(o.head || 1.4);
    const holder = new T.Group();
    holder.position.set(at[0], at[1], at[2]);
    holder.rotation.x = -LEAN;
    parent.add(holder);
    const turn = new T.Group();
    turn.rotation.y = Math.PI;
    holder.add(turn);
    turn.add(p.root);
    p.root.scale.setScalar(s);
    p.root.position.y = -0.88 * s;
    if (o.crown) addCrown(p.head, 0.55, [0, 0.62, 0]);
    return { p, holder, turn, s, id };
  }

  function addCrown(parent, s, at) {
    const g = new T.Group();
    g.position.set(at[0], at[1], at[2]);
    g.scale.setScalar(s);
    parent.add(g);
    const gold = mat('#ffcf2e', { metalness: 0.6, roughness: 0.3 });
    add(cylGeo(0.5, 0.5, 0.28, 10), gold, 0, 0, 0, g);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(coneGeo(0.13, 0.36, 6), gold, Math.cos(a) * 0.42, 0.3, Math.sin(a) * 0.42, g);
      add(sphGeo(0.07, 8, 6), glow(['#ff3d7f', '#18d4ff', '#7dff5a'][i % 3]), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5, g);
    }
    return g;
  }

  // ---------------------------------------------------------------- the brothers' planes

  const PLANES = {
    teddy: { body: '#3f86e8', trim: '#e53935', wing: '#f4f6fb', nose: '#ffd400', emblem: '🏀' },
    tommy: { body: '#7fdcbd', trim: '#ffb02e', wing: '#f6eedc', nose: '#ff8fb8', emblem: '✌️' },
  };

  function wingTexture(L) {
    const [c, g] = G.makeCanvas(512, 128);
    g.fillStyle = L.wing;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = L.trim;
    g.fillRect(0, 0, 40, 128);
    g.fillRect(472, 0, 40, 128);
    g.fillStyle = L.body;
    g.fillRect(40, 0, 12, 128);
    g.fillRect(460, 0, 12, 128);
    for (const x of [130, 382]) {
      g.beginPath();
      g.arc(x, 64, 46, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.stroke();
      g.font = `60px ${G.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(L.emblem, x, 70);
    }
    return G.toTexture(c);
  }

  function buildPlane(kind) {
    const L = PLANES[kind] || PLANES.teddy;
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const mBody = mat(L.body, { roughness: 0.5 }), mTrim = mat(L.trim, { roughness: 0.5 }), mNose = mat(L.nose, { roughness: 0.4 });
    const mDark = mat('#2a2633'), mWing = mat(L.wing, { roughness: 0.6 });
    const mWingTop = G.std('#ffffff', { map: wingTexture(L), roughness: 0.6 });
    box(0.52, 0.4, 1.15, mBody, 0, 0, 0.02, body);
    box(0.46, 0.36, 0.26, mTrim, 0, 0, -0.66, body);
    box(0.36, 0.3, 0.42, mBody, 0, 0.03, 0.74, body);
    box(0.54, 0.09, 0.92, mTrim, 0, 0.1, 0.06, body);
    const spin = add(coneGeo(0.16, 0.3, 12), mNose, 0, 0, -0.93, body);
    spin.rotation.x = -Math.PI / 2;
    add(boxGeo(2.0, 0.08, 0.52), [mWing, mWing, mWingTop, mWing, mWing, mWing], 0, -0.07, -0.12, body);
    box(0.92, 0.06, 0.28, mWing, 0, 0.05, 0.86, body);
    box(0.06, 0.38, 0.3, mTrim, 0, 0.25, 0.88, body);
    // the open cockpit: a thin rim around the pilot's waist
    for (const [w, d, x, z] of [[0.5, 0.06, 0, 0.5], [0.06, 0.34, -0.24, 0.34], [0.06, 0.34, 0.24, 0.34]]) box(w, 0.07, d, mDark, x, 0.21, z, body);
    const prop = new T.Group();
    prop.position.set(0, 0, -0.86);
    body.add(prop);
    box(1.0, 0.09, 0.03, mDark, 0, 0, 0, prop);
    const disc = new T.Mesh(cached('disc', () => new T.CircleGeometry(0.52, 24)), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }));
    disc.position.z = -0.88;
    body.add(disc);
    const pilot = addPilot(body, kind, 0.42, [0, 0.12, 0.34]);
    return { root, body, prop, disc, pilot, kind, look: L };
  }

  // A soft bubble and a wire cage around a plane, for shields.
  function addShield(v, r = 1.05) {
    const g = new T.Group();
    g.add(new T.Mesh(sphGeo(r, 20, 14), new T.MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })));
    const cage = new T.Mesh(cached(`ico${r}`, () => new T.IcosahedronGeometry(r * 1.06, 1)), new T.MeshBasicMaterial({ color: '#c8fbff', wireframe: true, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    g.add(cage);
    g.visible = false;
    v.root.add(g);
    v.shield = g;
    v.cage = cage;
    return g;
  }

  // A golden ring under the companion, so you can tell he's the helper.
  function addHalo(v, color, r = 0.95) {
    const ring = new T.Mesh(cached(`ring${r}`, () => new T.RingGeometry(r * 0.82, r, 32)), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    v.root.add(ring);
    v.halo = ring;
    return ring;
  }

  // A pink magnet ring that spins under a plane while the magnet is on.
  function addMagnet(v) {
    const ring = new T.Mesh(cached('mag', () => new T.TorusGeometry(0.8, 0.05, 6, 28)), new T.MeshBasicMaterial({ color: '#ff3d7f', transparent: true, opacity: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.25;
    ring.visible = false;
    v.root.add(ring);
    v.magnet = ring;
  }

  // ---------------------------------------------------------------- the silly enemies

  function buildDrone(theme) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const col = theme === 'night' ? '#b07bff' : theme === 'moon' || theme === 'space' ? '#c7cdd8' : '#ff8a1f';
    const mBody = mat(col, { roughness: 0.45, metalness: 0.2 });
    const mFace = G.std('#ffffff', { map: tex.droneFace, roughness: 0.5 });
    const mDark = mat('#2a2633');
    add(boxGeo(0.62, 0.22, 0.62), [mBody, mBody, mFace, mBody, mBody, mBody], 0, 0, 0, body);
    for (const a of [Math.PI / 4, -Math.PI / 4]) box(1.15, 0.06, 0.08, mDark, 0, 0.02, 0, body).rotation.y = a;
    const rotors = [];
    const mDisc = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
    for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
      const g = new T.Group();
      g.position.set(x, 0.1, z);
      body.add(g);
      add(cylGeo(0.25, 0.25, 0.01, 16), mDisc, 0, 0, 0, g);
      box(0.46, 0.02, 0.07, mDark, 0, 0.01, 0, g);
      rotors.push(g);
    }
    box(0.03, 0.26, 0.03, mDark, 0.2, 0.22, 0.2, body);
    const tip = ball(0.06, glow('#ff3d3d'), 0.2, 0.36, 0.2, body);
    return { root, body, rotors, tip, mats: [mBody] };
  }

  function buildUfo(scale = 1, pilotId = 'bolt', crown = false) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    body.scale.setScalar(scale);
    const spin = new T.Group(); // the saucer and its lights turn; the pilot doesn't
    body.add(spin);
    const mBody = mat('#b06bff', { roughness: 0.3, metalness: 0.45 });
    const saucer = add(sphGeo(0.74, 24, 12), mBody, 0, 0, 0, spin);
    saucer.scale.y = 0.3;
    const rim = add(cached('ufoRim', () => new T.TorusGeometry(0.72, 0.07, 8, 28)), mat('#ffd400', { roughness: 0.4, metalness: 0.3 }), 0, 0, 0, spin);
    rim.rotation.x = Math.PI / 2;
    const lights = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lights.push(add(sphGeo(0.065, 8, 6), new T.MeshBasicMaterial({ color: i % 2 ? '#7dff5a' : '#ff3d7f' }), Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.6, spin));
    }
    const pilot = addPilot(body, pilotId, 0.21, [0, 0.12, 0.08], { head: 1.6, crown });
    const dome = add(cached('dome', () => new T.SphereGeometry(0.38, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
      new T.MeshStandardMaterial({ color: '#9ff2ff', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }), 0, 0.12, 0, body);
    dome.renderOrder = 2;
    return { root, body, spin, lights, pilot, mats: [mBody] };
  }

  function buildCloud(theme, storm = false, scale = 1) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    body.scale.setScalar(scale);
    const col = storm ? '#7d8799' : theme === 'night' ? '#c3c8e6' : '#f4f7fb';
    const m = mat(col, { roughness: 0.95 });
    for (const [x, y, z, r] of [[0, 0, 0, 0.55], [-0.52, -0.06, 0.08, 0.42], [0.52, -0.06, 0.05, 0.45], [-0.26, 0.18, -0.22, 0.42], [0.28, 0.16, -0.2, 0.44], [0, -0.12, 0.32, 0.36], [-0.78, -0.12, -0.1, 0.3], [0.8, -0.1, -0.12, 0.3]]) {
      ball(r, m, x, y, z, body);
    }
    const face = spriteOf(storm ? tex.stormy : tex.grumpy, 1.0);
    face.position.set(0, 0.45, 0.42);
    body.add(face);
    return { root, body, face, mats: [m] };
  }

  function buildBlimp(scale = 1, sideways = false, crown = false) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    body.scale.setScalar(scale);
    const m = mat('#8fbf6a', { roughness: 0.7 }), dark = mat('#5f8a45', { roughness: 0.8 }), mDark = mat('#2a2633');
    const env = ball(1, m, 0, 0, 0, body);
    env.scale.set(sideways ? 1.25 : 0.7, 0.58, sideways ? 0.66 : 1.2);
    for (const [x, z, w, d] of sideways ? [[-0.6, -0.1, 0.34, 0.24], [0.5, 0.05, 0.28, 0.3], [0.05, -0.25, 0.24, 0.2]] : [[-0.12, -0.6, 0.24, 0.32], [0.16, 0.25, 0.26, 0.24], [-0.05, -0.15, 0.2, 0.18]]) {
      const pt = box(w, 0.04, d, dark, x, 0.53, z, body);
      pt.rotation.y = 0.3;
    }
    // fins and a little propeller at the back (the -z end, or the left end when sideways)
    const back = sideways ? [-1.18, 0, 0] : [0, 0, -1.18];
    box(sideways ? 0.4 : 0.06, 0.5, sideways ? 0.06 : 0.4, mat('#ff8a1f'), back[0], 0.25, back[2], body);
    box(sideways ? 0.4 : 0.8, 0.06, sideways ? 0.8 : 0.4, mat('#ff8a1f'), back[0], 0, back[2], body);
    const prop = new T.Group();
    prop.position.set(sideways ? -1.32 : 0, 0, sideways ? 0 : -1.32);
    body.add(prop);
    box(sideways ? 0.03 : 0.7, sideways ? 0.7 : 0.07, sideways ? 0.07 : 0.03, mDark, 0, 0, 0, prop);
    // googly eyes on the nose (the +z end, or the front side when sideways)
    const white = mat('#ffffff', { roughness: 0.3 });
    const eyes = [];
    const eyeAt = sideways ? [[-0.32, 0.36, 0.42], [0.34, 0.38, 0.4]] : [[-0.2, 0.34, 0.86], [0.22, 0.36, 0.84]];
    eyeAt.forEach(([x, y, z], i) => {
      const r = i ? 0.15 : 0.2;
      ball(r, white, x, y, z, body);
      eyes.push(ball(r * 0.5, mat(INK), x, y + r * 0.6, z + r * 0.45, body));
    });
    const mouth = box(sideways ? 0.6 : 0.36, 0.05, 0.05, mDark, 0, 0.18, sideways ? 0.6 : 1.1, body);
    mouth.rotation.x = -0.6;
    const rider = addPilot(body, 'zombie', sideways ? 0.34 : 0.44, [sideways ? 0.15 : 0, 0.5, sideways ? -0.05 : -0.05], { head: 1.5, crown });
    return { root, body, prop, eyes, rider, mats: [m] };
  }

  function buildBalloon(ptype) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const string = mat('#f4f4f4');
    for (const [x, y, z, col] of [[-0.3, 0.72, 0.06, '#ff3d4f'], [0.3, 0.72, 0.06, '#ffd400'], [0, 0.95, -0.16, '#18b4ff']]) {
      const b = ball(0.3, mat(col, { roughness: 0.25 }), x, y, z, body);
      b.scale.y = 1.15;
      const s = box(0.02, 0.62, 0.02, string, x / 2, (y + 0.1) / 2, z / 2, body);
      s.rotation.z = -x * 0.8;
    }
    box(0.5, 0.42, 0.5, mat('#ff3d7f'), 0, -0.05, 0, body);
    box(0.54, 0.44, 0.1, mat('#ffd400'), 0, -0.05, 0, body);
    box(0.1, 0.44, 0.54, mat('#ffd400'), 0, -0.05, 0, body);
    const badge = spriteOf(powerTexture(ptype), 0.78, { depthTest: false });
    badge.position.set(0, 0.0, 0.5);
    badge.renderOrder = 4;
    body.add(badge);
    return { root, body, badge, mats: [] };
  }

  // ---------------------------------------------------------------- bosses

  function buildBoss(kind, theme) {
    let v;
    if (kind === 'blimp') {
      v = buildBlimp(1.9, true, true);
    } else if (kind === 'storm') {
      v = buildCloud(theme, true, 2.3);
      v.face.scale.set(1.3, 1.3, 1);
      v.bolts = [];
      for (const s of [-1, 1]) {
        const b = spriteOf(G.emojiTexture('⚡'), 0.7);
        b.position.set(s * 1.0, -0.2, 0.4);
        v.body.add(b);
        v.bolts.push(b);
      }
    } else if (kind === 'bolt') {
      // Big Bolt: the kit's robot, just his head, very big, with propeller ears
      const root = new T.Group(), body = new T.Group();
      root.add(body);
      const pilot = addPilot(body, 'bolt', 4.4, [0, 0, 0], { head: 1 });
      for (const ch of pilot.p.hips.children) if (ch !== pilot.p.head) ch.visible = false;
      // move him so his (huge) head sits in the middle
      root.updateMatrixWorld(true);
      const c = new T.Box3().setFromObject(pilot.p.head).getCenter(new T.Vector3());
      pilot.holder.position.sub(c);
      const mDark = mat('#2a2633');
      const props = [];
      for (const s of [-1, 1]) {
        box(0.5, 0.3, 0.3, mat('#ff8a1f'), s * 1.05, 0.2, 0, body);
        const g = new T.Group();
        g.position.set(s * 1.3, 0.45, 0);
        body.add(g);
        add(cylGeo(0.75, 0.75, 0.01, 20), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }), 0, 0, 0, g);
        box(1.4, 0.03, 0.12, mDark, 0, 0.01, 0, g);
        props.push(g);
      }
      v = { root, body, pilot, rotors: props, mats: [] };
    } else {
      v = buildUfo(2.9, 'zombie', true);
    }
    v.kind = kind;
    return v;
  }

  // ---------------------------------------------------------------- shots, bullets, things to catch

  function shotView(kind) {
    const g = new T.Group();
    if (kind === 'ball') g.add(spriteOf(G.emojiTexture('🏀'), 0.44));
    else {
      g.add(spriteOf(tex.glow, 0.75, { color: '#ffe680', blending: T.AdditiveBlending }), spriteOf(G.emojiTexture('✌️'), 0.46));
    }
    g.userData.spin = g.children[g.children.length - 1];
    return g;
  }

  function bulletView(kind) {
    const s = spriteOf(tex.bullet[kind] || tex.bullet.zap, 0.5);
    s.renderOrder = 3;
    return s;
  }

  function itemView(it) {
    const g = new T.Group();
    if (it.kind === 'power') {
      g.add(spriteOf(tex.glow, 1.7, { color: '#fff3a0', blending: T.AdditiveBlending, opacity: 0.7 }));
      g.add(spriteOf(powerTexture(it.ptype), 0.92));
    } else if (it.kind === 'coin') g.add(spriteOf(tex.coin, 0.5));
    else if (it.kind === 'fruit') g.add(spriteOf(G.emojiTexture(it.emoji || '🍎'), 0.62));
    else if (it.kind === 'star') g.add(spriteOf(G.emojiTexture('⭐'), 0.6));
    else g.add(spriteOf(G.emojiTexture('⭐'), 0.3));
    g.userData.main = g.children[g.children.length - 1];
    return g;
  }

  // ---------------------------------------------------------------- the ground below: 10 places

  const TILE = 12; // one ground tile is 12 x 12 units, painted on a 1024 x 1024 canvas
  const PXU = 1024 / TILE;

  // world x on the tile canvas: x = -6 is the left edge, x = 6 the right
  const tx = (x) => (x + 6) * PXU;
  function wrapDraw(g, fn) { for (const dx of [-1024, 0, 1024]) for (const dy of [-1024, 0, 1024]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
  function dots(g, n, colors, rmin, rmax, rnd) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * 1024, y = rnd() * 1024, r = rmin + rnd() * (rmax - rmin);
      g.fillStyle = colors[i % colors.length];
      wrapDraw(g, () => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    }
  }
  const wavy = (y, amp, x0, per = 1) => x0 + Math.sin((y / 1024) * Math.PI * 2 * per) * amp;

  function paintGround(theme, g, rnd) {
    const S = 1024;
    const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, S, S); };
    switch (theme) {
      case 'yard': {
        fill('#78c257');
        g.fillStyle = '#86cf63';
        for (let x = 0; x < S; x += 128) g.fillRect(x, 0, 64, S); // mowing stripes
        g.fillStyle = '#e9d6a6'; // a winding garden path
        for (let y = 0; y < S; y += 4) { const x = wavy(y, 150, 300); g.fillRect(x - 34, y, 68, 5); }
        dots(g, 60, ['#ff5d8f', '#ffd400', '#ffffff', '#b07bff'], 4, 8, rnd);
        g.fillStyle = '#f2df9c'; // sandbox
        g.fillRect(700, 180, 150, 120);
        g.strokeStyle = '#a0683b';
        g.lineWidth = 12;
        g.strokeRect(700, 180, 150, 120);
        g.fillStyle = '#5fc4ff'; // a paddling pool
        g.beginPath(); g.arc(760, 720, 70, 0, Math.PI * 2); g.fill();
        g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.stroke();
        break;
      }
      case 'city': {
        fill('#a9afba');
        g.fillStyle = '#5d636e'; // roads: one down the middle, two across each tile
        g.fillRect(tx(-1.1), 0, tx(1.1) - tx(-1.1), S);
        for (const y of [256, 768]) g.fillRect(0, y - 60, S, 120);
        g.fillStyle = '#ffd400';
        for (let y = 0; y < S; y += 64) g.fillRect(tx(0) - 4, y, 8, 34);
        g.fillStyle = '#ffffff';
        for (const y of [256, 768]) for (let x = 0; x < S; x += 64) g.fillRect(x, y - 4, 34, 8);
        g.fillStyle = '#c7ccd5'; // sidewalks
        for (const y of [256, 768]) { g.fillRect(0, y - 74, S, 14); g.fillRect(0, y + 60, S, 14); }
        g.fillRect(tx(-1.1) - 14, 0, 14, S); g.fillRect(tx(1.1), 0, 14, S);
        break;
      }
      case 'beach': {
        fill('#f3d89c');
        g.fillStyle = '#2f9fe0';
        g.beginPath();
        g.moveTo(S, 0);
        for (let y = 0; y <= S; y += 8) g.lineTo(wavy(y, 40, tx(1.4), 2), y);
        g.lineTo(S, S);
        g.closePath();
        g.fill();
        g.fillStyle = '#58c3f2';
        g.beginPath();
        g.moveTo(S, 0);
        for (let y = 0; y <= S; y += 8) g.lineTo(wavy(y, 40, tx(1.4), 2) + 40, y);
        g.lineTo(S, S);
        g.closePath();
        g.fill();
        g.fillStyle = '#ffffff';
        for (let y = 0; y <= S; y += 4) g.fillRect(wavy(y, 40, tx(1.4), 2) - 6, y, 14, 5); // foam
        g.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 40; i++) { const x = tx(2.6) + rnd() * (S - tx(2.6)), y = rnd() * S; g.fillRect(x, y, 30, 4); }
        dots(g, 90, ['#e9c985', '#fff1c9'], 2, 4, rnd);
        break;
      }
      case 'farm': {
        fill('#7cc35a');
        const cols = ['#e8c84a', '#7cc35a', '#a8794a', '#5ea844', '#d9b23a'];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const x = c * 256, y = r * 256, col = cols[(r * 3 + c * 2) % cols.length];
          g.fillStyle = col;
          g.fillRect(x + 6, y + 6, 244, 244);
          g.strokeStyle = 'rgba(0,0,0,0.12)';
          g.lineWidth = 6;
          for (let k = 20; k < 244; k += 26) { g.beginPath(); if ((r + c) % 2) { g.moveTo(x + k, y + 10); g.lineTo(x + k, y + 246); } else { g.moveTo(x + 10, y + k); g.lineTo(x + 246, y + k); } g.stroke(); }
        }
        g.fillStyle = '#c9a26a'; // a dirt road
        for (let y = 0; y < S; y += 4) { const x = wavy(y, 90, tx(-0.5)); g.fillRect(x - 30, y, 60, 5); }
        break;
      }
      case 'clouds': {
        const gr = g.createLinearGradient(0, 0, S, S);
        gr.addColorStop(0, '#9fdcff');
        gr.addColorStop(1, '#bfe8ff');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 70; i++) {
          const x = rnd() * S, y = rnd() * S, r = 40 + rnd() * 70;
          wrapDraw(g, () => {
            const gg = g.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r);
            gg.addColorStop(0, 'rgba(255,255,255,0.95)');
            gg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gg;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          });
        }
        break;
      }
      case 'snow': {
        fill('#cfdff2');
        dots(g, 46, ['#e4eefa', '#f4f8ff', '#bccfe6'], 30, 90, rnd);
        g.fillStyle = '#bfe3ff'; // a frozen lake
        g.beginPath(); g.ellipse(tx(-3), 600, 170, 110, 0.3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 4;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(tx(-3) + R(-100, 100), 600 + R(-60, 60)); g.lineTo(tx(-3) + R(-100, 100), 600 + R(-60, 60)); g.stroke(); }
        g.strokeStyle = 'rgba(120,150,190,0.35)'; g.lineWidth = 5; // ski tracks
        for (const x0 of [tx(2.5), tx(2.8)]) { g.beginPath(); for (let y = 0; y <= S; y += 8) g.lineTo(wavy(y, 70, x0, 2), y); g.stroke(); }
        break;
      }
      case 'candy': {
        fill('#ffc2dc');
        g.fillStyle = '#8ff0d0'; // a mint river
        for (let y = 0; y < S; y += 4) { const x = wavy(y, 120, tx(2)); g.fillRect(x - 60, y, 120, 5); }
        g.fillStyle = '#7a4a2a';
        for (const [x, y, r] of [[200, 200, 70], [380, 760, 90], [820, 420, 60]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
        const sp = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ffffff', '#b07bff'];
        for (let i = 0; i < 260; i++) {
          const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI;
          g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = sp[i % sp.length]; g.fillRect(-9, -3, 18, 6); g.restore();
        }
        break;
      }
      case 'night': {
        fill('#2b3150');
        g.fillStyle = '#1b1f33';
        g.fillRect(tx(-1.1), 0, tx(1.1) - tx(-1.1), S);
        for (const y of [256, 768]) g.fillRect(0, y - 60, S, 120);
        g.fillStyle = '#ffcf4a';
        for (let y = 0; y < S; y += 64) g.fillRect(tx(0) - 4, y, 8, 34);
        for (const y of [256, 768]) for (let x = 0; x < S; x += 64) g.fillRect(x, y - 4, 34, 8);
        dots(g, 70, ['rgba(255,220,120,0.5)'], 6, 14, rnd); // street-light pools
        break;
      }
      case 'moon': {
        fill('#9c9daa');
        dots(g, 160, ['#8d8e9b', '#aeafbb'], 3, 10, rnd);
        for (let i = 0; i < 26; i++) {
          const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 70;
          wrapDraw(g, () => {
            g.fillStyle = '#7f808e'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#8c8d9a'; g.beginPath(); g.arc(x + r * 0.12, y + r * 0.12, r * 0.82, 0, Math.PI * 2); g.fill();
            g.strokeStyle = '#c3c4cf'; g.lineWidth = Math.max(3, r * 0.1); g.beginPath(); g.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
          });
        }
        break;
      }
      default: { // space
        fill('#0c0b2b');
        for (let i = 0; i < 8; i++) {
          const x = rnd() * S, y = rnd() * S, r = 120 + rnd() * 160, col = ['rgba(141,91,216,', 'rgba(24,180,255,', 'rgba(255,61,127,'][i % 3];
          wrapDraw(g, () => {
            const gg = g.createRadialGradient(x, y, 0, x, y, r);
            gg.addColorStop(0, col + '0.35)');
            gg.addColorStop(1, col + '0)');
            g.fillStyle = gg;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          });
        }
        dots(g, 260, ['#ffffff', '#fff3b0', '#bfe8ff'], 1, 3.5, rnd);
      }
    }
  }

  // Props: little 3D things on the ground. Each builder returns a Group sitting on y = 0.
  const P = {
    tree(col = '#3fae4a') {
      const g = new T.Group();
      box(0.18, 0.6, 0.18, mat('#8a5a32'), 0, 0.3, 0, g);
      ball(0.55, mat(col), 0, 0.85, 0, g);
      ball(0.38, mat(G.shade(col, 0.15)), 0.25, 1.1, 0.12, g);
      return g;
    },
    bush() { const g = new T.Group(); ball(0.38, mat('#4fb84a'), 0, 0.25, 0, g); ball(0.3, mat('#5fc458'), 0.3, 0.2, 0.1, g); return g; },
    trampoline() {
      const g = new T.Group();
      add(cylGeo(0.9, 0.9, 0.12, 24), mat('#2a2633'), 0, 0.5, 0, g);
      const r = add(cached('tramp', () => new T.TorusGeometry(0.92, 0.1, 6, 24)), mat('#18b4ff'), 0, 0.56, 0, g);
      r.rotation.x = Math.PI / 2;
      return g;
    },
    shed() {
      const g = new T.Group();
      box(1.2, 0.8, 1.0, mat('#e6d3b3'), 0, 0.4, 0, g);
      const roof = box(1.35, 0.12, 1.2, mat('#c0392b'), 0, 0.9, 0, g);
      roof.rotation.z = 0.12;
      box(0.3, 0.5, 0.05, mat('#7a4a2a'), 0, 0.25, 0.52, g);
      return g;
    },
    building(h, col, night) {
      const g = new T.Group();
      const m = mat(col, { roughness: 0.8 });
      box(1.5, h, 1.5, m, 0, h / 2, 0, g);
      box(1.6, 0.1, 1.6, mat(G.shade(col, -0.25)), 0, h, 0, g);
      const win = night ? glow('#ffe08a') : mat('#9fd7ff', { roughness: 0.2 });
      for (let y = 0.4; y < h - 0.2; y += 0.45) for (const x of [-0.42, 0, 0.42]) box(0.22, 0.24, 0.02, (night && Math.random() < 0.35) ? mat('#3b4166') : win, x, y, 0.76, g);
      if (Math.random() < 0.6) add(cylGeo(0.2, 0.2, 0.35, 10), mat('#8a5a32'), 0.4, h + 0.22, -0.4, g);
      box(0.4, 0.2, 0.3, mat('#d0d4dc'), -0.4, h + 0.15, 0.3, g);
      return g;
    },
    car(col, night) {
      const g = new T.Group();
      box(0.5, 0.22, 0.95, mat(col, { roughness: 0.4 }), 0, 0.16, 0, g);
      box(0.44, 0.18, 0.5, mat('#bfe8ff', { roughness: 0.1 }), 0, 0.34, 0.05, g);
      if (night) for (const x of [-0.16, 0.16]) box(0.1, 0.08, 0.04, glow('#fff3b0'), x, 0.16, 0.48, g);
      return g;
    },
    lamp() { const g = new T.Group(); box(0.08, 1.1, 0.08, mat('#3b4166'), 0, 0.55, 0, g); ball(0.14, glow('#ffe08a'), 0, 1.15, 0, g); return g; },
    umbrella() {
      const g = new T.Group();
      box(0.05, 1.0, 0.05, mat('#f4f4f4'), 0, 0.5, 0, g);
      add(coneGeo(0.75, 0.32, 8), mat(G.pick(['#ff3d7f', '#18b4ff', '#ffd400', '#7dff5a'])), 0, 1.05, 0, g);
      box(0.6, 0.02, 1.1, mat(G.pick(['#ff8fb8', '#9ff2d6', '#fff1a8'])), 0.6, 0.01, 0.2, g);
      return g;
    },
    palm() {
      const g = new T.Group();
      for (let i = 0; i < 5; i++) box(0.16, 0.3, 0.16, mat(i % 2 ? '#a8794a' : '#8a5a32'), i * 0.04, 0.15 + i * 0.28, 0, g);
      for (let k = 0; k < 6; k++) {
        const leaf = box(0.9, 0.04, 0.24, mat('#3fae4a'), 0, 1.45, 0, g);
        leaf.rotation.y = (k / 6) * Math.PI * 2;
        leaf.rotation.z = -0.35;
        leaf.position.x = 0.2 + Math.cos(leaf.rotation.y) * 0.4;
        leaf.position.z = -Math.sin(leaf.rotation.y) * 0.4;
      }
      return g;
    },
    castle() {
      const g = new T.Group();
      const s = mat('#e9c985');
      box(0.9, 0.35, 0.9, s, 0, 0.17, 0, g);
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) add(cylGeo(0.15, 0.17, 0.6, 8), s, x, 0.3, z, g);
      box(0.02, 0.3, 0.02, mat('#2a2633'), 0, 0.5, 0, g);
      box(0.2, 0.12, 0.02, mat('#ff3d7f'), 0.1, 0.6, 0, g);
      return g;
    },
    boat() {
      const g = new T.Group();
      box(0.5, 0.2, 1.2, mat('#ffffff'), 0, 0.1, 0, g);
      box(0.52, 0.06, 1.22, mat('#ff3d4f'), 0, 0.03, 0, g);
      box(0.04, 0.9, 0.04, mat('#8a5a32'), 0, 0.6, 0, g);
      const sail = add(cached('sail', () => new T.ConeGeometry(0.4, 0.8, 3)), mat('#fff3c0'), 0.05, 0.6, 0.1, g);
      sail.scale.z = 0.15;
      return g;
    },
    ball() { const g = new T.Group(); ball(0.25, mat('#ff3d7f', { roughness: 0.3 }), 0, 0.25, 0, g); ball(0.2, mat('#ffffff'), 0.08, 0.32, 0.08, g); return g; },
    barn() {
      const g = new T.Group();
      box(1.4, 0.9, 1.1, mat('#c0392b'), 0, 0.45, 0, g);
      for (const s of [-1, 1]) { const r = box(0.85, 0.1, 1.2, mat('#5a2d24'), s * 0.36, 1.05, 0, g); r.rotation.z = -s * 0.5; }
      box(0.5, 0.55, 0.04, mat('#ffffff'), 0, 0.28, 0.56, g);
      return g;
    },
    hay() { const g = new T.Group(); const c = add(cylGeo(0.3, 0.3, 0.55, 14), mat('#e8c84a'), 0, 0.3, 0, g); c.rotation.z = Math.PI / 2; return g; },
    silo() { const g = new T.Group(); add(cylGeo(0.4, 0.4, 1.6, 14), mat('#d0d4dc'), 0, 0.8, 0, g); add(sphGeo(0.4, 14, 8), mat('#8a93a6'), 0, 1.6, 0, g); return g; },
    cow() {
      const g = new T.Group();
      box(0.4, 0.3, 0.7, mat('#ffffff'), 0, 0.35, 0, g);
      box(0.3, 0.26, 0.3, mat('#ffffff'), 0, 0.45, 0.45, g);
      box(0.2, 0.1, 0.06, mat('#ffb0c0'), 0, 0.38, 0.6, g);
      box(0.18, 0.12, 0.3, mat(INK), 0.12, 0.51, -0.1, g);
      for (const [x, z] of [[-0.14, -0.25], [0.14, -0.25], [-0.14, 0.25], [0.14, 0.25]]) box(0.08, 0.22, 0.08, mat('#ffffff'), x, 0.1, z, g);
      return g;
    },
    puff() { const g = new T.Group(); const m = mat('#ffffff', { roughness: 1 }); ball(0.7, m, 0, 0.3, 0, g); ball(0.5, m, 0.6, 0.2, 0.2, g); ball(0.5, m, -0.6, 0.2, -0.1, g); return g; },
    rainbow() {
      const g = new T.Group();
      ['#ff3d4f', '#ff8a1f', '#ffd400', '#7dff5a', '#18b4ff', '#8d5bd8'].forEach((col, i) => {
        add(cached(`rb${i}`, () => new T.TorusGeometry(1.4 - i * 0.12, 0.06, 6, 24, Math.PI)), mat(col, { emissive: col, emissiveIntensity: 0.25 }), 0, 0, 0, g);
      });
      return g;
    },
    skyCastle() {
      const g = new T.Group();
      const m = mat('#ffffff', { roughness: 1 });
      ball(0.9, m, 0, 0, 0, g).scale.y = 0.45;
      box(0.8, 0.6, 0.6, mat('#ffd6e8'), 0, 0.5, 0, g);
      for (const x of [-0.45, 0.45]) { add(cylGeo(0.16, 0.16, 0.9, 8), mat('#ffd6e8'), x, 0.6, 0, g); add(coneGeo(0.22, 0.4, 8), mat('#8d5bd8'), x, 1.25, 0, g); }
      return g;
    },
    pine(snow) {
      const g = new T.Group();
      box(0.14, 0.3, 0.14, mat('#6b4428'), 0, 0.15, 0, g);
      [[0.55, 0.6, 0.5], [0.42, 0.5, 0.85], [0.28, 0.4, 1.15]].forEach(([r, h, y]) => {
        add(coneGeo(r, h, 8), mat('#2f8a4a'), 0, y, 0, g);
        if (snow) add(coneGeo(r * 0.55, h * 0.4, 8), mat('#ffffff'), 0, y + h * 0.32, 0, g);
      });
      return g;
    },
    snowman() {
      const g = new T.Group();
      const m = mat('#ffffff', { roughness: 0.9 });
      ball(0.35, m, 0, 0.32, 0, g); ball(0.26, m, 0, 0.8, 0, g); ball(0.19, m, 0, 1.15, 0, g);
      const n = add(coneGeo(0.05, 0.25, 6), mat('#ff8a1f'), 0, 1.15, 0.27, g);
      n.rotation.x = Math.PI / 2;
      box(0.28, 0.16, 0.28, mat(INK), 0, 1.36, 0, g);
      return g;
    },
    cabin() {
      const g = new T.Group();
      box(1.1, 0.7, 0.9, mat('#8a5a32'), 0, 0.35, 0, g);
      for (const s of [-1, 1]) { const r = box(0.7, 0.1, 1.0, mat('#ffffff'), s * 0.3, 0.85, 0, g); r.rotation.z = -s * 0.6; }
      box(0.2, 0.2, 0.02, glow('#ffe08a'), 0.25, 0.4, 0.46, g);
      return g;
    },
    rock(col = '#8f9aa8', snow) {
      const g = new T.Group();
      const r = add(cached('rock', () => new T.DodecahedronGeometry(0.42)), mat(col), 0, 0.2, 0, g);
      r.rotation.set(R(0, 3), R(0, 3), 0);
      if (snow) add(sphGeo(0.25, 8, 6), mat('#ffffff'), 0, 0.45, 0, g);
      return g;
    },
    lollipop() {
      const g = new T.Group();
      box(0.06, 1.0, 0.06, mat('#ffffff'), 0, 0.5, 0, g);
      const d = add(cylGeo(0.4, 0.4, 0.1, 18), mat(G.pick(['#ff3d7f', '#18d4ff', '#ffd400', '#b07bff'])), 0, 1.1, 0, g);
      d.rotation.x = Math.PI / 2 - TILT;
      const s = add(cached('swirl', () => new T.TorusGeometry(0.22, 0.05, 6, 18)), mat('#ffffff'), 0, 1.1, 0.06, g);
      s.rotation.x = Math.PI / 2 - TILT;
      return g;
    },
    cane() {
      const g = new T.Group();
      for (let i = 0; i < 6; i++) box(0.14, 0.2, 0.14, mat(i % 2 ? '#ffffff' : '#ff3d4f'), 0, 0.1 + i * 0.2, 0, g);
      for (let i = 0; i < 3; i++) box(0.14, 0.14, 0.14, mat(i % 2 ? '#ffffff' : '#ff3d4f'), 0.14 + i * 0.13, 1.25 + (i === 2 ? -0.12 : 0), 0, g);
      return g;
    },
    cupcake() {
      const g = new T.Group();
      add(cylGeo(0.35, 0.26, 0.35, 12), mat('#ffb0c8'), 0, 0.18, 0, g);
      ball(0.38, mat('#fff3f8'), 0, 0.45, 0, g).scale.y = 0.7;
      ball(0.1, mat('#e53935', { roughness: 0.2 }), 0, 0.72, 0, g);
      return g;
    },
    gumdrop() { const g = new T.Group(); add(coneGeo(0.35, 0.5, 10), mat(G.pick(['#7dff5a', '#ff8a1f', '#b07bff', '#18d4ff']), { roughness: 0.3 }), 0, 0.25, 0, g); return g; },
    donut() {
      const g = new T.Group();
      const d = add(cached('donut', () => new T.TorusGeometry(0.36, 0.17, 10, 20)), mat('#d99a5b'), 0, 0.17, 0, g);
      d.rotation.x = Math.PI / 2;
      const ic = add(cached('icing', () => new T.TorusGeometry(0.36, 0.13, 10, 20)), mat('#ff8fb8'), 0, 0.24, 0, g);
      ic.rotation.x = Math.PI / 2;
      return g;
    },
    rocket() {
      const g = new T.Group();
      add(cylGeo(0.22, 0.22, 1.1, 12), mat('#f4f6fb'), 0, 0.75, 0, g);
      add(coneGeo(0.22, 0.4, 12), mat('#e53935'), 0, 1.5, 0, g);
      for (const a of [0, 2.1, 4.2]) { const f = box(0.04, 0.35, 0.3, mat('#e53935'), Math.sin(a) * 0.2, 0.35, Math.cos(a) * 0.2, g); f.rotation.y = a; }
      box(0.9, 0.12, 0.9, mat('#5a5f6b'), 0, 0.06, 0, g);
      return g;
    },
    dome() {
      const g = new T.Group();
      add(cached('mdome', () => new T.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#e6eaef', { metalness: 0.3, roughness: 0.4 }), 0, 0, 0, g);
      box(0.25, 0.3, 0.3, mat('#18b4ff'), 0, 0.15, 0.55, g);
      return g;
    },
    flag() {
      const g = new T.Group();
      box(0.04, 0.9, 0.04, mat('#d0d4dc'), 0, 0.45, 0, g);
      const [c, gg] = G.makeCanvas(128, 80);
      gg.fillStyle = '#3f86e8'; gg.fillRect(0, 0, 64, 80); gg.fillStyle = '#7fdcbd'; gg.fillRect(64, 0, 64, 80);
      gg.font = `56px ${G.FONT}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = '#ffffff'; gg.fillText('TT', 64, 44);
      box(0.5, 0.3, 0.02, G.std('#ffffff', { map: G.toTexture(c) }), 0.27, 0.72, 0, g);
      return g;
    },
    planet(col, ring) {
      const g = new T.Group();
      const r = R(0.6, 1.3);
      ball(r, mat(col, { roughness: 0.7 }), 0, 0, 0, g);
      ball(r * 0.98, mat(G.shade(col, 0.25), { transparent: true, opacity: 0.5 }), r * 0.15, r * 0.15, 0, g).scale.y = 0.4;
      if (ring) {
        const rg = add(cached('pring', () => new T.RingGeometry(1.3, 1.9, 32)), new T.MeshBasicMaterial({ color: '#ffe6a8', side: T.DoubleSide, transparent: true, opacity: 0.8 }), 0, 0, 0, g);
        rg.rotation.x = -1.2;
        rg.scale.setScalar(r / 1.0);
      }
      g.position.y = -1.5;
      return g;
    },
    asteroid() { const g = new T.Group(); const a = add(cached('ast', () => new T.DodecahedronGeometry(0.4)), mat('#8a7b6a'), 0, 0, 0, g); a.scale.set(1.3, 0.9, 1); return g; },
    satellite() {
      const g = new T.Group();
      box(0.35, 0.35, 0.5, mat('#ffd400', { metalness: 0.4 }), 0, 0, 0, g);
      for (const s of [-1, 1]) box(0.8, 0.03, 0.35, mat('#3f6fd0', { metalness: 0.4, roughness: 0.3 }), s * 0.6, 0, 0, g);
      return g;
    },
  };

  // Each place: its sky colours, light, what's on the ground, and the clouds that pass by.
  const THEMES = {
    yard: { bg: '#8fd3ff', page: ['#a5ddff', '#5fae4a'], hemi: ['#ffffff', '#5b7a3a', 0.85], sun: ['#fff3e0', 1.1], clouds: 'white', shadows: true,
      props: [['tree', -5.5, -3], ['tree', 3, 5.5], ['bush', -5.5, 5.5], ['bush', -5.5, 5.5], ['trampoline', 1.5, 5], ['shed', -5.5, -3.5], ['tree', -2, 2], ['ball', -4, 4]] },
    city: { bg: '#8fd3ff', page: ['#a5ddff', '#7c8494'], hemi: ['#ffffff', '#6a6f7a', 0.85], sun: ['#fff3e0', 1.1], clouds: 'white', shadows: true, city: true },
    beach: { bg: '#8fd3ff', page: ['#8fe0ff', '#f3d89c'], hemi: ['#ffffff', '#c9b07a', 0.9], sun: ['#fff6e0', 1.15], clouds: 'white', shadows: true,
      props: [['umbrella', -5.2, 0], ['umbrella', -5.2, 0], ['palm', -5.6, -2], ['castle', -4.5, 0.5], ['ball', -4, 0], ['boat', 3, 5.6], ['boat', 3, 5.6], ['palm', -5.6, -3]] },
    farm: { bg: '#8fd3ff', page: ['#a5ddff', '#7cc35a'], hemi: ['#ffffff', '#6a8a3a', 0.85], sun: ['#fff3e0', 1.1], clouds: 'white', shadows: true,
      props: [['barn', -5, -2.5], ['hay', -5.5, 5.5], ['hay', -5.5, 5.5], ['silo', 2.5, 5.5], ['cow', -5, 5], ['cow', -5, 5], ['tree', -5.5, 5.5], ['tree', 3, 5.5]] },
    clouds: { bg: '#a5ddff', page: ['#c8ecff', '#7fc8ff'], hemi: ['#ffffff', '#b0d8ff', 1.0], sun: ['#ffffff', 0.9], clouds: 'white', shadows: true,
      props: [['puff', -5.5, 5.5], ['puff', -5.5, 5.5], ['rainbow', -4, 4], ['skyCastle', -5, 5], ['puff', -5.5, 5.5]] },
    snow: { bg: '#cfeaff', page: ['#d8efff', '#9fbad6'], hemi: ['#ffffff', '#a8c0dc', 0.95], sun: ['#ffffff', 1.0], clouds: 'white', shadows: true,
      props: [['pineSnow', -5.6, 5.6], ['pineSnow', -5.6, 5.6], ['pineSnow', -5.6, 5.6], ['snowman', -5, 5], ['cabin', -5.5, 5.5], ['rockSnow', -5.6, 5.6], ['pineSnow', -5.6, 5.6]] },
    candy: { bg: '#ffd6ea', page: ['#ffe0f0', '#ff9fc8'], hemi: ['#ffffff', '#d68aa8', 0.9], sun: ['#fff0f6', 1.1], clouds: 'pink', shadows: true,
      props: [['lollipop', -5.5, 5.5], ['lollipop', -5.5, 5.5], ['cane', -5.5, 5.5], ['cupcake', -5.5, 5.5], ['gumdrop', -5.5, 5.5], ['donut', -5.5, 5.5], ['gumdrop', -5.5, 5.5]] },
    night: { bg: '#1b2140', page: ['#1d2346', '#0d1024'], hemi: ['#8a9adf', '#20253d', 0.6], sun: ['#b9c6ff', 0.55], clouds: 'night', shadows: false, city: true, night: true },
    moon: { bg: '#0c0b2b', page: ['#2a2c4a', '#0c0b2b'], hemi: ['#ffffff', '#4a4b5c', 0.75], sun: ['#ffffff', 1.0], clouds: 'dust', shadows: true,
      props: [['rock', -5.6, 5.6], ['rock', -5.6, 5.6], ['rocket', -5, 5], ['dome', -5, 5], ['flag', -5, 5], ['rock', -5.6, 5.6], ['dome', -5, 5]] },
    space: { bg: '#0c0b2b', page: ['#1a1446', '#05051a'], hemi: ['#d0d8ff', '#1a1446', 0.8], sun: ['#ffffff', 1.0], clouds: 'dust', shadows: false,
      props: [['planetA', -5.5, 5.5], ['asteroid', -5.6, 5.6], ['planetB', -5.5, 5.5], ['satellite', -5, 5], ['asteroid', -5.6, 5.6]] },
  };
  const MAKERS = {
    pineSnow: () => P.pine(true), rockSnow: () => P.rock('#9fb0c4', true),
    planetA: () => P.planet(G.pick(['#ff8a5c', '#ffcf6a', '#8ad7ff']), true), planetB: () => P.planet(G.pick(['#b07bff', '#7dff9a', '#ff7ab0']), false),
  };

  // The ground: one big plane with the painted tile scrolling down, props riding along with it, and clouds
  // drifting past faster (in front of the ground, below the planes).
  const BAND = 24; // props live on a 24-unit loop, two tiles long
  function makeWorld(scene) {
    const group = new T.Group();
    scene.add(group);
    const groundMat = new T.MeshBasicMaterial({ color: '#ffffff' }); // painted, so it isn't lit: the colours stay as painted
    const ground = new T.Mesh(new T.PlaneGeometry(18, BAND), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -2);
    group.add(ground);
    const propGroup = new T.Group();
    group.add(propGroup);
    const skyGroup = new T.Group();
    scene.add(skyGroup);
    let props = [], puffs = [], theme = null, D = 0;
    const groundTex = {};

    function texFor(name) {
      if (groundTex[name]) return groundTex[name];
      const [c, g] = G.makeCanvas(1024, 1024);
      paintGround(name, g, SKY.sim.rng(name.length * 977 + 13));
      const t = G.toTexture(c, true);
      t.repeat.set(18 / TILE, BAND / TILE);
      t.offset.x = -0.25;
      return (groundTex[name] = t);
    }

    function clearProps() {
      for (const p of props) propGroup.remove(p.obj);
      props = [];
      for (const p of puffs) skyGroup.remove(p.s);
      puffs = [];
    }

    function cityProps(night) {
      // buildings in the blocks beside the main road, cars on it
      const cols = night ? ['#3b4166', '#4a3f6b', '#2f4a63'] : ['#ff8fa3', '#ffd38a', '#8fd0ff', '#b9a6ff', '#9fe0b8', '#f4f4f4'];
      for (let blk = 0; blk < 4; blk++) {
        const zc = blk * 6 + 3; // the middle of a block, between the cross roads
        for (const side of [-1, 1]) {
          for (const k of [-1, 1]) {
            const h = R(0.9, 2.4);
            const obj = P.building(h, G.pick(cols), night);
            props.push({ obj, bz: zc + k * 1.15, xr: side < 0 ? [-4.6, -2.2] : [2.2, 4.6], rot: false });
          }
        }
        props.push({ obj: P.car(G.pick(['#e53935', '#ffd400', '#18b4ff', '#7dff5a']), night), bz: zc + R(-2, 2), xr: [-0.5, -0.4], rot: false, carDir: 1 });
        props.push({ obj: P.car(G.pick(['#ff8a1f', '#ffffff', '#b07bff']), night), bz: zc + R(-2, 2), xr: [0.4, 0.5], rot: false });
        if (night) props.push({ obj: P.lamp(), bz: zc + 2.6, xr: [1.3, 1.4], rot: false });
      }
    }

    function setTheme(name) {
      const th = THEMES[name] || THEMES.yard;
      if (theme === name) return th;
      theme = name;
      clearProps();
      groundMat.map = texFor(name);
      groundMat.needsUpdate = true;
      if (th.city) cityProps(!!th.night);
      else {
        const n = th.props.length;
        const slots = 16;
        for (let i = 0; i < slots; i++) {
          const [kind, a, b] = th.props[i % n];
          const make = MAKERS[kind] || P[kind];
          const obj = make();
          props.push({ obj, bz: (i / slots) * BAND + R(0, 1), xr: [a, b], rot: true });
        }
      }
      for (const p of props) {
        p.obj.position.x = R(p.xr[0], p.xr[1]);
        if (p.rot) p.obj.rotation.y = R(-0.6, 0.6);
        p.y0 = p.obj.position.y;
        propGroup.add(p.obj);
      }
      // the clouds (or space dust) that pass by
      if (th.clouds !== 'dust') {
        const col = th.clouds === 'night' ? '#7f8bb8' : th.clouds === 'pink' ? '#ffe0ef' : '#ffffff';
        const n = name === 'clouds' ? 9 : 6;
        for (let i = 0; i < n; i++) {
          const s = spriteOf(tex.puff, 1, { color: col, opacity: th.clouds === 'night' ? 0.4 : name === 'snow' ? 0.45 : 0.8 });
          const sc = R(3, 5.5);
          s.scale.set(sc, sc * 0.6, 1);
          s.position.set(R(-7, 7), 1.6, R(-16, 10));
          skyGroup.add(s);
          puffs.push({ s, speed: R(1.6, 2.1) });
        }
        // a couple of faint ones above the planes
        for (let i = 0; i < 2; i++) {
          const s = spriteOf(tex.puff, 1, { color: col, opacity: 0.22 });
          s.scale.set(6, 3.4, 1);
          s.position.set(R(-6, 6), 6, R(-16, 10));
          s.renderOrder = 8;
          skyGroup.add(s);
          puffs.push({ s, speed: 2.8 });
        }
      } else {
        for (let i = 0; i < 26; i++) {
          const s = spriteOf(tex.dot, 0.12, { color: '#ffffff', opacity: 0.7 });
          s.scale.set(0.06, R(0.5, 1.2), 1);
          s.position.set(R(-7, 7), R(1, 2.5), R(-16, 10));
          skyGroup.add(s);
          puffs.push({ s, speed: R(5, 9), dust: true });
        }
      }
      return th;
    }

    // scroll the world by `speed` units a second
    function tick(dt, speed) {
      D += speed * dt;
      if (groundMat.map) groundMat.map.offset.y = D / TILE;
      for (const p of props) {
        const z = -14 + (((p.bz + D) % BAND) + BAND) % BAND;
        if (z < p.lastZ - 1) { // wrapped round to the top: somewhere new across
          p.obj.position.x = R(p.xr[0], p.xr[1]);
          if (p.rot) p.obj.rotation.y = R(-0.6, 0.6);
        }
        p.lastZ = z;
        p.obj.position.z = z;
        if (p.carDir) p.obj.position.z = -14 + (((p.bz + D * 1.6) % BAND) + BAND) % BAND;
      }
      for (const p of puffs) {
        p.s.position.z += p.speed * speed * dt;
        if (p.s.position.z > 11) { p.s.position.z -= 27; p.s.position.x = R(-7, 7); }
      }
    }

    return { setTheme, tick, theme: () => THEMES[theme], group };
  }

  // ---------------------------------------------------------------- effects

  function makeFx(scene) {
    const pool = [];
    const live = [];
    function get(map) {
      let s = pool.pop();
      if (!s) {
        s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
        s.renderOrder = 5;
      }
      s.material.map = map;
      s.material.color.set('#ffffff');
      s.material.opacity = 1;
      s.material.rotation = 0;
      s.material.blending = T.NormalBlending;
      s.material.depthTest = true;
      s.material.needsUpdate = true;
      s.visible = true;
      scene.add(s);
      return s;
    }
    // o: { map, x, y, z, vx, vy, vz, life, size, grow, spin, g (gravity), drag, color, additive, fade, onTop }
    function add(o) {
      const s = get(o.map);
      if (o.color) s.material.color.set(o.color);
      if (o.additive) s.material.blending = T.AdditiveBlending;
      if (o.onTop) { s.material.depthTest = false; s.renderOrder = 9; } else s.renderOrder = 5;
      s.position.set(o.x, o.y === undefined ? AIR : o.y, o.z);
      const p = Object.assign({ s, vx: 0, vy: 0, vz: 0, life: 1, age: 0, size: 0.5, grow: 0, spin: 0, g: 0, drag: 0, fade: 0.4, rot: 0 }, o);
      p.rot = o.rot || 0;
      s.scale.set(p.size, p.size, 1);
      live.push(p);
      return p;
    }
    function update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.age += dt;
        if (p.age >= p.life) {
          p.s.visible = false;
          scene.remove(p.s);
          pool.push(p.s);
          live.splice(i, 1);
          continue;
        }
        p.vy -= p.g * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vz *= d;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.position.z += p.vz * dt;
        const k = p.age / p.life;
        let sc = p.size + p.grow * p.age;
        if (p.pop) sc *= k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1;
        p.s.scale.set(sc * (p.sx || 1), sc, 1);
        p.rot += p.spin * dt;
        p.s.material.rotation = p.rot;
        p.s.material.opacity = (k > 1 - p.fade ? (1 - k) / p.fade : 1) * (p.alpha || 1);
      }
    }
    function clear() {
      for (const p of live) { p.s.visible = false; scene.remove(p.s); pool.push(p.s); }
      live.length = 0;
    }
    const starTex = () => G.emojiTexture('⭐');
    // positions here are world x, z at the game's height
    function puff(x, z, n = 6, color = '#ffffff', spread = 1.4) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        add({ map: tex.dot, x, z, vx: Math.cos(a) * R(0.5, spread), vy: R(0.2, 0.8), vz: Math.sin(a) * R(0.5, spread), life: R(0.45, 0.8), size: R(0.4, 0.7), grow: 1.0, drag: 3, color, fade: 0.7 });
      }
    }
    function stars(x, z, n = 8, speed = 3) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        add({ map: starTex(), x, z, vx: Math.cos(a) * R(1, speed), vy: R(0.5, 2), vz: Math.sin(a) * R(1, speed), g: 3, life: R(0.6, 1.0), size: R(0.25, 0.42), spin: R(-6, 6), drag: 1.6, fade: 0.4 });
      }
    }
    function word(x, z, text, fill, size = 1.3) {
      add({ map: burstTexture(text, fill), x, y: AIR + 1.2, z, vz: -0.5, life: 0.8, size, pop: true, fade: 0.35, onTop: true, rot: R(-0.25, 0.25) });
    }
    function points(x, z, n) {
      const p = add({ map: textTexture('+' + n), x, y: AIR + 1, z, vz: -0.9, life: 0.9, size: 0.7, sx: 2.6, fade: 0.4, onTop: true });
      p.s.scale.set(1.8, 0.7, 1);
    }
    function sparkle(x, z, size = 1.2, life = 0.5) {
      add({ map: tex.sparkle, x, y: AIR + 0.3, z, life, size, grow: (-size * 1.4) / life, spin: 3, additive: true, fade: 0.5 });
    }
    function confetti(x, z, n = 30) {
      const cols = ['#ffd400', '#ff3d7f', '#18d4ff', '#7dff5a', '#ffffff', '#ff8a1f'];
      for (let i = 0; i < n; i++) {
        add({ map: tex.dot, x: x + R(-5, 5), y: AIR + R(1.5, 3), z: z + R(-6, 2), vx: R(-0.5, 0.5), vy: R(-0.4, 0.4), vz: R(0.5, 2), g: 0.6, drag: 1.2, life: R(1.6, 2.6), size: R(0.14, 0.24), color: G.pick(cols), fade: 0.3, sx: 0.6, onTop: true });
      }
    }
    function emoji(ch, x, z, o = {}) {
      return add(Object.assign({ map: G.emojiTexture(ch), x, z, life: 1, size: 0.6, fade: 0.3 }, o));
    }
    return { add, update, clear, puff, stars, word, points, sparkle, confetti, emoji, live };
  }

  // a basketball hoop for Teddy's slam dunk
  function buildHoop() {
    const g = new T.Group();
    const board = box(2.0, 1.3, 0.08, mat('#ffffff'), 0, 0.95, -0.55, g);
    board.rotation.x = -TILT;
    box(0.9, 0.6, 0.09, mat('#e53935'), 0, 0.85, -0.5, g).rotation.x = -TILT;
    const rim = add(cached('rim', () => new T.TorusGeometry(0.55, 0.06, 8, 24)), mat('#ff6a1f', { roughness: 0.4 }), 0, 0.25, 0, g);
    rim.rotation.x = Math.PI / 2;
    add(cached('net', () => new T.CylinderGeometry(0.55, 0.32, 0.6, 14, 1, true)), new T.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.8 }), 0, -0.05, 0, g);
    return g;
  }

  SKY.art = {
    AIR, TILT, LEAN, wz, tex, THEMES, PLANES, POWER_LOOK, INK,
    initTextures, spriteOf, burstTexture, textTexture, powerTexture, powerIcon,
    addPilot, buildPlane, addShield, addHalo, addMagnet, buildDrone, buildUfo, buildCloud, buildBlimp, buildBalloon, buildBoss, buildHoop,
    shotView, bulletView, itemView, makeWorld, makeFx,
  };
})();

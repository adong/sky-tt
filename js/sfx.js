/* Sky TT: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);

  // The stage-start jingle: a bouncy take-off tune of our own (C major, square lead over a triangle bass).
  const JINGLE = [
    [523, 0.0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.2], [988, 0.55, 0.1], [1047, 0.65, 0.1], [1175, 0.75, 0.1], [1568, 0.88, 0.35],
  ];
  const JBASS = [[131, 0.0], [196, 0.3], [175, 0.55], [262, 0.88]];

  SKY.sfx = {
    jingle() {
      for (const [f, at, dur] of JINGLE) tone({ type: 'square', f, at, dur, vol: 0.07, lp: 3200 });
      for (const [f, at] of JBASS) tone({ type: 'triangle', f, at, dur: 0.22, vol: 0.22 });
      hiss({ f: 800, to: 3000, dur: 0.9, vol: 0.05, q: 0.6 }); // a propeller whoosh under it
    },
    // a soft "pup" for the brothers' shots (only every few shots, so auto-fire isn't noisy)
    shot(kind) {
      if (kind === 'ball') tone({ type: 'triangle', f: 240, to: 420, dur: 0.07, vol: 0.06 });
      else tone({ type: 'triangle', f: 1400, to: 1800, dur: 0.06, vol: 0.04 });
    },
    tick() { tone({ type: 'square', f: 900 + Math.random() * 200, dur: 0.025, vol: 0.025, lp: 3000 }); },
    // an enemy goes BONK into fruit and coins
    pop(big) {
      tone({ type: 'square', f: big ? 220 : 420, to: big ? 90 : 160, dur: 0.12, vol: 0.07, lp: 2200 });
      hiss({ filter: 'lowpass', f: 2600, to: 400, dur: big ? 0.4 : 0.2, vol: big ? 0.22 : 0.12 });
      [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.06 + i * 0.04, dur: 0.09, vol: 0.05 }));
    },
    foeShot(kind) {
      if (kind === 'goo') tone({ type: 'sine', f: 300, to: 140, dur: 0.12, vol: 0.06 });
      else if (kind === 'drop' || kind === 'snow') tone({ type: 'sine', f: 900, to: 500, dur: 0.08, vol: 0.04 });
      else tone({ type: 'square', f: 900, to: 400, dur: 0.08, vol: 0.025, lp: 2400 });
    },
    bossHit() { tone({ type: 'triangle', f: 160, to: 110, dur: 0.06, vol: 0.12 }); },
    bossDown() {
      hiss({ filter: 'lowpass', f: 3200, to: 120, dur: 1.2, vol: 0.45 });
      tone({ f: 140, to: 40, dur: 0.9, vol: 0.4 });
      for (let i = 0; i < 8; i++) tone({ type: 'triangle', f: 700 + i * 160, at: 0.3 + i * 0.07, dur: 0.12, vol: 0.07 });
    },
    // your plane gets bonked: a cartoon boing and a slide down
    bonk() {
      tone({ f: 260, to: 90, dur: 0.14, vol: 0.32 });
      tone({ type: 'square', f: 660, to: 220, at: 0.06, dur: 0.4, vol: 0.06, lp: 1800 });
      hiss({ filter: 'lowpass', f: 2000, to: 300, dur: 0.35, vol: 0.18 });
    },
    boing() { tone({ type: 'sine', f: 300, to: 700, dur: 0.18, vol: 0.14 }); },
    item(n) { S.coin(n); },
    power() { S.powerup(); },
    heart() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.1, vol: 0.06, lp: 3500 })); },
    shield() { hiss({ f: 1200, to: 5000, dur: 0.4, vol: 0.1, q: 3 }); tone({ type: 'sine', f: 600, to: 1200, dur: 0.35, vol: 0.08 }); },
    magnet() { for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 400 + i * 120, to: 900 + i * 120, at: i * 0.06, dur: 0.12, vol: 0.06 }); },
    powerAppear() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.09, vol: 0.07 })); },
    // Teddy's slam dunk: the ball whooshes up, then BOOM and a bouncy echo
    slamUp() { hiss({ f: 400, to: 3000, dur: 0.7, vol: 0.12, q: 1.5 }); tone({ type: 'triangle', f: 200, to: 800, dur: 0.7, vol: 0.08 }); },
    slam() {
      tone({ f: 110, to: 35, dur: 0.7, vol: 0.5 });
      hiss({ filter: 'lowpass', f: 2500, to: 100, dur: 0.9, vol: 0.4 });
      [0.25, 0.45, 0.6].forEach((at, i) => tone({ type: 'triangle', f: 330 - i * 50, to: 200, at, dur: 0.1, vol: 0.12 / (i + 1) }));
    },
    // Tommy's peace wave: a shimmering rising chord
    wave() {
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.4, vol: 0.07 }));
      hiss({ filter: 'highpass', f: 4000, to: 8000, dur: 1.0, vol: 0.06 });
    },
    // the boss is coming: a cartoon "uh-oh" siren
    warning() { for (let i = 0; i < 4; i++) tone({ type: 'square', f: i % 2 ? 440 : 587, at: i * 0.32, dur: 0.28, vol: 0.06, lp: 2000 }); },
    hello() { // the companion's horn: beep-beep!
      tone({ type: 'square', f: 660, dur: 0.1, vol: 0.06, lp: 2400 });
      tone({ type: 'square', f: 880, at: 0.14, dur: 0.14, vol: 0.06, lp: 2400 });
    },
    treat() { S.coin(3); tone({ type: 'triangle', f: 1568, at: 0.12, dur: 0.2, vol: 0.1 }); },
    save() {
      tone({ type: 'triangle', f: 880, dur: 0.1, vol: 0.12 });
      tone({ type: 'triangle', f: 1320, at: 0.08, dur: 0.25, vol: 0.12 });
      hiss({ f: 2500, to: 6000, dur: 0.3, vol: 0.08 });
    },
    // the high five: a clap and a happy run up
    cheer() {
      hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.4, q: 1.2 });
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: 0.08 + i * 0.07, dur: 0.14, vol: 0.1 }));
    },
    nope() { tone({ type: 'square', f: 200, dur: 0.08, vol: 0.05, lp: 1200 }); tone({ type: 'square', f: 160, at: 0.09, dur: 0.1, vol: 0.05, lp: 1200 }); },
    fanfare() {
      const notes = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.78], [784, 0.9], [1047, 1.05]];
      for (const [f, at] of notes) tone({ type: 'square', f, at, dur: at >= 1.05 ? 0.55 : 0.13, vol: 0.07, lp: 3600 });
      for (const [f, at] of [[131, 0], [196, 0.36], [262, 0.6], [196, 0.9], [262, 1.05]]) tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.22 });
    },
    sad() {
      [392, 370, 349].forEach((f, i) => tone({ type: 'sawtooth', f, to: f * 0.97, at: i * 0.35, dur: 0.32, vol: 0.06, lp: 1200 }));
      tone({ type: 'sawtooth', f: 330, to: 260, at: 1.05, dur: 0.9, vol: 0.07, lp: 1100 });
    },
    back() { [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.12, vol: 0.09 })); },
    tally() { tone({ type: 'square', f: 1200, dur: 0.03, vol: 0.04, lp: 4000 }); },
    click() { S.click(); },
    swish() { S.swish(); },
  };
})();

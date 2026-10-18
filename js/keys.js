/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: SKY.TITLE, // the name lives in js/title.js
  cols: ['Teddy (1P)', 'Tommy (2P)'],
  keys: [
    ['fly (it fires by itself)', 'W A S D', '↑ ← ↓ →'],
    ['slam dunk 🏀 · peace wave ✌️', 'Space or F', 'L'],
    ['call your brother · high five', 'T', 'Enter'],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: Teddy · Tommy · both · easy', '1 2 3 E', ''],
  ],
  note: 'Playing alone, the arrows fly too, and T or Enter calls your brother as often as you like.',
  touch: 'Drag anywhere and the plane follows your finger. The big 🏀 / ✌️ button is the super move; the face button calls your brother. Two players: each drags on their own half.',
});

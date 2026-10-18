/* 中文 for Sky TT: the words on the page, the toasts, the banners and the ? panel (Kit.lang, from kit/lang.js).
   The word bursts drawn in 3D (BONK!, SAVED!...) go through Kit.lang.t() in js/art.js.
   The kids' names and the game's name (SKY TT) stay in English on purpose. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY & TOMMY', 'TEDDY + TOMMY', 'SKY', 'SKY TT', 'Sky TT', 'TT', 'Claude Code',
    'TOMMY 2P', 'Teddy (1P)', 'Tommy (2P)', 'Esc']);

  const STAGES = {
    BACKYARD: '后院', 'BIG CITY': '大城市', 'SUNNY BEACH': '阳光海滩', 'FARM FIELDS': '农场', 'CLOUD KINGDOM': '云朵王国',
    'SNOWY MOUNTAINS': '雪山', 'CANDY LAND': '糖果乐园', 'NIGHT CITY': '夜晚的城市', 'THE MOON': '月球', 'OUTER SPACE': '外太空',
  };
  const BOSSES = { 'BIG ZOM BLIMP': '僵尸大飞艇', STORMY: '暴脾气乌云', 'BIG BOLT': '大头 BOLT', 'KING UFO': '飞碟大王' };
  const SPECIALS = { 'SLAM DUNK': '灌篮', 'PEACE WAVE': '比耶冲击波' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add(Object.assign({}, STAGES, BOSSES, SPECIALS, {
    // the stages' one-liners
    'Robot drones over the garden!': '机器人无人机飞过花园！',
    'UFOs above the rooftops!': '屋顶上空有飞碟！',
    'Look out for the Big Zom Blimp!': '小心僵尸大飞艇！',
    'Grumpy clouds over the barn!': '谷仓上空飘来了生气的云！',
    'Stormy is very grumpy today!': '暴脾气乌云今天超级生气！',
    'The clouds throw snowballs!': '云朵会扔雪球！',
    'Everything down there is sweets!': '下面全是糖果！',
    'Big Bolt wakes up at night!': '大头 BOLT 晚上醒来啦！',
    'UFOs everywhere!': '到处都是飞碟！',
    'The King UFO is waiting!': '飞碟大王在等你！',

    // title screen
    'Fly your toy plane and bonk the zombie blimps!': '开着玩具飞机，把僵尸飞艇打下来！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players together · key 3': '双人一起玩 · 按 3',
    '🐣 EASY': '🐣 简单', 'more hearts, slow bullets': '爱心多，子弹慢', '🔥 NORMAL': '🔥 普通', 'for big kids': '大孩子玩',
    Difficulty: '难度',
    '1 PLAYER · TEDDY 1P': '单人 · TEDDY 1P',
    'fly (it fires by itself)': '飞（会自动发射）',
    'slam dunk · peace wave': '灌篮 · 比耶冲击波',
    'easy ·': '简单 ·', stage: '选关',
    'double shot': '双发', 'spread shot': '散射', shield: '护盾', magnet: '磁铁', 'extra heart': '加一颗心',
    'one more 🏀 / ✌️ super move': '多一次 🏀 / ✌️ 超级绝招',
    "Drag anywhere and your plane follows your finger (it fires by itself). The big button is your super move, and your brother's face calls him in. Two players on an iPad: each drags on their own half.":
      '在屏幕上随便拖，飞机就跟着手指飞（会自动发射）。大按钮是超级绝招，点兄弟的头像就能叫他来帮忙。两个人玩 iPad：各拖自己那一半。',
    'LOADING…': '加载中…',

    // the HUD
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'he blocks hits': '他帮你挡住攻击', 'HIGH FIVE!': '击掌！',

    // pause, stage clear, game over, the end
    '↻ RESTART STAGE': '↻ 重玩这关',
    'P · Esc · Space to resume · R restart · Q menu · M sound': 'P · Esc · 空格 继续 · R 重玩 · Q 回菜单 · M 声音',
    'NEXT STAGE ▶': '下一关 ▶', 'Enter · Space next · Esc menu': '回车 · 空格 下一关 · Esc 回菜单',
    bonked: '打败', coins: '金币', fruit: '水果', stars: '星星', hearts: '爱心', score: '得分',
    '💥 bonked': '💥 打败', '🍎 fruit': '🍎 水果', '⭐ stars': '⭐ 星星', '❤️ hearts': '❤️ 爱心',
    'Great teamwork, brothers!': '兄弟俩配合得真棒！',
    'OH NO!': '哎呀！', '↻ TRY AGAIN': '↻ 再试一次', 'Enter try again · Esc menu': '回车 再试一次 · Esc 回菜单',
    'YOU SAVED THE SKY!': '你们拯救了天空！', 'Enter · Esc menu': '回车 · Esc 回菜单',

    // banners
    '⚠️ LOOK OUT!': '⚠️ 小心！', 'GOT BONKED!': '被打败啦！', 'STAGE CLEAR!': '过关啦！', 'YOU DID IT!': '你们做到啦！',

    // toasts
    '🎆 SPREAD SHOT!': '🎆 散射！', '🎆 BIG SPREAD!': '🎆 大散射！', '🎆 SUPER FAST SPREAD!': '🎆 超快散射！',
    '🛡️ SHIELD ON!': '🛡️ 护盾打开！', '🧲 MAGNET! EVERYTHING COMES TO YOU!': '🧲 磁铁！东西都飞过来啦！',
    '❤️ HEARTS FULL! +1000': '❤️ 爱心满啦！+1000', '❤️ +1 HEART!': '❤️ 多一颗心！',
    'BROTHER POWER! 🛡️': '兄弟力量！🛡️',

    // the word bursts in 3D (drawn on a canvas, through Kit.lang.t in js/art.js)
    'BONK!': '砰！', 'BONK!!': '砰砰！', 'POP!': '啪！', 'BOINK!': '咚！', 'POW!': '嘭！', 'BOING!': '嘣！', 'SAVED!': '救下啦！',
    'SLAM DUNK!': '灌篮！', 'PEACE WAVE!': '比耶冲击波！',

    // the ? panel (js/keys.js)
    'slam dunk 🏀 · peace wave ✌️': '灌篮 🏀 · 比耶冲击波 ✌️',
    'title: Teddy · Tommy · both · easy': '标题页：Teddy · Tommy · 双人 · 简单',
    'Playing alone, the arrows fly too, and T or Enter calls your brother as often as you like.':
      '一个人玩时，方向键也能飞。按 T 或回车叫兄弟来帮忙，想叫几次都行。',
    "Drag anywhere and the plane follows your finger. The big 🏀 / ✌️ button is the super move; the face button calls your brother. Two players: each drags on their own half.":
      '在屏幕上随便拖，飞机就跟着手指飞。大 🏀 / ✌️ 按钮是超级绝招，头像按钮叫兄弟来帮忙。两个人玩：各拖自己那一半。',
  }));

  const t = (s) => L.t(s);
  const list = (o) => Object.keys(o).join('|');
  // "STAGE 3 CLEAR!" before the plain "STAGE 3" (the stage picker adds ⭐ and 👑 after it)
  L.rule(/^STAGE (\d+) CLEAR!$/, '第 $1 关过关！');
  L.rule(/^STAGE (\d+)((?: ⭐| 👑)*)$/, '第 $1 关$2');
  L.rule(/^BEST (\d+)$/, '最高分 $1');
  L.rule(new RegExp(`^(${list(STAGES)}) · (.+)$`), (m, a, b) => `${t(a)} · ${t(b)}`);
  L.rule(/^(.+) IS COMING!$/, (m, who) => `${t(who)}来啦！`);
  L.rule(/^CALL (\w+)$/, '叫 $1');
  L.rule(/^(\w+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^HERE COMES (\w+)!$/, '$1 来啦！');
  L.rule(/^(\w+) STAYS LONGER!$/, '$1 多陪你一会儿！');
  L.rule(/^(\w+) NEEDS A HIGH FIVE! \(T\)$/, '$1 需要击掌！(T)');
  L.rule(/^(\w+) IS BACK!$/, '$1 回来啦！');
  L.rule(new RegExp(`^(\\S+) \\+1 (${list(SPECIALS)})!$`), (m, e, sp) => `${e} 多一次${SPECIALS[sp]}！`);
  L.rule(new RegExp(`^NO (${list(SPECIALS)}) LEFT — CATCH A 🌟$`), (m, sp) => `${SPECIALS[sp]}用完啦，快接 🌟！`);
  L.rule(new RegExp(`^(\\S+) (${list(TREAT)}) FROM (\\w+)!$`), (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(\S+) (DOUBLE|TRIPLE|MEGA) SHOT!$/, (m, e, n) => `${e} ${{ DOUBLE: '双发', TRIPLE: '三发', MEGA: '超级四发' }[n]}！`);
  L.rule(/^(\w+) saved you (\d+) times?!$/, '$1 救了你 $2 次！');
  L.rule(/^Next stop: (.+)!$/, (m, s) => `下一站：${t(s)}！`);
  L.rule(/^The (.+) was too bonky this time\. Try again with full hearts!$/, (m, s) => `${t(s.toUpperCase())}这关有点难！加满爱心再试一次吧！`);
  L.rule(/^The King UFO got bonked! Score (\d+)\. The zombie blimps say sorry\.$/, '飞碟大王被打败啦！得分 $1。僵尸飞艇说对不起！');
})();

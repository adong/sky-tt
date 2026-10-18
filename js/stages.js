/* Sky TT: the 10 stages. Each stage is a list of waves, played in order.

   A wave is [gap, pattern, foe, count, option]:
     gap      seconds after the previous wave started (on Easy every gap is a little longer)
     pattern  how the foes fly in:
                snake   one after another down a wiggly line          option L, R or C (where it starts)
                swoop   one after another, a curve across the screen  option L or R (the corner they come from)
                line    a row across the top, straight down
                vee     a V shape that stops, waits and shoots, then carries on down
                hover   come down, wait and shoot, then fly back up
                strafe  across the screen from one side               option L or R
                drift   big slow ones, drifting down
                dive    quick straight dives from random spots
     foe      drone, ufo, cloud or blimp
     count    how many (Easy has fewer)
   A power-up balloon is [gap, 'carrier', power, x]: power is double, spread, shield, magnet, heart or super.

   A stage with `boss` ends with that boss once its waves are done; the others end when the last wave has gone.
   `node tools/check.js` checks these and plays them all. */
(function () {
  'use strict';
  const SKY = (window.SKY = window.SKY || {});

  SKY.STAGES = [
    {
      name: 'BACKYARD', theme: 'yard', tag: 'Robot drones over the garden!',
      waves: [
        [2.0, 'snake', 'drone', 5, 'L'],
        [3.5, 'snake', 'drone', 5, 'R'],
        [3.5, 'carrier', 'double', -2],
        [2.0, 'line', 'drone', 4],
        [3.5, 'drift', 'cloud', 2],
        [4.0, 'swoop', 'drone', 6, 'L'],
        [3.5, 'swoop', 'drone', 6, 'R'],
        [4.0, 'hover', 'drone', 3],
        [4.5, 'carrier', 'shield', 2],
        [2.0, 'snake', 'drone', 6, 'C'],
        [4.0, 'drift', 'cloud', 3],
        [4.5, 'vee', 'drone', 5],
        [4.5, 'carrier', 'super', 0],
        [2.0, 'swoop', 'drone', 5, 'L'],
        [1.5, 'swoop', 'drone', 5, 'R'],
      ],
    },
    {
      name: 'BIG CITY', theme: 'city', tag: 'UFOs above the rooftops!',
      waves: [
        [2.0, 'swoop', 'drone', 6, 'R'],
        [3.5, 'swoop', 'drone', 6, 'L'],
        [3.5, 'strafe', 'ufo', 3, 'L'],
        [4.0, 'carrier', 'spread', 2],
        [2.0, 'snake', 'drone', 6, 'L'],
        [1.5, 'snake', 'drone', 6, 'R'],
        [4.0, 'drift', 'blimp', 1],
        [4.5, 'hover', 'ufo', 3],
        [5.0, 'line', 'drone', 5],
        [3.0, 'carrier', 'heart', -2],
        [2.0, 'strafe', 'ufo', 3, 'R'],
        [4.0, 'vee', 'drone', 7],
        [4.5, 'dive', 'drone', 6],
        [4.0, 'carrier', 'super', 2],
        [2.0, 'swoop', 'drone', 6, 'L'],
        [1.5, 'swoop', 'drone', 6, 'R'],
      ],
    },
    {
      name: 'SUNNY BEACH', theme: 'beach', boss: 'blimp', tag: 'Look out for the Big Zom Blimp!',
      waves: [
        [2.0, 'snake', 'drone', 6, 'C'],
        [3.5, 'drift', 'cloud', 2],
        [3.5, 'swoop', 'drone', 6, 'L'],
        [3.0, 'carrier', 'double', 2],
        [2.0, 'drift', 'blimp', 2],
        [5.0, 'swoop', 'drone', 6, 'R'],
        [3.5, 'hover', 'ufo', 2],
        [4.5, 'dive', 'drone', 6],
        [4.0, 'carrier', 'shield', -2],
        [2.0, 'vee', 'drone', 7],
        [4.5, 'carrier', 'super', 0],
      ],
    },
    {
      name: 'FARM FIELDS', theme: 'farm', tag: 'Grumpy clouds over the barn!',
      waves: [
        [2.0, 'line', 'drone', 5],
        [3.0, 'line', 'drone', 4],
        [3.5, 'drift', 'cloud', 3],
        [4.0, 'carrier', 'spread', -2],
        [2.0, 'strafe', 'ufo', 3, 'R'],
        [4.0, 'swoop', 'drone', 7, 'L'],
        [3.5, 'drift', 'blimp', 2],
        [5.0, 'hover', 'drone', 5],
        [4.5, 'carrier', 'magnet', 2],
        [2.0, 'snake', 'drone', 6, 'L'],
        [1.5, 'snake', 'drone', 6, 'R'],
        [4.0, 'strafe', 'ufo', 4, 'L'],
        [4.5, 'vee', 'drone', 7],
        [4.0, 'carrier', 'heart', 0],
        [2.0, 'dive', 'drone', 8],
        [3.5, 'drift', 'cloud', 3],
      ],
    },
    {
      name: 'CLOUD KINGDOM', theme: 'clouds', boss: 'storm', tag: 'Stormy is very grumpy today!',
      waves: [
        [2.0, 'drift', 'cloud', 3],
        [4.0, 'swoop', 'drone', 6, 'L'],
        [3.5, 'swoop', 'drone', 6, 'R'],
        [3.5, 'carrier', 'double', 0],
        [2.0, 'hover', 'cloud', 3],
        [5.0, 'strafe', 'ufo', 3, 'L'],
        [4.0, 'drift', 'blimp', 2],
        [4.5, 'carrier', 'shield', -2],
        [2.0, 'snake', 'drone', 7, 'C'],
        [4.0, 'drift', 'cloud', 4],
        [4.5, 'carrier', 'super', 2],
      ],
    },
    {
      name: 'SNOWY MOUNTAINS', theme: 'snow', tag: 'The clouds throw snowballs!',
      waves: [
        [2.0, 'snake', 'drone', 6, 'L'],
        [3.5, 'drift', 'cloud', 3],
        [4.0, 'strafe', 'ufo', 4, 'R'],
        [4.0, 'carrier', 'spread', 2],
        [2.0, 'swoop', 'drone', 7, 'L'],
        [3.0, 'swoop', 'drone', 7, 'R'],
        [4.0, 'hover', 'ufo', 3],
        [5.0, 'drift', 'blimp', 2],
        [4.5, 'carrier', 'heart', -2],
        [2.0, 'dive', 'drone', 8],
        [4.0, 'vee', 'drone', 7],
        [4.5, 'drift', 'cloud', 4],
        [4.5, 'carrier', 'super', 0],
        [2.0, 'strafe', 'ufo', 4, 'L'],
        [3.5, 'snake', 'drone', 7, 'C'],
      ],
    },
    {
      name: 'CANDY LAND', theme: 'candy', tag: 'Everything down there is sweets!',
      waves: [
        [2.0, 'swoop', 'drone', 7, 'R'],
        [3.0, 'swoop', 'drone', 7, 'L'],
        [3.5, 'hover', 'ufo', 4],
        [5.0, 'carrier', 'double', -2],
        [2.0, 'drift', 'blimp', 2],
        [3.5, 'snake', 'drone', 7, 'L'],
        [1.5, 'snake', 'drone', 7, 'R'],
        [4.0, 'drift', 'cloud', 4],
        [4.5, 'carrier', 'shield', 2],
        [2.0, 'strafe', 'ufo', 4, 'R'],
        [3.5, 'vee', 'drone', 9],
        [4.5, 'dive', 'drone', 9],
        [4.0, 'carrier', 'heart', 0],
        [2.0, 'hover', 'drone', 6],
        [5.0, 'drift', 'blimp', 3],
      ],
    },
    {
      name: 'NIGHT CITY', theme: 'night', boss: 'bolt', tag: 'Big Bolt wakes up at night!',
      waves: [
        [2.0, 'snake', 'drone', 7, 'R'],
        [3.5, 'strafe', 'ufo', 4, 'L'],
        [4.0, 'carrier', 'spread', 0],
        [2.0, 'swoop', 'drone', 7, 'L'],
        [3.0, 'swoop', 'drone', 7, 'R'],
        [4.0, 'drift', 'blimp', 2],
        [4.5, 'hover', 'ufo', 4],
        [5.0, 'carrier', 'shield', -2],
        [2.0, 'vee', 'drone', 9],
        [4.5, 'carrier', 'super', 2],
        [2.0, 'dive', 'drone', 8],
      ],
    },
    {
      name: 'THE MOON', theme: 'moon', tag: 'UFOs everywhere!',
      waves: [
        [2.0, 'strafe', 'ufo', 4, 'R'],
        [4.0, 'strafe', 'ufo', 4, 'L'],
        [4.0, 'carrier', 'double', 2],
        [2.0, 'snake', 'drone', 8, 'C'],
        [4.0, 'hover', 'ufo', 5],
        [5.5, 'drift', 'blimp', 3],
        [5.0, 'carrier', 'heart', -2],
        [2.0, 'swoop', 'drone', 8, 'L'],
        [3.0, 'swoop', 'drone', 8, 'R'],
        [4.0, 'dive', 'drone', 10],
        [4.5, 'carrier', 'magnet', 0],
        [2.0, 'vee', 'ufo', 5],
        [5.0, 'strafe', 'ufo', 5, 'R'],
        [4.0, 'carrier', 'super', 2],
        [2.0, 'hover', 'drone', 6],
      ],
    },
    {
      name: 'OUTER SPACE', theme: 'space', boss: 'king', tag: 'The King UFO is waiting!',
      waves: [
        [2.0, 'swoop', 'drone', 8, 'L'],
        [3.0, 'swoop', 'drone', 8, 'R'],
        [3.5, 'hover', 'ufo', 5],
        [5.0, 'carrier', 'spread', 0],
        [2.0, 'drift', 'blimp', 3],
        [5.0, 'strafe', 'ufo', 5, 'L'],
        [4.0, 'carrier', 'shield', 2],
        [2.0, 'vee', 'drone', 9],
        [4.5, 'dive', 'drone', 10],
        [4.0, 'carrier', 'heart', -2],
        [2.0, 'carrier', 'super', 2],
      ],
    },
  ];
})();

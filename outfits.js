/* WATSONATOR outfits and the achievements that unlock them.

   Kept out of index.html because none of it needs the DOM: every outfit is a
   builder handed the same box/mat helpers the dog itself is made from, and
   every achievement is a plain function of the saved stats. index.html does the
   wiring - counting, painting the wardrobe, putting the clothes on.

   All coordinates are Watson's own space, before DOG_SCALE. For reference:
   his body sits at y 1.55 and its top is y 2.13, the collar is at z 1.42, and
   the head group's origin is the middle of his skull.

   The camera chases him from behind and above, so his chest is never in shot.
   Anything meant to be noticed belongs on his back, his flanks, the top of his
   head or his tail; front detail is for the moments he turns. */
'use strict';
(function () {

/* Townsfolk stand about 2.9 units tall, so a unit is roughly 0.6 m. Distances
   in the stats are already converted, and are honest metres. */
const M_PER_UNIT = 0.6;
const MILE = 1609;

/* The numbers index.html has to test against at the end of a round. They live
   here so the criterion a player reads and the check that awards it cannot
   drift apart. Tuned against real play, not the theoretical maximum: a strong
   time trial lands around 3000, nowhere near the 11470 the scoring allows. */
const T = {
  crownScore:    3000,   // in a single time trial
  fastWinClock:  20,     // seconds still on the clock at a win
  sheriffClock:  40      // seconds into the round, both of them found
};

/* the palette, so an outfit reads as one idea rather than ten loose boxes */
const C = {
  ball:   0xd6e84c, ballLine: 0xf7f2e0,
  black:  0x15151b, white: 0xf7f2e0,
  bee:    0xffc021, wing: 0xcfe8f5,
  glass:  0x5fc8e8, tube: 0xff7a3d, band: 0xff7a3d,
  gold:   0xffd23f, jewel: 0xff5964,
  red:    0xc03a3a, hotred: 0xe2483f,
  denim:  0x3a4a7a, stud: 0xc9c4b4,
  tan:    0xb98a4e, star: 0xffd23f
};

/* ---------------------------------------------------------------------------
   the outfits

   build(api) gets { box, mat, parts } and returns the meshes it added, so
   taking an outfit off is just removing what it put on. An outfit may also
   return a fur recolour; index.html restores the default when it changes.
   --------------------------------------------------------------------------- */
const OUTFITS = [
  {
    key: 'ball', name: 'TENNIS BALL',
    criterion: 'FETCH THE BALL IN 5 ROUNDS',
    need: 5, have: s => s.ballRounds,
    fur: { fur: C.ball, fur2: 0xc2d442 },
    build({ box, mat, parts }) {
      const line = mat(C.ballLine);
      const added = [];
      // the two seams, over the back and down each flank
      for (const sx of [-1, 1]) {
        added.push(box(0.12, 1.2, 0.5, line, sx * 0.78, 1.62, 0.3));
        added.push(box(1.5, 0.12, 0.45, line, 0, 2.11, sx * 0.85));
      }
      for (const m of added) parts.dog.add(m);
      return added;
    }
  },
  {
    key: 'tux', name: 'TUXEDO',
    criterion: 'EVERY BISCUIT IN ONE ROUND',
    need: 1, have: s => s.sweeps,
    fur: { fur: C.black, fur2: 0x22222a },
    build({ box, mat, parts }) {
      const white = mat(C.white), black = mat(C.black);
      // His fur goes black for this one, so from behind only the white reads.
      const added = [
        box(0.8, 0.72, 0.14, white, 0, 1.5, 1.62),        // shirt front
        box(0.3, 0.16, 0.12, black, 0, 1.9, 1.95),        // bow tie, middle
        box(0.16, 0.26, 0.1, black, -0.2, 1.9, 1.95),
        box(0.16, 0.26, 0.1, black, 0.2, 1.9, 1.95),
        box(0.62, 0.5, 0.16, black, 0, 1.44, 1.66),       // lapels sit over the shirt
        box(1.74, 0.18, 0.4, white, 0, 2.18, 0.78)        // wing collar, across the shoulders
      ];
      // the tailcoat's split, two white lines running back over the haunches
      for (const sx of [-1, 1]) added.push(box(0.14, 0.12, 2.0, white, sx * 0.56, 2.17, -0.5));
      for (const m of added) parts.dog.add(m);
      const tip = box(0.32, 0.32, 0.42, white, 0, 0.15, -1.12);   // white-tipped tail
      parts.tail.add(tip);
      added.push(tip);
      // cuffs, one per leg, so they swing with the stride
      for (const leg of parts.legs) {
        const cuff = box(0.46, 0.18, 0.5, white, 0, -0.7, 0.04);
        leg.add(cuff);
        added.push(cuff);
      }
      return added;
    }
  },
  {
    key: 'bee', name: 'BEE',
    criterion: 'RUN A MILE IN TOTAL',
    need: MILE, have: s => s.dist, unit: 'm',
    fur: { fur: C.bee, fur2: 0xe0a615 },
    build({ box, mat, parts }) {
      const black = mat(C.black);
      const wing = mat(C.wing, { transparent: true, opacity: 0.5 });
      const added = [];
      const onDog  = m => { parts.dog.add(m);  added.push(m); return m; };
      const onHead = m => { parts.head.add(m); added.push(m); return m; };
      for (const z of [0.7, -0.1, -0.9]) onDog(box(1.66, 1.2, 0.34, black, 0, 1.56, z));
      for (const sx of [-1, 1]) {
        onDog(box(1.5, 0.1, 0.95, wing, sx * 0.9, 2.3, -0.2));        // flat over the back
        onHead(box(0.08, 0.5, 0.08, black, sx * 0.22, 0.66, 0.1));    // antenna
        onHead(box(0.2, 0.2, 0.2, black, sx * 0.22, 0.92, 0.1));      // and its tip
      }
      return added;
    }
  },
  {
    key: 'snorkel', name: 'SNORKEL',
    criterion: 'SWIM 200 METRES IN TOTAL',
    need: 200, have: s => s.swimDist, unit: 'm',
    build({ box, mat, parts }) {
      const glass = mat(C.glass, { transparent: true, opacity: 0.72 });
      const rubber = mat(C.black), tube = mat(C.tube), band = mat(C.band);
      const added = [
        box(1.08, 0.34, 0.14, rubber, 0, 0.18, 0.56),     // mask strap across the eyes
        box(0.9, 0.28, 0.1, glass, 0, 0.18, 0.63),
        box(0.14, 0.9, 0.14, tube, 0.6, 0.6, 0.3),        // the snorkel itself
        box(0.14, 0.14, 0.34, tube, 0.6, 1.0, 0.42)
      ];
      for (const m of added) parts.head.add(m);
      // armbands, front legs only
      for (const i of [0, 1]) {
        const arm = box(0.54, 0.34, 0.58, band, 0, -0.34, 0.02);
        parts.legs[i].add(arm);
        added.push(arm);
      }
      return added;
    }
  },
  {
    key: 'bling', name: 'BLING',
    criterion: 'COLLECT 25 GOLDEN BISCUITS',
    need: 25, have: s => s.golden,
    build({ box, mat, parts }) {
      const gold = mat(C.gold), jewel = mat(C.jewel);
      const added = [
        box(1.12, 0.2, 0.94, gold, 0, 1.93, 1.44),        // the chain, over his collar
        box(0.34, 0.42, 0.14, gold, 0, 1.64, 1.86),       // a medallion, hanging
        box(0.5, 0.16, 0.16, gold, 0, 1.72, 1.9),
        // the half he is actually seen from: chain over the shoulders, and a
        // second medallion lying flat on his back
        box(1.3, 0.18, 0.46, gold, 0, 2.17, 0.72),
        box(0.66, 0.14, 0.66, gold, 0, 2.18, 0.0),
        box(0.28, 0.17, 0.28, jewel, 0, 2.19, 0.0)
      ];
      for (const m of added) parts.dog.add(m);
      const tip = box(0.34, 0.34, 0.38, gold, 0, 0.15, -1.1);      // gold-tipped tail
      parts.tail.add(tip);
      added.push(tip);
      return added;
    }
  },
  {
    key: 'bib', name: 'RACING BIB',
    criterion: 'WIN WITH ' + T.fastWinClock + ' SECONDS LEFT',
    need: 1, have: s => s.fastWins,
    build({ box, mat, parts }) {
      const white = mat(C.white), red = mat(C.hotred);
      const added = [];
      for (const sx of [-1, 1]) {
        added.push(box(0.12, 0.9, 1.3, white, sx * 0.8, 1.6, -0.1));
        added.push(box(0.14, 0.52, 0.16, red, sx * 0.84, 1.62, -0.1));   // a number 1
        added.push(box(0.14, 0.16, 0.34, red, sx * 0.84, 1.36, -0.18));
      }
      added.push(box(1.62, 0.16, 0.5, white, 0, 2.12, 0.5));             // over the shoulders
      for (const m of added) parts.dog.add(m);
      return added;
    }
  },
  {
    key: 'punk', name: 'PUNK',
    criterion: 'BARK 250 TIMES',
    need: 250, have: s => s.barks,
    build({ box, mat, parts }) {
      const red = mat(C.hotred), stud = mat(C.stud), leather = mat(C.black);
      const added = [];
      // a mohawk, tallest in the middle
      [[-0.32, 0.26], [-0.16, 0.42], [0, 0.52], [0.16, 0.42], [0.32, 0.26]].forEach(([z, h]) => {
        const spike = box(0.12, h, 0.16, red, 0, 0.48 + h / 2, z);
        parts.head.add(spike);
        added.push(spike);
      });
      const collar = box(1.1, 0.3, 0.96, leather, 0, 1.95, 1.42);
      parts.dog.add(collar);
      added.push(collar);
      for (const sx of [-1, 0, 1]) {
        const s = box(0.14, 0.14, 0.14, stud, sx * 0.34, 2.06, 1.42);
        parts.dog.add(s);
        added.push(s);
      }
      return added;
    }
  },
  {
    key: 'cape', name: 'CAPE',
    criterion: 'WIN 10 ROUNDS',
    need: 10, have: s => s.wins,
    build({ box, mat, parts }) {
      const red = mat(C.red), gold = mat(C.gold);
      // Rotating about x lifts the trailing edge when the angle is POSITIVE.
      // It was negative, which drove the far end down through his back and tail.
      const cape = box(1.7, 0.12, 2.5, red, 0, 2.58, -0.85);
      cape.rotation.x = 0.28;                              // streams up and back
      const clasp = box(0.9, 0.22, 0.22, gold, 0, 2.26, 0.55);
      const added = [cape, clasp];
      for (const m of added) parts.dog.add(m);
      return added;
    }
  },
  {
    key: 'crown', name: 'CROWN',
    criterion: 'SCORE ' + T.crownScore + ' IN ONE TIME TRIAL',
    need: 1, have: s => s.crowns,
    build({ box, mat, parts }) {
      const gold = mat(C.gold), jewel = mat(C.jewel);
      const added = [box(1.0, 0.24, 1.0, gold, 0, 0.6, 0)];
      for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36], [0, 0]]) {
        added.push(box(0.2, 0.34, 0.2, gold, x, 0.86, z));
      }
      added.push(box(0.22, 0.22, 0.12, jewel, 0, 0.62, 0.52));
      for (const m of added) parts.head.add(m);
      return added;
    }
  },
  {
    key: 'sheriff', name: 'SHERIFF',
    criterion: 'FIND THEM BOTH WITHIN ' + T.sheriffClock + ' SECONDS',
    need: 1, have: s => s.sheriffs,
    build({ box, mat, parts }) {
      const tan = mat(C.tan), band = mat(0x6b4a24), star = mat(C.star);
      const added = [
        box(1.7, 0.12, 1.7, tan, 0, 0.58, 0),             // brim
        box(0.8, 0.42, 0.8, tan, 0, 0.82, 0),             // crown of the hat
        box(0.84, 0.12, 0.84, band, 0, 0.66, 0)
      ];
      for (const m of added) parts.head.add(m);
      const badge = box(0.55, 0.55, 0.14, star, 0.32, 1.5, 1.63);   // still on his chest, bigger
      badge.rotation.z = 0.4;
      parts.dog.add(badge);
      added.push(badge);
      // and a big one lying flat on his back, where it can be seen: three bars
      // crossed at sixty degrees read as a star from above
      for (let i = 0; i < 3; i++) {
        const bar = box(1.0, 0.12, 0.24, star, 0, 2.19, -0.15);
        bar.rotation.y = i * Math.PI / 3;
        parts.dog.add(bar);
        added.push(bar);
      }
      const pip = box(0.32, 0.14, 0.32, star, 0, 2.2, -0.15);
      parts.dog.add(pip);
      added.push(pip);
      return added;
    }
  }
];

/* ---------------------------------------------------------------------------
   the icons

   One 24x24 pixel drawing per outfit, as rects. The wardrobe paints them in
   colour once earned and as a flat shadow before that, so the shape is a tease
   and nothing more.
   --------------------------------------------------------------------------- */
const ICONS = {
  ball:    [[6,6,12,12,'#d6e84c'],[6,6,12,2,'#f7f2e0'],[6,16,12,2,'#f7f2e0'],[11,6,2,12,'#c2d442']],
  tux:     [[7,4,10,16,'#15151b'],[10,6,4,12,'#f7f2e0'],[9,4,6,3,'#15151b'],[10,7,4,3,'#15151b']],
  bee:     [[5,8,14,10,'#ffc021'],[5,10,14,2,'#15151b'],[5,14,14,2,'#15151b'],[3,5,7,4,'#cfe8f5'],[14,5,7,4,'#cfe8f5']],
  snorkel: [[4,9,16,5,'#15151b'],[6,10,12,3,'#5fc8e8'],[16,3,3,8,'#ff7a3d'],[16,3,4,3,'#ff7a3d']],
  bling:   [[4,8,16,3,'#ffd23f'],[10,11,4,5,'#ffd23f'],[9,16,6,3,'#ffd23f']],
  bib:     [[6,5,12,14,'#f7f2e0'],[11,8,2,8,'#e2483f'],[9,14,6,2,'#e2483f']],
  punk:    [[5,14,14,5,'#15151b'],[7,16,2,2,'#c9c4b4'],[11,16,2,2,'#c9c4b4'],[15,16,2,2,'#c9c4b4'],
            [8,8,2,6,'#e2483f'],[11,5,2,9,'#e2483f'],[14,8,2,6,'#e2483f']],
  cape:    [[6,4,12,4,'#ffd23f'],[4,8,16,12,'#c03a3a'],[8,8,8,12,'#a62f2f']],
  crown:   [[5,11,14,6,'#ffd23f'],[5,5,3,7,'#ffd23f'],[11,3,3,9,'#ffd23f'],[17,5,3,7,'#ffd23f'],[10,12,4,4,'#ff5964']],
  sheriff: [[3,12,18,3,'#b98a4e'],[7,5,10,7,'#b98a4e'],[6,10,12,2,'#6b4a24'],[9,16,6,6,'#ffd23f']]
};

/** an outfit's icon as inline svg. Locked, every rect goes flat and dark. */
function icon(key, locked) {
  const rects = (ICONS[key] || []).map(([x, y, w, h, fill]) =>
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="' + (locked ? '#000' : fill) + '"/>').join('');
  return '<svg viewBox="0 0 24 24" width="100%" height="100%" shape-rendering="crispEdges"' +
         (locked ? ' opacity="0.42"' : '') + '>' + rects + '</svg>';
}

/* ---------------------------------------------------------------------------
   progress
   --------------------------------------------------------------------------- */
const BLANK = {
  ballRounds: 0, sweeps: 0, dist: 0, swimDist: 0, golden: 0,
  barks: 0, wins: 0, fastWins: 0, crowns: 0, sheriffs: 0
};

/** a saved blob from any older version still has to come back whole */
function normalise(raw) {
  const s = Object.assign({}, BLANK);
  if (raw && typeof raw === 'object') {
    for (const k in BLANK) {
      const v = Number(raw[k]);
      if (isFinite(v) && v > 0) s[k] = v;
    }
  }
  return s;
}

/** where one outfit stands: how far along, and whether that is far enough */
function progress(o, stats) {
  const have = Math.max(0, Math.floor(o.have(stats) || 0));
  return {
    key: o.key, name: o.name, criterion: o.criterion,
    have, need: o.need, unit: o.unit || '',
    unlocked: have >= o.need,
    // a one-shot has nothing worth counting out loud
    countable: o.need > 1
  };
}

window.Wardrobe = {
  MILE, M_PER_UNIT, T,
  outfits: OUTFITS,
  byKey: key => OUTFITS.find(o => o.key === key) || null,
  icon, normalise, progress,
  blank: () => Object.assign({}, BLANK),
  /** every outfit's standing, in display order */
  survey: stats => OUTFITS.map(o => progress(o, stats)),
  unlockedKeys: stats => OUTFITS.filter(o => progress(o, stats).unlocked).map(o => o.key)
};

})();

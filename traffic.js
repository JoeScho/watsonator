/* WATSONATOR traffic: which road a car is on, and what it does at a junction.

   No THREE, no DOM - just where a car is and where it goes next, so the
   turning geometry can be tested on its own. index.html owns the models, the
   braking and the squashing; this owns the path.

   Axes: x runs east, z runs south, so the sea is at low z. Traffic drives on
   the right, which is what decides every lane offset and which way a turn goes.

   Why cars turn at all: the side streets dead-end at the coast road, so there
   is no off-map source for southbound traffic. The old code solved that by
   teleporting a car onto the seafront junction, which put it in plain sight
   about 11 units from a player standing on the promenade - a car blinking into
   existence at the water's edge. Cars now enter only from the far ends of the
   east-west roads, beyond fog from anywhere in bounds, and reach the side
   streets by turning into them. */
'use strict';
(function () {

const HALF_PI = Math.PI / 2;

const NET = {
  roadsX: [], roadsZ: [],
  lane: 2,
  edge: 290,        // where cars enter and leave, far beyond fog
  turnChance: 0.28
};

function configure(o) {
  NET.roadsX = (o.roadsX || []).slice();
  NET.roadsZ = (o.roadsZ || []).slice();
  if (o.lane !== undefined) NET.lane = o.lane;
  if (o.edge !== undefined) NET.edge = o.edge;
  if (o.turnChance !== undefined) NET.turnChance = o.turnChance;
}

/** the lane centre for a road: right-hand traffic, so the sign flips with axis.
    Heading east you keep to the south side; heading south you keep to the west. */
function laneOf(horiz, road, dir) {
  return horiz ? road + dir * NET.lane : road - dir * NET.lane;
}

/** a turn is a right turn when the heading rotates clockwise seen from above */
function isRight(fromHoriz, dA, dB) {
  return fromHoriz ? dB === dA : dB === -dA;
}

function radius(fromHoriz, dA, dB) {
  return isRight(fromHoriz, dA, dB) ? NET.lane : NET.lane * 3;
}

/** the roads that cross the one this car is driving on */
function crossings(c) { return c.horiz ? NET.roadsX : NET.roadsZ; }

/** is there another road beyond `from`, travelling `dir` along `list`? */
function beyond(list, from, dir) {
  for (const v of list) if ((v - from) * dir > 0) return true;
  return false;
}

/** the next junction ahead of the car, or null */
function nextJunction(c) {
  let best = null;
  for (const j of crossings(c)) {
    if ((j - c.p) * c.dir <= 0) continue;
    if (best === null || Math.abs(j - c.p) < Math.abs(best - c.p)) best = j;
  }
  return best;
}

/* An east-west road runs off both sides of the map, so a car on one can always
   carry straight on and can always be turned onto. A side street only exists
   between the east-west roads, so both continuing along one and turning into
   one require another east-west road further on. */
function canContinue(c, j) {
  return c.horiz ? true : beyond(NET.roadsZ, j, c.dir);
}
function canEnter(c, dB) {
  return c.horiz ? beyond(NET.roadsZ, c.road, dB) : true;
}

/** which way this car turns at j: +1, -1, or null for straight on */
function chooseTurn(c, j, random) {
  const rand = random || Math.random;
  const opts = [];
  for (const dB of [1, -1]) if (canEnter(c, dB)) opts.push(dB);
  if (!opts.length) return null;
  // at the end of a side street there is nowhere to go but round the corner
  if (canContinue(c, j) && rand() > NET.turnChance) return null;
  return opts.length === 1 ? opts[0] : opts[rand() < 0.5 ? 0 : 1];
}

/* The arc. Working in (A, B) where A is the axis the car is already driving
   along and B is the one it is crossing, both ends of a 90 degree turn are a
   radius from the same centre and at right angles to each other, so the path is
   just one radius vector swung onto the other. */
function beginTurn(c, j, dB) {
  const R = radius(c.horiz, c.dir, dB);
  const outLane = laneOf(!c.horiz, j, dB);   // still a coordinate on the A axis
  const cA = outLane - R * c.dir;
  const cB = c.lane + R * dB;
  c.turn = {
    cA, cB, R, j, dB, outLane,
    a0: 0,          b0: -R * dB,             // start, on the lane it came in on
    a1: R * c.dir,  b1: 0,                   // end, on the lane it leaves by
    s: 0, len: R * HALF_PI
  };
}

function finishTurn(c) {
  const t = c.turn;
  c.horiz = !c.horiz;
  c.dir = t.dB;
  c.road = t.j;
  c.lane = t.outLane;
  c.p = t.cB;
  c.turn = null;
  c.skip = null;
}

/** off one end of an east-west road and back on at the other, far out of sight */
function recycle(c) {
  if (c.turn || !c.horiz) return false;
  if (c.dir > 0 && c.p > NET.edge)  { c.p = -NET.edge; c.skip = null; return true; }
  if (c.dir < 0 && c.p < -NET.edge) { c.p =  NET.edge; c.skip = null; return true; }
  return false;
}

/** move a car `dist` along its path, turning at junctions as it goes */
function advance(c, dist, random) {
  if (!(dist > 0)) return;
  if (c.turn) {
    c.turn.s += dist / c.turn.len;
    if (c.turn.s < 1) return;
    const over = (c.turn.s - 1) * c.turn.len;
    finishTurn(c);
    advance(c, over, random);
    return;
  }
  c.p += dist * c.dir;
  const j = nextJunction(c);
  if (j !== null && c.skip !== j) {
    // the turn begins two lane widths short of the junction centre, which is
    // where both the tight and the wide arc happen to start
    const entry = j - c.dir * 2 * NET.lane;
    const over = (c.p - entry) * c.dir;
    if (over >= 0) {
      // A car that was already past the entry point before this step - which is
      // how one spawns mid-block - cannot be dragged back to it without visibly
      // jumping backwards. It has missed the turn, so it carries straight on.
      const dB = over > dist + 1e-9 ? null : chooseTurn(c, j, random);
      if (dB !== null) {
        c.p = entry;
        beginTurn(c, j, dB);
        advance(c, over, random);
        return;
      }
      c.skip = j;
    }
  }
  recycle(c);
}

/** where the car is now, and which way it is pointing */
function place(c) {
  if (!c.turn) {
    const vx = c.horiz ? c.dir : 0, vz = c.horiz ? 0 : c.dir;
    return {
      x: c.horiz ? c.p : c.lane,
      z: c.horiz ? c.lane : c.p,
      yaw: Math.atan2(vx, vz) - HALF_PI,
      turning: 0
    };
  }
  const t = c.turn, a = t.s * HALF_PI, co = Math.cos(a), si = Math.sin(a);
  const A  = t.cA + t.a0 * co + t.a1 * si;
  const B  = t.cB + t.b0 * co + t.b1 * si;
  const vA = -t.a0 * si + t.a1 * co;
  const vB = -t.b0 * si + t.b1 * co;
  const vx = c.horiz ? vA : vB, vz = c.horiz ? vB : vA;
  return {
    x: c.horiz ? A : B,
    z: c.horiz ? B : A,
    yaw: Math.atan2(vx, vz) - HALF_PI,
    turning: Math.min(1, t.s)
  };
}

/** a car on a road, ready to drive */
function make(horiz, dir, road, p) {
  return { horiz, dir, road, lane: laneOf(horiz, road, dir), p, turn: null, skip: null };
}

window.Traffic = {
  configure, make, advance, place, recycle,
  laneOf, isRight, radius, nextJunction, chooseTurn, canContinue, canEnter,
  net: () => NET
};

})();

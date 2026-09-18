/* WATSONATOR global leaderboard - the whole client half.

   One board, the time trial. Free roam is played against nobody and posts
   nothing, so it never comes through here.

   Talks to two Postgres functions through Supabase's REST endpoint with plain
   fetch. No library, no build step, nothing to deploy: see leaderboard.sql for
   the other half.

   Everything here fails soft. If the project is not configured, or the network
   is out, or Supabase is having a day, the game carries on exactly as it did
   before and the board quietly says so. */
'use strict';
(function () {

/* ===========================================================================
   CONFIGURE ME
   ---------------------------------------------------------------------------
   From your Supabase project: Settings, then API.
     URL      the Project URL, https://something.supabase.co
     ANON_KEY the anon public key - the publishable one, NOT the service role
   Leave them empty and the game runs with the leaderboard switched off.
   =========================================================================== */
const URL      = 'https://wjjeatlrzuaidzvoybpt.supabase.co';
const ANON_KEY = 'sb_publishable_D08dtBfi0UA81gbwDTQwVA_fFURWWoN';

const TIMEOUT = 8000;          // a dead network shouldn't hold the score screen
const NAME_KEY = 'watsonator.name';
const MAX_NAME = 16;           // the database trims to this too

const configured = !!(URL && ANON_KEY);

/** one POST to a Postgres function, with a timeout and a readable error */
async function rpc(fn, body) {
  if (!configured) throw new Error('LEADERBOARD NOT SET UP');
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT);
  let res;
  try {
    res = await fetch(URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      signal: stop.signal,
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('LEADERBOARD OFFLINE');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // anything the SQL raised comes back here as a sentence worth showing
    let msg = '';
    try { msg = (await res.json()).message || ''; } catch (e) {}
    throw new Error((msg || 'LEADERBOARD OFFLINE').toUpperCase());
  }
  if (res.status === 204) return null;
  try { return await res.json(); } catch (e) { return null; }
}

window.Board = {
  configured,
  MAX_NAME,

  /** the name they used last time, so nobody types it twice */
  name() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  },
  remember(n) {
    try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
  },

  /** the top ten, best first, one row per player: names are folded without
      case, so a player only appears once, at their best */
  top(limit) {
    return rpc('top_scores', { p_limit: limit || 10 });
  },

  /** throws with something printable if the database turns it down */
  submit(score, name) {
    return rpc('submit_score', { p_name: name, p_score: score });
  }
};

})();

-- WATSONATOR global leaderboard
-- ---------------------------------------------------------------------------
-- Paste the whole file into the Supabase SQL editor and run it once. Running it
-- again is safe: everything here is create-if-not-exists or create-or-replace.
--
-- The shape of the thing: anon can touch neither the table nor its rows. RLS is
-- on and there is deliberately not a single policy, so the only way in or out is
-- through the two security definer functions at the bottom, which run as the
-- owner and do the checking on the way past.
--
-- One board, the time trial. Free roam has no clock to race, so it posts
-- nothing and nothing here knows about it.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null,
  score      integer     not null,
  ip         text        not null default 'unknown',   -- rate limiting only, never read back out
  created_at timestamptz not null default now()
);

/* A table from before the single board holds a mode per row, so the free roam
   rounds go and the column that told the two apart goes with them. Guarded, so
   the file still re-runs. */
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'scores'
                and column_name = 'mode') then
    delete from public.scores where mode is distinct from 'challenge';
    alter table public.scores drop column mode;   -- takes its indexes with it
  end if;
end;
$$;

-- the board query: a player's rounds together, their best first
drop index if exists public.scores_board_idx;
create index if not exists scores_player_idx on public.scores (lower(name), score desc, created_at);
-- the rate limit check
create index if not exists scores_rate_idx  on public.scores (ip, created_at desc);

/* An empty board looks broken, so Watson and five of his friends start on it
   with something to beat. Matched by name without case, the way the board
   itself folds them, so running the file again does not stack them up. Their ip
   is 'seed' rather than the 'unknown' a real submission falls back to, so six
   rows appearing at once cannot spend anybody's rate limit. */
insert into public.scores (name, score, ip)
select v.name, v.score, 'seed'
from (values ('Watson', 500), ('Ruby', 600), ('Fletcher', 700),
             ('Misty', 800), ('Ted', 900), ('Gizmo', 1000)) as v(name, score)
where not exists (select 1 from public.scores s where lower(s.name) = lower(v.name));

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

/* ---------------------------------------------------------------------------
   submitting

   The ceiling is the real theoretical maximum of a round, not a guess. 22
   biscuits, each worth at most 60 (golden) times a streak multiplier capped at
   6, is 7920. The ball is 250. Mumma and Dadda are 200 each and the reunion
   bonus is 500, so 900. The time bonus is 20 a second against a 120 second
   clock, so 2400 more. That is 11470, with a little headroom for future tuning.

   If you change the scoring in index.html, change this to match, or a good
   round will start bouncing.
   --------------------------------------------------------------------------- */

-- the old two board signatures, which took a mode
drop function if exists public.submit_score(text, text, integer);
drop function if exists public.top_scores(text, integer);

create or replace function public.submit_score(p_name text, p_score integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- PostgREST hands the original client address along in x-forwarded-for; the
  -- first entry is the caller, the rest are proxies. Absent outside PostgREST.
  v_ip   text := coalesce(
                   nullif(btrim(split_part(
                     current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
                   'unknown');
  v_name text := nullif(btrim(p_name), '');
begin
  if p_score is null or p_score < 1 or p_score > 12000 then
    raise exception 'that score is not possible';
  end if;

  if v_name is null then
    raise exception 'name required';
  end if;
  v_name := left(v_name, 16);

  -- a short, blunt list. Extend it when someone inevitably tries harder.
  if v_name ~* '(fuck|shit|cunt|bitch|nigg|wank|twat|dick|piss|rape|nazi|hitler)' then
    raise exception 'pick another name';
  end if;

  if (select count(*) from public.scores
       where ip = v_ip and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'too many submissions, wait a minute';
  end if;

  insert into public.scores (name, score, ip)
  values (v_name, p_score, v_ip);
end;
$$;

/* ---------------------------------------------------------------------------
   reading the board

   A function rather than a select on the table so that the ip column has no
   route out of the database at all.

   One line per player, not per round. Names are matched without case, so
   joescho and JOESCHO are the same person and only their best round shows. The
   spelling on the board is the one they used for that best round. The limit is
   applied after the folding, so ten rows means ten different players.
   --------------------------------------------------------------------------- */
create or replace function public.top_scores(p_limit integer default 10)
returns table (pos integer, name text, score integer, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  with best as (
    select distinct on (lower(s.name)) s.name, s.score, s.created_at
    from public.scores s
    order by lower(s.name), s.score desc, s.created_at
  )
  select (row_number() over (order by b.score desc, b.created_at))::integer,
         b.name, b.score, b.created_at
  from best b
  order by b.score desc, b.created_at
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

grant execute on function public.submit_score(text, integer) to anon, authenticated;
grant execute on function public.top_scores(integer)         to anon, authenticated;

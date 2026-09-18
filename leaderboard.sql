-- WATSONATOR global leaderboard
-- ---------------------------------------------------------------------------
-- Paste the whole file into the Supabase SQL editor and run it once. Running it
-- again is safe: everything here is create-if-not-exists or create-or-replace.
--
-- The shape of the thing: anon can touch neither the table nor its rows. RLS is
-- on and there is deliberately not a single policy, so the only way in or out is
-- through the two security definer functions at the bottom, which run as the
-- owner and do the checking on the way past.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null,
  mode       text        not null,
  score      integer     not null,
  ip         text        not null default 'unknown',   -- rate limiting only, never read back out
  created_at timestamptz not null default now()
);

-- the board query: one mode, best first, oldest wins a tie
create index if not exists scores_board_idx on public.scores (mode, score desc, created_at);
-- the rate limit check
create index if not exists scores_rate_idx  on public.scores (ip, created_at desc);

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

/* ---------------------------------------------------------------------------
   submitting

   The ceilings are the real theoretical maximum of a round, not a guess. 22
   biscuits, each worth at most 60 (golden) times a streak multiplier capped at
   6, is 7920. The ball is 250. Mumma and Dadda are 200 each and the reunion
   bonus is 500, so 900. Challenge adds the time bonus, 20 a second against a
   90 second clock, so 1800 more. That puts challenge at 10870 and free roam,
   which banks no clock, at 9070. Both get a little headroom for future tuning.

   If you change the scoring in index.html, change these to match, or a good
   round will start bouncing.
   --------------------------------------------------------------------------- */
create or replace function public.submit_score(p_name text, p_mode text, p_score integer)
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
  v_cap  integer;
begin
  if p_mode is null or p_mode not in ('challenge', 'roam') then
    raise exception 'unknown mode';
  end if;

  v_cap := case p_mode when 'challenge' then 11000 else 9500 end;
  if p_score is null or p_score < 1 or p_score > v_cap then
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

  insert into public.scores (name, mode, score, ip)
  values (v_name, p_mode, p_score, v_ip);
end;
$$;

/* ---------------------------------------------------------------------------
   reading the board

   A function rather than a select on the table so that the ip column has no
   route out of the database at all.
   --------------------------------------------------------------------------- */
create or replace function public.top_scores(p_mode text, p_limit integer default 10)
returns table (pos integer, name text, score integer, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select (row_number() over (order by s.score desc, s.created_at))::integer,
         s.name, s.score, s.created_at
  from public.scores s
  where s.mode = p_mode
  order by s.score desc, s.created_at
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

grant execute on function public.submit_score(text, text, integer) to anon, authenticated;
grant execute on function public.top_scores(text, integer)         to anon, authenticated;

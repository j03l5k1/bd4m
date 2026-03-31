create extension if not exists pgcrypto;

create table if not exists public.motm_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  nominee_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint motm_votes_one_vote_per_player unique (game_id, voter_player_id),
  constraint motm_votes_no_self_vote check (voter_player_id <> nominee_player_id)
);

create index if not exists motm_votes_game_id_idx on public.motm_votes (game_id);
create index if not exists motm_votes_nominee_player_id_idx on public.motm_votes (nominee_player_id);

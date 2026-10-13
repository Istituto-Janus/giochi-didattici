-- Additive migration. Existing Janus tables and policies are untouched.
create schema jwc_private;
revoke all on schema jwc_private from public, anon, authenticated;
grant usage on schema jwc_private to service_role;
create table jwc_private.games (
 id uuid primary key default gen_random_uuid(), owner_hash text not null,
 title text not null check (char_length(title) between 1 and 120),
 language text not null check(language in ('it','en','es','fr','de')),
 letters text not null check(char_length(letters)=6),
 target integer not null check(target between 1 and 500),
 duration integer check(duration between 10 and 3600), retries boolean not null,
 solutions text[] not null check(cardinality(solutions)>0),
 lexicon_version text not null, deleted_at timestamptz, created_at timestamptz not null default now()
);
create index jwc_games_owner_date on jwc_private.games(owner_hash,created_at desc);
create table jwc_private.sessions (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 game_id uuid not null references jwc_private.games(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 1 and 32), nickname_key text not null,
 started_at timestamptz not null default now(), deadline timestamptz not null,
 finished_at timestamptz, found text[] not null default '{}', score integer not null default 0
);
create index jwc_sessions_game_nickname on jwc_private.sessions(game_id,nickname_key);
create index jwc_sessions_game_finished on jwc_private.sessions(game_id,finished_at desc) where finished_at is not null;
create table jwc_private.rates(scope text not null,bucket bigint not null,hits integer not null,primary key(scope));
alter table jwc_private.games enable row level security;
alter table jwc_private.sessions enable row level security;
alter table jwc_private.rates enable row level security;
grant all on all tables in schema jwc_private to service_role;
create function jwc_private.board(gid uuid) returns jsonb language sql security invoker set search_path='' as $$
 with best as (
 select distinct on (nickname_key) nickname_key,nickname,score,cardinality(found) as words
 from jwc_private.sessions where game_id=gid and finished_at is not null
 order by nickname_key,score desc,finished_at asc
 ), ranked as (select nickname_key,nickname,score,words,row_number() over(order by score desc,nickname_key asc) as rank from best)
 select coalesce(jsonb_agg(to_jsonb(ranked) order by rank),'[]'::jsonb) from ranked;
$$;
revoke all on function jwc_private.board(uuid) from public,anon,authenticated;
grant execute on function jwc_private.board(uuid) to service_role;
create function public.jwc_dispatch(op text,p jsonb,actor text,ip_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jwc_private.games%rowtype; s jwc_private.sessions%rowtype;
 v jsonb; b jsonb; hits integer; v_bucket bigint; lim integer; w text; pts integer;
begin
 v_bucket:=floor(extract(epoch from clock_timestamp())/60)::bigint;
 lim:=case when op in ('create','delete','rename','start') then 30 else 180 end;
 insert into jwc_private.rates values((mod(abs(hashtext(ip_hash)::bigint),4096))::text||':'||op,v_bucket,1)
 on conflict(scope) do update set bucket=excluded.bucket,hits=case when jwc_private.rates.bucket=excluded.bucket then jwc_private.rates.hits+1 else 1 end returning rates.hits into hits;
 if hits>lim then return jsonb_build_object('error','rate_limit','status',429); end if;
 insert into jwc_private.rates values('global:'||op,v_bucket,1)
 on conflict(scope) do update set bucket=excluded.bucket,hits=case when jwc_private.rates.bucket=excluded.bucket then jwc_private.rates.hits+1 else 1 end returning rates.hits into hits;
 if hits>(case when op='create' then 100 else 3000 end) then return jsonb_build_object('error','rate_limit','status',429); end if;
 -- Rate counters occupy at most 4096 slots per operation; old windows reset on upsert.
 if op in ('bootstrap','preview','generate') then return jsonb_build_object('ok',true); end if;
 if op='archive' then
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v from (select id,title,language,letters,target,duration,retries,created_at from jwc_private.games where owner_hash=actor and deleted_at is null order by created_at desc limit 200) x;
 return jsonb_build_object('games',v);
 elsif op='create' then
 if (select count(*) from jwc_private.games where owner_hash=actor and deleted_at is null)>=200 then return jsonb_build_object('error','archive_limit','status',409); end if;
 insert into jwc_private.games(owner_hash,title,language,letters,target,duration,retries,solutions,lexicon_version)
 values(actor,p->>'title',p->>'language',p->>'letters',(p->>'target')::integer,(p->>'duration')::integer,(p->>'retries')::boolean,array(select jsonb_array_elements_text(p->'solutions')),p->>'lexicon_version') returning * into g;
 return jsonb_build_object('id',g.id,'title',g.title);
 elsif op in ('word','state','finish','solutions') then
 select * into s from jwc_private.sessions where token_hash=p->>'token_hash' for update;
 if not found then return jsonb_build_object('error','session_missing','status',404); end if;
 select * into g from jwc_private.games where id=s.game_id and deleted_at is null;
 if not found then return jsonb_build_object('error','game_missing','status',404); end if;
 if s.finished_at is null and clock_timestamp()>=s.deadline then
 update jwc_private.sessions set finished_at=deadline where id=s.id returning * into s;
 end if;
 if op='word' and s.finished_at is null then
 w:=p->>'word';
 if w=any(s.found) then return jsonb_build_object('error','duplicate','status',409,'score',s.score); end if;
 if not(w=any(g.solutions)) then return jsonb_build_object('error','invalid_word','status',422,'score',s.score); end if;
 pts:=case char_length(w) when 3 then 10 when 4 then 20 when 5 then 30 when 6 then 50 else 0 end;
 update jwc_private.sessions set found=array_append(jwc_private.sessions.found,w),score=score+pts where id=s.id returning * into s;
 end if;
 if op='finish' and s.finished_at is null then
 update jwc_private.sessions set finished_at=clock_timestamp() where id=s.id returning * into s;
 end if;
 if op='solutions' and s.finished_at is null then return jsonb_build_object('error','not_finished','status',403); end if;
 v:=jsonb_build_object('finished',s.finished_at is not null,'found',s.found,'score',s.score,'deadline',s.deadline,'server_time',clock_timestamp(),'nickname',s.nickname,'id',s.game_id);
 if s.finished_at is not null then
 b:=jwc_private.board(s.game_id);
 v:=v||jsonb_build_object('leaderboard',(select coalesce(jsonb_agg(e),'[]'::jsonb) from (select e-'nickname_key' as e from jsonb_array_elements(b) e limit 100) q),'rank',(select (e->>'rank')::integer from jsonb_array_elements(b) e where e->>'nickname_key'=s.nickname_key));
 if op='solutions' then v:=v||jsonb_build_object('solutions',g.solutions); end if;
 end if;
 return v;
 end if;
 select * into g from jwc_private.games where id=(p->>'id')::uuid and deleted_at is null;
 if not found then return jsonb_build_object('error','game_missing','status',404); end if;
 if op in ('rename','delete','register') and g.owner_hash<>actor then return jsonb_build_object('error','forbidden','status',403); end if;
 if op='game' then
 b:=jwc_private.board(g.id);
 return jsonb_build_object('id',g.id,'title',g.title,'language',g.language,'letters',g.letters,'target',g.target,'duration',g.duration,'retries',g.retries,'solution_count',cardinality(g.solutions),'leaderboard',(select coalesce(jsonb_agg(e),'[]'::jsonb) from (select e-'nickname_key' as e from jsonb_array_elements(b) e limit 100) q));
 elsif op='rename' then
 update jwc_private.games set title=p->>'title' where id=g.id;
 return jsonb_build_object('ok',true);
 elsif op='delete' then
 update jwc_private.games set deleted_at=clock_timestamp() where id=g.id;
 return jsonb_build_object('ok',true);
 elsif op='register' then
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v from (select nickname,finished_at as played_at,score,cardinality(jwc_private.sessions.found) as words from jwc_private.sessions where game_id=g.id and finished_at is not null order by finished_at desc limit 100 offset least(greatest(coalesce((p->>'offset')::integer,0),0),100000)) x;
 return jsonb_build_object('results',v);
 elsif op='start' then
 perform pg_advisory_xact_lock(hashtextextended(g.id::text||':'||(p->>'nickname_key'),0));
 if not g.retries and exists(select 1 from jwc_private.sessions where game_id=g.id and nickname_key=p->>'nickname_key') then return jsonb_build_object('error','retry_disabled','status',409); end if;
 insert into jwc_private.sessions(token_hash,game_id,nickname,nickname_key,deadline)
 values(p->>'token_hash',g.id,p->>'nickname',p->>'nickname_key',clock_timestamp()+make_interval(secs=>coalesce(g.duration,86400))) returning * into s;
 return jsonb_build_object('finished',false,'found',s.found,'score',0,'deadline',s.deadline,'server_time',clock_timestamp(),'nickname',s.nickname,'id',g.id);
 end if;
 return jsonb_build_object('error','invalid_operation','status',400);
end;
$$;
revoke all on function public.jwc_dispatch(text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.jwc_dispatch(text,jsonb,text,text) to service_role;

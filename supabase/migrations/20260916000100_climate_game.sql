-- 기후 탐험대: Supabase 데이터베이스 스키마
-- 모든 브라우저 요청은 Edge Function을 거칩니다. 테이블은 anon/authenticated에 비공개입니다.

create table if not exists public.results (
  id bigint generated always as identity primary key,
  submitted_at timestamptz not null default now(),
  game_session_id text not null unique check (char_length(game_session_id) between 8 and 100),
  class_name text not null check (char_length(class_name) between 1 and 20),
  student_number integer not null check (student_number between 1 and 999),
  nickname text not null check (char_length(nickname) between 1 and 30),
  character_name text not null default '',
  level integer not null default 1,
  exp integer not null default 0,
  gold integer not null default 0,
  total_questions integer not null,
  first_try_correct integer not null,
  total_wrong integer not null,
  accuracy numeric(5,2) not null,
  play_time integer not null default 0,
  visited_climates jsonb not null default '[]'::jsonb,
  climate_scores jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  exploration_score integer not null check (exploration_score between 0 and 1000),
  remaining_hp integer not null default 0,
  boss_complete boolean not null default false,
  completed_at timestamptz not null
);

create table if not exists public.responses (
  id bigint generated always as identity primary key,
  submitted_at timestamptz not null default now(),
  game_session_id text not null references public.results(game_session_id) on delete cascade,
  class_name text not null,
  student_number integer not null,
  nickname text not null,
  question_id text not null,
  climate text not null,
  first_choice text not null default '',
  correct_answer text not null default '',
  first_try boolean not null default false,
  wrong_count integer not null default 0
);

create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  ranking_enabled boolean not null default true,
  ranking_limit integer not null default 10 check (ranking_limit in (5, 10, 999)),
  ranking_mode text not null default 'best' check (ranking_mode in ('best', 'latest', 'first')),
  name_mode text not null default 'nickname' check (name_mode in ('nickname', 'name')),
  question_count integer not null default 11 check (question_count between 1 and 50),
  region_count integer not null default 4 check (region_count between 1 and 6),
  boss_count integer not null default 3 check (boss_count between 1 and 3),
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

create index if not exists results_class_name_idx on public.results(class_name);
create index if not exists results_student_idx on public.results(class_name, student_number);
create index if not exists results_submitted_at_idx on public.results(submitted_at desc);
create index if not exists responses_class_name_idx on public.responses(class_name);
create index if not exists responses_question_idx on public.responses(question_id);

alter table public.results enable row level security;
alter table public.responses enable row level security;
alter table public.settings enable row level security;

revoke all on table public.results from anon, authenticated;
revoke all on table public.responses from anon, authenticated;
revoke all on table public.settings from anon, authenticated;
revoke all on sequence public.results_id_seq from anon, authenticated;
revoke all on sequence public.responses_id_seq from anon, authenticated;

grant all on table public.results to service_role;
grant all on table public.responses to service_role;
grant all on table public.settings to service_role;
grant usage, select on sequence public.results_id_seq to service_role;
grant usage, select on sequence public.responses_id_seq to service_role;

comment on table public.results is '학생별 완료 결과. 브라우저 직접 접근 금지';
comment on table public.responses is '문제별 첫 응답 분석. 결과 삭제 시 함께 삭제';
comment on table public.settings is '기후 탐험대 수업 공개 설정 단일 행';

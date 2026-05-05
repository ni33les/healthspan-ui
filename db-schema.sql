-- MATTANUTRA database schema
-- Apply this file to the target PostgreSQL database used by DB_CONNECTION.
-- It is intentionally idempotent for a fresh or partially prepared UAT database.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_plan') then
    create type assessment_plan as enum ('precision', 'pro');
  end if;

  if not exists (select 1 from pg_type where typname = 'assessment_status') then
    create type assessment_status as enum (
      'captured',
      'queued',
      'preparing',
      'ready',
      'failed'
    );
  end if;
end $$;

-- Compatibility renames for earlier development table names.
do $$
begin
  if to_regclass('public.assessment_submissions') is not null
    and to_regclass('public.assessments') is null then
    alter table public.assessment_submissions rename to assessments;
  end if;

  if to_regclass('public.assessment_formulations') is not null
    and to_regclass('public.formulations') is null then
    alter table public.assessment_formulations rename to formulations;
  end if;
end $$;

create table if not exists assessments (
  plan_id uuid primary key,
  locale text not null default 'en' check (locale in ('en', 'th')),
  selected_plan assessment_plan null,
  status assessment_status not null default 'captured',
  answers jsonb not null default '{}'::jsonb,
  answer_summary jsonb not null default '{}'::jsonb,
  queue_position integer null,
  captured_at timestamptz not null default now(),
  plan_selected_at timestamptz null,
  processing_started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table assessments
  add column if not exists locale text not null default 'en',
  add column if not exists selected_plan assessment_plan null,
  add column if not exists status assessment_status not null default 'captured',
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists answer_summary jsonb not null default '{}'::jsonb,
  add column if not exists queue_position integer null,
  add column if not exists captured_at timestamptz not null default now(),
  add column if not exists plan_selected_at timestamptz null,
  add column if not exists processing_started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_locale_check'
  ) then
    alter table assessments
      add constraint assessments_locale_check check (locale in ('en', 'th'));
  end if;
end $$;

create index if not exists assessments_status_idx
  on assessments (status, captured_at desc);

create index if not exists assessments_plan_idx
  on assessments (selected_plan, captured_at desc);

create index if not exists assessments_answers_gin_idx
  on assessments using gin (answers jsonb_path_ops);

create table if not exists jobs (
  id uuid primary key,
  job_type text not null,
  plan_id uuid null references assessments(plan_id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'complete', 'failed')
  ),
  priority integer not null default 0,
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error_message text null,
  queued_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table jobs
  add column if not exists job_type text not null,
  add column if not exists plan_id uuid null references assessments(plan_id) on delete cascade,
  add column if not exists status text not null default 'queued',
  add column if not exists priority integer not null default 0,
  add column if not exists attempts integer not null default 0,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists error_message text null,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists failed_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_status_check'
  ) then
    alter table jobs
      add constraint jobs_status_check
      check (status in ('queued', 'running', 'complete', 'failed'));
  end if;
end $$;

create index if not exists jobs_queue_idx
  on jobs (status, priority desc, queued_at asc);

create index if not exists jobs_plan_type_idx
  on jobs (plan_id, job_type, status);

create table if not exists formulations (
  plan_id uuid not null references assessments(plan_id) on delete cascade,
  version integer not null default 1,
  formulation jsonb not null,
  model_version text null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, version)
);

alter table formulations
  add column if not exists version integer not null default 1,
  add column if not exists formulation jsonb not null,
  add column if not exists model_version text null,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists recommendations (
  plan_id uuid not null references assessments(plan_id) on delete cascade,
  version integer not null default 1,
  recommendations jsonb not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, version)
);

alter table recommendations
  add column if not exists version integer not null default 1,
  add column if not exists recommendations jsonb not null,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Earlier versions used plan_id as the sole primary key, which allowed only one
-- formulation/recommendation per assessment. The current model keeps the
-- assessment as the master record and stores versioned child rows.
do $$
declare
  current_pkey text;
begin
  select conname into current_pkey
  from pg_constraint
  where conrelid = 'public.formulations'::regclass
    and contype = 'p'
  limit 1;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.formulations'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (plan_id, version)'
  ) then
    if current_pkey is not null then
      execute format('alter table public.formulations drop constraint %I', current_pkey);
    end if;

    alter table public.formulations
      add constraint formulations_pkey primary key (plan_id, version);
  end if;

  select conname into current_pkey
  from pg_constraint
  where conrelid = 'public.recommendations'::regclass
    and contype = 'p'
  limit 1;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recommendations'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (plan_id, version)'
  ) then
    if current_pkey is not null then
      execute format('alter table public.recommendations drop constraint %I', current_pkey);
    end if;

    alter table public.recommendations
      add constraint recommendations_pkey primary key (plan_id, version);
  end if;
end $$;

create index if not exists formulations_latest_idx
  on formulations (plan_id, version desc, generated_at desc);

create index if not exists recommendations_latest_idx
  on recommendations (plan_id, version desc, generated_at desc);

-- DOADMIN may apply this script in UAT, but the application role should own
-- and be able to maintain the database objects afterwards.
alter schema public owner to mn;
grant usage, create on schema public to mn;

alter type assessment_plan owner to mn;
alter type assessment_status owner to mn;

alter table assessments owner to mn;
alter table jobs owner to mn;
alter table formulations owner to mn;
alter table recommendations owner to mn;

commit;

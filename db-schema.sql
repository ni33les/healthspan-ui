-- MATTANUTRA database schema
-- Re-runnable PostgreSQL schema for UAT/production.
-- Intended for copy/paste into the DigitalOcean database console.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_plan') then
    create type public.assessment_plan as enum ('precision', 'pro');
  end if;

  if not exists (select 1 from pg_type where typname = 'assessment_status') then
    create type public.assessment_status as enum (
      'captured',
      'queued',
      'preparing',
      'ready',
      'failed'
    );
  end if;
end $$;

alter type public.assessment_plan add value if not exists 'precision';
alter type public.assessment_plan add value if not exists 'pro';

alter type public.assessment_status add value if not exists 'captured';
alter type public.assessment_status add value if not exists 'queued';
alter type public.assessment_status add value if not exists 'preparing';
alter type public.assessment_status add value if not exists 'ready';
alter type public.assessment_status add value if not exists 'failed';

-- Compatibility renames for earlier development table names.
do $$
begin
  if to_regclass('public.assessment_submissions') is not null
    and to_regclass('public.assessments') is null then
    alter table public.assessment_submissions rename to assessments;
  end if;

  if to_regclass('public.formulation_jobs') is not null
    and to_regclass('public.jobs') is null then
    alter table public.formulation_jobs rename to jobs;
  end if;

  if to_regclass('public.assessment_formulations') is not null
    and to_regclass('public.formulations') is null then
    alter table public.assessment_formulations rename to formulations;
  end if;
end $$;

create table if not exists public.assessments (
  plan_id uuid primary key,
  locale text not null default 'en' check (locale in ('en', 'th')),
  selected_plan public.assessment_plan null,
  status public.assessment_status not null default 'captured',
  answers jsonb not null default '{}'::jsonb,
  answer_summary jsonb not null default '{}'::jsonb,
  queue_position integer null,
  error_message text null,
  captured_at timestamptz not null default now(),
  plan_selected_at timestamptz null,
  processing_started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.assessments
  add column if not exists locale text default 'en',
  add column if not exists selected_plan public.assessment_plan null,
  add column if not exists status public.assessment_status default 'captured',
  add column if not exists answers jsonb default '{}'::jsonb,
  add column if not exists answer_summary jsonb default '{}'::jsonb,
  add column if not exists queue_position integer null,
  add column if not exists error_message text null,
  add column if not exists captured_at timestamptz default now(),
  add column if not exists plan_selected_at timestamptz null,
  add column if not exists processing_started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists updated_at timestamptz default now();

update public.assessments
set
  locale = coalesce(locale, 'en'),
  status = coalesce(status, 'captured'),
  answers = coalesce(answers, '{}'::jsonb),
  answer_summary = coalesce(answer_summary, '{}'::jsonb),
  captured_at = coalesce(captured_at, now()),
  updated_at = coalesce(updated_at, now())
where locale is null
  or status is null
  or answers is null
  or answer_summary is null
  or captured_at is null
  or updated_at is null;

alter table public.assessments
  alter column locale set default 'en',
  alter column locale set not null,
  alter column status set default 'captured',
  alter column status set not null,
  alter column answers set default '{}'::jsonb,
  alter column answers set not null,
  alter column answer_summary set default '{}'::jsonb,
  alter column answer_summary set not null,
  alter column captured_at set default now(),
  alter column captured_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_locale_check'
  ) then
    alter table public.assessments
      add constraint assessments_locale_check check (locale in ('en', 'th'));
  end if;
end $$;

create index if not exists assessments_status_idx
  on public.assessments (status, captured_at desc);

create index if not exists assessments_plan_idx
  on public.assessments (selected_plan, captured_at desc);

create index if not exists assessments_answers_gin_idx
  on public.assessments using gin (answers jsonb_path_ops);

create table if not exists public.jobs (
  id uuid primary key,
  job_type text not null,
  plan_id uuid null references public.assessments(plan_id) on delete cascade,
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

alter table public.jobs
  add column if not exists job_type text,
  add column if not exists plan_id uuid null references public.assessments(plan_id) on delete cascade,
  add column if not exists status text default 'queued',
  add column if not exists priority integer default 0,
  add column if not exists attempts integer default 0,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists error_message text null,
  add column if not exists queued_at timestamptz default now(),
  add column if not exists started_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists failed_at timestamptz null,
  add column if not exists updated_at timestamptz default now();

update public.jobs
set
  job_type = coalesce(job_type, 'formulation'),
  status = case
    when status in ('queued', 'running', 'complete', 'failed') then status
    else 'queued'
  end,
  priority = coalesce(priority, 0),
  attempts = coalesce(attempts, 0),
  payload = coalesce(payload, '{}'::jsonb),
  queued_at = coalesce(queued_at, now()),
  updated_at = coalesce(updated_at, now())
where job_type is null
  or status is null
  or status not in ('queued', 'running', 'complete', 'failed')
  or priority is null
  or attempts is null
  or payload is null
  or queued_at is null
  or updated_at is null;

alter table public.jobs
  alter column job_type set not null,
  alter column status set default 'queued',
  alter column status set not null,
  alter column priority set default 0,
  alter column priority set not null,
  alter column attempts set default 0,
  alter column attempts set not null,
  alter column payload set default '{}'::jsonb,
  alter column payload set not null,
  alter column queued_at set default now(),
  alter column queued_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_status_check
      check (status in ('queued', 'running', 'complete', 'failed'));
  end if;
end $$;

create index if not exists jobs_queue_idx
  on public.jobs (status, priority desc, queued_at asc);

create index if not exists jobs_plan_type_idx
  on public.jobs (plan_id, job_type, status);

create table if not exists public.formulations (
  plan_id uuid not null references public.assessments(plan_id) on delete cascade,
  version integer not null default 1,
  formulation jsonb not null,
  model_version text null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, version)
);

alter table public.formulations
  add column if not exists version integer default 1,
  add column if not exists formulation jsonb default '{}'::jsonb,
  add column if not exists model_version text null,
  add column if not exists generated_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.formulations
set
  version = coalesce(version, 1),
  formulation = coalesce(formulation, '{}'::jsonb),
  generated_at = coalesce(generated_at, now()),
  updated_at = coalesce(updated_at, now())
where version is null
  or formulation is null
  or generated_at is null
  or updated_at is null;

alter table public.formulations
  alter column version set default 1,
  alter column version set not null,
  alter column formulation set not null,
  alter column generated_at set default now(),
  alter column generated_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create table if not exists public.recommendations (
  plan_id uuid not null references public.assessments(plan_id) on delete cascade,
  version integer not null default 1,
  recommendations jsonb not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, version)
);

alter table public.recommendations
  add column if not exists version integer default 1,
  add column if not exists recommendations jsonb default '[]'::jsonb,
  add column if not exists generated_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.recommendations
set
  version = coalesce(version, 1),
  recommendations = coalesce(recommendations, '[]'::jsonb),
  generated_at = coalesce(generated_at, now()),
  updated_at = coalesce(updated_at, now())
where version is null
  or recommendations is null
  or generated_at is null
  or updated_at is null;

alter table public.recommendations
  alter column version set default 1,
  alter column version set not null,
  alter column recommendations set not null,
  alter column generated_at set default now(),
  alter column generated_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create table if not exists public.job_audit_events (
  id uuid primary key,
  job_id uuid null references public.jobs(id) on delete set null,
  plan_id uuid null references public.assessments(plan_id) on delete cascade,
  event_type text not null,
  level text not null default 'low' check (
    level in ('low', 'medium', 'high', 'critical')
  ),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_audit_events
  add column if not exists job_id uuid null references public.jobs(id) on delete set null,
  add column if not exists plan_id uuid null references public.assessments(plan_id) on delete cascade,
  add column if not exists event_type text default 'unknown',
  add column if not exists level text default 'low',
  add column if not exists event_payload jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.job_audit_events
set
  event_type = coalesce(event_type, 'unknown'),
  level = case
    when level in ('low', 'medium', 'high', 'critical') then level
    else 'low'
  end,
  event_payload = coalesce(event_payload, '{}'::jsonb),
  created_at = coalesce(created_at, now())
where event_type is null
  or level is null
  or level not in ('low', 'medium', 'high', 'critical')
  or event_payload is null
  or created_at is null;

alter table public.job_audit_events
  alter column event_type set not null,
  alter column level set default 'low',
  alter column level set not null,
  alter column event_payload set default '{}'::jsonb,
  alter column event_payload set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_audit_events'::regclass
      and conname = 'job_audit_events_level_check'
  ) then
    alter table public.job_audit_events
      add constraint job_audit_events_level_check
      check (level in ('low', 'medium', 'high', 'critical'));
  end if;
end $$;

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
      execute format(
        'alter table public.formulations drop constraint %I',
        current_pkey
      );
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
      execute format(
        'alter table public.recommendations drop constraint %I',
        current_pkey
      );
    end if;

    alter table public.recommendations
      add constraint recommendations_pkey primary key (plan_id, version);
  end if;
end $$;

create index if not exists formulations_latest_idx
  on public.formulations (plan_id, version desc, generated_at desc);

create index if not exists recommendations_latest_idx
  on public.recommendations (plan_id, version desc, generated_at desc);

create index if not exists job_audit_events_plan_idx
  on public.job_audit_events (plan_id, created_at desc);

create index if not exists job_audit_events_job_idx
  on public.job_audit_events (job_id, created_at desc);

create index if not exists job_audit_events_level_idx
  on public.job_audit_events (level, created_at desc);

-- DOADMIN can apply this script in UAT. If a lower-privilege user reapplies it
-- locally, ownership changes are skipped with notices rather than aborting.
do $$
begin
  begin
    execute 'alter schema public owner to mn';
  exception when others then
    raise notice 'Skipping schema owner change: %', sqlerrm;
  end;

  begin
    execute 'grant usage, create on schema public to mn';
  exception when others then
    raise notice 'Skipping schema grant: %', sqlerrm;
  end;

  begin
    execute 'alter type public.assessment_plan owner to mn';
  exception when others then
    raise notice 'Skipping assessment_plan owner change: %', sqlerrm;
  end;

  begin
    execute 'alter type public.assessment_status owner to mn';
  exception when others then
    raise notice 'Skipping assessment_status owner change: %', sqlerrm;
  end;

  begin
    execute 'alter table public.assessments owner to mn';
  exception when others then
    raise notice 'Skipping assessments owner change: %', sqlerrm;
  end;

  begin
    execute 'alter table public.jobs owner to mn';
  exception when others then
    raise notice 'Skipping jobs owner change: %', sqlerrm;
  end;

  begin
    execute 'alter table public.formulations owner to mn';
  exception when others then
    raise notice 'Skipping formulations owner change: %', sqlerrm;
  end;

  begin
    execute 'alter table public.recommendations owner to mn';
  exception when others then
    raise notice 'Skipping recommendations owner change: %', sqlerrm;
  end;

  begin
    execute 'alter table public.job_audit_events owner to mn';
  exception when others then
    raise notice 'Skipping job_audit_events owner change: %', sqlerrm;
  end;
end $$;

-- Crispy Native production profile model (household account + sub-profiles)

create extension if not exists pgcrypto;

drop table if exists public.user_data cascade;
drop table if exists public.profile_data cascade;
drop table if exists public.account_data cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    avatar text,
    order_index integer not null default 0,
    last_active_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint profiles_name_not_blank check (char_length(btrim(name)) between 1 and 32)
);

create index profiles_account_order_idx
    on public.profiles (account_id, order_index, created_at);

create index profiles_account_updated_idx
    on public.profiles (account_id, updated_at desc);

create table public.account_data (
    account_id uuid primary key references auth.users (id) on delete cascade,
    addons jsonb not null default '[]'::jsonb,
    version integer not null default 1,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint account_data_addons_array check (jsonb_typeof(addons) = 'array')
);

create table public.profile_data (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    settings jsonb not null default '{}'::jsonb,
    catalog_prefs jsonb not null default '{}'::jsonb,
    trakt_auth jsonb not null default '{}'::jsonb,
    version integer not null default 1,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint profile_data_settings_object check (jsonb_typeof(settings) = 'object'),
    constraint profile_data_catalog_object check (jsonb_typeof(catalog_prefs) = 'object'),
    constraint profile_data_trakt_object check (jsonb_typeof(trakt_auth) = 'object')
);

create index profile_data_updated_idx
    on public.profile_data (updated_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

create trigger account_data_updated_at
before update on public.account_data
for each row
execute function public.set_current_timestamp_updated_at();

create trigger profile_data_updated_at
before update on public.profile_data
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.account_data enable row level security;
alter table public.profile_data enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = account_id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = account_id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

create policy "profiles_delete_own"
on public.profiles
for delete
using (auth.uid() = account_id);

create policy "account_data_select_own"
on public.account_data
for select
using (auth.uid() = account_id);

create policy "account_data_insert_own"
on public.account_data
for insert
with check (auth.uid() = account_id);

create policy "account_data_update_own"
on public.account_data
for update
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

create policy "account_data_delete_own"
on public.account_data
for delete
using (auth.uid() = account_id);

create policy "profile_data_select_own"
on public.profile_data
for select
using (
    exists (
        select 1
        from public.profiles p
        where p.id = profile_data.profile_id
          and p.account_id = auth.uid()
    )
);

create policy "profile_data_insert_own"
on public.profile_data
for insert
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = profile_data.profile_id
          and p.account_id = auth.uid()
    )
);

create policy "profile_data_update_own"
on public.profile_data
for update
using (
    exists (
        select 1
        from public.profiles p
        where p.id = profile_data.profile_id
          and p.account_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = profile_data.profile_id
          and p.account_id = auth.uid()
    )
);

create policy "profile_data_delete_own"
on public.profile_data
for delete
using (
    exists (
        select 1
        from public.profiles p
        where p.id = profile_data.profile_id
          and p.account_id = auth.uid()
    )
);

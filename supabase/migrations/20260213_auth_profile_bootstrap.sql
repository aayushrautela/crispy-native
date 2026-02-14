-- Production hardening for account bootstrap:
-- 1) Ensure app roles can operate on profile tables under RLS
-- 2) Auto-create one profile per new auth user using username metadata
-- 3) Backfill missing account/profile rows for existing users

begin;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.account_data to authenticated;
grant select, insert, update, delete on table public.profile_data to authenticated;

create or replace function public.normalize_profile_name(raw_name text, fallback_name text default 'user')
returns text
language plpgsql
immutable
as $$
declare
    candidate text;
begin
    candidate := lower(coalesce(raw_name, fallback_name, 'user'));
    candidate := regexp_replace(candidate, '[^a-z0-9._\- ]+', '', 'g');
    candidate := regexp_replace(candidate, '\s+', ' ', 'g');
    candidate := btrim(candidate, ' ._-');

    if candidate = '' then
        candidate := lower(coalesce(fallback_name, 'user'));
        candidate := regexp_replace(candidate, '[^a-z0-9._\- ]+', '', 'g');
        candidate := regexp_replace(candidate, '\s+', ' ', 'g');
        candidate := btrim(candidate, ' ._-');
    end if;

    if candidate = '' then
        candidate := 'user';
    end if;

    return left(candidate, 32);
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    metadata_name text;
    fallback_name text;
    profile_name text;
    created_profile_id uuid;
begin
    metadata_name := nullif(btrim(coalesce(
        new.raw_user_meta_data ->> 'username',
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'full_name',
        ''
    )), '');

    fallback_name := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
    profile_name := public.normalize_profile_name(metadata_name, fallback_name);

    insert into public.profiles (account_id, name, order_index, last_active_at)
    values (new.id, profile_name, 1, now())
    on conflict do nothing
    returning id into created_profile_id;

    if created_profile_id is null then
        select p.id
        into created_profile_id
        from public.profiles p
        where p.account_id = new.id
        order by p.order_index asc, p.created_at asc
        limit 1;
    end if;

    insert into public.account_data (account_id)
    values (new.id)
    on conflict (account_id) do nothing;

    if created_profile_id is not null then
        insert into public.profile_data (profile_id)
        values (created_profile_id)
        on conflict (profile_id) do nothing;
    end if;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

do $$
declare
    auth_user record;
    first_profile_id uuid;
    derived_profile_name text;
begin
    for auth_user in
        select u.id, u.email, u.raw_user_meta_data
        from auth.users u
    loop
        insert into public.account_data (account_id)
        values (auth_user.id)
        on conflict (account_id) do nothing;

        select p.id
        into first_profile_id
        from public.profiles p
        where p.account_id = auth_user.id
        order by p.order_index asc, p.created_at asc
        limit 1;

        if first_profile_id is null then
            derived_profile_name := public.normalize_profile_name(
                coalesce(
                    auth_user.raw_user_meta_data ->> 'username',
                    auth_user.raw_user_meta_data ->> 'name',
                    auth_user.raw_user_meta_data ->> 'full_name'
                ),
                split_part(coalesce(auth_user.email, ''), '@', 1)
            );

            insert into public.profiles (account_id, name, order_index, last_active_at)
            values (auth_user.id, derived_profile_name, 1, now())
            returning id into first_profile_id;
        end if;

        if first_profile_id is not null then
            insert into public.profile_data (profile_id)
            values (first_profile_id)
            on conflict (profile_id) do nothing;
        end if;
    end loop;
end;
$$;

commit;

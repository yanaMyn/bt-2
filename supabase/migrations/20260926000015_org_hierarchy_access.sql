-- Peserta terhitung, wewenang per unit (RLS & RPC), struktur, kegiatan, jamaah, perpindahan.
-- Lihat openspec/changes/add-org-hierarchy/design.md D2–D6.

-- =====================================================================
-- Helper wewenang (D3)
-- =====================================================================

create function public.current_admin() returns public.admin_profiles
language sql stable security definer
set search_path = ''
as $$
  select * from public.admin_profiles where user_id = auth.uid() and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid() and is_active)
$$;

create function public.my_unit() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select unit_id from public.admin_profiles where user_id = auth.uid() and is_active
$$;

create function public.my_level() returns text
language sql stable security definer
set search_path = ''
as $$
  select u.level from public.admin_profiles p join public.org_units u on u.id = p.unit_id
  where p.user_id = auth.uid() and p.is_active
$$;

-- Unit adalah unit admin atau turunannya (kedalaman maksimal 2).
create function public.unit_in_scope(p_unit uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.my_unit() is not null and (
    p_unit = public.my_unit()
    or exists (
      select 1 from public.org_units u
      left join public.org_units p on p.id = u.parent_id
      where u.id = p_unit and (u.parent_id = public.my_unit() or p.parent_id = public.my_unit())
    )
  )
$$;

create function public.manages_unit(p_unit uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.my_unit() is not null and p_unit = public.my_unit()
$$;

-- Daerah mengelola admin Desa mana pun; Desa mengelola admin Kelompok anaknya.
create function public.can_admin_unit_admins(p_unit uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_units u
    where u.id = p_unit
      and (
        (u.level = 'desa' and public.my_level() = 'daerah')
        or (u.level = 'kelompok' and public.my_level() = 'desa' and u.parent_id = public.my_unit())
      )
  )
$$;

create function public.assert_manages_category(p_category_id uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  perform public.assert_admin();
  select owner_unit_id into v_owner from public.categories where id = p_category_id;
  if v_owner is null then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.manages_unit(v_owner) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

create function public.assert_kelompok_admin() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if public.my_level() <> 'kelompok' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return public.my_unit();
end
$$;

-- =====================================================================
-- Peserta terhitung (D2)
-- =====================================================================

create function public.activity_participants(p_category_id uuid, p_on date)
returns table (member_id uuid, kelompok_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.kelompok_id
  from public.categories c
  join public.org_units o on o.id = c.owner_unit_id
  join public.members m on true
  join public.org_units k on k.id = m.kelompok_id
  where c.id = p_category_id
    and (m.inactive_since is null or m.inactive_since > p_on)
    and case o.level
      when 'kelompok' then m.kelompok_id = o.id
      when 'desa' then k.parent_id = o.id and (
        c.scope_all or exists (select 1 from public.activity_units au where au.category_id = c.id and au.unit_id = k.id)
      )
      else c.scope_all or exists (
        select 1 from public.activity_units au where au.category_id = c.id and au.unit_id = k.parent_id
      )
    end
    and (c.criteria_gender is null or m.gender = c.criteria_gender)
    and (
      c.criteria_marital is null
      or (c.criteria_marital = 'belum' and m.marital_status = 'belum')
      or (c.criteria_marital = 'pernah' and m.marital_status in ('menikah', 'janda_duda'))
    )
    and (
      (c.criteria_min_age is null and c.criteria_max_age is null)
      or (
        m.birth_date is not null
        and extract(year from age(p_on, m.birth_date)) >= coalesce(c.criteria_min_age, 0)
        and extract(year from age(p_on, m.birth_date)) <= coalesce(c.criteria_max_age, 1000)
      )
    )
$$;
revoke execute on function public.activity_participants(uuid, date) from public, anon;
grant execute on function public.activity_participants(uuid, date) to authenticated;

-- =====================================================================
-- Sesi: penutupan & pengisian memakai peserta terhitung
-- =====================================================================

create or replace function public.close_session(p_session_id uuid, p_closed_at timestamptz) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_auto uuid;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or v_session.closed_at is not null then
    return;
  end if;

  select s.id into v_auto
    from public.categories c
    join public.statuses s on s.id = c.reset_status_id and s.archived_at is null
    where c.id = v_session.category_id;
  if v_auto is not null then
    insert into public.attendance (session_id, member_id, status_id)
      select p_session_id, p.member_id, v_auto
      from public.activity_participants(v_session.category_id, v_session.session_date) p
      where not exists (
        select 1 from public.attendance a where a.session_id = p_session_id and a.member_id = p.member_id
      );
  end if;

  -- Peserta saat ini + yang sudah mengisi (mis. pindah kelompok saat sesi berjalan), dengan kelompok asal.
  insert into public.session_members (session_id, member_id, kelompok_id)
    select p_session_id, p.member_id, p.kelompok_id
    from public.activity_participants(v_session.category_id, v_session.session_date) p
    union
    select p_session_id, a.member_id, m.kelompok_id
    from public.attendance a join public.members m on m.id = a.member_id
    where a.session_id = p_session_id
    on conflict do nothing;
  update public.sessions set closed_at = p_closed_at where id = p_session_id;
end
$$;
revoke execute on function public.close_session(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.set_attendance(
  p_category_id uuid,
  p_member_id uuid,
  p_status_id uuid,
  p_pin text default null
)
returns table (session_id uuid, status_id uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
  v_session uuid;
  v_date date;
begin
  select * into v_cat from public.categories where id = p_category_id and is_active;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cat.pin_enabled and p_pin is null then
    raise exception 'PIN_REQUIRED' using errcode = '28000';
  end if;
  if not public.check_category_pin(v_cat, p_pin) then
    raise exception 'PIN_INVALID' using errcode = '28P01';
  end if;

  perform public.finalize_category(p_category_id);
  v_session := public.current_session_id(p_category_id);
  if v_session is null then
    raise exception 'NO_ACTIVE_SESSION' using errcode = 'P0002';
  end if;
  select s.session_date into v_date from public.sessions s where s.id = v_session;

  if not exists (
    select 1 from public.activity_participants(p_category_id, v_date) p where p.member_id = p_member_id
  ) then
    raise exception 'NOT_PARTICIPANT' using errcode = '22023';
  end if;

  if p_status_id is not null and not exists (
    select 1 from public.statuses
    where id = p_status_id and category_id = p_category_id and archived_at is null
  ) then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  if p_status_id is null then
    delete from public.attendance a where a.session_id = v_session and a.member_id = p_member_id;
  else
    insert into public.attendance as a (session_id, member_id, status_id, updated_at)
      values (v_session, p_member_id, p_status_id, now())
      on conflict on constraint attendance_pkey
      do update set status_id = excluded.status_id, updated_at = now();
  end if;

  return query select v_session, p_status_id;
end
$$;

-- =====================================================================
-- RPC kegiatan/sesi/status/PIN lama: wajib admin pemilik kegiatan
-- =====================================================================

create or replace function public.end_session(p_category_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  perform public.assert_manages_category(p_category_id);
  perform public.finalize_category(p_category_id);
  v_session := public.current_session_id(p_category_id);
  if v_session is null then
    raise exception 'NO_ACTIVE_SESSION' using errcode = 'P0002';
  end if;
  perform public.close_session(v_session, now());
  return v_session;
end
$$;

create or replace function public.schedule_sessions(p_category_id uuid, p_items jsonb) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_start time;
  v_end time;
  v_grace int;
  v_note text;
  v_count int := 0;
begin
  perform public.assert_manages_category(p_category_id);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ROWS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 62 then
    raise exception 'TOO_MANY_SESSIONS' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_start := nullif(v_item->>'start', '')::time;
    v_end := nullif(v_item->>'end', '')::time;
    v_grace := coalesce((v_item->>'grace')::int, 0);
    v_note := nullif(btrim(coalesce(v_item->>'note', '')), '');
    perform public.validate_session_fields(v_start, v_end, v_grace, v_note);
    insert into public.sessions (category_id, session_date, start_time, end_time, grace_hours, note)
      values (p_category_id, (v_item->>'date')::date, v_start, v_end, v_grace, v_note);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

create or replace function public.update_session(
  p_session_id uuid, p_date date, p_start time, p_end time, p_grace int, p_note text
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_admin();
  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_manages_category(v_session.category_id);
  perform public.finalize_category(v_session.category_id);
  select * into v_session from public.sessions where id = p_session_id;

  if v_session.closed_at is not null then
    if p_start is distinct from v_session.start_time
      or p_end is distinct from v_session.end_time
      or coalesce(p_grace, v_session.grace_hours) <> v_session.grace_hours then
      raise exception 'SESSION_FINISHED' using errcode = '22023';
    end if;
    if v_note is not null and char_length(v_note) > 200 then
      raise exception 'NOTE_TOO_LONG' using errcode = '22023';
    end if;
    update public.sessions set session_date = p_date, note = v_note where id = p_session_id;
    return;
  end if;

  if v_session.start_time is null and p_start is null and p_end is null then
    if v_note is not null and char_length(v_note) > 200 then
      raise exception 'NOTE_TOO_LONG' using errcode = '22023';
    end if;
    update public.sessions set session_date = p_date, note = v_note where id = p_session_id;
    return;
  end if;

  perform public.validate_session_fields(p_start, p_end, coalesce(p_grace, 0), v_note);
  update public.sessions set
    session_date = p_date, start_time = p_start, end_time = p_end,
    grace_hours = coalesce(p_grace, 0), note = v_note
  where id = p_session_id;
end
$$;

create or replace function public.delete_session(p_session_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
begin
  perform public.assert_admin();
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_manages_category(v_session.category_id);
  if v_session.closed_at is not null
    or v_session.opens_at is null
    or v_session.opens_at <= now()
    or exists (select 1 from public.attendance where session_id = p_session_id) then
    raise exception 'SESSION_NOT_DELETABLE' using errcode = '22023';
  end if;
  delete from public.sessions where id = p_session_id;
end
$$;

create or replace function public.set_category_pin(p_category_id uuid, p_enabled boolean, p_pin text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
begin
  perform public.assert_manages_category(p_category_id);
  select * into v_cat from public.categories where id = p_category_id for update;
  if not p_enabled then
    update public.categories set pin_enabled = false, pin = null where id = p_category_id;
    return;
  end if;
  if p_pin is null and v_cat.pin_enabled then
    return;
  end if;
  perform public.validate_pin(p_pin);
  update public.categories set pin_enabled = true, pin = p_pin where id = p_category_id;
end
$$;

create or replace function public.set_category_active(p_category_id uuid, p_active boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_manages_category(p_category_id);
  update public.categories set is_active = p_active where id = p_category_id;
end
$$;

create or replace function public.set_reset_status(p_category_id uuid, p_status_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_manages_category(p_category_id);
  if p_status_id is not null and not exists (
    select 1 from public.statuses
    where id = p_status_id and category_id = p_category_id and archived_at is null
  ) then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  update public.categories set reset_status_id = p_status_id where id = p_category_id;
end
$$;

create or replace function public.delete_status(p_status_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.statuses;
begin
  perform public.assert_admin();
  select * into v_status from public.statuses where id = p_status_id for update;
  if not found then
    raise exception 'STATUS_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_manages_category(v_status.category_id);
  if v_status.archived_at is not null then
    return 'archived';
  end if;
  if (
    select count(*) from public.statuses
    where category_id = v_status.category_id and archived_at is null
  ) <= 1 then
    raise exception 'LAST_ACTIVE_STATUS' using errcode = '22023';
  end if;
  if exists (select 1 from public.attendance where status_id = p_status_id) then
    update public.statuses set archived_at = now() where id = p_status_id;
    update public.categories set reset_status_id = null where reset_status_id = p_status_id;
    return 'archived';
  end if;
  delete from public.statuses where id = p_status_id;
  return 'deleted';
end
$$;

-- Digantikan create_activity / update_activity / RPC jamaah & perpindahan.
drop function public.create_category(text);
drop function public.rename_category(uuid, text);
drop function public.unique_category_slug(text, uuid);
drop function public.import_members(uuid, jsonb);
drop function public.remove_members_from_category(uuid, uuid[]);
drop function public.delete_members(uuid[]);
drop function public.members_with_history(uuid[]);

-- =====================================================================
-- Struktur organisasi (D1, spec org-structure)
-- =====================================================================

create function public.unique_unit_slug(p_base text) returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_base text := public.slugify(p_base);
  v_slug text := v_base;
  v_n int := 1;
begin
  while exists (select 1 from public.org_units where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end
$$;

-- Tambah Desa (induk Daerah, oleh Admin Daerah) atau Kelompok (induk Desa, oleh Admin Daerah / Admin Desa itu).
create function public.create_unit(p_parent uuid, p_name text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_parent public.org_units;
  v_name text := btrim(coalesce(p_name, ''));
  v_level text;
  v_id uuid;
begin
  perform public.assert_admin();
  select * into v_parent from public.org_units where id = p_parent;
  if not found or v_parent.level = 'kelompok' then
    raise exception 'INVALID_PARENT' using errcode = '22023';
  end if;
  v_level := case v_parent.level when 'daerah' then 'desa' else 'kelompok' end;
  if not (
    public.my_level() = 'daerah'
    or (v_level = 'kelompok' and public.my_level() = 'desa' and public.my_unit() = p_parent)
  ) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'UNIT_NAME_EMPTY' using errcode = '22023';
  end if;
  if exists (select 1 from public.org_units where parent_id = p_parent and lower(btrim(name)) = lower(v_name)) then
    raise exception 'UNIT_NAME_TAKEN' using errcode = '23505';
  end if;
  insert into public.org_units (level, parent_id, name, slug)
    values (v_level, p_parent, v_name, public.unique_unit_slug(v_name))
    returning id into v_id;
  return v_id;
end
$$;

create function public.rename_unit(p_unit uuid, p_name text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_unit public.org_units;
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform public.assert_admin();
  select * into v_unit from public.org_units where id = p_unit;
  if not found then
    raise exception 'UNIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (
    public.my_level() = 'daerah'
    or (v_unit.level = 'kelompok' and public.my_level() = 'desa' and public.my_unit() = v_unit.parent_id)
  ) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'UNIT_NAME_EMPTY' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.org_units
    where parent_id is not distinct from v_unit.parent_id and id <> p_unit and lower(btrim(name)) = lower(v_name)
  ) then
    raise exception 'UNIT_NAME_TAKEN' using errcode = '23505';
  end if;
  update public.org_units set name = v_name where id = p_unit;
end
$$;

-- Hanya unit kosong; bila tidak, pesan detail menyebut isi yang tersisa.
create function public.delete_unit(p_unit uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_unit public.org_units;
  v_left text[] := '{}';
begin
  perform public.assert_admin();
  select * into v_unit from public.org_units where id = p_unit;
  if not found then
    raise exception 'UNIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_unit.level = 'daerah' or not (
    public.my_level() = 'daerah'
    or (v_unit.level = 'kelompok' and public.my_level() = 'desa' and public.my_unit() = v_unit.parent_id)
  ) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if exists (select 1 from public.org_units where parent_id = p_unit) then v_left := array_append(v_left, 'kelompok'); end if;
  if exists (select 1 from public.members where kelompok_id = p_unit) then v_left := array_append(v_left, 'jamaah'); end if;
  if exists (select 1 from public.categories where owner_unit_id = p_unit) then v_left := array_append(v_left, 'kegiatan'); end if;
  if exists (select 1 from public.admin_profiles where unit_id = p_unit) then v_left := array_append(v_left, 'admin'); end if;
  if cardinality(v_left) > 0 then
    raise exception 'UNIT_NOT_EMPTY' using errcode = '23503', detail = array_to_string(v_left, ',');
  end if;
  delete from public.org_units where id = p_unit;
end
$$;

-- =====================================================================
-- Kegiatan (D6, spec category-management)
-- =====================================================================

create function public.unique_activity_slug(p_base text, p_exclude uuid default null) returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_base text := public.slugify(p_base);
  v_slug text := v_base;
  v_n int := 1;
begin
  while exists (select 1 from public.categories where slug = v_slug and (p_exclude is null or id <> p_exclude)) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end
$$;

-- Validasi kriteria & wilayah; unit terpilih harus anak langsung pemilik (Desa->kelompok, Daerah->desa).
create function public.validate_activity(
  p_owner uuid, p_name text, p_gender text, p_min int, p_max int, p_marital text, p_scope_all boolean, p_units uuid[]
) returns void
language plpgsql stable
set search_path = ''
as $$
declare
  v_owner_level text;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'CATEGORY_NAME_EMPTY' using errcode = '22023';
  end if;
  if p_gender is not null and p_gender not in ('L', 'P') then
    raise exception 'INVALID_CRITERIA' using errcode = '22023';
  end if;
  if p_marital is not null and p_marital not in ('belum', 'pernah') then
    raise exception 'INVALID_CRITERIA' using errcode = '22023';
  end if;
  if (p_min is not null and (p_min < 0 or p_min > 120)) or (p_max is not null and (p_max < 0 or p_max > 120))
    or (p_min is not null and p_max is not null and p_min > p_max) then
    raise exception 'INVALID_AGE_RANGE' using errcode = '22023';
  end if;
  select level into v_owner_level from public.org_units where id = p_owner;
  if not coalesce(p_scope_all, true) then
    if v_owner_level = 'kelompok' or coalesce(cardinality(p_units), 0) = 0 then
      raise exception 'INVALID_SCOPE' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(p_units) u(id)
      where not exists (select 1 from public.org_units x where x.id = u.id and x.parent_id = p_owner)
    ) then
      raise exception 'INVALID_SCOPE' using errcode = '22023';
    end if;
  end if;
end
$$;

create function public.create_activity(
  p_name text,
  p_gender text default null,
  p_min_age int default null,
  p_max_age int default null,
  p_marital text default null,
  p_scope_all boolean default true,
  p_units uuid[] default '{}'
)
returns table (id uuid, slug text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_unit_name text;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_slug text;
begin
  perform public.assert_admin();
  v_owner := public.my_unit();
  perform public.validate_activity(v_owner, v_name, p_gender, p_min_age, p_max_age, p_marital, p_scope_all, p_units);
  if exists (
    select 1 from public.categories c where c.owner_unit_id = v_owner and lower(btrim(c.name)) = lower(v_name)
  ) then
    raise exception 'CATEGORY_NAME_TAKEN' using errcode = '23505';
  end if;
  select name into v_unit_name from public.org_units where org_units.id = v_owner;
  v_slug := public.unique_activity_slug(v_name || ' ' || v_unit_name);

  insert into public.categories (name, slug, owner_unit_id, scope_all, criteria_gender, criteria_min_age,
      criteria_max_age, criteria_marital)
    values (v_name, v_slug, v_owner, coalesce(p_scope_all, true), p_gender, p_min_age, p_max_age, p_marital)
    returning categories.id into v_id;
  if not coalesce(p_scope_all, true) then
    insert into public.activity_units (category_id, unit_id) select v_id, u from unnest(p_units) u;
  end if;

  insert into public.statuses (category_id, label, color, sort_order, counts_as_present) values
    (v_id, 'Hadir', '#16a34a', 1, true),
    (v_id, 'Izin',  '#eab308', 2, false),
    (v_id, 'Sakit', '#2563eb', 3, false),
    (v_id, 'Alpa',  '#dc2626', 4, false);
  update public.categories set reset_status_id = (
    select s.id from public.statuses s where s.category_id = v_id and s.label = 'Alpa'
  ) where categories.id = v_id;

  return query select v_id, v_slug;
end
$$;

create function public.update_activity(
  p_category_id uuid,
  p_name text,
  p_gender text default null,
  p_min_age int default null,
  p_max_age int default null,
  p_marital text default null,
  p_scope_all boolean default true,
  p_units uuid[] default '{}'
) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_unit_name text;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
begin
  perform public.assert_manages_category(p_category_id);
  select owner_unit_id into v_owner from public.categories where id = p_category_id;
  perform public.validate_activity(v_owner, v_name, p_gender, p_min_age, p_max_age, p_marital, p_scope_all, p_units);
  if exists (
    select 1 from public.categories c
    where c.owner_unit_id = v_owner and lower(btrim(c.name)) = lower(v_name) and c.id <> p_category_id
  ) then
    raise exception 'CATEGORY_NAME_TAKEN' using errcode = '23505';
  end if;
  select name into v_unit_name from public.org_units where id = v_owner;
  v_slug := public.unique_activity_slug(v_name || ' ' || v_unit_name, p_category_id);
  update public.categories set
    name = v_name, slug = v_slug, scope_all = coalesce(p_scope_all, true),
    criteria_gender = p_gender, criteria_min_age = p_min_age, criteria_max_age = p_max_age,
    criteria_marital = p_marital
  where id = p_category_id;
  delete from public.activity_units where category_id = p_category_id;
  if not coalesce(p_scope_all, true) then
    insert into public.activity_units (category_id, unit_id) select p_category_id, u from unnest(p_units) u;
  end if;
  return v_slug;
end
$$;

-- =====================================================================
-- Jamaah (spec member-management, member-import)
-- =====================================================================

create function public.parse_marital(p_text text) returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_text, '')));
begin
  if v in ('', 'belum', 'belum menikah', 'belum_menikah') then return 'belum'; end if;
  if v in ('menikah', 'sudah', 'sudah menikah') then return 'menikah'; end if;
  if v in ('janda', 'duda', 'janda/duda', 'janda_duda') then return 'janda_duda'; end if;
  raise exception 'INVALID_ROW' using errcode = '22023', detail = p_text;
end
$$;

-- p_rows = [{"name","gender","birth_date":"YYYY-MM-DD"|null,"marital":"belum"|...}] -> kelompok admin, atomik.
create function public.import_members(p_rows jsonb) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_row jsonb;
  v_name text;
  v_gender text;
  v_count int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS' using errcode = '22023';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_name := regexp_replace(btrim(coalesce(v_row->>'name', '')), '\s+', ' ', 'g');
    v_gender := v_row->>'gender';
    if v_name = '' or v_gender is null or v_gender not in ('L', 'P') then
      raise exception 'INVALID_ROW' using errcode = '22023', detail = v_row::text;
    end if;
    insert into public.members (name, gender, kelompok_id, birth_date, marital_status)
      values (v_name, v_gender, v_kelompok, nullif(v_row->>'birth_date', '')::date,
        public.parse_marital(v_row->>'marital'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Nonaktif/aktif massal (atomik). p_active=false memerlukan tanggal & alasan.
create function public.set_members_active(p_ids uuid[], p_active boolean, p_since date default null, p_reason text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_count int;
begin
  if exists (select 1 from unnest(p_ids) u(id)
      where not exists (select 1 from public.members m where m.id = u.id and m.kelompok_id = v_kelompok)) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_active then
    update public.members set inactive_since = null, inactive_reason = null where id = any (p_ids);
  else
    if p_since is null or p_reason is null or p_reason not in ('meninggal', 'pindah_luar', 'lainnya') then
      raise exception 'INVALID_INACTIVE' using errcode = '22023';
    end if;
    if exists (select 1 from public.member_transfers where member_id = any (p_ids) and status = 'pending') then
      raise exception 'MEMBER_TRANSFER_PENDING' using errcode = '22023';
    end if;
    update public.members set inactive_since = p_since, inactive_reason = p_reason where id = any (p_ids);
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Hapus jamaah tanpa riwayat (kehadiran/snapshot/perpindahan); yang punya riwayat dilewati.
create function public.delete_members(p_ids uuid[]) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_skipped uuid[];
  v_count int;
begin
  if exists (select 1 from unnest(p_ids) u(id)
      where not exists (select 1 from public.members m where m.id = u.id and m.kelompok_id = v_kelompok)) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  select coalesce(array_agg(u.id), '{}') into v_skipped from unnest(p_ids) u(id)
    where exists (select 1 from public.attendance a where a.member_id = u.id)
       or exists (select 1 from public.session_members sm where sm.member_id = u.id)
       or exists (select 1 from public.member_transfers t where t.member_id = u.id);
  delete from public.members where id = any (p_ids) and not (id = any (v_skipped));
  get diagnostics v_count = row_count;
  return jsonb_build_object('deleted', v_count, 'skipped', to_jsonb(v_skipped));
end
$$;

-- =====================================================================
-- Perpindahan (D5)
-- =====================================================================

create function public.request_transfer(p_member uuid, p_to uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_member public.members;
  v_id uuid;
begin
  select * into v_member from public.members where id = p_member for update;
  if not found or v_member.kelompok_id <> v_kelompok then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_member.inactive_since is not null then
    raise exception 'MEMBER_INACTIVE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.org_units where id = p_to and level = 'kelompok') or p_to = v_kelompok then
    raise exception 'INVALID_KELOMPOK' using errcode = '22023';
  end if;
  if exists (select 1 from public.member_transfers where member_id = p_member and status = 'pending') then
    raise exception 'MEMBER_TRANSFER_PENDING' using errcode = '22023';
  end if;
  insert into public.member_transfers (member_id, from_kelompok, to_kelompok, requested_by)
    values (p_member, v_kelompok, p_to, auth.uid())
    returning id into v_id;
  return v_id;
end
$$;

create function public.cancel_transfer(p_transfer uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
begin
  update public.member_transfers set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
    where id = p_transfer and status = 'pending' and from_kelompok = v_kelompok;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;
end
$$;

create function public.decide_transfer(p_transfer uuid, p_accept boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_t public.member_transfers;
begin
  select * into v_t from public.member_transfers
    where id = p_transfer and status = 'pending' and to_kelompok = v_kelompok for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_accept then
    perform set_config('app.transfer', 'on', true);
    update public.members set kelompok_id = v_t.to_kelompok where id = v_t.member_id;
    perform set_config('app.transfer', '', true);
  end if;
  update public.member_transfers
    set status = case when p_accept then 'accepted' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
    where id = p_transfer;
end
$$;

-- =====================================================================
-- Akun admin: ganti password & profil sendiri (D4)
-- =====================================================================

create function public.password_changed() returns void
language sql security definer
set search_path = ''
as $$
  update public.admin_profiles set must_change_password = false where user_id = auth.uid()
$$;

-- Profil admin yang sedang login beserta unit & induknya (untuk klien).
create function public.my_admin_profile()
returns table (
  user_id uuid, username text, display_name text, must_change_password boolean,
  unit_id uuid, unit_level text, unit_name text, parent_id uuid, parent_name text
)
language sql stable security definer
set search_path = ''
as $$
  select p.user_id, p.username, p.display_name, p.must_change_password,
         u.id, u.level, u.name, pu.id, pu.name
  from public.admin_profiles p
  join public.org_units u on u.id = p.unit_id
  left join public.org_units pu on pu.id = u.parent_id
  where p.user_id = auth.uid() and p.is_active
$$;

-- =====================================================================
-- RLS (D3)
-- =====================================================================

-- categories: publik membaca yang aktif; admin membaca dalam cakupan; hapus oleh pemilik.
drop policy "admin read" on public.categories;
drop policy "admin delete" on public.categories;
create policy "admin read" on public.categories for select to authenticated
  using (public.unit_in_scope(owner_unit_id));
create policy "admin delete" on public.categories for delete to authenticated
  using (public.manages_unit(owner_unit_id));

-- statuses: baca publik; tulis oleh admin pemilik kegiatan.
drop policy "admin write" on public.statuses;
create policy "admin insert" on public.statuses for insert to authenticated
  with check (exists (select 1 from public.categories c where c.id = category_id and public.manages_unit(c.owner_unit_id)));
create policy "admin update" on public.statuses for update to authenticated
  using (exists (select 1 from public.categories c where c.id = category_id and public.manages_unit(c.owner_unit_id)))
  with check (exists (select 1 from public.categories c where c.id = category_id and public.manages_unit(c.owner_unit_id)));
create policy "admin delete" on public.statuses for delete to authenticated
  using (exists (select 1 from public.categories c where c.id = category_id and public.manages_unit(c.owner_unit_id)));

-- members: anon tidak membaca tabel; admin membaca dalam cakupan; tulis hanya admin kelompok itu.
drop policy "public read" on public.members;
drop policy "admin write" on public.members;
revoke all on public.members from anon;
create policy "admin read" on public.members for select to authenticated
  using (public.unit_in_scope(kelompok_id));
create policy "kelompok insert" on public.members for insert to authenticated
  with check (public.my_level() = 'kelompok' and kelompok_id = public.my_unit());
create policy "kelompok update" on public.members for update to authenticated
  using (public.my_level() = 'kelompok' and kelompok_id = public.my_unit())
  with check (public.my_level() = 'kelompok' and kelompok_id = public.my_unit());
create policy "kelompok delete" on public.members for delete to authenticated
  using (public.my_level() = 'kelompok' and kelompok_id = public.my_unit());

-- session_members: hanya admin dalam cakupan kegiatan (laporan).
drop policy "public read" on public.session_members;
revoke all on public.session_members from anon;
create policy "admin read" on public.session_members for select to authenticated
  using (exists (
    select 1 from public.sessions s join public.categories c on c.id = s.category_id
    where s.id = session_id and public.unit_in_scope(c.owner_unit_id)
  ));

-- admin_profiles: profil sendiri & admin unit yang boleh ia kelola; tulis lewat Edge Function / RPC.
create policy "admin read" on public.admin_profiles for select to authenticated
  using (user_id = auth.uid() or public.can_admin_unit_admins(unit_id));

-- member_transfers: admin yang kelompok asal/tujuannya dalam cakupan; tulis lewat RPC.
create policy "admin read" on public.member_transfers for select to authenticated
  using (public.unit_in_scope(from_kelompok) or public.unit_in_scope(to_kelompok));

-- activity_units: baca publik (wilayah kegiatan tidak rahasia); tulis lewat RPC.
create policy "public read" on public.activity_units for select to anon, authenticated using (true);

-- criteria_templates: admin membaca; Admin Daerah mengelola.
create policy "admin read" on public.criteria_templates for select to authenticated using (public.is_admin());
create policy "daerah write" on public.criteria_templates for all to authenticated
  using (public.my_level() = 'daerah') with check (public.my_level() = 'daerah');

-- Tulis langsung ke org_units/admin_profiles/member_transfers/activity_units tidak dibuka (RPC/Edge Function).
revoke insert, update, delete on public.org_units, public.admin_profiles, public.member_transfers,
  public.activity_units from anon, authenticated;
revoke all on public.admin_profiles, public.member_transfers, public.criteria_templates from anon;

-- Helper internal tidak perlu dipanggil anon.
revoke execute on function public.assert_manages_category(uuid) from public, anon;
revoke execute on function public.assert_kelompok_admin() from public, anon;

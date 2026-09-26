-- Hierarki Daerah > Desa > Kelompok, jamaah milik kelompok, kegiatan milik unit.
-- PERINGATAN: migrasi ini MENGHAPUS SELURUH DATA LAMA (keputusan pengguna, lihat
-- openspec/changes/add-org-hierarchy). Akun Auth tidak dihapus.
-- Lihat design.md D1 & D10.

-- ---------- Hapus data lama & struktur keanggotaan manual ----------

drop view if exists public.category_summary;
drop view if exists public.session_stats;
truncate public.attendance, public.session_members, public.sessions, public.statuses,
  public.category_members, public.members, public.categories cascade;
drop table public.category_members;

-- ---------- Slug umum ----------

create function public.slugify(p_text text) returns text
language sql immutable
set search_path = ''
as $$
  select coalesce(nullif(btrim(regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'x')
$$;

-- ---------- Unit organisasi ----------

create table public.org_units (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('daerah', 'desa', 'kelompok')),
  parent_id uuid references public.org_units (id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  constraint org_units_root check ((level = 'daerah') = (parent_id is null))
);
create unique index org_units_one_daerah on public.org_units ((true)) where level = 'daerah';
create unique index org_units_name_per_parent on public.org_units (parent_id, lower(btrim(name)))
  where parent_id is not null;
create index org_units_parent_idx on public.org_units (parent_id);

-- Desa berinduk Daerah, Kelompok berinduk Desa; induk & level tidak bisa diubah.
create function public.org_units_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_level text;
begin
  if tg_op = 'UPDATE' and (new.parent_id is distinct from old.parent_id or new.level <> old.level) then
    raise exception 'UNIT_PARENT_IMMUTABLE' using errcode = '22023';
  end if;
  if new.level <> 'daerah' then
    select level into v_parent_level from public.org_units where id = new.parent_id;
    if v_parent_level is distinct from (case new.level when 'desa' then 'daerah' else 'desa' end) then
      raise exception 'INVALID_PARENT' using errcode = '22023';
    end if;
  end if;
  return new;
end
$$;
create trigger org_units_guard before insert or update on public.org_units
  for each row execute function public.org_units_guard();

-- ---------- Profil admin ----------

create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,32}$'),
  display_name text not null check (length(btrim(display_name)) > 0),
  unit_id uuid not null references public.org_units (id) on delete restrict,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index admin_profiles_unit_idx on public.admin_profiles (unit_id);

-- ---------- Jamaah ----------

alter table public.members
  add column kelompok_id uuid not null references public.org_units (id) on delete restrict,
  add column birth_date date,
  add column marital_status text not null default 'belum'
    check (marital_status in ('belum', 'menikah', 'janda_duda')),
  add column inactive_since date,
  add column inactive_reason text check (inactive_reason in ('meninggal', 'pindah_luar', 'lainnya')),
  add constraint members_inactive_pair check ((inactive_since is null) = (inactive_reason is null));
create index members_kelompok_idx on public.members (kelompok_id);

-- Tanggal lahir tidak di masa depan; kelompok harus level kelompok; kelompok hanya
-- boleh berubah lewat perpindahan (flag app.transfer diset oleh decide_transfer).
create function public.members_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null and new.birth_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'BIRTH_DATE_FUTURE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.org_units where id = new.kelompok_id and level = 'kelompok') then
    raise exception 'INVALID_KELOMPOK' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.kelompok_id <> old.kelompok_id
    and coalesce(current_setting('app.transfer', true), '') <> 'on' then
    raise exception 'USE_TRANSFER' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger members_guard before insert or update on public.members
  for each row execute function public.members_guard();

create table public.member_transfers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  from_kelompok uuid not null references public.org_units (id) on delete restrict,
  to_kelompok uuid not null references public.org_units (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  constraint member_transfers_distinct check (from_kelompok <> to_kelompok)
);
create unique index member_transfers_one_pending on public.member_transfers (member_id) where status = 'pending';
create index member_transfers_to_idx on public.member_transfers (to_kelompok) where status = 'pending';

-- ---------- Kegiatan (tabel categories) ----------

alter table public.categories
  add column owner_unit_id uuid not null references public.org_units (id) on delete restrict,
  add column scope_all boolean not null default true,
  add column criteria_gender text check (criteria_gender in ('L', 'P')),
  add column criteria_min_age int check (criteria_min_age between 0 and 120),
  add column criteria_max_age int check (criteria_max_age between 0 and 120),
  add column criteria_marital text check (criteria_marital in ('belum', 'pernah')),
  add constraint categories_age_range check (
    criteria_min_age is null or criteria_max_age is null or criteria_min_age <= criteria_max_age
  );
drop index public.categories_name_key;
create unique index categories_name_per_owner on public.categories (owner_unit_id, lower(btrim(name)));
create index categories_owner_idx on public.categories (owner_unit_id);
grant select (owner_unit_id, scope_all, criteria_gender, criteria_min_age, criteria_max_age, criteria_marital)
  on public.categories to anon, authenticated;

-- Wilayah terpilih bila scope_all = false (kelompok untuk kegiatan Desa, desa untuk kegiatan Daerah).
create table public.activity_units (
  category_id uuid not null references public.categories (id) on delete cascade,
  unit_id uuid not null references public.org_units (id) on delete cascade,
  primary key (category_id, unit_id)
);

create table public.criteria_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  gender text check (gender in ('L', 'P')),
  min_age int check (min_age between 0 and 120),
  max_age int check (max_age between 0 and 120),
  marital text check (marital in ('belum', 'pernah')),
  sort_order int not null default 0,
  constraint criteria_templates_age_range check (min_age is null or max_age is null or min_age <= max_age)
);
create unique index criteria_templates_name_key on public.criteria_templates (lower(btrim(name)));

insert into public.criteria_templates (name, gender, min_age, max_age, marital, sort_order) values
  ('Caberawit', null, 5, 11, null, 1),
  ('Pra Remaja', null, 12, 15, null, 2),
  ('Remaja', null, 16, 19, null, 3),
  ('Muda Mudi', null, 20, null, 'belum', 4),
  ('Dewasa L', 'L', 20, null, null, 5),
  ('Dewasa P', 'P', 20, null, null, 6),
  ('Bapak-bapak', 'L', null, null, 'pernah', 7),
  ('Ibu-ibu', 'P', null, null, 'pernah', 8),
  ('Lansia', null, 50, null, null, 9);

-- Snapshot peserta mencatat kelompok asal saat sesi ditutup.
alter table public.session_members
  add column kelompok_id uuid not null references public.org_units (id) on delete restrict;

-- ---------- RLS tabel baru (kebijakan lengkap di migrasi 0015) ----------

alter table public.org_units enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.member_transfers enable row level security;
alter table public.activity_units enable row level security;
alter table public.criteria_templates enable row level security;

create policy "public read" on public.org_units for select to anon, authenticated using (true);

-- ---------- Bootstrap Admin Daerah pertama (dijalankan manual di SQL Editor) ----------

create function public.bootstrap_root_admin(p_email text, p_username text, p_daerah_name text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_daerah uuid;
begin
  if exists (select 1 from public.org_units where level = 'daerah') then
    raise exception 'DAERAH_EXISTS' using errcode = '23505';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.org_units (level, name, slug)
    values ('daerah', btrim(p_daerah_name), public.slugify(p_daerah_name))
    returning id into v_daerah;
  insert into public.admin_profiles (user_id, username, display_name, unit_id, must_change_password)
    values (v_user, lower(btrim(p_username)), 'Admin ' || btrim(p_daerah_name), v_daerah, false);
  return v_daerah;
end
$$;
revoke execute on function public.bootstrap_root_admin(text, text, text) from public, anon, authenticated;

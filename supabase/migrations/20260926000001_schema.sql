-- Skema inti absensi. Lihat openspec/changes/add-mobile-attendance-system/design.md (D2, D3).

create extension if not exists pgcrypto with schema extensions;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  pin_enabled boolean not null default false,
  pin_hash text,
  created_at timestamptz not null default now(),
  constraint categories_pin_hash_required check (not pin_enabled or pin_hash is not null)
);
create unique index categories_name_key on public.categories (lower(btrim(name)));
create unique index categories_slug_key on public.categories (slug);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  counts_as_present boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index statuses_category_idx on public.statuses (category_id);
-- Label unik hanya di antara status aktif; status terarsip membebaskan labelnya.
create unique index statuses_active_label_key
  on public.statuses (category_id, lower(btrim(label)))
  where archived_at is null;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  gender text not null check (gender in ('L', 'P')),
  created_at timestamptz not null default now()
);

create table public.category_members (
  category_id uuid not null references public.categories (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, member_id)
);
create index category_members_member_idx on public.category_members (member_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  started_at timestamptz not null default now(),
  closed_at timestamptz
);
create index sessions_category_idx on public.sessions (category_id, started_at desc);
-- Tepat satu sesi aktif per kategori.
create unique index sessions_one_active_key on public.sessions (category_id) where closed_at is null;

-- Snapshot anggota kategori saat sesi ditutup (D3).
create table public.session_members (
  session_id uuid not null references public.sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (session_id, member_id)
);

create table public.attendance (
  session_id uuid not null references public.sessions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  -- Dicek saat commit agar penghapusan kategori (cascade ke statuses dan sessions
  -- sekaligus) tidak gagal; delete langsung status terpakai tetap ditolak.
  status_id uuid not null references public.statuses (id) deferrable initially deferred,
  updated_at timestamptz not null default now(),
  primary key (session_id, member_id)
);
create index attendance_status_idx on public.attendance (status_id);
create index attendance_member_idx on public.attendance (member_id);

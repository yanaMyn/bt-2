-- Fungsi server (RPC). Semua security definer dengan search_path tetap.
-- Kode error dilempar sebagai pesan exception agar mudah dipetakan di klien.

create function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'authenticated'
$$;

create function public.assert_admin() returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
end
$$;

-- Label sesi bawaan: "September 2026" (zona waktu Asia/Jakarta).
create function public.default_session_label(p_at timestamptz default now()) returns text
language sql stable
set search_path = ''
as $$
  select (array['Januari','Februari','Maret','April','Mei','Juni','Juli',
                'Agustus','September','Oktober','November','Desember'])
           [extract(month from p_at at time zone 'Asia/Jakarta')::int]
         || ' ' || extract(year from p_at at time zone 'Asia/Jakarta')::int
$$;

-- Slug unik dari nama: "Kelas 1A" -> "kelas-1a"; bentrok -> "kelas-1a-2".
create function public.unique_category_slug(p_name text, p_exclude uuid default null) returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n int := 1;
begin
  v_base := btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then
    v_base := 'kategori';
  end if;
  v_slug := v_base;
  while exists (
    select 1 from public.categories
    where slug = v_slug and (p_exclude is null or id <> p_exclude)
  ) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end
$$;

create function public.validate_pin(p_pin text) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN_FORMAT' using errcode = '22023';
  end if;
end
$$;

-- Kategori + 4 status bawaan + sesi aktif, satu transaksi.
create function public.create_category(p_name text)
returns table (id uuid, slug text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text;
  v_name text := btrim(p_name);
begin
  perform public.assert_admin();
  if exists (select 1 from public.categories c where lower(btrim(c.name)) = lower(v_name)) then
    raise exception 'CATEGORY_NAME_TAKEN' using errcode = '23505';
  end if;
  v_slug := public.unique_category_slug(v_name);
  insert into public.categories (name, slug) values (v_name, v_slug) returning categories.id into v_id;

  insert into public.statuses (category_id, label, color, sort_order, counts_as_present) values
    (v_id, 'Hadir', '#16a34a', 1, true),
    (v_id, 'Izin',  '#eab308', 2, false),
    (v_id, 'Sakit', '#2563eb', 3, false),
    (v_id, 'Alpa',  '#dc2626', 4, false);

  insert into public.sessions (category_id, label) values (v_id, public.default_session_label());

  return query select v_id, v_slug;
end
$$;

create function public.rename_category(p_category_id uuid, p_name text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_slug text;
begin
  perform public.assert_admin();
  if v_name = '' then
    raise exception 'CATEGORY_NAME_EMPTY' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.categories
    where lower(btrim(name)) = lower(v_name) and id <> p_category_id
  ) then
    raise exception 'CATEGORY_NAME_TAKEN' using errcode = '23505';
  end if;
  v_slug := public.unique_category_slug(v_name, p_category_id);
  update public.categories set name = v_name, slug = v_slug where id = p_category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_slug;
end
$$;

-- p_enabled=true dari kondisi mati wajib menyertakan PIN; saat sudah aktif,
-- p_pin null berarti PIN lama dipertahankan. Mematikan PIN menghapus hash.
create function public.set_category_pin(p_category_id uuid, p_enabled boolean, p_pin text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
begin
  perform public.assert_admin();
  select * into v_cat from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not p_enabled then
    update public.categories set pin_enabled = false, pin_hash = null where id = p_category_id;
    return;
  end if;

  if p_pin is null and v_cat.pin_enabled then
    return;
  end if;
  perform public.validate_pin(p_pin);
  update public.categories
    set pin_enabled = true, pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
    where id = p_category_id;
end
$$;

-- true bila PIN cocok atau PIN kategori tidak aktif. PIN salah diperlambat.
create function public.check_category_pin(p_cat public.categories, p_pin text) returns boolean
language plpgsql volatile
set search_path = ''
as $$
begin
  if not p_cat.pin_enabled then
    return true;
  end if;
  if p_pin is not null and extensions.crypt(p_pin, p_cat.pin_hash) = p_cat.pin_hash then
    return true;
  end if;
  perform pg_sleep(0.5);
  return false;
end
$$;

create function public.verify_category_pin(p_category_id uuid, p_pin text) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cat public.categories;
begin
  select * into v_cat from public.categories where id = p_category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  return public.check_category_pin(v_cat, p_pin);
end
$$;

-- Satu-satunya jalur tulis kehadiran publik. p_status_id null = kembali ke "Belum".
create function public.set_attendance(
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
begin
  select * into v_cat from public.categories where id = p_category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cat.pin_enabled and p_pin is null then
    raise exception 'PIN_REQUIRED' using errcode = '28000';
  end if;
  if not public.check_category_pin(v_cat, p_pin) then
    raise exception 'PIN_INVALID' using errcode = '28P01';
  end if;

  if not exists (
    select 1 from public.category_members
    where category_id = p_category_id and member_id = p_member_id
  ) then
    raise exception 'NOT_MEMBER' using errcode = '22023';
  end if;

  if p_status_id is not null and not exists (
    select 1 from public.statuses
    where id = p_status_id and category_id = p_category_id and archived_at is null
  ) then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  -- Sesi aktif selalu ditentukan server, sehingga sesi tertutup tidak bisa diubah.
  select s.id into v_session from public.sessions s
    where s.category_id = p_category_id and s.closed_at is null;

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

-- Hapus status: permanen bila belum terpakai, arsip bila terpakai.
create function public.delete_status(p_status_id uuid) returns text
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
    return 'archived';
  end if;
  delete from public.statuses where id = p_status_id;
  return 'deleted';
end
$$;

-- Reset: snapshot anggota -> tutup sesi aktif -> buka sesi baru (atomik).
create function public.reset_category(p_category_id uuid, p_label text default null) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_new uuid;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  perform public.assert_admin();
  select id into v_old from public.sessions
    where category_id = p_category_id and closed_at is null
    for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.session_members (session_id, member_id)
    select v_old, member_id from public.category_members where category_id = p_category_id;
  update public.sessions set closed_at = now() where id = v_old;
  insert into public.sessions (category_id, label)
    values (p_category_id, coalesce(v_label, public.default_session_label()))
    returning id into v_new;
  return v_new;
end
$$;

-- Import massal: selalu membuat orang baru. p_rows = [{"name": "...", "gender": "L"|"P"}].
-- Satu baris tidak valid membatalkan semuanya.
create function public.import_members(p_category_id uuid, p_rows jsonb) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_name text;
  v_gender text;
  v_member uuid;
  v_count int := 0;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_name := regexp_replace(btrim(coalesce(v_row->>'name', '')), '\s+', ' ', 'g');
    v_gender := v_row->>'gender';
    if v_name = '' or v_gender is null or v_gender not in ('L', 'P') then
      raise exception 'INVALID_ROW' using errcode = '22023', detail = v_row::text;
    end if;
    insert into public.members (name, gender) values (v_name, v_gender) returning id into v_member;
    insert into public.category_members (category_id, member_id) values (p_category_id, v_member);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Helper internal tidak perlu dipanggil klien.
revoke execute on function public.check_category_pin(public.categories, text) from public, anon, authenticated;
revoke execute on function public.unique_category_slug(text, uuid) from public, anon, authenticated;

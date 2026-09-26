-- Status otomatis saat reset: anggota yang belum mengisi di sesi yang ditutup dicatat dengan status ini.
-- Lihat design.md D11d.

alter table public.categories
  add column reset_status_id uuid references public.statuses (id) on delete set null;
grant select (reset_status_id) on public.categories to authenticated;

-- Isi awal: status aktif berlabel "Alpa" bila ada.
update public.categories c set reset_status_id = (
  select s.id from public.statuses s
  where s.category_id = c.id and s.archived_at is null and lower(btrim(s.label)) = 'alpa'
  order by s.sort_order
  limit 1
);

create function public.set_reset_status(p_category_id uuid, p_status_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_status_id is not null and not exists (
    select 1 from public.statuses
    where id = p_status_id and category_id = p_category_id and archived_at is null
  ) then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  update public.categories set reset_status_id = p_status_id where id = p_category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;
end
$$;

create or replace function public.create_category(p_name text)
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

  update public.categories set reset_status_id = (
    select s.id from public.statuses s where s.category_id = v_id and s.label = 'Alpa'
  ) where categories.id = v_id;

  insert into public.sessions (category_id, session_date) values (v_id, public.today_jakarta());

  return query select v_id, v_slug;
end
$$;

-- Arsip status juga mengosongkan pengaturan status otomatis yang memakainya.
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

-- Reset: isi status otomatis untuk yang belum mengisi -> snapshot -> tutup -> buka sesi baru (atomik).
create or replace function public.reset_category(p_category_id uuid, p_date date default null, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_new uuid;
  v_auto uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.assert_admin();
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'NOTE_TOO_LONG' using errcode = '22023';
  end if;
  select id into v_old from public.sessions
    where category_id = p_category_id and closed_at is null
    for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select s.id into v_auto
    from public.categories c
    join public.statuses s on s.id = c.reset_status_id and s.archived_at is null
    where c.id = p_category_id;
  if v_auto is not null then
    insert into public.attendance (session_id, member_id, status_id)
      select v_old, cm.member_id, v_auto
      from public.category_members cm
      where cm.category_id = p_category_id
        and not exists (
          select 1 from public.attendance a where a.session_id = v_old and a.member_id = cm.member_id
        );
  end if;

  insert into public.session_members (session_id, member_id)
    select v_old, member_id from public.category_members where category_id = p_category_id;
  update public.sessions set closed_at = now() where id = v_old;
  insert into public.sessions (category_id, session_date, note)
    values (p_category_id, coalesce(p_date, public.today_jakarta()), v_note)
    returning id into v_new;
  return v_new;
end
$$;

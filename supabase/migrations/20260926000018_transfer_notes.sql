-- Alasan (opsional) saat melepas jamaah dan saat kelompok tujuan menolak.
alter table public.member_transfers
  add column request_note text check (char_length(request_note) <= 500),
  add column decision_note text check (char_length(decision_note) <= 500);

-- Teks kosong/spasi disimpan sebagai null.
create function public.clean_note(p_note text) returns text
language sql immutable
set search_path = ''
as $$
  select nullif(btrim(coalesce(p_note, '')), '')
$$;

drop function public.request_transfer(uuid, uuid);
create function public.request_transfer(p_member uuid, p_to uuid, p_note text default null) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_member public.members;
  v_note text := public.clean_note(p_note);
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
  if char_length(v_note) > 500 then
    raise exception 'TRANSFER_NOTE_TOO_LONG' using errcode = '22023';
  end if;
  insert into public.member_transfers (member_id, from_kelompok, to_kelompok, requested_by, request_note)
    values (p_member, v_kelompok, p_to, auth.uid(), v_note)
    returning id into v_id;
  return v_id;
end
$$;

-- Alasan hanya disimpan bila ditolak.
drop function public.decide_transfer(uuid, boolean);
create function public.decide_transfer(p_transfer uuid, p_accept boolean, p_note text default null) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kelompok uuid := public.assert_kelompok_admin();
  v_t public.member_transfers;
  v_note text := case when p_accept then null else public.clean_note(p_note) end;
begin
  select * into v_t from public.member_transfers
    where id = p_transfer and status = 'pending' and to_kelompok = v_kelompok for update;
  if not found then
    raise exception 'TRANSFER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'TRANSFER_NOTE_TOO_LONG' using errcode = '22023';
  end if;
  if p_accept then
    perform set_config('app.transfer', 'on', true);
    update public.members set kelompok_id = v_t.to_kelompok where id = v_t.member_id;
    perform set_config('app.transfer', '', true);
  end if;
  update public.member_transfers
    set status = case when p_accept then 'accepted' else 'rejected' end,
        decided_by = auth.uid(), decided_at = now(), decision_note = v_note
    where id = p_transfer;
end
$$;

drop function public.list_transfers();
create function public.list_transfers()
returns table (
  id uuid, member_id uuid, from_kelompok uuid, to_kelompok uuid, status text,
  requested_at timestamptz, decided_at timestamptz,
  member_name text, member_gender text, member_birth_date date, member_marital text,
  requested_by_name text, decided_by_name text, request_note text, decision_note text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return query
    select t.id, t.member_id, t.from_kelompok, t.to_kelompok, t.status, t.requested_at, t.decided_at,
      m.name, m.gender, m.birth_date, m.marital_status,
      rp.display_name, dp.display_name, t.request_note, t.decision_note
    from public.member_transfers t
    join public.members m on m.id = t.member_id
    left join public.admin_profiles rp on rp.user_id = t.requested_by
    left join public.admin_profiles dp on dp.user_id = t.decided_by
    where public.unit_in_scope(t.from_kelompok) or public.unit_in_scope(t.to_kelompok)
    order by t.requested_at desc;
end
$$;
revoke execute on function public.list_transfers() from public, anon;
grant execute on function public.list_transfers() to authenticated;

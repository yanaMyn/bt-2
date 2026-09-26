-- PIN tepat 4 digit yang bisa dilihat admin (menggantikan pin_hash). Lihat design.md D5.

alter table public.categories drop constraint categories_pin_hash_required;
alter table public.categories add column pin text check (pin ~ '^[0-9]{4}$');

-- Hash lama tidak bisa dipulihkan menjadi angka: matikan PIN kategori tersebut.
-- Admin perlu menyalakan ulang dengan PIN 4 digit.
update public.categories set pin_enabled = false where pin_enabled;
alter table public.categories drop column pin_hash;
alter table public.categories
  add constraint categories_pin_required check (not pin_enabled or pin is not null);

-- Hanya admin yang boleh membaca PIN; anon tetap tanpa kolom pin.
grant select (pin) on public.categories to authenticated;

create or replace function public.validate_pin(p_pin text) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN_FORMAT' using errcode = '22023';
  end if;
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
  perform public.assert_admin();
  select * into v_cat from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002';
  end if;

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

create or replace function public.check_category_pin(p_cat public.categories, p_pin text) returns boolean
language plpgsql volatile
set search_path = ''
as $$
begin
  if not p_cat.pin_enabled then
    return true;
  end if;
  if p_pin is not null and p_pin = p_cat.pin then
    return true;
  end if;
  perform pg_sleep(0.5);
  return false;
end
$$;

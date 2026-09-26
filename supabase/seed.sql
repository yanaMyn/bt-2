-- Data contoh untuk pengembangan. Jalankan di Supabase SQL Editor SETELAH semua migrasi
-- (dan sebaiknya setelah bootstrap_root_admin). Memakai Daerah yang ada, atau membuat "Daerah Contoh".
-- Membuat: Desa CNT (Kelompok Baitul Ilmi, Citra), Desa CNB (Kelompok Cibubur), jamaah beragam umur &
-- status nikah, kegiatan kelompok dari templat, satu kegiatan Desa dan satu kegiatan Daerah, satu sesi
-- selesai (Remaja, 29 Agustus 2026), satu sesi berjalan sepanjang hari ini (Remaja), dan satu sesi
-- dijadwalkan (Desaan CNT, Minggu berikutnya).

do $$
declare
  v_daerah uuid;
  v_cnt uuid;
  v_cnb uuid;
  v_bi uuid;
  v_citra uuid;
  v_cib uuid;
  v_remaja uuid;
  v_desaan uuid;
  v_past uuid;
  v_hadir uuid;
  v_izin uuid;
  v_today date := public.today_jakarta();
  v_member record;
  v_i int := 0;
begin
  select id into v_daerah from public.org_units where level = 'daerah';
  if v_daerah is null then
    insert into public.org_units (level, name, slug) values ('daerah', 'Daerah Contoh', 'daerah-contoh')
      returning id into v_daerah;
  end if;
  insert into public.org_units (level, parent_id, name, slug) values ('desa', v_daerah, 'CNT', 'cnt') returning id into v_cnt;
  insert into public.org_units (level, parent_id, name, slug) values ('desa', v_daerah, 'CNB', 'cnb') returning id into v_cnb;
  insert into public.org_units (level, parent_id, name, slug) values ('kelompok', v_cnt, 'Baitul Ilmi', 'baitul-ilmi')
    returning id into v_bi;
  insert into public.org_units (level, parent_id, name, slug) values ('kelompok', v_cnt, 'Citra', 'citra')
    returning id into v_citra;
  insert into public.org_units (level, parent_id, name, slug) values ('kelompok', v_cnb, 'Cibubur', 'cibubur')
    returning id into v_cib;

  insert into public.members (name, gender, kelompok_id, birth_date, marital_status) values
    ('Ahmad Fauzi', 'L', v_bi, '2009-03-12', 'belum'),
    ('Bagas Pratama', 'L', v_bi, '2008-07-01', 'belum'),
    ('Dinda Lestari', 'P', v_bi, '2010-01-20', 'belum'),
    ('Elsa Rahmawati', 'P', v_bi, '2009-11-05', 'belum'),
    ('Fajar Nugroho', 'L', v_bi, '2017-04-18', 'belum'),
    ('Gita Permata', 'P', v_bi, '2016-09-09', 'belum'),
    ('Hana Salsabila', 'P', v_bi, '1985-02-14', 'menikah'),
    ('Siti Aminah', 'P', v_bi, '1970-06-30', 'janda_duda'),
    ('Pak Ilham', 'L', v_bi, '1982-12-01', 'menikah'),
    ('Umi Kalsum', 'P', v_bi, null, 'belum'),
    ('Rizki Hidayat', 'L', v_citra, '2009-05-05', 'belum'),
    ('Wulan Sari', 'P', v_citra, '1990-08-17', 'menikah'),
    ('Yusuf Hakim', 'L', v_cib, '2008-02-02', 'belum');

  -- Kegiatan: kategori + status bawaan + status otomatis Alpa.
  insert into public.categories (name, slug, owner_unit_id, criteria_min_age, criteria_max_age)
    values ('Remaja', 'remaja-baitul-ilmi', v_bi, 16, 19) returning id into v_remaja;
  insert into public.categories (name, slug, owner_unit_id, criteria_min_age, criteria_max_age)
    values ('Caberawit', 'caberawit-baitul-ilmi', v_bi, 5, 11);
  insert into public.categories (name, slug, owner_unit_id, criteria_gender, criteria_marital)
    values ('Ibu-ibu', 'ibu-ibu-baitul-ilmi', v_bi, 'P', 'pernah');
  insert into public.categories (name, slug, owner_unit_id)
    values ('Desaan CNT', 'desaan-cnt', v_cnt) returning id into v_desaan;
  insert into public.categories (name, slug, owner_unit_id)
    values ('Pengajian Daerah', 'pengajian-daerah', v_daerah);
  insert into public.statuses (category_id, label, color, sort_order, counts_as_present)
    select c.id, s.label, s.color, s.sort_order, s.present
    from public.categories c
    cross join (values ('Hadir', '#16a34a', 1, true), ('Izin', '#eab308', 2, false),
                       ('Sakit', '#2563eb', 3, false), ('Alpa', '#dc2626', 4, false)) s(label, color, sort_order, present);
  update public.categories c set reset_status_id = s.id
    from public.statuses s where s.category_id = c.id and s.label = 'Alpa';

  select id into v_hadir from public.statuses where category_id = v_remaja and label = 'Hadir';
  select id into v_izin from public.statuses where category_id = v_remaja and label = 'Izin';

  -- Sesi lampau Remaja: sebagian hadir, lalu selesai otomatis (yang belum mengisi dicatat Alpa).
  insert into public.sessions (category_id, session_date, start_time, end_time, note)
    values (v_remaja, '2026-08-29', '19:30', '21:00', 'Pertemuan akhir Agustus') returning id into v_past;
  for v_member in select p.member_id from public.activity_participants(v_remaja, '2026-08-29') p loop
    v_i := v_i + 1;
    if v_i <= 2 then
      insert into public.attendance (session_id, member_id, status_id)
        values (v_past, v_member.member_id, case when v_i = 1 then v_hadir else v_izin end);
    end if;
  end loop;
  perform public.finalize_category(v_remaja);

  -- Sesi berjalan Remaja sepanjang hari ini, dengan satu isian.
  insert into public.sessions (category_id, session_date, start_time, end_time, note)
    values (v_remaja, v_today, '00:00', '23:59:59', 'Sesi contoh sepanjang hari');
  insert into public.attendance (session_id, member_id, status_id)
    select s.id, (select p.member_id from public.activity_participants(v_remaja, v_today) p limit 1), v_hadir
    from public.sessions s where s.category_id = v_remaja and s.closed_at is null;

  -- Sesi dijadwalkan Desaan CNT pada hari Minggu berikutnya.
  insert into public.sessions (category_id, session_date, start_time, end_time, grace_hours)
    values (v_desaan, v_today + (7 - extract(dow from v_today)::int), '08:00', '10:00', 6);
end
$$;

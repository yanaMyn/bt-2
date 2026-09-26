-- Data contoh untuk pengembangan. Jalankan di Supabase SQL Editor SETELAH semua migrasi.
-- Membuat 2 kategori, 22 anggota (1 orang di dua kategori), 1 sesi selesai, 1 sesi berjalan (sepanjang hari ini)
-- dengan sebagian isian, dan 1 sesi dijadwalkan untuk Kajian Ahad.

select set_config('request.jwt.claims', '{"role":"authenticated"}', false);

do $$
declare
  v_kelas uuid;
  v_kajian uuid;
  v_hadir uuid;
  v_izin uuid;
  v_sakit uuid;
  v_member record;
  v_i int := 0;
  v_past uuid;
  v_today date := public.today_jakarta();
begin
  select id into v_kelas from public.create_category('Kelas A');
  select id into v_kajian from public.create_category('Kajian Ahad');

  perform public.import_members(v_kelas, '[
    {"name":"Ahmad Fauzi","gender":"L"},{"name":"Bagas Pratama","gender":"L"},
    {"name":"Dimas Saputra","gender":"L"},{"name":"Fajar Nugroho","gender":"L"},
    {"name":"Hafiz Ramadhan","gender":"L"},{"name":"Ilham Maulana","gender":"L"},
    {"name":"Citra Dewi","gender":"P"},{"name":"Dinda Lestari","gender":"P"},
    {"name":"Elsa Rahmawati","gender":"P"},{"name":"Fitri Handayani","gender":"P"},
    {"name":"Gita Permata","gender":"P"},{"name":"Hana Salsabila","gender":"P"}
  ]'::jsonb);
  perform public.import_members(v_kajian, '[
    {"name":"Budi Santoso","gender":"L"},{"name":"Rizki Hidayat","gender":"L"},
    {"name":"Yusuf Hakim","gender":"L"},{"name":"Zaki Firmansyah","gender":"L"},
    {"name":"Aisyah Putri","gender":"P"},{"name":"Nur Azizah","gender":"P"},
    {"name":"Rina Marlina","gender":"P"},{"name":"Siti Aminah","gender":"P"},
    {"name":"Umi Kalsum","gender":"P"},{"name":"Wulan Sari","gender":"P"}
  ]'::jsonb);
  -- Satu orang tergabung di dua kategori.
  insert into public.category_members (category_id, member_id)
    select v_kajian, id from public.members where name = 'Ahmad Fauzi';

  select id into v_hadir from public.statuses where category_id = v_kelas and label = 'Hadir';
  select id into v_izin from public.statuses where category_id = v_kelas and label = 'Izin';
  select id into v_sakit from public.statuses where category_id = v_kelas and label = 'Sakit';

  -- Sesi lampau Kelas A: hampir semua hadir, lalu selesai otomatis karena waktunya sudah lewat.
  perform public.schedule_sessions(v_kelas, jsonb_build_array(jsonb_build_object(
    'date', '2026-08-29', 'start', '19:30', 'end', '21:00', 'note', 'Pertemuan akhir Agustus')));
  select id into v_past from public.sessions where category_id = v_kelas and session_date = '2026-08-29';
  for v_member in
    select m.id from public.members m join public.category_members cm on cm.member_id = m.id
    where cm.category_id = v_kelas order by m.name
  loop
    v_i := v_i + 1;
    insert into public.attendance (session_id, member_id, status_id)
      values (v_past, v_member.id, case when v_i = 3 then v_izin else v_hadir end);
  end loop;
  perform public.finalize_category(v_kelas);

  -- Sesi berjalan Kelas A sepanjang hari ini (agar contoh selalu bisa diisi).
  perform public.schedule_sessions(v_kelas, jsonb_build_array(jsonb_build_object(
    'date', v_today, 'start', '00:00', 'end', '23:59:59', 'note', 'Sesi contoh sepanjang hari')));

  -- Sesi dijadwalkan Kajian Ahad pada hari Minggu berikutnya.
  perform public.schedule_sessions(v_kajian, jsonb_build_array(jsonb_build_object(
    'date', v_today + (7 - extract(dow from v_today)::int), 'start', '08:00', 'end', '10:00', 'grace', 6)));

  -- Sesi berjalan Kelas A: sebagian sudah diisi.
  v_i := 0;
  for v_member in
    select m.id from public.members m join public.category_members cm on cm.member_id = m.id
    where cm.category_id = v_kelas order by m.name limit 7
  loop
    v_i := v_i + 1;
    perform public.set_attendance(v_kelas, v_member.id, case when v_i = 5 then v_sakit else v_hadir end, null);
  end loop;
end
$$;

select set_config('request.jwt.claims', '', false);

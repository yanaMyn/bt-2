-- Penutupan otomatis sesi setiap menit dengan pg_cron (tersedia di Supabase, termasuk paket Free).
-- Aman gagal: bila pg_cron tidak tersedia (mis. lingkungan test), migrasi tetap berhasil dan
-- penutupan terjadi saat ada pengisian atau admin membuka panel. Lihat design.md D3.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  -- cron.schedule dengan nama yang sama memperbarui job yang sudah ada.
  perform cron.schedule('finalize-sessions', '* * * * *', 'select public.finalize_due_sessions()');
exception when others then
  raise notice 'pg_cron tidak tersedia, penutupan otomatis terjadwal dilewati: %', sqlerrm;
end
$$;

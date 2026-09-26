export function ConfigError({ missing }: { missing: string[] }) {
  return (
    <main className="mx-auto max-w-xl p-4">
      <div className="mt-10 rounded-2xl border border-red-200 bg-white p-5">
        <h1 className="text-xl font-bold text-red-700">Konfigurasi belum lengkap</h1>
        <p className="mt-2 text-muted">
          Aplikasi belum bisa terhubung ke database. Isi variabel berikut di file <code>.env</code>{' '}
          (lihat <code>.env.example</code>) lalu jalankan ulang aplikasi:
        </p>
        <ul className="mt-3 list-disc pl-6 font-mono text-sm">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}

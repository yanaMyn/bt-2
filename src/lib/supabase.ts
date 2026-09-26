import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Nama variabel lingkungan yang belum diisi; kosong berarti konfigurasi lengkap. */
export const missingEnv: string[] = [
  !url && 'VITE_SUPABASE_URL',
  !anonKey && 'VITE_SUPABASE_ANON_KEY',
].filter((v): v is string => Boolean(v))

// Klien tetap dibuat agar modul lain bisa mengimpornya; App menampilkan layar
// error konfigurasi sebelum ada request bila env belum lengkap.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-anon-key')

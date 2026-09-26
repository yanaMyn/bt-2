import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigError } from '../components/ConfigError'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('konfigurasi Supabase', () => {
  it('melaporkan variabel yang kosong', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { missingEnv } = await import('./supabase')
    expect(missingEnv).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  })

  it('kosong bila keduanya terisi', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key')
    const { missingEnv } = await import('./supabase')
    expect(missingEnv).toEqual([])
  })

  it('layar error menyebut variabel yang perlu diisi', () => {
    const html = renderToString(<ConfigError missing={['VITE_SUPABASE_URL']} />)
    expect(html).toContain('Konfigurasi belum lengkap')
    expect(html).toContain('VITE_SUPABASE_URL')
  })
})

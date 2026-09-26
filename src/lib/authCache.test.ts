import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { clearAdminCacheOnUserChange } from './authCache'

type Cb = (event: string, session: { user: { id: string } } | null) => void

function setup() {
  let cb: Cb = () => {}
  const auth = {
    onAuthStateChange: (f: Cb) => {
      cb = f
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
  }
  const qc = new QueryClient()
  clearAdminCacheOnUserChange(auth, qc)
  const seed = () => {
    qc.setQueryData(['admin', 'me'], { username: 'lama' })
    qc.setQueryData(['structure'], ['publik'])
  }
  const emit = (event: string, id: string | null) => cb(event, id ? { user: { id } } : null)
  return { qc, seed, emit }
}

describe('clearAdminCacheOnUserChange', () => {
  it('mempertahankan cache untuk sesi awal dan refresh token akun yang sama', () => {
    const { qc, seed, emit } = setup()
    seed()
    emit('INITIAL_SESSION', 'u1')
    emit('TOKEN_REFRESHED', 'u1')
    expect(qc.getQueryData(['admin', 'me'])).toEqual({ username: 'lama' })
  })

  it('membuang cache admin saat keluar atau berganti akun, cache publik tetap', () => {
    const { qc, seed, emit } = setup()
    emit('INITIAL_SESSION', 'u1')
    seed()
    emit('SIGNED_OUT', null)
    expect(qc.getQueryData(['admin', 'me'])).toBeUndefined()
    expect(qc.getQueryData(['structure'])).toEqual(['publik'])

    seed()
    emit('SIGNED_IN', 'u2')
    expect(qc.getQueryData(['admin', 'me'])).toBeUndefined()
  })
})

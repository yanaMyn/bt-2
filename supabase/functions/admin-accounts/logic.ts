// Logika murni Edge Function admin-accounts (tanpa API Deno), dipakai juga oleh klien & test.
// Lihat openspec/changes/add-org-hierarchy/design.md D4.

export const USERNAME_RE = /^[a-z0-9._]{3,32}$/
export const MIN_PASSWORD = 8
/** Domain email sintetis untuk akun nama pengguna; tidak pernah dikirimi email. */
export const SYNTHETIC_DOMAIN = 'users.absensi.local'

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${SYNTHETIC_DOMAIN}`
}

/** Input login: dengan "@" dipakai sebagai email apa adanya, tanpa "@" dianggap nama pengguna. */
export function loginIdToEmail(input: string): string {
  const v = input.trim().toLowerCase()
  return v.includes('@') ? v : usernameToEmail(v)
}

export type AccountAction =
  | { action: 'create'; unit_id: string; username: string; display_name: string; password: string }
  | { action: 'reset_password'; user_id: string; password: string }
  | { action: 'set_active'; user_id: string; active: boolean }

export type Parsed = { ok: true; value: AccountAction } | { ok: false; error: string }

const isStr = (v: unknown): v is string => typeof v === 'string'

export function validatePassword(p: unknown): string | null {
  return isStr(p) && p.length >= MIN_PASSWORD ? null : 'PASSWORD_TOO_SHORT'
}

export function parseRequest(body: unknown): Parsed {
  if (!body || typeof body !== 'object') return { ok: false, error: 'INVALID_REQUEST' }
  const b = body as Record<string, unknown>
  switch (b.action) {
    case 'create': {
      const username = isStr(b.username) ? b.username.trim().toLowerCase() : ''
      const display = isStr(b.display_name) ? b.display_name.trim() : ''
      if (!isStr(b.unit_id) || !b.unit_id) return { ok: false, error: 'INVALID_REQUEST' }
      if (!USERNAME_RE.test(username)) return { ok: false, error: 'INVALID_USERNAME' }
      if (!display) return { ok: false, error: 'DISPLAY_NAME_EMPTY' }
      const pw = validatePassword(b.password)
      if (pw) return { ok: false, error: pw }
      return {
        ok: true,
        value: { action: 'create', unit_id: b.unit_id, username, display_name: display, password: b.password as string },
      }
    }
    case 'reset_password': {
      if (!isStr(b.user_id) || !b.user_id) return { ok: false, error: 'INVALID_REQUEST' }
      const pw = validatePassword(b.password)
      if (pw) return { ok: false, error: pw }
      return { ok: true, value: { action: 'reset_password', user_id: b.user_id, password: b.password as string } }
    }
    case 'set_active': {
      if (!isStr(b.user_id) || !b.user_id || typeof b.active !== 'boolean') return { ok: false, error: 'INVALID_REQUEST' }
      return { ok: true, value: { action: 'set_active', user_id: b.user_id, active: b.active } }
    }
    default:
      return { ok: false, error: 'INVALID_REQUEST' }
  }
}

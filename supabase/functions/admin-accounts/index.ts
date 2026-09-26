// Edge Function "admin-accounts": membuat akun admin, mereset password, dan (non)aktifkan akun.
// Deploy lewat Supabase Dashboard -> Edge Functions -> editor (salin index.ts & logic.ts).
// Otorisasi: pemanggil harus admin aktif yang boleh mengelola admin unit target
// (Daerah -> admin Desa, Desa -> admin Kelompok anaknya), diperiksa lewat RPC dengan JWT pemanggil.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseRequest, usernameToEmail } from './logic.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Akun nonaktif diblokir di Auth selama ~100 tahun; "none" mencabut blokir.
const BAN_FOREVER = '876000h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // Klien sebagai pemanggil (RLS & RPC berlaku) dan klien layanan (kunci rahasia, hanya di server).
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const service = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: me } = await asCaller.rpc('my_admin_profile')
  const caller = Array.isArray(me) ? me[0] : null
  if (!caller) return json(401, { error: 'NOT_ADMIN' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'INVALID_REQUEST' })
  }
  const parsed = parseRequest(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const input = parsed.value

  const canManage = async (unitId: string) => {
    const { data, error } = await asCaller.rpc('can_admin_unit_admins', { p_unit: unitId })
    return !error && data === true
  }

  if (input.action === 'create') {
    if (!(await canManage(input.unit_id))) return json(403, { error: 'NOT_ALLOWED' })
    const { data: taken } = await service
      .from('admin_profiles')
      .select('user_id')
      .eq('username', input.username)
      .maybeSingle()
    if (taken) return json(409, { error: 'USERNAME_TAKEN' })

    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email: usernameToEmail(input.username),
      password: input.password,
      email_confirm: true,
      user_metadata: { username: input.username, display_name: input.display_name },
    })
    if (createErr || !created.user) {
      return json(createErr?.status === 422 ? 409 : 500, { error: createErr?.status === 422 ? 'USERNAME_TAKEN' : 'CREATE_FAILED' })
    }
    const { error: profileErr } = await service.from('admin_profiles').insert({
      user_id: created.user.id,
      username: input.username,
      display_name: input.display_name,
      unit_id: input.unit_id,
      must_change_password: true,
      created_by: caller.user_id,
    })
    if (profileErr) {
      await service.auth.admin.deleteUser(created.user.id)
      return json(500, { error: 'CREATE_FAILED' })
    }
    return json(200, { ok: true, user_id: created.user.id })
  }

  // reset_password & set_active: target harus admin unit yang boleh dikelola pemanggil.
  if (input.user_id === caller.user_id) return json(403, { error: 'CANNOT_TARGET_SELF' })
  const { data: target } = await service
    .from('admin_profiles')
    .select('unit_id')
    .eq('user_id', input.user_id)
    .maybeSingle()
  if (!target || !(await canManage(target.unit_id))) return json(403, { error: 'NOT_ALLOWED' })

  if (input.action === 'reset_password') {
    const { error } = await service.auth.admin.updateUserById(input.user_id, { password: input.password })
    if (error) return json(500, { error: 'UPDATE_FAILED' })
    await service.from('admin_profiles').update({ must_change_password: true }).eq('user_id', input.user_id)
    return json(200, { ok: true })
  }

  const { error } = await service.auth.admin.updateUserById(input.user_id, {
    ban_duration: input.active ? 'none' : BAN_FOREVER,
  })
  if (error) return json(500, { error: 'UPDATE_FAILED' })
  await service.from('admin_profiles').update({ is_active: input.active }).eq('user_id', input.user_id)
  return json(200, { ok: true })
})

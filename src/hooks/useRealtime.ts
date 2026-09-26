import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

/**
 * Berlangganan perubahan tabel lewat Supabase Realtime. Event DELETE tidak bisa
 * difilter di server, jadi penyaringan dilakukan di handler.
 */
export function useRealtime(
  channelName: string | null,
  tables: readonly { table: string; filter?: string }[],
  onChange: (table: string, payload: Payload) => void,
) {
  const handler = useRef(onChange)
  handler.current = onChange
  const tablesKey = JSON.stringify(tables)

  useEffect(() => {
    if (!channelName) return
    const channel = supabase.channel(channelName)
    for (const t of JSON.parse(tablesKey) as { table: string; filter?: string }[]) {
      channel.on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
        (payload: Payload) => handler.current(t.table, payload),
      )
    }
    channel.subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelName, tablesKey])
}

/** Ambil nilai kolom dari record baru atau lama pada payload realtime. */
export function payloadValue(payload: Payload, column: string): unknown {
  const rec = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Record<string, unknown>
  return rec?.[column]
}

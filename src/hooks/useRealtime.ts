import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

export interface RealtimeBinding {
  table: string
  /** Default semua event. Filter server tidak berlaku untuk DELETE. */
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  /** Filter server, mis. `session_id=eq.<id>` atau `session_id=in.(a,b)`. */
  filter?: string
}

/** Status kanal dari Supabase Realtime (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`). */
export type RealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

let seq = 0

/**
 * Berlangganan perubahan tabel lewat Supabase Realtime. `channelName = null` melepas kanal
 * (mis. saat halaman tidak terlihat). Event DELETE tidak bisa difilter di server, jadi
 * penyaringannya dilakukan di handler.
 */
export function useRealtime(
  channelName: string | null,
  bindings: readonly RealtimeBinding[],
  onChange: (table: string, payload: Payload) => void,
  onStatus?: (status: RealtimeStatus) => void,
) {
  const handler = useRef(onChange)
  handler.current = onChange
  const statusHandler = useRef(onStatus)
  statusHandler.current = onStatus
  const bindingsKey = JSON.stringify(bindings)

  useEffect(() => {
    if (!channelName) return
    let disposed = false
    // Nama unik per pemasangan: kanal lama dilepas secara async, jadi nama yang sama bisa bentrok.
    const channel = supabase.channel(`${channelName}#${++seq}`)
    for (const b of JSON.parse(bindingsKey) as RealtimeBinding[]) {
      channel.on(
        'postgres_changes' as never,
        { event: b.event ?? '*', schema: 'public', table: b.table, ...(b.filter ? { filter: b.filter } : {}) },
        (payload: Payload) => handler.current(b.table, payload),
      )
    }
    channel.subscribe((status: string) => {
      if (!disposed) statusHandler.current?.(status as RealtimeStatus)
    })
    return () => {
      disposed = true
      void supabase.removeChannel(channel)
    }
  }, [channelName, bindingsKey])
}

/** Ambil nilai kolom dari record baru atau lama pada payload realtime. */
export function payloadValue(payload: Payload, column: string): unknown {
  const rec = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Record<string, unknown>
  return rec?.[column]
}

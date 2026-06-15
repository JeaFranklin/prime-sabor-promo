/**
 * agenda.ts — Cliente do bucket Supabase Storage que armazena a agenda (Bot Viana)
 *
 * A VPS faz upload do JSON 1x por hora (cron — ver task #23). Aqui só lemos.
 * Cache em memória de 60s pra economizar leituras quando vier rajada de perguntas.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { AgendaJson } from './tipos'

const BUCKET = 'viana-agenda'
const ARQUIVO = 'agenda-atual.json'
const CACHE_TTL_MS = 60_000

let _cache: { data: AgendaJson; ts: number } | null = null

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function carregarAgenda(): Promise<AgendaJson | null> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data
  }

  try {
    const supa = adminClient()
    const { data, error } = await supa.storage.from(BUCKET).download(ARQUIVO)
    if (error || !data) {
      console.error(`[viana] falha ao baixar agenda do Storage: ${error?.message || 'sem retorno'}`)
      return _cache?.data || null
    }
    const json = JSON.parse(await data.text()) as AgendaJson
    _cache = { data: json, ts: now }
    console.log(`[viana] agenda carregada: ${json.total_linhas} linhas (gerada em ${json.gerada_em})`)
    return json
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[viana] erro ao carregar agenda: ${msg}`)
    return _cache?.data || null
  }
}

/** Helper: verifica se uma string ISO bate com uma data alvo (compara só YYYY-MM-DD). */
export function mesmaData(d: string | null | undefined, alvo: Date): boolean {
  if (!d) return false
  const data = new Date(d)
  if (isNaN(data.getTime())) return false
  return data.toISOString().slice(0, 10) === alvo.toISOString().slice(0, 10)
}

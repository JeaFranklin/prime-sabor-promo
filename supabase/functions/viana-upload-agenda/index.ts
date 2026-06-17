/**
 * viana-upload-agenda — Edge Function | Bot Viana
 * Baixa Excel do OneDrive via Microsoft Graph API, converte pra JSON e salva no Storage
 * Substitui: /opt/viana/scripts/upload_agenda.py
 * Agendado via pg_cron: 0 * * * * (toda hora)
 *
 * SETUP NECESSÁRIO (fazer 1x no portal Azure):
 *   Veja: docs/setup-microsoft-graph.md
 *
 * Secrets necessários (supabase secrets set):
 *   VIANA_MS_TENANT_ID       — ID do tenant Azure (ex: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
 *   VIANA_MS_CLIENT_ID       — Client ID do app Azure registrado
 *   VIANA_MS_CLIENT_SECRET   — Client Secret do app Azure
 *   VIANA_MS_REFRESH_TOKEN   — Refresh token obtido no setup inicial
 *   VIANA_ONEDRIVE_FILE_PATH — Caminho do Excel no OneDrive (ex: "Agenda/Agenda Viana.xlsx")
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MS_TENANT_ID         = Deno.env.get('VIANA_MS_TENANT_ID')!
const MS_CLIENT_ID         = Deno.env.get('VIANA_MS_CLIENT_ID')!
const MS_CLIENT_SECRET     = Deno.env.get('VIANA_MS_CLIENT_SECRET')!
const MS_REFRESH_TOKEN     = Deno.env.get('VIANA_MS_REFRESH_TOKEN')!
const ONEDRIVE_FILE_PATH   = Deno.env.get('VIANA_ONEDRIVE_FILE_PATH')!

const BUCKET  = 'viana-agenda'
const ARQUIVO = 'agenda-atual.json'

function log(msg: string) {
  console.log(`[viana-upload-agenda] ${msg}`)
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        refresh_token: MS_REFRESH_TOKEN,
        grant_type:    'refresh_token',
        scope:         'https://graph.microsoft.com/Files.Read.All offline_access',
      }),
    }
  )
  if (!res.ok) throw new Error(`Erro ao obter token: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

async function downloadExcel(token: string): Promise<ArrayBuffer> {
  // Caminho: /me/drive/root:/PASTA/ARQUIVO.xlsx:/content
  const encodedPath = encodeURIComponent(ONEDRIVE_FILE_PATH)
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Erro ao baixar Excel: ${res.status} ${await res.text()}`)
  return res.arrayBuffer()
}

function parseExcel(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[]

  return rows
    .map(row => {
      // Normaliza data — pode vir como Date ou string
      let dataStr: string | null = null
      const rawData = row['DATA'] ?? row['Data'] ?? null
      if (rawData instanceof Date) {
        dataStr = rawData.toISOString().slice(0, 10)
      } else if (rawData) {
        dataStr = String(rawData).trim() || null
      }

      return {
        mes:       row['MES']       ?? row['Mês']        ?? null,
        data:      dataStr,
        diaSemana: row['DIA SEM']   ?? row['Dia Sem']    ?? null,
        cod:       row['COD']       ?? row['Cod']        ?? null,
        descricao: row['DESC']      ?? row['Fornecedor'] ?? row['FORNECEDOR'] ?? null,
        fluxo:     row['FLUXO']     ?? row['Fluxo']      ?? null,
        prazo:     row['PRAZO']     ?? row['Prazo']      ?? null,
        status:    row['STATUS']    ?? row['Status']     ?? null,
        comprador: row['COMPRADOR'] ?? row['Comprador']  ?? null,
        pedido:    row['PEDIDO']    ?? row['Pedido']     ?? null,
      }
    })
    .filter(l => l.data || l.cod || l.descricao)
}

Deno.serve(async () => {
  try {
    log('iniciando...')

    const token = await getAccessToken()
    log('token Microsoft OK')

    const buffer = await downloadExcel(token)
    log(`excel baixado: ${buffer.byteLength} bytes`)

    const linhas = parseExcel(buffer)
    log(`linhas parseadas: ${linhas.length}`)

    const payload = JSON.stringify({
      gerada_em:    new Date().toISOString(),
      total_linhas: linhas.length,
      linhas,
    })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ARQUIVO, new TextEncoder().encode(payload), {
        contentType: 'application/json',
        upsert: true,
      })

    if (error) throw new Error(`Storage erro: ${error.message}`)
    log(`OK: ${linhas.length} linhas salvas no Storage`)

    return new Response(JSON.stringify({ ok: true, linhas: linhas.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log(`ERRO: ${err.message}`)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

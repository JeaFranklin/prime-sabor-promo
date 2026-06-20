/**
 * viana-upload-agenda — Edge Function | Bot Viana
 * Recebe o Excel da Agenda de Atendimento via Power Automate (body binário),
 * converte pra JSON e salva no Supabase Storage.
 * Substitui: /opt/viana/scripts/upload_agenda.py
 *
 * Fluxo: Power Automate detecta alteração no OneDrive → faz POST aqui com o arquivo
 *
 * Secrets necessários (já configurados):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BUCKET  = 'viana-agenda'
const ARQUIVO = 'agenda-atual.json'

function log(msg: string) {
  console.log(`[viana-upload-agenda] ${msg}`)
}

function parseExcel(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // Lê tudo como arrays para encontrar a linha real de cabeçalho
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][]

  // Detecta a linha de cabeçalho: primeira linha que contém pelo menos 2 dessas palavras-chave
  const keywords = ['data', 'cod', 'status', 'fornecedor', 'desc', 'mes', 'fluxo', 'prazo']
  let headerIdx = -1
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    const row = allRows[i] ?? []
    const cells = row.map((c: unknown) => String(c ?? '').toLowerCase())
    const hits = keywords.filter(k => cells.some(c => c.includes(k)))
    if (hits.length >= 2) { headerIdx = i; break }
  }

  if (headerIdx === -1) {
    console.log(`[viana-upload-agenda] cabecalho nao encontrado. Primeiras linhas: ${JSON.stringify(allRows.slice(0, 5))}`)
    return []
  }

  const headers = (allRows[headerIdx] as unknown[]).map(h => String(h ?? '').trim())
  console.log(`[viana-upload-agenda] cabecalho na linha ${headerIdx + 1}: ${headers.join(' | ')}`)

  const dataRows = allRows.slice(headerIdx + 1)
  // Loga as 3 primeiras linhas de dados para diagnóstico
  dataRows.slice(0, 3).forEach((row, i) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, j) => { obj[h] = row[j] ?? null })
    console.log(`[viana-upload-agenda] linha dados ${i + 1}: ${JSON.stringify(obj)}`)
  })

  return dataRows
    .map(row => {
      const r: Record<string, unknown> = {}
      headers.forEach((h, i) => { r[h] = row[i] ?? null })

      let dataStr: string | null = null
      const rawData = r['DATA'] ?? r['Data'] ?? r['DT'] ?? r['Dt'] ?? null
      if (rawData instanceof Date) {
        dataStr = rawData.toISOString().slice(0, 10)
      } else if (rawData) {
        dataStr = String(rawData).trim() || null
      }

      return {
        mes:       r['MES']        ?? r['Mês']         ?? null,
        data:      dataStr,
        diaSemana: r['DIA SEMANA'] ?? r['DIA SEM']     ?? r['Dia Sem']    ?? null,
        cod:       r['COD FORN']   ?? r['COD']          ?? r['Cod']        ?? null,
        descricao: r['FORNECEDOR'] ?? r['DESC']         ?? r['Fornecedor'] ?? r['DESCRICAO'] ?? null,
        secao:     r['SECAO']      ?? r['Seção']        ?? r['SECÇÃO']     ?? null,
        fluxo:     r['FLUXO']      ?? r['Fluxo']        ?? null,
        prazo:     r['PRAZO']      ?? r['Prazo']        ?? null,
        status:    r['STATUS']     ?? r['Status']       ?? null,
        comprador: r['COMPRADOR']  ?? r['Comprador']    ?? null,
        pedido:    r['PEDIDO']     ?? r['Pedido']       ?? null,
      }
    })
    .filter(l => l.cod || l.descricao || l.diaSemana)
}

Deno.serve(async (req) => {
  try {
    log('iniciando...')

    // Lê o arquivo Excel enviado pelo Power Automate no body da requisição
    const buffer = await req.arrayBuffer()
    log(`arquivo recebido: ${buffer.byteLength} bytes`)

    if (buffer.byteLength < 100) {
      throw new Error('Body vazio ou muito pequeno — o Power Automate deve enviar o arquivo Excel no body da requisição.')
    }

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

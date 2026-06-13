/**
 * Renderiza o template React-PDF em buffer, sobe pro Storage privado
 * e devolve o path + signed URL com validade.
 *
 * Server-only. Usa o service-role key.
 */
import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
import { TemplatePromotora } from './template-promotora'
import { TemplateCliente } from './template-cliente'
import type { ConteudoContratoCliente, ConteudoContratoPromotora } from './tipos'

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7  // 7 dias

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type ResultadoPDF = {
  storagePath: string
  signedUrl: string
  hash: string
  bytes: number
}

export async function gerarPdfPromotora(
  dados: ConteudoContratoPromotora,
): Promise<ResultadoPDF> {
  const buffer = await renderToBuffer(<TemplatePromotora dados={dados} />)
  return uploadParaStorage(buffer, `promotora/${dados.numero}.pdf`)
}

export async function gerarPdfCliente(
  dados: ConteudoContratoCliente,
): Promise<ResultadoPDF> {
  const buffer = await renderToBuffer(<TemplateCliente dados={dados} />)
  return uploadParaStorage(buffer, `cliente/${dados.numero}.pdf`)
}

async function uploadParaStorage(buffer: Buffer, path: string): Promise<ResultadoPDF> {
  const supa = adminClient()
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  console.log(`[contratos] uploading PDF ${path} (${buffer.length} bytes, sha256=${hash.slice(0,12)}…)`)

  const { error: upErr } = await supa.storage
    .from('contratos')
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (upErr) {
    console.error(`[contratos] falha no upload: ${upErr.message}`)
    throw new Error(`Upload do PDF falhou: ${upErr.message}`)
  }

  const { data: signed, error: signErr } = await supa.storage
    .from('contratos')
    .createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (signErr || !signed) {
    throw new Error(`Falha ao gerar signed URL: ${signErr?.message || 'sem dados'}`)
  }

  return {
    storagePath: path,
    signedUrl: signed.signedUrl,
    hash,
    bytes: buffer.length,
  }
}

/** Re-gera a signed URL de um PDF já existente. Usado quando expira. */
export async function reassinarUrl(storagePath: string): Promise<string> {
  const supa = adminClient()
  const { data, error } = await supa.storage
    .from('contratos')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC)
  if (error || !data) throw new Error(`Falha ao reassinar URL: ${error?.message}`)
  return data.signedUrl
}

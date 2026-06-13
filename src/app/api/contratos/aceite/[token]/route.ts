/**
 * GET  /api/contratos/aceite/[token]
 *   → devolve metadados do contrato + signed URL do PDF (pra página pública abrir)
 *
 * POST /api/contratos/aceite/[token]
 *   body: { acao: 'aceitar' | 'recusar', nome_digitado?: string, motivo?: string }
 *   → registra aceite ou recusa com IP, UA, data/hora (MP 2.200-2/2001)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { reassinarUrl } from '@/lib/contratos/gerar-pdf'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const supa = adminClient()
  const { data, error } = await supa
    .from('contratos')
    .select('id, numero, tipo, status, expira_em, pdf_path, valor_total, data_inicio_servico, data_fim_servico, qtd_dias, aceito_em, recusado_em, conteudo_json')
    .eq('token_aceite', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  }
  if (data.expira_em && new Date(data.expira_em) < new Date()) {
    return NextResponse.json({ ...data, expirado: true, signed_url: null })
  }
  const signed_url = await reassinarUrl(data.pdf_path)
  return NextResponse.json({ ...data, expirado: false, signed_url })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const acao = body.acao as 'aceitar' | 'recusar' | undefined
  if (!acao || !['aceitar', 'recusar'].includes(acao)) {
    return NextResponse.json({ error: 'acao inválida' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
  const ua = req.headers.get('user-agent') || null

  const supa = adminClient()
  const { data: contrato, error } = await supa
    .from('contratos').select('id, status, expira_em').eq('token_aceite', token).maybeSingle()
  if (error || !contrato) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  if (contrato.status === 'aceito' || contrato.status === 'recusado') {
    return NextResponse.json({ error: `Contrato já foi ${contrato.status}` }, { status: 409 })
  }
  if (contrato.expira_em && new Date(contrato.expira_em) < new Date()) {
    return NextResponse.json({ error: 'Link expirado — solicite reenvio' }, { status: 410 })
  }

  const update = acao === 'aceitar'
    ? {
        status: 'aceito' as const,
        aceito_em: new Date().toISOString(),
        aceito_ip: ip, aceito_user_agent: ua,
        aceito_nome_digitado: (body.nome_digitado || '').trim() || null,
      }
    : {
        status: 'recusado' as const,
        recusado_em: new Date().toISOString(),
        recusa_motivo: (body.motivo || '').trim() || null,
      }

  const { error: upErr } = await supa.from('contratos').update(update).eq('id', contrato.id)
  if (upErr) {
    console.error('[api/contratos/aceite] update falhou:', upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  console.log(`[api/contratos/aceite] contrato ${contrato.id} → ${update.status} (IP ${ip})`)
  return NextResponse.json({ ok: true, status: update.status })
}

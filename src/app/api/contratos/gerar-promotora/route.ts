/**
 * POST /api/contratos/gerar-promotora
 *   body: { servico_id: string, promotora_id: string }
 *
 * Chamado pela JFS APÓS a proposta ter sido aceita pela promotora.
 * Gera o contrato individual da promotora + linka com a proposta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarContratoDePromotora } from '@/lib/contratos/automacao'

export async function POST(req: NextRequest) {
  try {
    const { servico_id, promotora_id } = await req.json()
    if (!servico_id || !promotora_id) {
      return NextResponse.json({ error: 'servico_id e promotora_id são obrigatórios' }, { status: 400 })
    }
    const resumo = await gerarContratoDePromotora(servico_id, promotora_id)
    return NextResponse.json(resumo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/contratos/gerar-promotora] erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

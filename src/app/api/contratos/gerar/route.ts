/**
 * POST /api/contratos/gerar
 *   body: { servico_id: string }
 *
 * Dispara a geração de todos os contratos para um serviço (>= 5 dias).
 * Idempotente — não duplica se já houver contrato ativo para a mesma parte.
 */
import { NextRequest, NextResponse } from 'next/server'
import { gerarContratosDoServico } from '@/lib/contratos/automacao'

export async function POST(req: NextRequest) {
  try {
    const { servico_id } = await req.json()
    if (!servico_id) {
      return NextResponse.json({ error: 'servico_id é obrigatório' }, { status: 400 })
    }
    console.log(`[api/contratos/gerar] requisição para servico_id=${servico_id}`)
    const resumo = await gerarContratosDoServico(servico_id)
    return NextResponse.json(resumo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/contratos/gerar] erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

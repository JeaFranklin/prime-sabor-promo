/**
 * POST /api/relatorios/[tipo]/pdf
 *
 * Recebe { periodo: { inicio, fim } } no body, busca os dados de novo
 * (mesma query da tela), agrega, gera PDF e devolve direto pra download.
 *
 * Auth: usa o cliente SSR (createSupabaseServer) que lê o cookie.
 *   - Se usuário não logado → 401
 *   - Se logado → RLS deixa ler normalmente (role authenticated)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import {
  agregarFinanceiro, agregarOperacional, agregarPromotoras,
  agregarClientes, agregarPendencias,
} from '@/lib/relatorios/agregadores'
import { gerarPdfRelatorio } from '@/lib/relatorios/gerar-pdf'
import type { TipoRelatorio, PeriodoFiltro } from '@/lib/relatorios/tipos'

const TIPOS_VALIDOS: TipoRelatorio[] = ['financeiro','operacional','promotoras','clientes','pendencias']

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tipo: string }> },
) {
  const { tipo } = await ctx.params

  if (!TIPOS_VALIDOS.includes(tipo as TipoRelatorio)) {
    return NextResponse.json({ error: `Tipo inválido: ${tipo}` }, { status: 400 })
  }
  const tipoR = tipo as TipoRelatorio

  // Body
  let body: { periodo?: PeriodoFiltro }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const periodo = body.periodo
  if (!periodo || !periodo.inicio || !periodo.fim) {
    return NextResponse.json({ error: 'Faltam datas inicio/fim' }, { status: 400 })
  }

  // Auth — cookie do navegador
  const supa = await createSupabaseServer()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  console.log(`[relatorios/pdf] tipo=${tipoR} periodo=${periodo.inicio}→${periodo.fim} user=${user.email}`)

  try {
    // Buffer do PDF — fluxo é: query → agregador → template → buffer
    let buffer: Buffer

    if (tipoR === 'financeiro') {
      const { data, error } = await supa.from('servicos').select(`
        id, nome, status, data_inicio, data_fim,
        valor_cliente, valor_total_cliente, valor_diaria, num_promotoras,
        tipo_acao, cliente_id,
        clientes:cliente_id ( id, nome_empresa ),
        escala ( valor_diaria, promotora_id )
      `).gte('data_inicio', periodo.inicio).lte('data_inicio', periodo.fim)
        .order('data_inicio', { ascending: false })
      if (error) throw error
      const res = agregarFinanceiro((data as unknown as Parameters<typeof agregarFinanceiro>[0]) ?? [])
      buffer = await gerarPdfRelatorio('financeiro', periodo, res)
    }
    else if (tipoR === 'operacional') {
      const { data, error } = await supa.from('servicos').select(`
        id, nome, status, data_inicio, data_fim, num_promotoras,
        clientes:cliente_id ( nome_empresa )
      `).gte('data_inicio', periodo.inicio).lte('data_inicio', periodo.fim)
        .order('data_inicio', { ascending: false })
      if (error) throw error
      const res = agregarOperacional((data as unknown as Parameters<typeof agregarOperacional>[0]) ?? [])
      buffer = await gerarPdfRelatorio('operacional', periodo, res)
    }
    else if (tipoR === 'promotoras') {
      const { count: ativas } = await supa.from('promotoras')
        .select('id', { count: 'exact', head: true }).eq('status', 'ativo')
      const { data, error } = await supa.from('escala').select(`
        promotora_id, valor_diaria,
        servico:servico_id!inner ( id, data_inicio, data_fim, valor_diaria ),
        promotora:promotora_id ( id, nome, status, foto_url, avaliacao_media )
      `).gte('servico.data_inicio', periodo.inicio).lte('servico.data_inicio', periodo.fim)
      if (error) throw error
      const res = agregarPromotoras(
        (data as unknown as Parameters<typeof agregarPromotoras>[0]) ?? [],
        ativas ?? 0,
      )
      buffer = await gerarPdfRelatorio('promotoras', periodo, res)
    }
    else if (tipoR === 'clientes') {
      const { data, error } = await supa.from('servicos').select(`
        id, valor_cliente, valor_total_cliente, tipo_acao, cliente_id,
        clientes:cliente_id ( id, nome_empresa )
      `).gte('data_inicio', periodo.inicio).lte('data_inicio', periodo.fim)
      if (error) throw error
      const res = agregarClientes((data as unknown as Parameters<typeof agregarClientes>[0]) ?? [])
      buffer = await gerarPdfRelatorio('clientes', periodo, res)
    }
    else {  // pendencias
      const { data, error } = await supa.from('escala').select(`
        id, servico_id, promotora_id, valor_diaria,
        status_confirmacao, status_pagamento,
        servico:servico_id (
          id, nome, data_inicio, data_fim, valor_diaria,
          data_emissao_nf, prazo_pagamento_dias,
          clientes:cliente_id ( nome_empresa )
        )
      `).or('status_confirmacao.eq.pendente,status_pagamento.eq.pendente')
      if (error) throw error
      const res = agregarPendencias((data as unknown as Parameters<typeof agregarPendencias>[0]) ?? [])
      buffer = await gerarPdfRelatorio('pendencias', periodo, res)
    }

    console.log(`[relatorios/pdf] gerado ${buffer.length} bytes`)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-${tipoR}-${periodo.inicio}-a-${periodo.fim}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = (e as { message?: string })?.message || JSON.stringify(e)
    console.error(`[relatorios/pdf] falhou:`, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

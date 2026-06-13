/**
 * Relatório Financeiro — Faturamento, Custo e Margem por período.
 *
 * Estrutura:
 *   - 4 cards (receita, custo, margem R$, margem %)
 *   - LineChart com séries mensais de receita/custo/margem
 *   - Tabela detalhada serviço-a-serviço
 *   - Botão de exportar PDF
 */
'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { HeaderRelatorio } from '../_components/HeaderRelatorio'
import { FiltroPeriodo } from '../_components/FiltroPeriodo'
import { CardResumo } from '../_components/CardResumo'
import { BotaoExportarPdf } from '../_components/BotaoExportarPdf'
import { agregarFinanceiro, periodoPadrao } from '@/lib/relatorios/agregadores'
import { moeda, dataBR } from '@/lib/contratos/formatar'
import type { PeriodoFiltro, ResultadoFinanceiro } from '@/lib/relatorios/tipos'
import { STATUS_SERVICO_LABEL } from '@/lib/relatorios/tipos'

export default function RelatorioFinanceiro() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [resultado, setResultado] = useState<ResultadoFinanceiro | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        console.log(`[financeiro] carregando periodo=${periodo.inicio}→${periodo.fim}`)
        const { data, error } = await supabase
          .from('servicos')
          .select(`
            id, nome, status, data_inicio, data_fim,
            valor_cliente, valor_total_cliente, valor_diaria, num_promotoras,
            tipo_acao, cliente_id,
            clientes:cliente_id ( id, nome_empresa ),
            escala ( valor_diaria, promotora_id )
          `)
          .gte('data_inicio', periodo.inicio)
          .lte('data_inicio', periodo.fim)
          .order('data_inicio', { ascending: false })

        if (error) throw error
        const res = agregarFinanceiro((data as unknown as Parameters<typeof agregarFinanceiro>[0]) ?? [])
        console.log(`[financeiro] ${res.linhas.length} servicos agregados, margem=${res.cards.margem_total}`)
        setResultado(res)
      } catch (e) {
        const msg = (e as { message?: string })?.message || JSON.stringify(e)
        console.error('[financeiro] falhou:', msg)
        setErro('Erro ao carregar: ' + msg)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [periodo])

  const cards = resultado?.cards

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderRelatorio
        titulo="Financeiro"
        emoji="💰"
        acoes={
          <BotaoExportarPdf
            tipo="financeiro"
            periodo={periodo}
            filenamePrefix="relatorio-financeiro"
          />
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Calculando…</div>
        ) : !resultado || resultado.linhas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">Nenhum serviço encontrado nesse período.</p>
          </div>
        ) : (
          <>
            {/* Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <CardResumo
                label="Receita"
                valor={moeda(cards?.receita_total)}
                emoji="📈"
                tom="azul"
                hint={`${cards?.qtd_servicos ?? 0} serviço(s)`}
              />
              <CardResumo
                label="Custo Promotoras"
                valor={moeda(cards?.custo_total)}
                emoji="💸"
                tom="vermelho"
              />
              <CardResumo
                label="Margem"
                valor={moeda(cards?.margem_total)}
                emoji="💵"
                tom={(cards?.margem_total ?? 0) >= 0 ? 'verde' : 'vermelho'}
              />
              <CardResumo
                label="Margem %"
                valor={`${(cards?.margem_pct ?? 0).toFixed(1)}%`}
                emoji="📊"
                tom={(cards?.margem_pct ?? 0) >= 30 ? 'verde' : (cards?.margem_pct ?? 0) >= 15 ? 'amarelo' : 'vermelho'}
              />
            </div>

            {/* Gráfico — só se tiver mais de 1 mês */}
            {resultado.serie.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Evolução mensal</h2>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={resultado.serie} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes_label" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => moeda(v).replace('R$', '')} />
                      <Tooltip formatter={(v) => moeda(Number(v) || 0)} />
                      <Legend />
                      <Line type="monotone" dataKey="receita" name="Receita" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="custo" name="Custo" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="margem" name="Margem" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tabela detalhada */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">
                Detalhamento por serviço ({resultado.linhas.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Serviço</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Período</th>
                      <th className="px-3 py-2 text-right">Receita</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 text-right">Margem</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((l) => (
                      <tr key={l.servico_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{l.servico_nome}</td>
                        <td className="px-3 py-2 text-gray-600">{l.cliente_nome}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {dataBR(l.data_inicio)} → {dataBR(l.data_fim)}
                        </td>
                        <td className="px-3 py-2 text-right text-blue-700">{moeda(l.receita)}</td>
                        <td className="px-3 py-2 text-right text-red-700">{moeda(l.custo)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${l.margem >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {moeda(l.margem)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{l.margem_pct.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{STATUS_SERVICO_LABEL[l.status] ?? l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                      <td className="px-3 py-2 text-right text-blue-700">{moeda(cards?.receita_total)}</td>
                      <td className="px-3 py-2 text-right text-red-700">{moeda(cards?.custo_total)}</td>
                      <td className={`px-3 py-2 text-right ${(cards?.margem_total ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {moeda(cards?.margem_total)}
                      </td>
                      <td className="px-3 py-2 text-right">{(cards?.margem_pct ?? 0).toFixed(1)}%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

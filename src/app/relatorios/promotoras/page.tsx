/**
 * Relatório Performance Promotoras — ranking por valor recebido no período.
 *
 * Cards: total ativas, qtd serviços no período, total pago, avaliação média.
 * Gráfico: BarChart horizontal top 10 por valor.
 * Tabela: ranking completo com foto, qtd serviços, R$ recebido, avaliação.
 */
'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { HeaderRelatorio } from '../_components/HeaderRelatorio'
import { FiltroPeriodo } from '../_components/FiltroPeriodo'
import { CardResumo } from '../_components/CardResumo'
import { BotaoExportarPdf } from '../_components/BotaoExportarPdf'
import { agregarPromotoras, periodoPadrao } from '@/lib/relatorios/agregadores'
import { moeda } from '@/lib/contratos/formatar'
import type { PeriodoFiltro, ResultadoPromotoras } from '@/lib/relatorios/tipos'

export default function RelatorioPromotoras() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [resultado, setResultado] = useState<ResultadoPromotoras | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        // 1) Conta promotoras ativas
        const { count: ativas } = await supabase
          .from('promotoras')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ativo')

        // 2) Escala do período (filtrando pelos serviços do período)
        const { data, error } = await supabase
          .from('escala')
          .select(`
            promotora_id, valor_diaria,
            servico:servico_id!inner ( id, data_inicio, data_fim, valor_diaria ),
            promotora:promotora_id ( id, nome, status, foto_url, avaliacao_media )
          `)
          .gte('servico.data_inicio', periodo.inicio)
          .lte('servico.data_inicio', periodo.fim)

        if (error) throw error
        setResultado(agregarPromotoras(
          (data as unknown as Parameters<typeof agregarPromotoras>[0]) ?? [],
          ativas ?? 0,
        ))
      } catch (e) {
        setErro('Erro: ' + ((e as { message?: string })?.message || JSON.stringify(e)))
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [periodo])

  const cards = resultado?.cards
  const top10 = resultado?.linhas.slice(0, 10) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderRelatorio
        titulo="Performance Promotoras"
        emoji="👩"
        acoes={
          <BotaoExportarPdf tipo="promotoras" periodo={periodo} filenamePrefix="relatorio-promotoras" />
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4">{erro}</div>}

        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Calculando…</div>
        ) : !resultado || resultado.linhas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">Nenhuma escala encontrada no período.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <CardResumo label="Promotoras ativas" valor={String(cards?.total_promotoras_ativas ?? 0)} emoji="👩‍💼" tom="azul" />
              <CardResumo label="Escalas no período" valor={String(cards?.qtd_servicos_periodo ?? 0)} emoji="📅" tom="cinza" />
              <CardResumo label="Total pago" valor={moeda(cards?.total_pago)} emoji="💸" tom="verde" />
              <CardResumo
                label="Avaliação média"
                valor={cards?.avaliacao_media_geral ? cards.avaliacao_media_geral.toFixed(1) + ' ⭐' : '—'}
                emoji="⭐"
                tom="amarelo"
              />
            </div>

            {top10.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Top 10 por valor recebido</h2>
                <div style={{ width: '100%', height: Math.max(220, top10.length * 32) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={top10}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" fontSize={12} tickFormatter={(v) => moeda(v).replace('R$', '')} />
                      <YAxis type="category" dataKey="promotora_nome" stroke="#6b7280" fontSize={11} width={100} />
                      <Tooltip formatter={(v) => moeda(Number(v) || 0)} />
                      <Bar dataKey="total_recebido" name="Recebido" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">
                Ranking completo ({resultado.linhas.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Promotora</th>
                      <th className="px-3 py-2 text-center">Serviços</th>
                      <th className="px-3 py-2 text-right">Recebido</th>
                      <th className="px-3 py-2 text-center">Avaliação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((l, i) => (
                      <tr key={l.promotora_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            {l.foto_url
                              ? <img src={l.foto_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{l.promotora_nome.slice(0, 1)}</div>
                            }
                            <span className="truncate max-w-[180px]">{l.promotora_nome}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">{l.qtd_servicos}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{moeda(l.total_recebido)}</td>
                        <td className="px-3 py-2 text-center text-amber-600">
                          {l.avaliacao_media ? `${l.avaliacao_media.toFixed(1)} ⭐` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Relatório Operacional — Volume de serviços por status, no período.
 *
 * Cards: total, confirmado, em andamento, concluído, cancelado.
 * Gráfico: PieChart com distribuição por status.
 * Tabela: lista de serviços com status + cliente.
 */
'use client'

import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { HeaderRelatorio } from '../_components/HeaderRelatorio'
import { FiltroPeriodo } from '../_components/FiltroPeriodo'
import { CardResumo } from '../_components/CardResumo'
import { BotaoExportarPdf } from '../_components/BotaoExportarPdf'
import { agregarOperacional, periodoPadrao } from '@/lib/relatorios/agregadores'
import { dataBR } from '@/lib/contratos/formatar'
import type { PeriodoFiltro, ResultadoOperacional } from '@/lib/relatorios/tipos'
import { STATUS_SERVICO_LABEL } from '@/lib/relatorios/tipos'

export default function RelatorioOperacional() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [resultado, setResultado] = useState<ResultadoOperacional | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const { data, error } = await supabase
          .from('servicos')
          .select(`
            id, nome, status, data_inicio, data_fim, num_promotoras,
            clientes:cliente_id ( nome_empresa )
          `)
          .gte('data_inicio', periodo.inicio)
          .lte('data_inicio', periodo.fim)
          .order('data_inicio', { ascending: false })
        if (error) throw error
        setResultado(agregarOperacional((data as unknown as Parameters<typeof agregarOperacional>[0]) ?? []))
      } catch (e) {
        setErro('Erro: ' + ((e as { message?: string })?.message || JSON.stringify(e)))
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
        titulo="Operacional"
        emoji="📊"
        acoes={
          <BotaoExportarPdf tipo="operacional" periodo={periodo} filenamePrefix="relatorio-operacional" />
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
            <p className="text-gray-500">Nenhum serviço encontrado nesse período.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <CardResumo label="Total" valor={String(cards?.total ?? 0)} emoji="📋" tom="cinza" />
              <CardResumo label="Confirmado" valor={String(cards?.confirmado ?? 0)} emoji="✅" tom="azul" />
              <CardResumo label="Em andamento" valor={String(cards?.em_andamento ?? 0)} emoji="🏃" tom="amarelo" />
              <CardResumo label="Concluídos" valor={String(cards?.concluido ?? 0)} emoji="🏁" tom="verde" />
              <CardResumo label="Cancelados" valor={String(cards?.cancelado ?? 0)} emoji="🚫" tom="vermelho" />
            </div>

            {resultado.distribuicao.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Distribuição por status</h2>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={resultado.distribuicao}
                        dataKey="qtd"
                        nameKey="status_label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {resultado.distribuicao.map((d) => (
                          <Cell key={d.status} fill={d.cor} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">
                Serviços ({resultado.linhas.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Serviço</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Período</th>
                      <th className="px-3 py-2 text-center">Promotoras</th>
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
                        <td className="px-3 py-2 text-center text-gray-700">{l.num_promotoras}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{STATUS_SERVICO_LABEL[l.status] ?? l.status}</td>
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

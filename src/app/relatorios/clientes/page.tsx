/**
 * Relatório Clientes — top clientes por faturamento + distribuição por tipo_acao.
 *
 * Cards: qtd clientes, faturamento total, ticket médio.
 * Gráficos: BarChart top 10 clientes + PieChart por tipo_acao.
 * Tabela: ranking completo de clientes.
 */
'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { HeaderRelatorio } from '../_components/HeaderRelatorio'
import { FiltroPeriodo } from '../_components/FiltroPeriodo'
import { CardResumo } from '../_components/CardResumo'
import { BotaoExportarPdf } from '../_components/BotaoExportarPdf'
import { agregarClientes, periodoPadrao } from '@/lib/relatorios/agregadores'
import { moeda } from '@/lib/contratos/formatar'
import type { PeriodoFiltro, ResultadoClientes } from '@/lib/relatorios/tipos'

const CORES_TIPO = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#a855f7']

export default function RelatorioClientes() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoPadrao())
  const [resultado, setResultado] = useState<ResultadoClientes | null>(null)
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
            id, valor_cliente, valor_total_cliente, tipo_acao, cliente_id,
            clientes:cliente_id ( id, nome_empresa )
          `)
          .gte('data_inicio', periodo.inicio)
          .lte('data_inicio', periodo.fim)
        if (error) throw error
        setResultado(agregarClientes((data as unknown as Parameters<typeof agregarClientes>[0]) ?? []))
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
        titulo="Clientes / Tipo de Serviço"
        emoji="🏢"
        acoes={
          <BotaoExportarPdf tipo="clientes" periodo={periodo} filenamePrefix="relatorio-clientes" />
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4">{erro}</div>}

        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Calculando…</div>
        ) : !resultado || resultado.top_clientes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">Nenhum serviço encontrado no período.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <CardResumo label="Clientes ativos" valor={String(cards?.qtd_clientes_ativos ?? 0)} emoji="🏢" tom="azul" />
              <CardResumo label="Faturamento" valor={moeda(cards?.faturamento_total)} emoji="💰" tom="verde" />
              <CardResumo label="Ticket médio" valor={moeda(cards?.ticket_medio_geral)} emoji="🎯" tom="cinza" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Top clientes */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Top 10 clientes</h2>
                <div style={{ width: '100%', height: Math.max(220, resultado.top_clientes.length * 30) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={resultado.top_clientes}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" fontSize={11} tickFormatter={(v) => moeda(v).replace('R$', '')} />
                      <YAxis type="category" dataKey="cliente_nome" stroke="#6b7280" fontSize={11} width={100} />
                      <Tooltip formatter={(v) => moeda(Number(v) || 0)} />
                      <Bar dataKey="faturamento" name="Faturamento" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Por tipo_acao */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Por tipo de serviço</h2>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={resultado.por_tipo_acao}
                        dataKey="faturamento"
                        nameKey="tipo_acao"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name }) => String(name ?? '')}
                      >
                        {resultado.por_tipo_acao.map((_, i) => (
                          <Cell key={i} fill={CORES_TIPO[i % CORES_TIPO.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => moeda(Number(v) || 0)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">
                Ranking de clientes ({resultado.top_clientes.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-center">Serviços</th>
                      <th className="px-3 py-2 text-right">Faturamento</th>
                      <th className="px-3 py-2 text-right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.top_clientes.map((c, i) => (
                      <tr key={c.cliente_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{c.cliente_nome}</td>
                        <td className="px-3 py-2 text-center text-gray-700">{c.qtd_servicos}</td>
                        <td className="px-3 py-2 text-right text-purple-700 font-semibold">{moeda(c.faturamento)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{moeda(c.ticket_medio)}</td>
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

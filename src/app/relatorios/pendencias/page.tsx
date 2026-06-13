/**
 * Relatório Pendências — lista acionável de serviços com problemas.
 *
 * Sem gráfico: é um to-do operacional. 2 tipos de problema:
 *   1) confirmação_pendente — promotora não respondeu se vai ou não
 *   2) pagamento_pendente   — data_fim do serviço passou e o pgto ainda está 'pendente'
 *
 * Sem filtro de período — pendência é "agora", não importa quando o serviço foi.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { HeaderRelatorio } from '../_components/HeaderRelatorio'
import { CardResumo } from '../_components/CardResumo'
import { BotaoExportarPdf } from '../_components/BotaoExportarPdf'
import { agregarPendencias, periodoPadrao } from '@/lib/relatorios/agregadores'
import { moeda, dataBR } from '@/lib/contratos/formatar'
import type { ResultadoPendencias } from '@/lib/relatorios/tipos'

export default function RelatorioPendencias() {
  const [resultado, setResultado] = useState<ResultadoPendencias | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const { data, error } = await supabase
          .from('escala')
          .select(`
            id, servico_id, promotora_id, valor_diaria,
            status_confirmacao, status_pagamento,
            servico:servico_id (
              id, nome, data_inicio, data_fim, valor_diaria,
              data_emissao_nf, prazo_pagamento_dias,
              clientes:cliente_id ( nome_empresa )
            )
          `)
          .or('status_confirmacao.eq.pendente,status_pagamento.eq.pendente')
        if (error) throw error
        setResultado(agregarPendencias((data as unknown as Parameters<typeof agregarPendencias>[0]) ?? []))
      } catch (e) {
        setErro('Erro: ' + ((e as { message?: string })?.message || JSON.stringify(e)))
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  const cards = resultado?.cards

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderRelatorio
        titulo="Pendências"
        emoji="⚠️"
        acoes={
          <BotaoExportarPdf
            tipo="pendencias"
            periodo={periodoPadrao()}
            filenamePrefix="relatorio-pendencias"
          />
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-900">
          ⚡ Esta tela mostra o que precisa de ação <strong>agora</strong> — independente de período.
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4">{erro}</div>}

        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Carregando…</div>
        ) : !resultado || resultado.linhas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-gray-700 font-semibold">Tudo em dia!</p>
            <p className="text-gray-500 text-sm">Nenhuma pendência operacional no momento.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <CardResumo label="Total pendências" valor={String(cards?.total_pendencias ?? 0)} emoji="⚠️" tom="amarelo" />
              <CardResumo label="Pgto atrasados" valor={String(cards?.pagamentos_atrasados ?? 0)} emoji="💸" tom="vermelho" />
              <CardResumo label="Confirmações" valor={String(cards?.confirmacoes_pendentes ?? 0)} emoji="❓" tom="azul" />
              <CardResumo label="R$ em atraso" valor={moeda(cards?.valor_em_atraso)} emoji="🧾" tom="vermelho" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">
                Lista de ações ({resultado.linhas.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Serviço</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Período</th>
                      <th className="px-3 py-2 text-left">Detalhe</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((p, i) => {
                      const eAtraso = p.problema === 'pagamento_pendente'
                      return (
                        <tr key={`${p.servico_id}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            {eAtraso
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">💸 Pagamento</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">❓ Confirmação</span>
                            }
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-800">{p.servico_nome}</td>
                          <td className="px-3 py-2 text-gray-600">{p.cliente_nome}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {dataBR(p.data_inicio)} → {dataBR(p.data_fim)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{p.detalhe}</td>
                          <td className="px-3 py-2 text-right text-red-700 font-semibold">
                            {p.valor != null ? moeda(p.valor) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/servicos/${p.servico_id}`}
                              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
                            >
                              Abrir →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
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

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { notificarWhatsApp } from '@/lib/notificar'
import { BlocoContratos } from './BlocoContratos'

type Servico = {
  id: string
  nome: string
  produto: string | null
  tipo_acao: string | null
  data_inicio: string | null
  data_fim: string | null
  horario_inicio: string | null
  horario_fim: string | null
  rua: string | null
  numero: string | null
  bairro: string | null
  cep: string | null
  cidade: string | null
  estado: string | null
  responsavel_local_nome: string | null
  responsavel_local_contato: string | null
  briefing_produto: string | null
  briefing_roteiro: string | null
  briefing_uniforme: string | null
  briefing_levar: string | null
  briefing_nao_fazer: string | null
  briefing_metas: string | null
  valor_cliente: number | null
  valor_diaria: number | null
  num_promotoras: number
  status: string
  observacoes: string | null
  created_at: string
  clientes: { id: string; nome_empresa: string } | null
}

type EscalaItem = {
  id: string
  promotora_id: string
  is_lider: boolean
  is_reserva: boolean
  status_confirmacao: string
  valor_diaria: number | null
  status_pagamento: string
  observacao: string | null
  promotoras: { id: string; nome: string; whatsapp: string | null; cidade: string | null; foto_url: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  proposta: 'Proposta',
  negociacao: 'Negociação',
  confirmado: 'Confirmado',
  briefing: 'Briefing',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  faturado: 'Faturado',
  pago: 'Pago',
}

const STATUS_CORES: Record<string, string> = {
  proposta: 'bg-gray-100 text-gray-600',
  negociacao: 'bg-yellow-100 text-yellow-700',
  confirmado: 'bg-blue-100 text-blue-700',
  briefing: 'bg-purple-100 text-purple-700',
  em_andamento: 'bg-orange-100 text-orange-700',
  concluido: 'bg-green-100 text-green-700',
  faturado: 'bg-teal-100 text-teal-700',
  pago: 'bg-emerald-100 text-emerald-700',
}

const CONFIRMACAO_CORES: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  recusou: 'bg-red-100 text-red-700',
}

const STATUS_ORDEM = ['proposta', 'negociacao', 'confirmado', 'briefing', 'em_andamento', 'concluido', 'faturado', 'pago']

const TIPO_ICONES: Record<string, string> = {
  degustacao: '🍽️',
  demonstracao: '🎯',
  abordagem: '🗣️',
  sampling: '🎁',
}

export default function ServicoDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [servico, setServico] = useState<Servico | null>(null)
  const [escala, setEscala] = useState<EscalaItem[]>([])
  const [aba, setAba] = useState<'dados' | 'escala' | 'briefing' | 'financeiro'>('dados')
  const [carregando, setCarregando] = useState(true)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [salvandoBriefing, setSalvandoBriefing] = useState(false)

  const [briefing, setBriefing] = useState({
    briefing_produto: '',
    briefing_roteiro: '',
    briefing_uniforme: '',
    briefing_levar: '',
    briefing_nao_fazer: '',
    briefing_metas: '',
  })

  // Escala — adicionar promotora
  const [promotoras, setPromotoras] = useState<{ id: string; nome: string; cidade: string | null; avaliacao_media: number | null }[]>([])
  const [promotoraFiltro, setPromotoraFiltro] = useState('')
  const [adicionandoEscala, setAdicionandoEscala] = useState(false)

  useEffect(() => {
    buscarDados()
  }, [id])

  async function buscarDados() {
    setCarregando(true)
    const [{ data: srv }, { data: esc }, { data: proms }] = await Promise.all([
      supabase.from('servicos').select('*, clientes(id, nome_empresa)').eq('id', id).single(),
      supabase.from('escala').select('*, promotoras(id, nome, whatsapp, cidade, foto_url)').eq('servico_id', id).order('created_at'),
      supabase.from('promotoras').select('id, nome, cidade, avaliacao_media').eq('status', 'ativo').order('nome'),
    ])
    if (srv) {
      setServico(srv as Servico)
      setBriefing({
        briefing_produto: srv.briefing_produto || '',
        briefing_roteiro: srv.briefing_roteiro || '',
        briefing_uniforme: srv.briefing_uniforme || '',
        briefing_levar: srv.briefing_levar || '',
        briefing_nao_fazer: srv.briefing_nao_fazer || '',
        briefing_metas: srv.briefing_metas || '',
      })
    }
    setEscala((esc as EscalaItem[]) || [])
    setPromotoras(proms || [])
    setCarregando(false)
  }

  // Dados do serviço no formato que a notificação espera.
  function payloadServico() {
    return {
      nome: servico?.nome || 'serviço',
      data_inicio: servico?.data_inicio,
      horario_inicio: servico?.horario_inicio,
      cidade: servico?.cidade,
      bairro: servico?.bairro,
    }
  }

  // Destinatários = promotoras da escala (com número), opcionalmente só as confirmadas.
  function destinatariosEscala(somenteConfirmadas = false) {
    return escala
      .filter(e => e.promotoras?.whatsapp && (!somenteConfirmadas || e.status_confirmacao === 'confirmada'))
      .map(e => ({ numero: e.promotoras!.whatsapp, nome: e.promotoras!.nome, valor: e.valor_diaria }))
  }

  async function avancarStatus() {
    if (!servico) return
    const idx = STATUS_ORDEM.indexOf(servico.status)
    if (idx >= STATUS_ORDEM.length - 1) return
    const novoStatus = STATUS_ORDEM[idx + 1]
    setSalvandoStatus(true)
    await supabase.from('servicos').update({ status: novoStatus }).eq('id', id)
    setServico(s => s ? { ...s, status: novoStatus } : s)
    setSalvandoStatus(false)

    // Fluxos por mudança de status: check-in (em andamento) e relatório (concluído).
    if (novoStatus === 'em_andamento') {
      notificarWhatsApp('checkin', payloadServico(), destinatariosEscala())
    } else if (novoStatus === 'concluido') {
      notificarWhatsApp('relatorio', payloadServico(), destinatariosEscala())
    }
  }

  async function salvarBriefing() {
    setSalvandoBriefing(true)
    await supabase.from('servicos').update({
      briefing_produto: briefing.briefing_produto || null,
      briefing_roteiro: briefing.briefing_roteiro || null,
      briefing_uniforme: briefing.briefing_uniforme || null,
      briefing_levar: briefing.briefing_levar || null,
      briefing_nao_fazer: briefing.briefing_nao_fazer || null,
      briefing_metas: briefing.briefing_metas || null,
    }).eq('id', id)
    setSalvandoBriefing(false)
    alert('Briefing salvo! ✅')

    // Fluxo: avisa as promotoras da escala que o briefing está disponível.
    notificarWhatsApp('briefing', payloadServico(), destinatariosEscala())
  }

  async function adicionarNaEscala(promotora_id: string) {
    setAdicionandoEscala(true)
    const { error } = await supabase.from('escala').insert({
      servico_id: id,
      promotora_id,
      is_lider: false,
      is_reserva: false,
      status_confirmacao: 'pendente',
      valor_diaria: servico?.valor_diaria || null,
      status_pagamento: 'pendente',
    })
    if (!error) await buscarDados()
    setAdicionandoEscala(false)
    setPromotoraFiltro('')

    // Fluxo: avisa a promotora recém-escalada. Buscamos o whatsapp dela
    // (a lista de seleção não traz esse campo).
    if (!error) {
      const { data: prom } = await supabase
        .from('promotoras').select('nome, whatsapp').eq('id', promotora_id).single()
      if (prom?.whatsapp) {
        notificarWhatsApp('escalacao', payloadServico(), [{ numero: prom.whatsapp, nome: prom.nome }])
      }
    }
  }

  async function removerDaEscala(escalaId: string) {
    await supabase.from('escala').delete().eq('id', escalaId)
    setEscala(prev => prev.filter(e => e.id !== escalaId))
  }

  async function atualizarConfirmacao(escalaId: string, status: string) {
    await supabase.from('escala').update({ status_confirmacao: status }).eq('id', escalaId)
    setEscala(prev => prev.map(e => e.id === escalaId ? { ...e, status_confirmacao: status } : e))

    // Fluxo: ao confirmar a presença, manda um agradecimento pra promotora.
    if (status === 'confirmada') {
      const item = escala.find(e => e.id === escalaId)
      if (item?.promotoras?.whatsapp) {
        notificarWhatsApp('confirmacao', payloadServico(), [{ numero: item.promotoras.whatsapp, nome: item.promotoras.nome }])
      }
    }
  }

  async function atualizarPagamento(escalaId: string, status: string) {
    await supabase.from('escala').update({ status_pagamento: status }).eq('id', escalaId)
    setEscala(prev => prev.map(e => e.id === escalaId ? { ...e, status_pagamento: status } : e))

    // Fluxo: ao marcar como pago, avisa a promotora (com o valor da diária).
    if (status === 'pago') {
      const item = escala.find(e => e.id === escalaId)
      if (item?.promotoras?.whatsapp) {
        notificarWhatsApp('pagamento', payloadServico(), [{ numero: item.promotoras.whatsapp, nome: item.promotoras.nome, valor: item.valor_diaria }])
      }
    }
  }

  async function toggleLider(escalaId: string, atual: boolean) {
    await supabase.from('escala').update({ is_lider: !atual }).eq('id', escalaId)
    setEscala(prev => prev.map(e => e.id === escalaId ? { ...e, is_lider: !atual } : e))
  }

  function formatarData(d: string | null) {
    if (!d) return '—'
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function formatarHora(h: string | null) {
    if (!h) return ''
    return h.substring(0, 5)
  }

  if (carregando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">⏳ Carregando...</div>
  if (!servico) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Serviço não encontrado.</div>

  const idxStatus = STATUS_ORDEM.indexOf(servico.status)
  const proximoStatus = idxStatus < STATUS_ORDEM.length - 1 ? STATUS_ORDEM[idxStatus + 1] : null

  const totalPagoPromotoras = escala.reduce((s, e) => s + (e.status_pagamento === 'pago' ? (e.valor_diaria || 0) : 0), 0)
  const totalPendentePromotoras = escala.reduce((s, e) => s + (e.status_pagamento === 'pendente' ? (e.valor_diaria || 0) : 0), 0)
  const margem = (servico.valor_cliente || 0) - (totalPagoPromotoras + totalPendentePromotoras)

  const promotorasNaoEscaladas = promotoras.filter(p =>
    !escala.find(e => e.promotora_id === p.id) &&
    (p.nome.toLowerCase().includes(promotoraFiltro.toLowerCase()) || (p.cidade || '').toLowerCase().includes(promotoraFiltro.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/servicos" className="text-white/80 hover:text-white text-sm">← Serviços</Link>
              <span className="text-white/40">|</span>
              <span className="text-white/80 text-sm">Detalhes</span>
            </div>
            <Link href={`/servicos/${id}/editar`} className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition">
              ✏️ Editar
            </Link>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
              {TIPO_ICONES[servico.tipo_acao || ''] || '🗂️'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-lg leading-tight">{servico.nome}</h1>
              <p className="text-white/80 text-sm">
                {servico.clientes?.nome_empresa || 'Sem cliente'}{servico.produto ? ` · ${servico.produto}` : ''}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className="mt-3 flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_CORES[servico.status]}`}>
              {STATUS_LABEL[servico.status]}
            </span>
            {proximoStatus && (
              <button onClick={avancarStatus} disabled={salvandoStatus}
                className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1 rounded-full transition disabled:opacity-50">
                {salvandoStatus ? '...' : `Avançar → ${STATUS_LABEL[proximoStatus]}`}
              </button>
            )}
          </div>

          {/* Progresso */}
          <div className="mt-3 flex gap-1">
            {STATUS_ORDEM.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${i <= idxStatus ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex border-b border-gray-200 bg-white -mx-4 px-4">
          {(['dados', 'escala', 'briefing', 'financeiro'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${aba === a ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500'}`}>
              {a === 'dados' && '📋 Dados'}
              {a === 'escala' && `👥 Escala (${escala.length})`}
              {a === 'briefing' && '📝 Briefing'}
              {a === 'financeiro' && '💰 Financeiro'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <BlocoContratos servicoId={servico.id} dataInicio={servico.data_inicio} dataFim={servico.data_fim} />

        {/* ABA DADOS */}
        {aba === 'dados' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-gray-700">📋 Informações do Serviço</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Tipo de Ação</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{TIPO_ICONES[servico.tipo_acao || ''] || ''} {servico.tipo_acao ? servico.tipo_acao.charAt(0).toUpperCase() + servico.tipo_acao.slice(1) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Promotoras</p>
                  <p className="font-semibold text-gray-700 mt-0.5">👥 {servico.num_promotoras}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Início</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{formatarData(servico.data_inicio)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Fim</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{formatarData(servico.data_fim)}</p>
                </div>
                {servico.horario_inicio && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">Horário</p>
                    <p className="font-semibold text-gray-700 mt-0.5">{formatarHora(servico.horario_inicio)} às {formatarHora(servico.horario_fim)}</p>
                  </div>
                )}
              </div>
              {servico.observacoes && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observações</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{servico.observacoes}</p>
                </div>
              )}
            </div>

            {(servico.rua || servico.cidade) && (
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-700">📍 Local</h3>
                <p className="text-sm text-gray-700">
                  {[servico.rua, servico.numero, servico.bairro].filter(Boolean).join(', ')}
                  {servico.cidade ? ` — ${servico.cidade}${servico.estado ? `/${servico.estado}` : ''}` : ''}
                  {servico.cep ? ` — CEP ${servico.cep}` : ''}
                </p>
                {(servico.rua || servico.cidade) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([servico.rua, servico.numero, servico.bairro, servico.cidade, servico.estado].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold hover:underline">
                    🗺️ Abrir no Google Maps
                  </a>
                )}
              </div>
            )}

            {(servico.responsavel_local_nome || servico.responsavel_local_contato) && (
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-700">👤 Responsável no Local</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  {servico.responsavel_local_nome && <p><span className="text-gray-400">Nome:</span> {servico.responsavel_local_nome}</p>}
                  {servico.responsavel_local_contato && (
                    <p>
                      <span className="text-gray-400">Contato:</span>{' '}
                      <a href={`https://wa.me/55${servico.responsavel_local_contato.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-600 font-semibold hover:underline">
                        📱 {servico.responsavel_local_contato}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ABA ESCALA */}
        {aba === 'escala' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700">👥 Promotoras Escaladas</h3>
                <span className="text-sm text-gray-500">{escala.length}/{servico.num_promotoras}</span>
              </div>

              {escala.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhuma promotora escalada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {escala.map(e => (
                    <div key={e.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold flex-shrink-0">
                          {e.promotoras?.foto_url ? (
                            <img src={e.promotoras.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : e.promotoras?.nome.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800">{e.promotoras?.nome}</p>
                            {e.is_lider && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">👑 Líder</span>}
                            {e.is_reserva && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">🔄 Reserva</span>}
                          </div>
                          <p className="text-xs text-gray-400">{e.promotoras?.cidade || '—'}</p>
                        </div>
                        {e.promotoras?.whatsapp && (
                          <a href={`https://wa.me/55${e.promotoras.whatsapp.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-green-500 hover:text-green-600 text-xl">💬</a>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Confirmação</p>
                          <select value={e.status_confirmacao}
                            onChange={ev => atualizarConfirmacao(e.id, ev.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${CONFIRMACAO_CORES[e.status_confirmacao]}`}>
                            <option value="pendente">Pendente</option>
                            <option value="confirmada">✅ Confirmada</option>
                            <option value="recusou">❌ Recusou</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Pagamento</p>
                          <select value={e.status_pagamento}
                            onChange={ev => atualizarPagamento(e.id, ev.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${e.status_pagamento === 'pago' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            <option value="pendente">⏳ Pendente</option>
                            <option value="pago">✅ Pago</option>
                          </select>
                        </div>
                        {e.valor_diaria != null && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Diária</p>
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                              R$ {Number(e.valor_diaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Líder</p>
                          <button onClick={() => toggleLider(e.id, e.is_lider)}
                            className={`text-xs px-2 py-1 rounded-lg font-semibold transition ${e.is_lider ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                            {e.is_lider ? '👑 Sim' : '👑 Não'}
                          </button>
                        </div>
                      </div>

                      <button onClick={() => removerDaEscala(e.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition">
                        🗑️ Remover da escala
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adicionar promotora */}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-700">➕ Adicionar Promotora</h3>
              <input
                value={promotoraFiltro}
                onChange={e => setPromotoraFiltro(e.target.value)}
                placeholder='🔍 Buscar por nome ou cidade...'
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-400" />
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {promotorasNaoEscaladas.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => adicionarNaEscala(p.id)} disabled={adicionandoEscala}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-violet-50 transition text-left disabled:opacity-50">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                      {p.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-700">{p.nome}</p>
                      <p className="text-xs text-gray-400">{p.cidade || '—'}{p.avaliacao_media ? ` · ⭐ ${p.avaliacao_media}` : ''}</p>
                    </div>
                    <span className="text-violet-500 text-xs font-bold">+ Add</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ABA BRIEFING */}
        {aba === 'briefing' && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-700">📝 Briefing do Serviço</h3>
            <p className="text-xs text-gray-400">Este documento é enviado às promotoras com tudo que precisam saber.</p>

            {[
              { key: 'briefing_produto', label: '🛍️ Apresentação do Produto', placeholder: 'O que é o produto, diferenciais, como funciona...' },
              { key: 'briefing_roteiro', label: '🗣️ Roteiro de Abordagem', placeholder: 'O que falar ao abordar os clientes, script de vendas...' },
              { key: 'briefing_uniforme', label: '👗 Uniforme e Apresentação', placeholder: 'O que usar, maquiagem, cabelo, calçado...' },
              { key: 'briefing_levar', label: '🎒 O que Levar', placeholder: 'Materiais, produto, onde retirar...' },
              { key: 'briefing_nao_fazer', label: '🚫 O que NÃO Fazer', placeholder: 'Regras do cliente e do local, proibições...' },
              { key: 'briefing_metas', label: '🎯 Metas', placeholder: 'Quantas degustações, abordagens, vendas esperadas...' },
            ].map(campo => (
              <div key={campo.key}>
                <label className="text-xs font-semibold text-gray-600">{campo.label}</label>
                <textarea
                  value={briefing[campo.key as keyof typeof briefing]}
                  onChange={e => setBriefing(b => ({ ...b, [campo.key]: e.target.value }))}
                  rows={3} placeholder={campo.placeholder}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" />
              </div>
            ))}

            <button onClick={salvarBriefing} disabled={salvandoBriefing}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
              {salvandoBriefing ? '⏳ Salvando...' : '💾 Salvar Briefing'}
            </button>
          </div>
        )}

        {/* ABA FINANCEIRO */}
        {aba === 'financeiro' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-gray-700">💰 Resumo Financeiro</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Valor cobrado do cliente</span>
                  <span className="font-bold text-gray-800">
                    {servico.valor_cliente != null
                      ? `R$ ${Number(servico.valor_cliente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Diária por promotora</span>
                  <span className="font-semibold text-gray-700">
                    {servico.valor_diaria != null
                      ? `R$ ${Number(servico.valor_diaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total pago às promotoras</span>
                  <span className="font-semibold text-red-600">
                    R$ {totalPagoPromotoras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Pagamentos pendentes</span>
                  <span className="font-semibold text-yellow-600">
                    R$ {totalPendentePromotoras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-gray-50 rounded-xl px-3">
                  <span className="font-bold text-gray-700">Margem Estimada</span>
                  <span className={`font-black text-lg ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    R$ {margem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {servico.valor_cliente ? ` (${Math.round(margem / Number(servico.valor_cliente) * 100)}%)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Pagamentos individuais */}
            {escala.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-gray-700">💸 Pagamento por Promotora</h3>
                {escala.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{e.promotoras?.nome}</p>
                      <p className="text-xs text-gray-400">
                        {e.valor_diaria != null ? `R$ ${Number(e.valor_diaria).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Diária não definida'}
                      </p>
                    </div>
                    <select value={e.status_pagamento}
                      onChange={ev => atualizarPagamento(e.id, ev.target.value)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border-0 cursor-pointer ${e.status_pagamento === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      <option value="pendente">⏳ Pendente</option>
                      <option value="pago">✅ Pago</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

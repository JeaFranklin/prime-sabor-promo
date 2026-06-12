'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome_empresa: string
  nome_fantasia: string
  cnpj: string
  inscricao_estadual: string
  categoria: string
  data_fundacao: string
  data_inauguracao: string
  telefone: string
  site: string
  email_xml: string
  whatsapp_ofertas: string
  instagram: string
  linkedin: string
  facebook: string
  cidade: string
  estado: string
  rua: string
  numero: string
  bairro: string
  cep: string
  lat: number
  lng: number
  observacoes: string
  logo_url: string
  status: string
  created_at: string
}

type Contato = {
  id: string
  nome: string
  cargo: string
  whatsapp: string
  email: string
  recebe_notificacao: boolean
  tipo: string
}

const STATUS_CORES: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-red-100 text-red-600',
}

const CATEGORIA_ICONES: Record<string, string> = {
  'indústria': '🏭', 'distribuidor': '🚚', 'varejo': '🛒', 'evento': '🎪', 'agência': '📢',
}

function formatarData(d: string) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function urlInstagram(v: string) {
  const user = v.replace('@', '').trim()
  return `https://instagram.com/${user}`
}

function urlLinkedin(v: string) {
  const s = v.trim()
  if (s.startsWith('http')) return s
  if (s.includes('linkedin.com')) return `https://${s}`
  return `https://linkedin.com/company/${s}`
}

function urlFacebook(v: string) {
  const s = v.trim()
  if (s.startsWith('http')) return s
  if (s.includes('facebook.com')) return `https://${s}`
  return `https://facebook.com/${s}`
}

function urlSite(v: string) {
  const s = v.trim()
  if (s.startsWith('http')) return s
  return `https://${s}`
}

type ServicoCliente = {
  id: string
  nome: string
  status: string
  data_inicio: string | null
  data_fim: string | null
  tipo_acao: string | null
  num_promotoras: number
}

export default function PerfilCliente() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [servicosCliente, setServicosCliente] = useState<ServicoCliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [alterandoStatus, setAlterandoStatus] = useState(false)
  const [aba, setAba] = useState<'dados' | 'contatos' | 'endereco'>('dados')

  useEffect(() => {
    async function carregar() {
      const [{ data: cData }, { data: ctData }, { data: srvData }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('contatos_cliente').select('*').eq('cliente_id', id).order('tipo').order('created_at'),
        supabase.from('servicos').select('id, nome, status, data_inicio, data_fim, tipo_acao, num_promotoras').eq('cliente_id', id).order('created_at', { ascending: false }),
      ])
      if (cData) setCliente(cData)
      setContatos(ctData || [])
      setServicosCliente(srvData || [])
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  async function alterarStatus(novoStatus: string) {
    if (!cliente || alterandoStatus) return
    setAlterandoStatus(true)
    const { error } = await supabase.from('clientes').update({ status: novoStatus }).eq('id', id)
    if (!error) setCliente(prev => prev ? { ...prev, status: novoStatus } : prev)
    setAlterandoStatus(false)
  }

  if (carregando) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">⏳ Carregando...</p>
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Cliente não encontrado.</p>
    </div>
  )

  const enderecoCompleto = [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(', ')
  const contatosGerais = contatos.filter(c => c.tipo !== 'financeiro')
  const contatosFinanceiro = contatos.filter(c => c.tipo === 'financeiro')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/clientes" className="text-white/80 hover:text-white text-sm">← Voltar</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">🏢 Perfil do Cliente</h1>
          </div>
          <Link href={`/clientes/${id}/editar`}
            className="bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-green-50 transition">
            ✏️ Editar
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {cliente.logo_url
                ? <img src={cliente.logo_url} alt="Logo" className="w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <span className="text-3xl">{CATEGORIA_ICONES[cliente.categoria] || '🏢'}</span>
              }
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-800">{cliente.nome_empresa}</h2>
              {cliente.nome_fantasia && (
                <p className="text-sm text-gray-500 font-semibold">{cliente.nome_fantasia}</p>
              )}
              <p className="text-xs text-gray-400">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[cliente.status] || 'bg-gray-100 text-gray-500'}`}>
                  {cliente.status}
                </span>
                {cliente.categoria && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 capitalize">
                    {CATEGORIA_ICONES[cliente.categoria]} {cliente.categoria}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2 font-semibold">🔄 Status</p>
            <div className="flex gap-2">
              {['ativo', 'inativo', 'suspenso'].map(s => (
                <button key={s} onClick={() => alterarStatus(s)}
                  disabled={alterandoStatus || cliente.status === s}
                  className={`flex-1 py-1.5 rounded-xl border-2 font-semibold text-xs transition ${
                    cliente.status === s
                      ? s === 'ativo' ? 'bg-green-500 border-green-500 text-white'
                        : s === 'inativo' ? 'bg-gray-400 border-gray-400 text-white'
                        : 'bg-red-500 border-red-500 text-white'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                  } disabled:cursor-default`}>
                  {s === 'ativo' ? '✅ Ativo' : s === 'inativo' ? '⏸️ Inativo' : '🚫 Suspenso'}
                </button>
              ))}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            {cliente.telefone && (
              <a href={`tel:${cliente.telefone.replace(/\D/g, '')}`}
                className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                📞 Ligar
              </a>
            )}
            {cliente.whatsapp_ofertas && (
              <a href={`https://wa.me/${cliente.whatsapp_ofertas.replace(/\D/g, '')}`} target="_blank"
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                💬 Zap Ofertas
              </a>
            )}
            {cliente.email_xml && (
              <a href={`mailto:${cliente.email_xml}`}
                className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                ✉️ E-mail XML
              </a>
            )}
            {cliente.site && (
              <a href={urlSite(cliente.site)} target="_blank"
                className="flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                🌐 Site
              </a>
            )}
            {cliente.instagram && (
              <a href={urlInstagram(cliente.instagram)} target="_blank"
                className="flex items-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                📸 Instagram
              </a>
            )}
            {cliente.linkedin && (
              <a href={urlLinkedin(cliente.linkedin)} target="_blank"
                className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                💼 LinkedIn
              </a>
            )}
            {cliente.facebook && (
              <a href={urlFacebook(cliente.facebook)} target="_blank"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                📘 Facebook
              </a>
            )}
            {(cliente.lat && cliente.lng) && (
              <a href={`https://maps.google.com/?q=${cliente.lat},${cliente.lng}`} target="_blank"
                className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition">
                🗺️ Mapa
              </a>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(['dados', 'contatos', 'endereco'] as const).map(a => (
              <button key={a} onClick={() => setAba(a)}
                className={`flex-1 py-3 text-sm font-semibold transition ${aba === a ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {a === 'dados' ? '📋 Dados' : a === 'contatos' ? `👥 Contatos (${contatos.length})` : '📍 Endereço'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ABA DADOS */}
            {aba === 'dados' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  {cliente.cnpj && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">CNPJ</p>
                      <p className="text-sm font-semibold text-gray-700">{cliente.cnpj}</p>
                    </div>
                  )}
                  {cliente.inscricao_estadual && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Inscrição Estadual</p>
                      <p className="text-sm font-semibold text-gray-700">{cliente.inscricao_estadual}</p>
                    </div>
                  )}
                  {cliente.data_fundacao && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Data de Fundação</p>
                      <p className="text-sm font-semibold text-gray-700">{formatarData(cliente.data_fundacao)}</p>
                    </div>
                  )}
                  {cliente.data_inauguracao && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Data de Inauguração</p>
                      <p className="text-sm font-semibold text-gray-700">{formatarData(cliente.data_inauguracao)}</p>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Telefone Fixo</p>
                      <p className="text-sm font-semibold text-gray-700">{cliente.telefone}</p>
                    </div>
                  )}
                  {cliente.email_xml && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">E-mail XML (NF-e)</p>
                      <p className="text-sm font-semibold text-gray-700 break-all">{cliente.email_xml}</p>
                    </div>
                  )}
                  {cliente.whatsapp_ofertas && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">WhatsApp Ofertas</p>
                      <p className="text-sm font-semibold text-gray-700">{cliente.whatsapp_ofertas}</p>
                    </div>
                  )}
                </div>
                {cliente.observacoes && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Observações</p>
                      <p className="text-sm text-gray-600">{cliente.observacoes}</p>
                    </div>
                  </>
                )}
                <hr className="border-gray-100" />
                <p className="text-xs text-gray-400">Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            )}

            {/* ABA CONTATOS */}
            {aba === 'contatos' && (
              <div className="space-y-4">
                {contatos.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <p className="text-2xl mb-2">👥</p>
                    <p className="text-sm">Nenhum contato cadastrado.</p>
                    <Link href={`/clientes/${id}/editar`} className="text-green-600 text-xs font-semibold mt-1 inline-block">
                      + Adicionar contato
                    </Link>
                  </div>
                ) : (
                  <>
                    {contatosGerais.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">👥 Contatos Gerais</h3>
                        <div className="space-y-3">
                          {contatosGerais.map(c => (
                            <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-bold text-gray-800 text-sm">{c.nome}</p>
                                  {c.cargo && <p className="text-xs text-gray-500">{c.cargo}</p>}
                                </div>
                                {c.recebe_notificacao && (
                                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-semibold">
                                    💬 Recebe Zap
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {c.whatsapp && (
                                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank"
                                    className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition">
                                    💬 {c.whatsapp}
                                  </a>
                                )}
                                {c.email && (
                                  <a href={`mailto:${c.email}`}
                                    className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition">
                                    ✉️ {c.email}
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {contatosFinanceiro.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">💰 Contatos Financeiro</h3>
                        <div className="space-y-3">
                          {contatosFinanceiro.map(c => (
                            <div key={c.id} className="border border-amber-100 bg-amber-50/30 rounded-xl p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-bold text-gray-800 text-sm">{c.nome}</p>
                                  {c.cargo && <p className="text-xs text-gray-500">{c.cargo}</p>}
                                </div>
                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">
                                  💰 Financeiro
                                </span>
                              </div>
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {c.whatsapp && (
                                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank"
                                    className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition">
                                    💬 {c.whatsapp}
                                  </a>
                                )}
                                {c.email && (
                                  <a href={`mailto:${c.email}`}
                                    className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition">
                                    ✉️ {c.email}
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ABA ENDEREÇO */}
            {aba === 'endereco' && (
              <div className="space-y-3">
                {enderecoCompleto ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Endereço Completo</p>
                      <p className="text-sm font-semibold text-gray-700">{enderecoCompleto}</p>
                      {cliente.cep && <p className="text-xs text-gray-500 mt-0.5">CEP: {cliente.cep}</p>}
                    </div>
                    {(cliente.lat && cliente.lng) ? (
                      <a href={`https://maps.google.com/?q=${cliente.lat},${cliente.lng}`} target="_blank"
                        className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-3 rounded-xl transition mt-2">
                        🗺️ Abrir no Google Maps
                      </a>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                        <p className="text-xs text-yellow-700">⚠️ Geolocalização não cadastrada. Edite o cliente e clique em "Obter Geolocalização".</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <p className="text-2xl mb-2">📍</p>
                    <p className="text-sm">Endereço não cadastrado.</p>
                    <Link href={`/clientes/${id}/editar`} className="text-green-600 text-xs font-semibold mt-1 inline-block">
                      + Adicionar endereço
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Serviços */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">📋 Serviços ({servicosCliente.length})</h3>
            <Link href={`/servicos/novo`}
              className="text-xs text-violet-600 font-semibold hover:underline">+ Novo</Link>
          </div>
          {servicosCliente.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">Nenhum serviço cadastrado para este cliente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {servicosCliente.map(s => (
                <Link key={s.id} href={`/servicos/${s.id}`}
                  className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl hover:bg-violet-50 transition">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.nome}</p>
                    <p className="text-xs text-gray-400">
                      {s.data_inicio ? s.data_inicio.split('-').reverse().join('/') : '—'}
                      {s.data_fim ? ` até ${s.data_fim.split('-').reverse().join('/')}` : ''}
                      {` · 👥 ${s.num_promotoras}`}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize whitespace-nowrap">
                    {s.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

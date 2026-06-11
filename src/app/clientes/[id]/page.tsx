'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome_empresa: string
  cnpj: string
  contato_nome: string
  whatsapp: string
  email: string
  categoria: string
  cidade: string
  estado: string
  site: string
  observacoes: string
  status: string
  created_at: string
}

const STATUS_CORES: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-red-100 text-red-600',
}

const CATEGORIA_ICONES: Record<string, string> = {
  'indústria': '🏭',
  'distribuidor': '🚚',
  'varejo': '🛒',
  'evento': '🎪',
  'agência': '📢',
}

export default function PerfilCliente() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [alterandoStatus, setAlterandoStatus] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) console.error(error)
      else setCliente(data)
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  async function alterarStatus(novoStatus: string) {
    if (!cliente || alterandoStatus) return
    setAlterandoStatus(true)
    const { error } = await supabase
      .from('clientes')
      .update({ status: novoStatus })
      .eq('id', id)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-3xl flex-shrink-0">
              {CATEGORIA_ICONES[cliente.categoria] || '🏢'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-800">{cliente.nome_empresa}</h2>
              <p className="text-sm text-gray-500">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
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

          {/* Alterar status */}
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

          {/* Botões de ação rápida */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            {cliente.whatsapp && (
              <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`} target="_blank"
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                💬 WhatsApp
              </a>
            )}
            {cliente.email && (
              <a href={`mailto:${cliente.email}`}
                className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                ✉️ E-mail
              </a>
            )}
            {cliente.site && (
              <a href={cliente.site.startsWith('http') ? cliente.site : `https://${cliente.site}`} target="_blank"
                className="flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                🌐 Site
              </a>
            )}
          </div>
        </div>

        {/* Detalhes */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-700">📋 Dados Cadastrais</h3>

          <div className="grid grid-cols-2 gap-4">
            {cliente.cnpj && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">CNPJ</p>
                <p className="text-sm font-semibold text-gray-700">{cliente.cnpj}</p>
              </div>
            )}
            {cliente.contato_nome && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Contato</p>
                <p className="text-sm font-semibold text-gray-700">{cliente.contato_nome}</p>
              </div>
            )}
            {cliente.whatsapp && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                <p className="text-sm font-semibold text-gray-700">{cliente.whatsapp}</p>
              </div>
            )}
            {cliente.email && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
                <p className="text-sm font-semibold text-gray-700 break-all">{cliente.email}</p>
              </div>
            )}
            {cliente.site && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Site</p>
                <p className="text-sm font-semibold text-gray-700">{cliente.site}</p>
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
          <p className="text-xs text-gray-400">
            Cadastrado em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Histórico de serviços — placeholder */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-gray-700 mb-3">📋 Serviços Realizados</h3>
          <div className="text-center py-6 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">Histórico de serviços disponível em breve.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

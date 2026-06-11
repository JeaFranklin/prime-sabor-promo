'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Promotora = {
  id: string
  nome: string
  whatsapp: string
  cpf: string
  email: string
  instagram: string
  rua: string
  numero: string
  bairro: string
  cep: string
  cidade: string
  estado: string
  data_nascimento: string
  servicos: string[]
  status: string
  foto_url: string
  avaliacao_media: number
  total_servicos: number
  chave_pix: string
  banco: string
  observacoes: string
  lat: number
  lng: number
  created_at: string
}

function calcularIdade(data: string): number | null {
  if (!data) return null
  const nasc = new Date(data)
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

const STATUS_CORES: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-red-100 text-red-600',
}

export default function PerfilPromotora() {
  const { id } = useParams()
  const router = useRouter()
  const [promotora, setPromotora] = useState<Promotora | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'dados' | 'pagamento' | 'historico'>('dados')

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('promotoras')
        .select('*')
        .eq('id', id)
        .single()
      if (error) console.error(error)
      else setPromotora(data)
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  if (carregando) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">⏳ Carregando...</p>
    </div>
  )

  if (!promotora) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Promotora não encontrada.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/promotoras" className="text-white/80 hover:text-white text-sm">← Voltar</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">👩 Perfil</h1>
          </div>
          <Link href={`/promotoras/${id}/editar`}
            className="bg-white text-red-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition">
            ✏️ Editar
          </Link>
        </div>
      </div>

      {/* Card principal */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full border-4 border-red-200 overflow-hidden bg-red-50 flex items-center justify-center flex-shrink-0">
              {promotora.foto_url
                ? <img src={promotora.foto_url} alt={promotora.nome} className="w-full h-full object-cover" />
                : <span className="text-3xl font-black text-red-400">{promotora.nome.charAt(0)}</span>
              }
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-gray-800">{promotora.nome}</h2>
              <p className="text-sm text-gray-500">{promotora.bairro ? `${promotora.bairro}, ` : ''}{promotora.cidade || '—'}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[promotora.status] || 'bg-gray-100 text-gray-500'}`}>
                  {promotora.status}
                </span>
                {(promotora.servicos || []).map(s => (
                  <span key={s} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">{s}</span>
                ))}
              </div>
            </div>
            {promotora.avaliacao_media > 0 && (
              <div className="text-center">
                <p className="text-2xl font-black text-yellow-500">⭐ {promotora.avaliacao_media}</p>
                <p className="text-xs text-gray-400">{promotora.total_servicos} serviços</p>
              </div>
            )}
          </div>

          {/* Botões de ação rápida */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {promotora.whatsapp && (
              <a href={`https://wa.me/${promotora.whatsapp.replace(/\D/g, '')}`} target="_blank"
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                💬 WhatsApp
              </a>
            )}
            {promotora.instagram && (
              <a href={`https://instagram.com/${promotora.instagram.replace('@', '')}`} target="_blank"
                className="flex items-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                📸 Instagram
              </a>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(['dados', 'pagamento', 'historico'] as const).map(a => (
              <button key={a} onClick={() => setAba(a)}
                className={`flex-1 py-3 text-sm font-semibold transition ${aba === a ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {a === 'dados' ? '📋 Dados' : a === 'pagamento' ? '💰 Pagamento' : '📊 Histórico'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {aba === 'dados' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Data de Nascimento</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {promotora.data_nascimento
                        ? `${new Date(promotora.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')} (${calcularIdade(promotora.data_nascimento)} anos)`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">CPF</p>
                    <p className="text-sm font-semibold text-gray-700">{promotora.cpf || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                    <p className="text-sm font-semibold text-gray-700">{promotora.whatsapp || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
                    <p className="text-sm font-semibold text-gray-700">{promotora.email || '—'}</p>
                  </div>
                </div>
                <hr className="border-gray-100" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Endereço</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {[promotora.rua, promotora.numero, promotora.bairro, promotora.cidade, promotora.estado].filter(Boolean).join(', ') || '—'}
                  </p>
                  {promotora.lat && promotora.lng && (
                    <a href={`https://maps.google.com/?q=${promotora.lat},${promotora.lng}`} target="_blank"
                      className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                      🗺️ Ver no mapa
                    </a>
                  )}
                </div>
                {promotora.observacoes && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Observações</p>
                      <p className="text-sm text-gray-600">{promotora.observacoes}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {aba === 'pagamento' && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-700">⚠️ Dados bancários exclusivamente no nome do titular.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Chave PIX</p>
                    <p className="text-sm font-semibold text-gray-700">{promotora.chave_pix || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Banco</p>
                    <p className="text-sm font-semibold text-gray-700">{promotora.banco || '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {aba === 'historico' && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">Histórico de serviços em breve.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

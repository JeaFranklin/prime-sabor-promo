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
  tamanho_uniforme: string
  disponibilidade_dias: string[]
  disponibilidade_turno: string
  created_at: string
}

type FotoTrabalho = {
  id: string
  url: string
  descricao: string
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

const DIAS_LABELS: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom'
}

export default function PerfilPromotora() {
  const { id } = useParams()
  const router = useRouter()
  const [promotora, setPromotora] = useState<Promotora | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'dados' | 'pagamento' | 'historico'>('dados')

  // Status
  const [alterandoStatus, setAlterandoStatus] = useState(false)

  // Avaliação
  const [notaHover, setNotaHover] = useState(0)
  const [salvandoNota, setSalvandoNota] = useState(false)

  // Fotos do trabalho
  const [fotos, setFotos] = useState<FotoTrabalho[]>([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

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

  useEffect(() => {
    if (aba === 'historico' && id) carregarFotos()
  }, [aba, id])

  async function carregarFotos() {
    setCarregandoFotos(true)
    const { data, error } = await supabase
      .from('fotos_promotora')
      .select('*')
      .eq('promotora_id', id)
      .order('created_at', { ascending: false })
    if (!error) setFotos(data || [])
    setCarregandoFotos(false)
  }

  async function alterarStatus(novoStatus: string) {
    if (!promotora || alterandoStatus) return
    setAlterandoStatus(true)
    const { error } = await supabase
      .from('promotoras')
      .update({ status: novoStatus })
      .eq('id', id)
    if (!error) setPromotora(prev => prev ? { ...prev, status: novoStatus } : prev)
    setAlterandoStatus(false)
  }

  async function darNota(nota: number) {
    if (!promotora || salvandoNota) return
    setSalvandoNota(true)
    const { error } = await supabase
      .from('promotoras')
      .update({ avaliacao_media: nota })
      .eq('id', id)
    if (!error) setPromotora(prev => prev ? { ...prev, avaliacao_media: nota } : prev)
    setSalvandoNota(false)
  }

  async function uploadFotoTrabalho(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Foto muito grande. Máximo 10MB.'); return }
    setUploadandoFoto(true)
    const ext = file.name.split('.').pop()
    const nomeArquivo = `trabalhos/${id}/${Date.now()}.${ext}`
    const { data: uploadData, error: uploadErro } = await supabase.storage
      .from('FOTO')
      .upload(nomeArquivo, file, { upsert: true })
    if (uploadErro) { console.error(uploadErro); setUploadandoFoto(false); return }
    const { data: urlData } = supabase.storage.from('FOTO').getPublicUrl(uploadData.path)
    await supabase.from('fotos_promotora').insert({
      promotora_id: id,
      url: urlData.publicUrl,
      descricao: '',
    })
    await carregarFotos()
    setUploadandoFoto(false)
  }

  async function excluirFoto(fotoId: string) {
    await supabase.from('fotos_promotora').delete().eq('id', fotoId)
    setFotos(prev => prev.filter(f => f.id !== fotoId))
  }

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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Card principal */}
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
          </div>

          {/* Avaliação por estrelas */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2 font-semibold">⭐ Avaliação</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => darNota(n)}
                  onMouseEnter={() => setNotaHover(n)}
                  onMouseLeave={() => setNotaHover(0)}
                  disabled={salvandoNota}
                  className="text-2xl transition-transform hover:scale-110 disabled:opacity-50"
                >
                  {n <= (notaHover || promotora.avaliacao_media) ? '⭐' : '☆'}
                </button>
              ))}
              {promotora.avaliacao_media > 0 && (
                <span className="text-sm text-gray-500 ml-2 font-semibold">{promotora.avaliacao_media}/5</span>
              )}
              {salvandoNota && <span className="text-xs text-gray-400 ml-2">salvando...</span>}
            </div>
          </div>

          {/* Alterar status */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2 font-semibold">🔄 Status</p>
            <div className="flex gap-2">
              {['ativo', 'inativo', 'suspenso'].map(s => (
                <button
                  key={s}
                  onClick={() => alterarStatus(s)}
                  disabled={alterandoStatus || promotora.status === s}
                  className={`flex-1 py-1.5 rounded-xl border-2 font-semibold text-xs transition ${
                    promotora.status === s
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
                {a === 'dados' ? '📋 Dados' : a === 'pagamento' ? '💰 Pagamento' : '📸 Fotos'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ABA DADOS */}
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
                  {promotora.tamanho_uniforme && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Tamanho Uniforme</p>
                      <p className="text-sm font-semibold text-gray-700">{promotora.tamanho_uniforme}</p>
                    </div>
                  )}
                  {promotora.total_servicos > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total de Serviços</p>
                      <p className="text-sm font-semibold text-gray-700">{promotora.total_servicos} serviços</p>
                    </div>
                  )}
                </div>

                {/* Disponibilidade */}
                {((promotora.disponibilidade_dias || []).length > 0 || promotora.disponibilidade_turno) && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Disponibilidade</p>
                      {(promotora.disponibilidade_dias || []).length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-1">
                          {promotora.disponibilidade_dias.map(d => (
                            <span key={d} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-semibold">
                              {DIAS_LABELS[d] || d}
                            </span>
                          ))}
                        </div>
                      )}
                      {promotora.disponibilidade_turno && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 font-semibold capitalize">
                          {promotora.disponibilidade_turno}
                        </span>
                      )}
                    </div>
                  </>
                )}

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

            {/* ABA PAGAMENTO */}
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

            {/* ABA FOTOS */}
            {aba === 'historico' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Fotos do Trabalho</p>
                  <label className={`cursor-pointer bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition ${uploadandoFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadandoFoto ? '⏳ Enviando...' : '📷 Adicionar Foto'}
                    <input type="file" accept="image/*" onChange={uploadFotoTrabalho} className="hidden" disabled={uploadandoFoto} />
                  </label>
                </div>

                {carregandoFotos ? (
                  <p className="text-center text-gray-400 py-6">⏳ Carregando fotos...</p>
                ) : fotos.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📸</p>
                    <p className="text-sm">Nenhuma foto de trabalho ainda.</p>
                    <p className="text-xs mt-1">Clique em "Adicionar Foto" para enviar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {fotos.map(foto => (
                      <div key={foto.id} className="relative group aspect-square">
                        <img
                          src={foto.url}
                          alt="Foto do trabalho"
                          className="w-full h-full object-cover rounded-xl cursor-pointer hover:opacity-90 transition"
                          onClick={() => setFotoAmpliada(foto.url)}
                        />
                        <button
                          onClick={() => excluirFoto(foto.id)}
                          className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox para foto ampliada */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}

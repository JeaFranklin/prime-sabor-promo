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

type Avaliacao = {
  id: string
  nota: number
  observacao: string
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
  const [aba, setAba] = useState<'dados' | 'pagamento' | 'fotos' | 'notas' | 'servicos'>('dados')

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

  // Avaliações
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const [carregandoAvaliacoes, setCarregandoAvaliacoes] = useState(false)
  const [novaObservacao, setNovaObservacao] = useState('')
  const [notaSelecionada, setNotaSelecionada] = useState(0)

  // Serviços da promotora
  const [servicosPromotora, setServicosPromotora] = useState<{ id: string; nome: string; status: string; data_inicio: string | null; clientes: { nome_empresa: string } | null }[]>([])

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
    if (aba === 'fotos' && id) carregarFotos()
    if (aba === 'notas' && id) carregarAvaliacoes()
    if (aba === 'servicos' && id) carregarServicos()
  }, [aba, id])

  async function carregarServicos() {
    const { data } = await supabase
      .from('escala')
      .select('servicos(id, nome, status, data_inicio, clientes(nome_empresa))')
      .eq('promotora_id', id)
      .order('created_at', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lista = (data || []).map((e: any) => Array.isArray(e.servicos) ? e.servicos[0] : e.servicos).filter(Boolean)
    setServicosPromotora(lista as { id: string; nome: string; status: string; data_inicio: string | null; clientes: { nome_empresa: string } | null }[])
  }

  async function carregarAvaliacoes() {
    setCarregandoAvaliacoes(true)
    const { data } = await supabase
      .from('avaliacoes_promotora')
      .select('*')
      .eq('promotora_id', id)
      .order('created_at', { ascending: false })
    setAvaliacoes(data || [])
    setCarregandoAvaliacoes(false)
  }

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
    if (!promotora || salvandoNota || nota === 0) return
    setSalvandoNota(true)
    // Salva no histórico
    await supabase.from('avaliacoes_promotora').insert({
      promotora_id: id,
      nota,
      observacao: novaObservacao.trim() || null,
    })
    // Recalcula a média buscando todas as notas
    const { data } = await supabase
      .from('avaliacoes_promotora')
      .select('nota')
      .eq('promotora_id', id)
    if (data && data.length > 0) {
      const media = data.reduce((s, a) => s + a.nota, 0) / data.length
      const mediaArredondada = Math.round(media * 10) / 10
      await supabase.from('promotoras').update({ avaliacao_media: mediaArredondada }).eq('id', id)
      setPromotora(prev => prev ? { ...prev, avaliacao_media: mediaArredondada } : prev)
    }
    setNovaObservacao('')
    setNotaSelecionada(0)
    if (aba === 'notas') carregarAvaliacoes()
    setSalvandoNota(false)
  }

  async function excluirAvaliacao(avaliacaoId: string) {
    await supabase.from('avaliacoes_promotora').delete().eq('id', avaliacaoId)
    const novas = avaliacoes.filter(a => a.id !== avaliacaoId)
    setAvaliacoes(novas)
    if (novas.length > 0) {
      const media = novas.reduce((s, a) => s + a.nota, 0) / novas.length
      const mediaArredondada = Math.round(media * 10) / 10
      await supabase.from('promotoras').update({ avaliacao_media: mediaArredondada }).eq('id', id)
      setPromotora(prev => prev ? { ...prev, avaliacao_media: mediaArredondada } : prev)
    } else {
      await supabase.from('promotoras').update({ avaliacao_media: 0 }).eq('id', id)
      setPromotora(prev => prev ? { ...prev, avaliacao_media: 0 } : prev)
    }
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

          {/* Média de avaliação — somente leitura */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-semibold">⭐ Avaliação Média</p>
              <button onClick={() => setAba('notas')}
                className="text-xs text-red-500 hover:underline font-semibold">
                Ver histórico →
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className="text-xl">
                    {n <= Math.round(promotora.avaliacao_media) ? '⭐' : '☆'}
                  </span>
                ))}
              </div>
              {promotora.avaliacao_media > 0
                ? <span className="text-sm font-bold text-gray-700">{promotora.avaliacao_media}/5</span>
                : <span className="text-xs text-gray-400">Nenhuma avaliação ainda</span>
              }
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
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {(['dados', 'pagamento', 'fotos', 'notas', 'servicos'] as const).map(a => (
              <button key={a} onClick={() => setAba(a)}
                className={`flex-shrink-0 px-3 py-3 text-xs font-semibold transition ${aba === a ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {a === 'dados' ? '📋 Dados' : a === 'pagamento' ? '💰 Pagamento' : a === 'fotos' ? '📸 Fotos' : a === 'notas' ? `⭐ Notas` : '🗂️ Serviços'}
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
            {aba === 'fotos' && (
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
            {/* ABA NOTAS */}
            {aba === 'notas' && (
              <div className="space-y-4">

                {/* Formulário para registrar nova nota */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-600 mb-2">📝 Registrar nova avaliação</p>
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n}
                        onClick={() => setNotaSelecionada(n)}
                        onMouseEnter={() => setNotaHover(n)}
                        onMouseLeave={() => setNotaHover(0)}
                        className="text-2xl transition-transform hover:scale-110">
                        {n <= (notaHover || notaSelecionada) ? '⭐' : '☆'}
                      </button>
                    ))}
                    {notaSelecionada > 0 && (
                      <span className="text-sm text-gray-500 ml-1 font-semibold">{notaSelecionada}/5</span>
                    )}
                  </div>
                  <input value={novaObservacao} onChange={e => setNovaObservacao(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-400 bg-white mb-2"
                    placeholder="Observação (opcional): pontualidade, apresentação, resultado..." />
                  <button onClick={() => darNota(notaSelecionada)}
                    disabled={salvandoNota || notaSelecionada === 0}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-xl transition">
                    {salvandoNota ? '⏳ Salvando...' : notaSelecionada === 0 ? 'Selecione uma nota acima' : '✅ Registrar Avaliação'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Histórico</p>
                  {avaliacoes.length > 0 && (
                    <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200 font-bold">
                      Média: {(avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length).toFixed(1)}/5 · {avaliacoes.length} nota{avaliacoes.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {carregandoAvaliacoes ? (
                  <p className="text-center text-gray-400 py-6">⏳ Carregando...</p>
                ) : avaliacoes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">⭐</p>
                    <p className="text-sm">Nenhuma avaliação registrada ainda.</p>
                    <p className="text-xs mt-1">Use o painel de estrelas acima para avaliar.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {avaliacoes.map(a => (
                      <div key={a.id} className="flex items-start justify-between border border-gray-100 rounded-xl p-3 bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-sm text-gray-800">
                              {'⭐'.repeat(a.nota)}{'☆'.repeat(5 - a.nota)}
                            </span>
                            <span className="text-xs font-bold text-yellow-600">{a.nota}/5</span>
                          </div>
                          {a.observacao && (
                            <p className="text-xs text-gray-600 mt-1">"{a.observacao}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button onClick={() => excluirAvaliacao(a.id)}
                          className="text-red-300 hover:text-red-500 text-xs ml-2 flex-shrink-0">× remover</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA SERVIÇOS */}
            {aba === 'servicos' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-400">Serviços em que esta promotora está escalada.</p>
                {servicosPromotora.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">🗂️</p>
                    <p className="text-sm">Nenhum serviço encontrado.</p>
                  </div>
                ) : (
                  servicosPromotora.map(s => (
                    <Link key={s.id} href={`/servicos/${s.id}`}
                      className="flex items-center justify-between bg-gray-50 rounded-xl p-3 hover:bg-violet-50 transition">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.nome}</p>
                        <p className="text-xs text-gray-400">{s.clientes?.nome_empresa || '—'}{s.data_inicio ? ` · ${s.data_inicio.split('-').reverse().join('/')}` : ''}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize">{s.status}</span>
                    </Link>
                  ))
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

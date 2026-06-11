'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SERVICOS_OPCOES = ['repositor', 'demonstrador', 'degustação']
const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
const DIAS_LABELS: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }
const TURNOS = ['manhã', 'tarde', 'noite', 'integral']

function validarCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(c[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(c[10])
}

function formatarCPF(v: string): string {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
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

export default function EditarPromotora() {
  const { id } = useParams()
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cpfErro, setCpfErro] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null)
  const [fotoAtualUrl, setFotoAtualUrl] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [dataNasc, setDataNasc] = useState('')
  const [servicos, setServicos] = useState<string[]>([])
  const [diasDisponivel, setDiasDisponivel] = useState<string[]>([])
  const [form, setForm] = useState({
    nome: '', whatsapp: '', cpf: '', email: '', instagram: '',
    rua: '', numero: '', bairro: '', cep: '', cidade: '', estado: '',
    chave_pix: '', banco: '', observacoes: '', status: 'ativo',
    tamanho_uniforme: '', disponibilidade_turno: '',
  })

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('promotoras')
        .select('*')
        .eq('id', id)
        .single()
      if (error) { console.error(error); setCarregando(false); return }
      const p = data
      setForm({
        nome: p.nome || '',
        whatsapp: p.whatsapp || '',
        cpf: p.cpf || '',
        email: p.email || '',
        instagram: p.instagram || '',
        rua: p.rua || '',
        numero: p.numero || '',
        bairro: p.bairro || '',
        cep: p.cep || '',
        cidade: p.cidade || '',
        estado: p.estado || '',
        chave_pix: p.chave_pix || '',
        banco: p.banco || '',
        observacoes: p.observacoes || '',
        status: p.status || 'ativo',
        tamanho_uniforme: p.tamanho_uniforme || '',
        disponibilidade_turno: p.disponibilidade_turno || '',
      })
      setDataNasc(p.data_nascimento || '')
      setServicos(p.servicos || [])
      setDiasDisponivel(p.disponibilidade_dias || [])
      setFotoAtualUrl(p.foto_url || null)
      if (p.lat && p.lng) setCoordenadas({ lat: p.lat, lng: p.lng })
      setCarregando(false)
    }
    if (id) carregar()
  }, [id])

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setErro('Foto muito grande. Máximo 5MB.'); return }
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function toggleServico(s: string) {
    setServicos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleDia(d: string) {
    setDiasDisponivel(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function atualizar(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function handleCPF(v: string) {
    const formatado = formatarCPF(v)
    atualizar('cpf', formatado)
    const numeros = formatado.replace(/\D/g, '')
    if (numeros.length === 11) {
      setCpfErro(validarCPF(numeros) ? '' : '❌ CPF inválido — verifique os números digitados.')
    } else {
      setCpfErro('')
    }
  }

  async function geocodificarEndereco() {
    const { rua, numero, bairro, cidade, estado } = form
    if (!rua || !cidade) { setErro('Preencha pelo menos Rua e Cidade para buscar a localização.'); return }
    setGeocodificando(true)
    setErro('')
    const enderecoCompleto = `${rua}, ${numero}, ${bairro}, ${cidade}, ${estado}, Brasil`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}&limit=1`
    try {
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
      const data = await res.json()
      if (data.length > 0) {
        setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      } else {
        setErro('⚠️ Endereço não encontrado. Verifique os dados e tente novamente.')
      }
    } catch {
      setErro('Erro ao buscar localização. Verifique sua internet.')
    }
    setGeocodificando(false)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (form.cpf && !validarCPF(form.cpf.replace(/\D/g, ''))) { setErro('CPF inválido.'); return }
    if (servicos.length === 0) { setErro('Selecione pelo menos um tipo de serviço.'); return }

    setSalvando(true)
    setErro('')

    let foto_url = fotoAtualUrl
    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop()
      const nomeArquivo = `promotoras/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErro } = await supabase.storage
        .from('FOTO')
        .upload(nomeArquivo, fotoFile, { upsert: true })
      if (uploadErro) console.error('Erro upload foto:', uploadErro)
      else {
        const { data: urlData } = supabase.storage.from('FOTO').getPublicUrl(uploadData.path)
        foto_url = urlData.publicUrl
      }
    }

    const { error } = await supabase
      .from('promotoras')
      .update({
        ...form,
        data_nascimento: dataNasc || null,
        servicos,
        disponibilidade_dias: diasDisponivel,
        lat: coordenadas?.lat || null,
        lng: coordenadas?.lng || null,
        foto_url,
      })
      .eq('id', id)

    setSalvando(false)
    if (error) setErro('Erro ao salvar: ' + error.message)
    else router.push(`/promotoras/${id}`)
  }

  if (carregando) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">⏳ Carregando dados...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/promotoras/${id}`} className="text-white/80 hover:text-white text-sm">← Voltar</Link>
          <span className="text-white/40">|</span>
          <h1 className="font-black text-lg">✏️ Editar Promotora</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Status */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-3">🔄 Status do Cadastro</h2>
          <div className="flex gap-2">
            {['ativo', 'inativo', 'suspenso'].map(s => (
              <button key={s} type="button" onClick={() => atualizar('status', s)}
                className={`flex-1 py-2 rounded-xl border-2 font-semibold text-sm transition ${
                  form.status === s
                    ? s === 'ativo' ? 'bg-green-500 border-green-500 text-white'
                      : s === 'inativo' ? 'bg-gray-400 border-gray-400 text-white'
                      : 'bg-red-500 border-red-500 text-white'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}>
                {s === 'ativo' ? '✅ Ativo' : s === 'inativo' ? '⏸️ Inativo' : '🚫 Suspenso'}
              </button>
            ))}
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📋 Dados Pessoais</h2>
          <div className="space-y-3">

            {/* Foto */}
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="w-24 h-24 rounded-full border-4 border-red-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                {(fotoPreview || fotoAtualUrl)
                  ? <img src={fotoPreview || fotoAtualUrl!} alt="Foto" className="w-full h-full object-cover" />
                  : <span className="text-4xl">👩</span>
                }
              </div>
              <label className="cursor-pointer bg-red-50 border-2 border-dashed border-red-300 text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-100 transition">
                📷 {(fotoPreview || fotoAtualUrl) ? 'Trocar foto' : 'Adicionar foto de perfil'}
                <input type="file" accept="image/*" onChange={handleFoto} className="hidden" />
              </label>
              <p className="text-xs text-gray-400">JPG ou PNG • máximo 5MB</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome completo *</label>
              <input value={form.nome} onChange={e => atualizar('nome', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Nome completo" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data de Nascimento</label>
                <input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Idade</label>
                <div className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 text-gray-600 min-h-[38px]">
                  {calcularIdade(dataNasc) !== null ? `🎂 ${calcularIdade(dataNasc)} anos` : '—'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">WhatsApp</label>
                <input value={form.whatsapp} onChange={e => atualizar('whatsapp', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="55 63 9 9999-9999" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tamanho Uniforme</label>
                <select value={form.tamanho_uniforme} onChange={e => atualizar('tamanho_uniforme', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400 bg-white">
                  <option value="">Selecione</option>
                  {['PP', 'P', 'M', 'G', 'GG', 'GGG'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CPF</label>
                <input value={form.cpf} onChange={e => handleCPF(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none ${cpfErro ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-red-400'}`}
                  placeholder="000.000.000-00" maxLength={14} />
                {cpfErro && <p className="text-xs text-red-500 mt-1">{cpfErro}</p>}
                {form.cpf.replace(/\D/g, '').length === 11 && !cpfErro && (
                  <p className="text-xs text-green-600 mt-1">✅ CPF válido</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">E-mail</label>
                <input value={form.email} onChange={e => atualizar('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="email@exemplo.com" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Instagram</label>
              <input value={form.instagram} onChange={e => atualizar('instagram', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="@usuario" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">📍 Endereço</h2>
          <p className="text-xs text-gray-400 mb-4">Usado para sugerir promotoras mais próximas dos serviços.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Rua</label>
                <input value={form.rua} onChange={e => atualizar('rua', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="Nome da rua" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Número</label>
                <input value={form.numero} onChange={e => atualizar('numero', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="Nº" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Bairro</label>
                <input value={form.bairro} onChange={e => atualizar('bairro', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="Bairro" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CEP</label>
                <input value={form.cep} onChange={e => atualizar('cep', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="00000-000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Cidade</label>
                <input value={form.cidade} onChange={e => atualizar('cidade', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="Palmas" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Estado</label>
                <input value={form.estado} onChange={e => atualizar('estado', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                  placeholder="TO" />
              </div>
            </div>
            <button type="button" onClick={geocodificarEndereco} disabled={geocodificando}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm py-2 rounded-xl hover:bg-blue-50 transition disabled:opacity-50">
              {geocodificando ? '⏳ Buscando localização...' : '🗺️ Atualizar Geolocalização'}
            </button>
            {coordenadas && (
              <p className="text-xs text-green-600 text-center font-semibold">
                ✅ Localização: {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>

        {/* Disponibilidade */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📅 Disponibilidade</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Dias disponíveis</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map(d => (
                  <button key={d} type="button" onClick={() => toggleDia(d)}
                    className={`px-3 py-1.5 rounded-xl border-2 font-semibold text-sm transition ${
                      diasDisponivel.includes(d) ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-500'
                    }`}>
                    {DIAS_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Turno preferido</label>
              <div className="flex gap-2 flex-wrap">
                {TURNOS.map(t => (
                  <button key={t} type="button" onClick={() => atualizar('disponibilidade_turno', form.disponibilidade_turno === t ? '' : t)}
                    className={`px-3 py-1.5 rounded-xl border-2 font-semibold text-sm transition capitalize ${
                      form.disponibilidade_turno === t ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-gray-200 text-gray-500'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tipo de serviço */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">🛠️ Tipo de Serviço *</h2>
          <div className="flex gap-3 flex-wrap">
            {SERVICOS_OPCOES.map(s => (
              <button key={s} type="button" onClick={() => toggleServico(s)}
                className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition ${
                  servicos.includes(s) ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                }`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Dados financeiros */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">💰 Dados para Pagamento</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-yellow-700">⚠️ Os dados bancários devem estar obrigatoriamente no nome do titular do cadastro.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Chave PIX</label>
              <input value={form.chave_pix} onChange={e => atualizar('chave_pix', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="CPF, telefone ou e-mail" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Banco</label>
              <input value={form.banco} onChange={e => atualizar('banco', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
                placeholder="Ex: Nubank, Bradesco..." />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📝 Observações</h2>
          <textarea value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400 min-h-20 resize-none"
            placeholder="Observações internas sobre esta promotora..." />
        </div>

        {erro && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl p-3">{erro}</p>}

        <button onClick={salvar} disabled={salvando}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg transition">
          {salvando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}

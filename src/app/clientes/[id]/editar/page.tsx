'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = ['indústria', 'distribuidor', 'varejo', 'evento', 'agência']

type Contato = {
  id?: string
  nome: string
  cargo: string
  whatsapp: string
  email: string
  recebe_notificacao: boolean
  tipo: 'geral' | 'financeiro'
}

function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  let soma = 0, peso = 2
  for (let i = 11; i >= 0; i--) { soma += parseInt(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  let r = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (r !== parseInt(c[12])) return false
  soma = 0; peso = 2
  for (let i = 12; i >= 0; i--) { soma += parseInt(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  r = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  return r === parseInt(c[13])
}

function formatarCNPJ(v: string): string {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function validarRedeSocial(valor: string, tipo: 'instagram' | 'linkedin' | 'facebook'): boolean {
  if (!valor) return true
  if (tipo === 'instagram') return /^@?[\w.]+$/.test(valor)
  if (tipo === 'linkedin') return valor.includes('linkedin.com') || /^[\w-]+$/.test(valor)
  if (tipo === 'facebook') return valor.includes('facebook.com') || /^[\w.]+$/.test(valor)
  return true
}

const contatoVazio = (tipo: 'geral' | 'financeiro'): Contato => ({
  nome: '', cargo: '', whatsapp: '', email: '', recebe_notificacao: true, tipo
})

async function buscarDadosCNPJ(cnpj: string) {
  const n = cnpj.replace(/\D/g, '')
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${n}`)
  if (!res.ok) throw new Error('CNPJ não encontrado')
  return res.json()
}

function extrairDominio(site: string): string {
  return site.trim()
    .replace(/https?:\/\//, '')
    .replace(/www\./, '')
    .split('/')[0]
    .split('?')[0]
}

export default function EditarCliente() {
  const { id } = useParams()
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cnpjErro, setCnpjErro] = useState('')
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [cnpjOk, setCnpjOk] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null)
  const [buscandoLogo, setBuscandoLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [contatosGerais, setContatosGerais] = useState<Contato[]>([contatoVazio('geral')])
  const [contatosFinanceiro, setContatosFinanceiro] = useState<Contato[]>([contatoVazio('financeiro')])
  const [form, setForm] = useState({
    nome_empresa: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
    categoria: '', data_fundacao: '', data_inauguracao: '',
    telefone: '', site: '', email_xml: '', whatsapp_ofertas: '',
    instagram: '', linkedin: '', facebook: '',
    rua: '', numero: '', bairro: '', cep: '', cidade: '', estado: '',
    observacoes: '', logo_url: '',
  })

  useEffect(() => {
    async function carregar() {
      const [{ data: cData }, { data: ctData }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('contatos_cliente').select('*').eq('cliente_id', id).order('created_at'),
      ])
      if (cData) {
        setForm({
          nome_empresa: cData.nome_empresa || '',
          nome_fantasia: cData.nome_fantasia || '',
          cnpj: cData.cnpj || '',
          inscricao_estadual: cData.inscricao_estadual || '',
          categoria: cData.categoria || '',
          data_fundacao: cData.data_fundacao || '',
          data_inauguracao: cData.data_inauguracao || '',
          telefone: cData.telefone || '',
          site: cData.site || '',
          email_xml: cData.email_xml || '',
          whatsapp_ofertas: cData.whatsapp_ofertas || '',
          instagram: cData.instagram || '',
          linkedin: cData.linkedin || '',
          facebook: cData.facebook || '',
          rua: cData.rua || '',
          numero: cData.numero || '',
          bairro: cData.bairro || '',
          cep: cData.cep || '',
          cidade: cData.cidade || '',
          estado: cData.estado || '',
          observacoes: cData.observacoes || '',
          logo_url: cData.logo_url || '',
        })
        if (cData.logo_url) setLogoPreview(cData.logo_url)
        if (cData.lat && cData.lng) setCoordenadas({ lat: cData.lat, lng: cData.lng })
      }
      if (ctData && ctData.length > 0) {
        const gerais = ctData.filter((c: Contato) => c.tipo !== 'financeiro')
        const fin = ctData.filter((c: Contato) => c.tipo === 'financeiro')
        setContatosGerais(gerais.length > 0 ? gerais : [contatoVazio('geral')])
        setContatosFinanceiro(fin.length > 0 ? fin : [contatoVazio('financeiro')])
      }
    }
    if (id) carregar()
  }, [id])

  function atualizar(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  async function handleCNPJ(v: string) {
    const f = formatarCNPJ(v)
    atualizar('cnpj', f)
    const n = f.replace(/\D/g, '')
    if (n.length !== 14) { setCnpjErro(''); setCnpjOk(''); return }
    if (!validarCNPJ(n)) { setCnpjErro('❌ CNPJ inválido.'); setCnpjOk(''); return }
    setCnpjErro('')
    setBuscandoCNPJ(true)
    setCnpjOk('')
    try {
      const d = await buscarDadosCNPJ(n)
      setForm(prev => ({
        ...prev,
        nome_empresa: prev.nome_empresa || d.razao_social || '',
        nome_fantasia: prev.nome_fantasia || d.nome_fantasia || '',
        telefone: prev.telefone || (d.ddd_telefone_1 ? d.ddd_telefone_1.trim() : ''),
        email_xml: prev.email_xml || d.email || '',
        rua: prev.rua || (d.logradouro ? d.logradouro.trim() : ''),
        numero: prev.numero || d.numero || '',
        bairro: prev.bairro || d.bairro || '',
        cep: prev.cep || (d.cep ? d.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : ''),
        cidade: prev.cidade || d.municipio || '',
        estado: prev.estado || d.uf || '',
        data_fundacao: prev.data_fundacao || d.data_inicio_atividade || '',
      }))
      setCnpjOk('✅ Dados preenchidos automaticamente pela Receita Federal!')
    } catch {
      setCnpjOk('✅ CNPJ válido. (Dados não encontrados — preencha manualmente.)')
    }
    setBuscandoCNPJ(false)
  }

  async function buscarLogo() {
    const dominio = form.site ? extrairDominio(form.site) : ''
    const instagram = form.instagram.replace('@', '').trim()
    if (!dominio && !instagram) { setErro('Informe o site ou Instagram para buscar o logo.'); return }
    setBuscandoLogo(true)
    setErro('')
    if (dominio && !dominio.includes('instagram.com') && !dominio.includes('facebook.com')) {
      const url = `https://logo.clearbit.com/${dominio}`
      try {
        const res = await fetch(url)
        if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
          setLogoPreview(url); atualizar('logo_url', url); setBuscandoLogo(false); return
        }
      } catch { /* continua */ }
    }
    if (instagram) {
      for (const sufixo of ['.com.br', '.com']) {
        const url = `https://logo.clearbit.com/${instagram}${sufixo}`
        try {
          const res = await fetch(url)
          if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
            setLogoPreview(url); atualizar('logo_url', url); setBuscandoLogo(false); return
          }
        } catch { /* continua */ }
      }
    }
    setErro('⚠️ Logo não encontrado automaticamente. Envie do computador ou cole a URL abaixo.')
    setBuscandoLogo(false)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const base64 = ev.target?.result as string
      const ext = file.name.split('.').pop()
      const nomeArquivo = `logos/${Date.now()}.${ext}`
      const { data: uploadData, error } = await supabase.storage.from('FOTO').upload(nomeArquivo, file, { upsert: true })
      if (!error && uploadData) {
        const { data: urlData } = supabase.storage.from('FOTO').getPublicUrl(uploadData.path)
        setLogoPreview(urlData.publicUrl)
        atualizar('logo_url', urlData.publicUrl)
      } else {
        setLogoPreview(base64)
        atualizar('logo_url', base64)
      }
    }
    reader.readAsDataURL(file)
  }

  function atualizarContato(lista: Contato[], setLista: (v: Contato[]) => void, idx: number, campo: keyof Contato, valor: string | boolean) {
    setLista(lista.map((c, i) => i === idx ? { ...c, [campo]: valor } : c))
  }

  async function geocodificar() {
    const { rua, numero, bairro, cidade, estado } = form
    if (!cidade) { setErro('Preencha pelo menos a Cidade para buscar a localização.'); return }
    setGeocodificando(true)
    setErro('')
    const partes = [rua, numero, bairro, cidade, estado, 'Brasil'].filter(Boolean)
    const q = partes.join(', ')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'GustPro-Sistema/1.0 (sistema interno)'
        }
      })
      if (!res.ok) throw new Error('Erro na API')
      const data = await res.json()
      if (data.length > 0) {
        setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      } else {
        const q2 = [cidade, estado, 'Brasil'].join(', ')
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q2)}&limit=1&countrycodes=br`, {
          headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'GustPro-Sistema/1.0' }
        })
        const data2 = await res2.json()
        if (data2.length > 0) {
          setCoordenadas({ lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) })
          setErro('⚠️ Endereço exato não encontrado. Localização aproximada pela cidade.')
        } else {
          setErro('❌ Localização não encontrada. Verifique o endereço e tente novamente.')
        }
      }
    } catch {
      setErro('❌ Erro ao buscar localização. Verifique sua internet.')
    }
    setGeocodificando(false)
  }

  async function salvar() {
    if (!form.nome_empresa.trim()) { setErro('Nome da empresa é obrigatório.'); return }
    if (form.cnpj && !validarCNPJ(form.cnpj.replace(/\D/g, ''))) { setErro('CNPJ inválido.'); return }
    if (!form.categoria) { setErro('Selecione uma categoria.'); return }
    if (form.instagram && !validarRedeSocial(form.instagram, 'instagram')) { setErro('Instagram inválido.'); return }

    setSalvando(true)
    setErro('')

    const { error: errUpdate } = await supabase.from('clientes').update({
      ...form,
      lat: coordenadas?.lat || null,
      lng: coordenadas?.lng || null,
    }).eq('id', id)

    if (errUpdate) { setSalvando(false); setErro('Erro ao salvar: ' + errUpdate.message); return }

    await supabase.from('contatos_cliente').delete().eq('cliente_id', id)

    const todosContatos = [...contatosGerais, ...contatosFinanceiro].filter(c => c.nome.trim())
    if (todosContatos.length > 0) {
      await supabase.from('contatos_cliente').insert(
        todosContatos.map(({ id: _cid, ...c }) => ({ ...c, cliente_id: id }))
      )
    }

    setSalvando(false)
    router.push(`/clientes/${id}`)
  }

  const renderContatos = (lista: Contato[], setLista: (v: Contato[]) => void, tipo: 'geral' | 'financeiro') => (
    <div className="space-y-4">
      {lista.map((c, idx) => (
        <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500">Contato {idx + 1}</span>
            {lista.length > 1 && (
              <button type="button" onClick={() => setLista(lista.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 text-xs font-semibold">× Remover</button>
            )}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Nome *</label>
                <input value={c.nome} onChange={e => atualizarContato(lista, setLista, idx, 'nome', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Cargo</label>
                <input value={c.cargo} onChange={e => atualizarContato(lista, setLista, idx, 'cargo', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
                  placeholder={tipo === 'financeiro' ? 'Financeiro, Contabilidade...' : 'Gerente, Compras...'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">WhatsApp</label>
                <input value={c.whatsapp} onChange={e => atualizarContato(lista, setLista, idx, 'whatsapp', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">E-mail</label>
                <input value={c.email} onChange={e => atualizarContato(lista, setLista, idx, 'email', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={c.recebe_notificacao}
                onChange={e => atualizarContato(lista, setLista, idx, 'recebe_notificacao', e.target.checked)}
                className="w-4 h-4 accent-green-600" />
              <span className="text-xs text-gray-600 font-semibold">💬 Receber notificação via WhatsApp</span>
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setLista([...lista, contatoVazio(tipo)])}
        className="w-full border-2 border-dashed border-green-200 text-green-600 text-sm font-semibold py-2 rounded-xl hover:bg-green-50 transition">
        + Adicionar {tipo === 'financeiro' ? 'contato financeiro' : 'contato'}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/clientes/${id}`} className="text-white/80 hover:text-white text-sm">← Voltar</Link>
          <span className="text-white/40">|</span>
          <h1 className="font-black text-lg">✏️ Editar Cliente</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Logo */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">🖼️ Logo da Empresa</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" onError={() => setLogoPreview(null)} />
                : <span className="text-3xl">🏢</span>
              }
            </div>
            <div className="flex-1 space-y-2">
              <button type="button" onClick={buscarLogo} disabled={buscandoLogo}
                className="w-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold py-2 rounded-xl hover:bg-blue-100 transition disabled:opacity-50">
                {buscandoLogo ? '⏳ Buscando...' : '🔍 Buscar logo automaticamente'}
              </button>
              <label className="block w-full text-center bg-gray-50 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                📁 Enviar logo do computador
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>
          <input value={form.logo_url} onChange={e => { atualizar('logo_url', e.target.value); setLogoPreview(e.target.value || null) }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400 mt-3"
            placeholder="Ou cole a URL do logo aqui..." />
        </div>

        {/* Dados da empresa */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">🏢 Dados da Empresa</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Razão Social *</label>
                <input value={form.nome_empresa} onChange={e => atualizar('nome_empresa', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome Fantasia</label>
                <input value={form.nome_fantasia} onChange={e => atualizar('nome_fantasia', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CNPJ</label>
                <div className="relative">
                  <input value={form.cnpj} onChange={e => handleCNPJ(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none pr-10 ${cnpjErro ? 'border-red-400 bg-red-50' : cnpjOk ? 'border-green-400 bg-green-50' : 'border-gray-200 focus:border-green-400'}`}
                    maxLength={18} />
                  {buscandoCNPJ && <span className="absolute right-3 top-2.5 text-sm">⏳</span>}
                </div>
                {cnpjErro && <p className="text-xs text-red-500 mt-1">{cnpjErro}</p>}
                {buscandoCNPJ && <p className="text-xs text-blue-500 mt-1">🔍 Consultando Receita Federal...</p>}
                {cnpjOk && !buscandoCNPJ && <p className="text-xs text-green-600 mt-1">{cnpjOk}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Inscrição Estadual</label>
                <input value={form.inscricao_estadual} onChange={e => atualizar('inscricao_estadual', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data de Fundação</label>
                <input type="date" value={form.data_fundacao} onChange={e => atualizar('data_fundacao', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Data de Inauguração</label>
                <input type="date" value={form.data_inauguracao} onChange={e => atualizar('data_inauguracao', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Categoria *</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIAS.map(cat => (
                  <button key={cat} type="button" onClick={() => atualizar('categoria', cat)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition capitalize ${form.categoria === cat ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                    {cat === 'indústria' ? '🏭' : cat === 'distribuidor' ? '🚚' : cat === 'varejo' ? '🛒' : cat === 'evento' ? '🎪' : '📢'} {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Canais */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📞 Canais de Contato</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Telefone Fixo</label>
                <input value={form.telefone} onChange={e => atualizar('telefone', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" placeholder="(62) 3333-4444" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Site</label>
                <input value={form.site} onChange={e => atualizar('site', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" placeholder="www.empresa.com.br" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">E-mail XML <span className="text-gray-400 font-normal">(NF-e)</span></label>
                <input value={form.email_xml} onChange={e => atualizar('email_xml', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" placeholder="nfe@empresa.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">WhatsApp Ofertas <span className="text-gray-400 font-normal">(loja)</span></label>
                <input value={form.whatsapp_ofertas} onChange={e => atualizar('whatsapp_ofertas', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" placeholder="55 62 9 9999-9999" />
              </div>
            </div>
          </div>
        </div>

        {/* Redes sociais */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📱 Redes Sociais</h2>
          <div className="space-y-3">
            {[
              { campo: 'instagram', label: '📸 Instagram', placeholder: '@empresa', tipo: 'instagram' as const },
              { campo: 'linkedin', label: '💼 LinkedIn', placeholder: 'linkedin.com/company/empresa', tipo: 'linkedin' as const },
              { campo: 'facebook', label: '📘 Facebook', placeholder: 'facebook.com/empresa', tipo: 'facebook' as const },
            ].map(({ campo, label, placeholder, tipo }) => {
              const val = form[campo as keyof typeof form] as string
              const valido = validarRedeSocial(val, tipo)
              return (
                <div key={campo}>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
                  <input value={val} onChange={e => atualizar(campo, e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none ${val && !valido ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-green-400'}`}
                    placeholder={placeholder} />
                  {val && !valido && <p className="text-xs text-red-500 mt-1">❌ Formato inválido</p>}
                  {val && valido && <p className="text-xs text-green-600 mt-1">✅ Válido</p>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">📍 Endereço</h2>
          <p className="text-xs text-gray-400 mb-4">As promotoras usam este endereço para chegar ao local do serviço.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Rua / Avenida</label>
                <input value={form.rua} onChange={e => atualizar('rua', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Número</label>
                <input value={form.numero} onChange={e => atualizar('numero', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Bairro</label>
                <input value={form.bairro} onChange={e => atualizar('bairro', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CEP</label>
                <input value={form.cep} onChange={e => atualizar('cep', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Cidade *</label>
                <input value={form.cidade} onChange={e => atualizar('cidade', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Estado</label>
                <input value={form.estado} onChange={e => atualizar('estado', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400" maxLength={2} />
              </div>
            </div>
            <button type="button" onClick={geocodificar} disabled={geocodificando}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-blue-50 transition disabled:opacity-50">
              {geocodificando ? '⏳ Buscando localização...' : '🗺️ Obter / Atualizar Geolocalização'}
            </button>
            {coordenadas && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-xs text-green-700 font-semibold">✅ Localização salva.</p>
                <a href={`https://maps.google.com/?q=${coordenadas.lat},${coordenadas.lng}`} target="_blank"
                  className="text-xs text-blue-500 hover:underline mt-1 inline-block">Verificar no mapa →</a>
              </div>
            )}
          </div>
        </div>

        {/* Contatos gerais */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">👥 Contatos Gerais</h2>
          <p className="text-xs text-gray-400 mb-4">Gerentes, supervisores, compradores.</p>
          {renderContatos(contatosGerais, setContatosGerais, 'geral')}
        </div>

        {/* Contatos financeiro */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">💰 Contatos Financeiro</h2>
          <p className="text-xs text-gray-400 mb-4">Responsáveis por pagamentos, NF-e e questões financeiras.</p>
          {renderContatos(contatosFinanceiro, setContatosFinanceiro, 'financeiro')}
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📝 Observações</h2>
          <textarea value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400 min-h-20 resize-none" />
        </div>

        {erro && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl p-3">{erro}</p>}

        <button onClick={salvar} disabled={salvando}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg transition">
          {salvando ? '⏳ Salvando...' : '✅ Salvar Alterações'}
        </button>
      </div>
    </div>
  )
}

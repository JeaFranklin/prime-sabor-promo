/**
 * Helpers de formatação para contratos — datas e valores em PT-BR,
 * por extenso quando útil (cláusulas de valor exigem "tantos reais (...)").
 */

export function dataBR(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function dataExtenso(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const meses = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro',
  ]
  return `${d} de ${meses[m - 1]} de ${y}`
}

export function moeda(v?: number | null): string {
  if (v == null) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Calcula a duração em dias corridos (inclusive). */
export function calcDiasCorridos(inicio: string, fim: string): number {
  const d1 = new Date(inicio + 'T00:00:00')
  const d2 = new Date(fim + 'T00:00:00')
  const ms = d2.getTime() - d1.getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
}

/**
 * Valor por extenso simplificado (centavos arredondados). Suficiente para
 * contratos até R$ 999.999,99 — que cobre nosso caso de uso.
 */
export function valorExtenso(v: number): string {
  const inteiro = Math.floor(v)
  const centavos = Math.round((v - inteiro) * 100)
  const txtInteiro = numeroExtenso(inteiro)
  let s = `${txtInteiro} ${inteiro === 1 ? 'real' : 'reais'}`
  if (centavos > 0) {
    s += ` e ${numeroExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
  }
  return s
}

function numeroExtenso(n: number): string {
  if (n === 0) return 'zero'
  if (n === 100) return 'cem'
  const unidades = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove']
  const dez10 = ['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove']
  const dezenas = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
  const centenas = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos']

  if (n < 10) return unidades[n]
  if (n < 20) return dez10[n - 10]
  if (n < 100) {
    const d = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`
  }
  if (n < 1000) {
    const c = Math.floor(n / 100)
    const resto = n % 100
    return resto === 0 ? centenas[c] : `${centenas[c]} e ${numeroExtenso(resto)}`
  }
  if (n < 1_000_000) {
    const milhares = Math.floor(n / 1000)
    const resto = n % 1000
    const txtMil = milhares === 1 ? 'mil' : `${numeroExtenso(milhares)} mil`
    if (resto === 0) return txtMil
    if (resto < 100) return `${txtMil} e ${numeroExtenso(resto)}`
    return `${txtMil}, ${numeroExtenso(resto)}`
  }
  return String(n) // fallback
}

/** Mascara CPF/CNPJ se vierem só dígitos. */
export function mascaraDoc(doc?: string | null): string {
  if (!doc) return ''
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc
}

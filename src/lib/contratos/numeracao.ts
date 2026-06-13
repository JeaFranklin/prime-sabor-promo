/**
 * Gera o próximo número de contrato no formato CT-YYYY-NNNN.
 * NNNN reinicia a cada ano. Roda server-side com o client de service-role
 * pra contornar RLS quando estiver ativo.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function proximoNumeroContrato(supabase: SupabaseClient): Promise<string> {
  const ano = new Date().getFullYear()
  const prefixo = `CT-${ano}-`

  const { data, error } = await supabase
    .from('contratos')
    .select('numero')
    .like('numero', `${prefixo}%`)
    .order('numero', { ascending: false })
    .limit(1)

  if (error) throw new Error(`Falha ao calcular próximo número de contrato: ${error.message}`)

  let proximo = 1
  if (data && data.length > 0) {
    const ultimoTxt = data[0].numero.slice(prefixo.length)
    const ultimoNum = parseInt(ultimoTxt, 10)
    if (!Number.isNaN(ultimoNum)) proximo = ultimoNum + 1
  }

  return `${prefixo}${String(proximo).padStart(4, '0')}`
}

/** Token aleatório (URL-safe) para o aceite público. ~22 caracteres. */
export function gerarTokenAceite(): string {
  // Usa crypto.randomUUID(), substituindo hífens — suficientemente aleatório.
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

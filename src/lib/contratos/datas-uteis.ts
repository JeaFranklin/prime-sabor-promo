/**
 * Cálculo de datas úteis para pagamentos.
 *
 * Regra atual: pula sábado (6) e domingo (0). Feriados nacionais ficam como
 * TODO — adicionar lib `date-holidays` ou tabela `feriados` no banco depois.
 */

/** Soma N dias corridos a uma data (string ISO 'YYYY-MM-DD'). Devolve outra ISO. */
export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

/** Se a data cair em sábado ou domingo, avança até a próxima segunda. */
export function proximoDiaUtil(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  while (true) {
    const dia = dt.getUTCDay() // 0=domingo, 6=sábado
    if (dia !== 0 && dia !== 6) break
    dt.setUTCDate(dt.getUTCDate() + 1)
  }
  return dt.toISOString().slice(0, 10)
}

/**
 * Pagamento do cliente = data de emissão da NF + prazo (em dias corridos),
 * ajustado pro próximo dia útil se cair em fim de semana.
 */
export function calcularDataPagamentoCliente(
  dataEmissaoNF: string,
  prazoDias: number,
): string {
  return proximoDiaUtil(somarDias(dataEmissaoNF, prazoDias))
}

/**
 * Pagamento da promotora = pagamento do cliente + 5 dias corridos,
 * ajustado pro próximo dia útil.
 */
export function calcularDataPagamentoPromotora(dataPagamentoCliente: string): string {
  return proximoDiaUtil(somarDias(dataPagamentoCliente, 5))
}

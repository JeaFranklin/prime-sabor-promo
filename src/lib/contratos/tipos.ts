/**
 * Tipos compartilhados do módulo de contratos.
 * Estes objetos viram o snapshot JSONB salvo em contratos.conteudo_json
 * — então o PDF pode ser regenerado fielmente no futuro.
 */

export type DadosEmpresa = {
  razao_social: string
  nome_fantasia?: string | null
  cnpj: string
  endereco_completo?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  telefone?: string | null
  email?: string | null
  representante_nome?: string | null
  representante_cpf?: string | null
  representante_cargo?: string | null
  logo_url?: string | null
  foro_cidade?: string | null
  foro_estado?: string | null
}

export type DadosCliente = {
  id: string
  nome_empresa: string
  cnpj?: string | null
  cpf?: string | null
  responsavel_nome?: string | null
  responsavel_cpf?: string | null
  email?: string | null
  telefone?: string | null
  endereco_completo?: string | null
  cidade?: string | null
  estado?: string | null
  logo_url?: string | null
}

export type DadosPromotora = {
  id: string
  nome: string
  cpf?: string | null
  rg?: string | null
  whatsapp?: string | null
  email?: string | null
  endereco_completo?: string | null
  cidade?: string | null
  estado?: string | null
  cnpj_mei?: string | null   // se for MEI, atenua risco trabalhista
  chave_pix?: string | null
}

export type DadosServico = {
  id: string
  nome: string
  descricao?: string | null
  data_inicio: string          // 'YYYY-MM-DD'
  data_fim: string             // 'YYYY-MM-DD'
  horario_inicio?: string | null
  horario_fim?: string | null
  local_completo: string       // endereço onde será prestado
  qtd_dias: number             // calculado
  valor_diaria?: number | null      // diária da promotora
  valor_total_cliente?: number | null // total cobrado do cliente
  briefing?: string | null
  // Forma de pagamento
  tem_sinal?: boolean | null          // se há sinal/entrada antecipada
  sinal_pct?: number | null            // % do sinal (ex: 50)
  prazo_pagamento_dias?: number | null // dias após emissão da NF
  data_emissao_nf?: string | null      // ISO 'YYYY-MM-DD'
  // Datas calculadas no momento da geração do contrato
  data_pagamento_cliente?: string | null    // calculada
  data_pagamento_promotora?: string | null  // calculada
}

export type ConteudoContratoPromotora = {
  numero: string
  empresa: DadosEmpresa
  promotora: DadosPromotora
  servico: DadosServico
  cliente_nome: string         // nome do cliente final aparece no objeto
  valor_total_promotora: number // diária × dias
  gerado_em: string            // ISO
}

export type ConteudoContratoCliente = {
  numero: string
  empresa: DadosEmpresa
  cliente: DadosCliente
  servico: DadosServico
  qtd_promotoras: number
  valor_total: number
  gerado_em: string
}

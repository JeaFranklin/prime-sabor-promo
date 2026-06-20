/**
 * permissoes.ts — Controle de acesso do Bot Viana
 *
 * admin   → Jeã e Kênia: podem ler e escrever (alterar agenda)
 * readonly → Duda: só leitura, comandos de escrita são bloqueados
 *
 * Env var VIANA_ADMINS = lista de números com permissão de escrita (separados por vírgula).
 * VIANA_NUMEROS_AUTORIZADOS = whitelist geral (todos os 3 números).
 */
import 'server-only'

export type PapelUsuario = 'admin' | 'readonly'

export function papelDoNumero(numero: string): PapelUsuario {
  const admins = (process.env.VIANA_ADMINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const variantes = [numero, numero.startsWith('55') ? numero.slice(2) : `55${numero}`]
  return variantes.some((n) => admins.includes(n)) ? 'admin' : 'readonly'
}

export function isAdmin(numero: string): boolean {
  return papelDoNumero(numero) === 'admin'
}

export const MENSAGEM_SEM_PERMISSAO =
  '🔒 Você tem acesso *somente leitura*.\n\nApenas administradores podem alterar a agenda.\n\n— Viana'

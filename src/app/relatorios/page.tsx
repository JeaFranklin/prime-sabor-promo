/**
 * Index do módulo de Relatórios.
 *
 * Mostra 5 cards (um por sub-relatório) com descrição curta + emoji.
 * Cada card linka pra rota correspondente.
 *
 * Server Component — não precisa de fetch, é só navegação.
 */
import Link from 'next/link'

type RelatorioCard = {
  href: string
  emoji: string
  titulo: string
  descricao: string
  tom: string  // classes Tailwind do ícone/borda
}

const RELATORIOS: RelatorioCard[] = [
  {
    href: '/relatorios/financeiro',
    emoji: '💰',
    titulo: 'Financeiro',
    descricao: 'Faturamento, custo com promotoras e margem por período.',
    tom: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/30',
  },
  {
    href: '/relatorios/operacional',
    emoji: '📊',
    titulo: 'Operacional',
    descricao: 'Volume de serviços por status: confirmado, em andamento, concluído.',
    tom: 'border-blue-200 hover:border-blue-400 bg-blue-50/30',
  },
  {
    href: '/relatorios/promotoras',
    emoji: '👩',
    titulo: 'Performance Promotoras',
    descricao: 'Ranking por serviços realizados, valor recebido e avaliação média.',
    tom: 'border-red-200 hover:border-red-400 bg-red-50/30',
  },
  {
    href: '/relatorios/clientes',
    emoji: '🏢',
    titulo: 'Clientes / Tipo de Serviço',
    descricao: 'Top clientes por faturamento e distribuição por tipo de ação.',
    tom: 'border-purple-200 hover:border-purple-400 bg-purple-50/30',
  },
  {
    href: '/relatorios/pendencias',
    emoji: '⚠️',
    titulo: 'Pendências',
    descricao: 'Pagamentos em atraso e confirmações de promotora ainda em aberto.',
    tom: 'border-amber-200 hover:border-amber-400 bg-amber-50/30',
  },
]

export default function RelatoriosHome() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-6 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-white/80 hover:text-white text-sm font-medium">
            ← Início
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">📊 Relatórios</h1>
          <p className="text-white/90 text-sm mt-1">
            Escolha um relatório pra analisar seus dados.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RELATORIOS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className={`block bg-white border-2 ${r.tom} rounded-2xl p-5 shadow-sm hover:shadow-md transition`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-gray-800 text-lg">{r.titulo}</h2>
                  <p className="text-sm text-gray-600 mt-1">{r.descricao}</p>
                </div>
                <div className="text-gray-300 text-2xl">→</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          💡 <strong>Dica:</strong> em cada relatório você pode filtrar por período e baixar
          uma versão em PDF pra mandar pro contador, sócio ou cliente.
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-4">⭐</div>
        <h1 className="text-2xl font-black text-red-600 mb-1">GustPro</h1>
        <p className="text-gray-500 text-sm mb-8">Sistema de Gestão de Promotoras</p>

        <div className="space-y-3">
          <Link href="/promotoras" className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition">
            👩 Promotoras
          </Link>
          <Link href="/servicos" className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition">
            📋 Serviços
          </Link>
          <Link href="/clientes" className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition">
            🏢 Clientes
          </Link>
          <Link href="/contratos" className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl transition">
            📄 Contratos
          </Link>
          <Link href="/relatorios" className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition">
            📊 Relatórios
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">NERESCO Consultoria © 2026</p>
      </div>
    </div>
  )
}

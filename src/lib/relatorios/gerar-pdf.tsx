/**
 * Gera o PDF de cada relatório usando @react-pdf/renderer.
 *
 * Server-only. Chamado da API route /api/relatorios/[tipo]/pdf.
 *
 * Estrutura comum a todos os 5 relatórios:
 *   1) Header (logo JFS + título + período)
 *   2) Cards de KPI (texto simples)
 *   3) Tabela detalhada
 *   4) Rodapé (timestamp + nº de páginas)
 *
 * Caveat documentado no plano: gráficos NÃO entram no PDF (Recharts é SVG/DOM,
 * difícil portar pra react-pdf). Quem quer gráfico vê na tela.
 */
import 'server-only'
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import { moeda, dataBR } from '@/lib/contratos/formatar'
import type {
  PeriodoFiltro, TipoRelatorio,
  ResultadoFinanceiro, ResultadoOperacional,
  ResultadoPromotoras, ResultadoClientes, ResultadoPendencias,
} from './tipos'
import { STATUS_SERVICO_LABEL } from './tipos'

// ──────────────────────────────────────────────────────────────
// Estilos compartilhados
// ──────────────────────────────────────────────────────────────
const COR_PRIMARIA = '#1d4ed8'  // blue-700
const COR_TEXTO = '#1f2937'     // gray-800
const COR_CINZA = '#6b7280'     // gray-500
const COR_CINZA_CLARO = '#f3f4f6'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: COR_TEXTO, fontFamily: 'Helvetica' },
  header: { borderBottom: `2pt solid ${COR_PRIMARIA}`, paddingBottom: 8, marginBottom: 14 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: COR_PRIMARIA },
  subtitulo: { fontSize: 10, color: COR_CINZA, marginTop: 3 },
  secaoTitulo: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 6, color: COR_PRIMARIA },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  card: { flex: 1, minWidth: '23%', padding: 8, backgroundColor: COR_CINZA_CLARO, borderRadius: 4 },
  cardLabel: { fontSize: 7, color: COR_CINZA, textTransform: 'uppercase', marginBottom: 2 },
  cardValor: { fontSize: 12, fontWeight: 'bold', color: COR_TEXTO },
  tabela: { borderTop: `0.5pt solid ${COR_CINZA}`, borderLeft: `0.5pt solid ${COR_CINZA}`, marginTop: 4 },
  thead: { flexDirection: 'row', backgroundColor: COR_PRIMARIA, color: 'white' },
  th: { padding: 4, fontSize: 8, fontWeight: 'bold', borderRight: '0.5pt solid white' },
  tr: { flexDirection: 'row', borderBottom: `0.5pt solid ${COR_CINZA}` },
  tdAlt: { backgroundColor: '#fafafa' },
  td: { padding: 4, fontSize: 8, borderRight: `0.5pt solid ${COR_CINZA}` },
  rodape: {
    position: 'absolute', bottom: 24, left: 36, right: 36,
    fontSize: 7, color: COR_CINZA, textAlign: 'center',
    borderTop: `0.5pt solid ${COR_CINZA}`, paddingTop: 6,
  },
})

// ──────────────────────────────────────────────────────────────
// Componentes auxiliares
// ──────────────────────────────────────────────────────────────
type KPI = { label: string; valor: string }

type Coluna = { header: string; width: string; align?: 'left' | 'right' | 'center' }

function HeaderPdf({ titulo, periodo }: { titulo: string; periodo: PeriodoFiltro }) {
  return (
    <View style={styles.header}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.subtitulo}>
        Período: {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}
        {'  ·  '}Gerado em: {dataBR(new Date().toISOString().slice(0, 10))}
      </Text>
    </View>
  )
}

function Cards({ kpis }: { kpis: KPI[] }) {
  return (
    <View style={styles.cardsRow}>
      {kpis.map((k, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardLabel}>{k.label}</Text>
          <Text style={styles.cardValor}>{k.valor}</Text>
        </View>
      ))}
    </View>
  )
}

function Tabela({ colunas, linhas }: { colunas: Coluna[]; linhas: string[][] }) {
  return (
    <View style={styles.tabela}>
      <View style={styles.thead}>
        {colunas.map((c, i) => (
          <Text key={i} style={[styles.th, { width: c.width, textAlign: c.align ?? 'left' }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {linhas.map((linha, i) => (
        <View key={i} style={[styles.tr, ...(i % 2 === 1 ? [styles.tdAlt] : [])]} wrap={false}>
          {linha.map((celula, j) => (
            <Text key={j} style={[styles.td, { width: colunas[j].width, textAlign: colunas[j].align ?? 'left' }]}>
              {celula}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function Rodape() {
  return (
    <Text
      style={styles.rodape}
      render={({ pageNumber, totalPages }) =>
        `JFS Consultoria — Página ${pageNumber} de ${totalPages}`
      }
      fixed
    />
  )
}

// ──────────────────────────────────────────────────────────────
// Templates por tipo
// ──────────────────────────────────────────────────────────────

function PdfFinanceiro({ r, periodo }: { r: ResultadoFinanceiro; periodo: PeriodoFiltro }) {
  const kpis: KPI[] = [
    { label: 'Receita', valor: moeda(r.cards.receita_total) },
    { label: 'Custo', valor: moeda(r.cards.custo_total) },
    { label: 'Margem', valor: moeda(r.cards.margem_total) },
    { label: 'Margem %', valor: `${r.cards.margem_pct.toFixed(1)}%` },
    { label: 'Serviços', valor: String(r.cards.qtd_servicos) },
  ]
  const colunas: Coluna[] = [
    { header: 'Serviço', width: '24%' },
    { header: 'Cliente', width: '18%' },
    { header: 'Período', width: '18%' },
    { header: 'Receita', width: '12%', align: 'right' },
    { header: 'Custo', width: '12%', align: 'right' },
    { header: 'Margem', width: '12%', align: 'right' },
    { header: '%', width: '4%', align: 'right' },
  ]
  const linhas = r.linhas.map(l => [
    l.servico_nome, l.cliente_nome,
    `${dataBR(l.data_inicio)}—${dataBR(l.data_fim)}`,
    moeda(l.receita), moeda(l.custo), moeda(l.margem),
    `${l.margem_pct.toFixed(0)}%`,
  ])

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <HeaderPdf titulo="Relatório Financeiro" periodo={periodo} />
        <Cards kpis={kpis} />
        <Text style={styles.secaoTitulo}>Detalhamento por serviço</Text>
        <Tabela colunas={colunas} linhas={linhas} />
        <Rodape />
      </Page>
    </Document>
  )
}

function PdfOperacional({ r, periodo }: { r: ResultadoOperacional; periodo: PeriodoFiltro }) {
  const kpis: KPI[] = [
    { label: 'Total', valor: String(r.cards.total) },
    { label: 'Confirmado', valor: String(r.cards.confirmado) },
    { label: 'Em andamento', valor: String(r.cards.em_andamento) },
    { label: 'Concluídos', valor: String(r.cards.concluido) },
    { label: 'Cancelados', valor: String(r.cards.cancelado) },
  ]
  const colunas: Coluna[] = [
    { header: 'Serviço', width: '30%' },
    { header: 'Cliente', width: '22%' },
    { header: 'Período', width: '22%' },
    { header: 'Promotoras', width: '13%', align: 'center' },
    { header: 'Status', width: '13%' },
  ]
  const linhas = r.linhas.map(l => [
    l.servico_nome, l.cliente_nome,
    `${dataBR(l.data_inicio)}—${dataBR(l.data_fim)}`,
    String(l.num_promotoras),
    STATUS_SERVICO_LABEL[l.status] ?? l.status,
  ])

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <HeaderPdf titulo="Relatório Operacional" periodo={periodo} />
        <Cards kpis={kpis} />
        <Text style={styles.secaoTitulo}>Distribuição por status</Text>
        <Tabela
          colunas={[{ header: 'Status', width: '50%' }, { header: 'Quantidade', width: '50%', align: 'right' }]}
          linhas={r.distribuicao.map(d => [d.status_label, String(d.qtd)])}
        />
        <Text style={styles.secaoTitulo}>Serviços</Text>
        <Tabela colunas={colunas} linhas={linhas} />
        <Rodape />
      </Page>
    </Document>
  )
}

function PdfPromotoras({ r, periodo }: { r: ResultadoPromotoras; periodo: PeriodoFiltro }) {
  const kpis: KPI[] = [
    { label: 'Ativas', valor: String(r.cards.total_promotoras_ativas) },
    { label: 'Escalas no período', valor: String(r.cards.qtd_servicos_periodo) },
    { label: 'Total pago', valor: moeda(r.cards.total_pago) },
    { label: 'Avaliação média', valor: r.cards.avaliacao_media_geral ? r.cards.avaliacao_media_geral.toFixed(1) : '—' },
  ]
  const colunas: Coluna[] = [
    { header: '#', width: '5%', align: 'right' },
    { header: 'Promotora', width: '45%' },
    { header: 'Serviços', width: '15%', align: 'center' },
    { header: 'Recebido', width: '20%', align: 'right' },
    { header: 'Avaliação', width: '15%', align: 'center' },
  ]
  const linhas = r.linhas.map((l, i) => [
    String(i + 1), l.promotora_nome, String(l.qtd_servicos),
    moeda(l.total_recebido),
    l.avaliacao_media ? `${l.avaliacao_media.toFixed(1)} *` : '—',
  ])

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <HeaderPdf titulo="Performance Promotoras" periodo={periodo} />
        <Cards kpis={kpis} />
        <Text style={styles.secaoTitulo}>Ranking</Text>
        <Tabela colunas={colunas} linhas={linhas} />
        <Rodape />
      </Page>
    </Document>
  )
}

function PdfClientes({ r, periodo }: { r: ResultadoClientes; periodo: PeriodoFiltro }) {
  const kpis: KPI[] = [
    { label: 'Clientes', valor: String(r.cards.qtd_clientes_ativos) },
    { label: 'Faturamento', valor: moeda(r.cards.faturamento_total) },
    { label: 'Ticket médio', valor: moeda(r.cards.ticket_medio_geral) },
  ]
  const colClientes: Coluna[] = [
    { header: '#', width: '5%', align: 'right' },
    { header: 'Cliente', width: '50%' },
    { header: 'Serviços', width: '15%', align: 'center' },
    { header: 'Faturamento', width: '15%', align: 'right' },
    { header: 'Ticket médio', width: '15%', align: 'right' },
  ]
  const linhasClientes = r.top_clientes.map((c, i) => [
    String(i + 1), c.cliente_nome, String(c.qtd_servicos),
    moeda(c.faturamento), moeda(c.ticket_medio),
  ])

  const colTipo: Coluna[] = [
    { header: 'Tipo de ação', width: '40%' },
    { header: 'Qtd serviços', width: '25%', align: 'center' },
    { header: 'Faturamento', width: '35%', align: 'right' },
  ]
  const linhasTipo = r.por_tipo_acao.map(t => [t.tipo_acao, String(t.qtd), moeda(t.faturamento)])

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <HeaderPdf titulo="Clientes e Tipo de Serviço" periodo={periodo} />
        <Cards kpis={kpis} />
        <Text style={styles.secaoTitulo}>Top clientes</Text>
        <Tabela colunas={colClientes} linhas={linhasClientes} />
        <Text style={styles.secaoTitulo}>Por tipo de serviço</Text>
        <Tabela colunas={colTipo} linhas={linhasTipo} />
        <Rodape />
      </Page>
    </Document>
  )
}

function PdfPendencias({ r, periodo }: { r: ResultadoPendencias; periodo: PeriodoFiltro }) {
  const kpis: KPI[] = [
    { label: 'Total pendências', valor: String(r.cards.total_pendencias) },
    { label: 'Pgto atrasados', valor: String(r.cards.pagamentos_atrasados) },
    { label: 'Confirmações', valor: String(r.cards.confirmacoes_pendentes) },
    { label: 'R$ em atraso', valor: moeda(r.cards.valor_em_atraso) },
  ]
  const colunas: Coluna[] = [
    { header: 'Tipo', width: '12%' },
    { header: 'Serviço', width: '24%' },
    { header: 'Cliente', width: '18%' },
    { header: 'Período', width: '18%' },
    { header: 'Detalhe', width: '18%' },
    { header: 'Valor', width: '10%', align: 'right' },
  ]
  const linhas = r.linhas.map(p => [
    p.problema === 'pagamento_pendente' ? 'Pagamento' : 'Confirmação',
    p.servico_nome, p.cliente_nome,
    `${dataBR(p.data_inicio)}—${dataBR(p.data_fim)}`,
    p.detalhe,
    p.valor != null ? moeda(p.valor) : '—',
  ])

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <HeaderPdf titulo="Relatório de Pendências" periodo={periodo} />
        <Cards kpis={kpis} />
        <Text style={styles.secaoTitulo}>Lista de ações</Text>
        <Tabela colunas={colunas} linhas={linhas} />
        <Rodape />
      </Page>
    </Document>
  )
}

// ──────────────────────────────────────────────────────────────
// Dispatcher: gera o PDF apropriado e devolve buffer
// ──────────────────────────────────────────────────────────────
export async function gerarPdfRelatorio(
  tipo: TipoRelatorio,
  periodo: PeriodoFiltro,
  resultado: ResultadoFinanceiro | ResultadoOperacional | ResultadoPromotoras | ResultadoClientes | ResultadoPendencias,
): Promise<Buffer> {
  let doc
  switch (tipo) {
    case 'financeiro':
      doc = <PdfFinanceiro r={resultado as ResultadoFinanceiro} periodo={periodo} />
      break
    case 'operacional':
      doc = <PdfOperacional r={resultado as ResultadoOperacional} periodo={periodo} />
      break
    case 'promotoras':
      doc = <PdfPromotoras r={resultado as ResultadoPromotoras} periodo={periodo} />
      break
    case 'clientes':
      doc = <PdfClientes r={resultado as ResultadoClientes} periodo={periodo} />
      break
    case 'pendencias':
      doc = <PdfPendencias r={resultado as ResultadoPendencias} periodo={periodo} />
      break
    default:
      throw new Error(`Tipo de relatório desconhecido: ${tipo}`)
  }
  return renderToBuffer(doc)
}
